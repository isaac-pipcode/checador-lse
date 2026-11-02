import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderizar, TAXA } from './render';
import { clipesDosBlocos, curvaDeDucking } from '../src/ad/mixagem';
import { PARAMETROS_AD_PADRAO, type BlocoAD } from '../src/ad/tipos';

const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

/** Lê WAV PCM 24 bits estéreo e devolve o RMS do canal esquerdo em [a, b) segundos. */
function rms(wav: Buffer, a: number, b: number): number {
  const dados = wav.subarray(44);
  let s = 0;
  let n = 0;
  for (let q = Math.round(a * TAXA); q < Math.round(b * TAXA); q++) {
    const v = dados.readIntLE(q * 6, 3) / 8388607;
    s += v * v;
    n++;
  }
  return Math.sqrt(s / n);
}

describe.skipIf(!temFfmpeg)('renderização da mixagem (ffmpeg)', () => {
  it('abaixa o original sob a AD, posiciona a voz e gera vídeo com faixa extra', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'render-teste-'));
    const video = join(pasta, 'v.webm');
    const voz = join(pasta, 'voz.wav');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=24:d=6', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=6', '-c:v', 'libvpx', '-c:a', 'libopus', video]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=1', voz]);

    const p = { ...PARAMETROS_AD_PADRAO, duckingDb: -12, ataqueMs: 200, liberacaoMs: 200 };
    const blocos: BlocoAD[] = [
      {
        id: 'b', inicioMs: 2000, fimMs: 4000, texto: 'teste', nota: '', takeAtivoId: 't',
        takes: [{ id: 't', arquivo: null, duracaoMs: 1000, trimInicioMs: 0, trimFimMs: 1000, posicaoMs: 2500, ganhoDb: 0, gravadoEm: '' }],
      },
    ];
    const clipes = clipesDosBlocos(blocos, p);
    const rel = await renderizar(
      {
        videoCaminho: video, nomeBase: 'teste', duracaoMs: 6000, clipes, curva: curvaDeDucking(clipes, p),
        takes: [{ id: 't', bytes: readFileSync(voz) }],
        saidas: { mixagem: true, trilhaAd: true, video: true },
      },
      pasta,
      () => {},
    );

    expect(rel.originalTemAudio).toBe(true);
    expect(rel.arquivos.map((a) => a.split('/').pop())).toEqual(['teste-mixagem-ad.wav', 'teste-com-ad.mkv', 'teste-trilha-ad.wav']);
    expect(rel.loudness?.integradoLufs).not.toBeNull();

    const stem = readFileSync(join(pasta, 'teste-trilha-ad.wav'));
    expect(rms(stem, 0.5, 2.0)).toBeLessThan(1e-4); // silêncio antes da voz
    // seno do ffmpeg: amplitude 1/8 → RMS 0,088; × pan −3 dB ≈ 0,0625
    expect(rms(stem, 2.6, 3.4)).toBeCloseTo(0.0625, 2); // voz no lugar

    const mix = readFileSync(join(pasta, 'teste-mixagem-ad.wav'));
    // diferença do original sob a AD: só o stem não basta; compara mix − voz
    const fora = rms(mix, 0.5, 2.0);
    const dentroMix = rms(mix, 2.6, 3.4);
    const dentroStem = rms(stem, 2.6, 3.4);
    const dentroOriginal = Math.sqrt(Math.max(0, dentroMix ** 2 - dentroStem ** 2)); // sinais em frequências distintas ≈ ortogonais
    const atenuacaoDb = 20 * Math.log10(dentroOriginal / fora);
    expect(atenuacaoDb).toBeLessThan(-10);
    expect(atenuacaoDb).toBeGreaterThan(-14);

    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type:stream_tags=title', '-of', 'csv=p=0', join(pasta, 'teste-com-ad.mkv')]).stdout.toString();
    expect(probe).toMatch(/audio,Audiodescrição/);
  }, 30000);
});
