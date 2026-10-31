import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { filtroLibras, renderizarEntrega } from './entrega';
import { JANELA_PADRAO } from '../src/libras/tipos';
import { clipesDosBlocos, curvaDeDucking } from '../src/ad/mixagem';
import { PARAMETROS_AD_PADRAO, type BlocoAD } from '../src/ad/tipos';

const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

describe('filtro da janela de Libras', () => {
  it('clipe que começa depois da obra: desloca o tempo; antes: corta o início', () => {
    const base = { quadro: { w: 1920, h: 1080 }, fonte: { w: 1920, h: 1080 }, janela: JANELA_PADRAO, entrada: 1 };
    const depois = filtroLibras({ ...base, inicioNaObraMs: 1500 }).filtro;
    expect(depois).toContain('setpts=PTS-STARTPTS+1.500/TB');
    expect(depois).toContain('chromakey=0x00B140:0.120:0.080');
    expect(depois).toContain('overlay=1418:518:eof_action=pass');
    const antes = filtroLibras({ ...base, inicioNaObraMs: -2000 }).filtro;
    expect(antes).toContain('trim=start=2.000,setpts=PTS-STARTPTS');
  });

  it('fundo sólido atrás do intérprete', () => {
    const f = filtroLibras({
      quadro: { w: 1280, h: 720 }, fonte: { w: 1280, h: 720 }, entrada: 1, inicioNaObraMs: 0,
      janela: { ...JANELA_PADRAO, fundo: 'solido', corFundo: '#1B2230' },
    }).filtro;
    expect(f).toMatch(/color=c=0x1B2230:s=320x360\[libf\]/);
  });
});

describe.skipIf(!temFfmpeg)('pacote de entrega (ffmpeg)', () => {
  it('um MP4 com janela de Libras, faixas Original e AD e LSE selecionável', async () => {
    const d = mkdtempSync(join(tmpdir(), 'entrega-'));
    const obra = join(d, 'obra.mp4');
    const clipe = join(d, 'clipe.mp4');
    const voz = join(d, 'voz.wav');
    const f = (args: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
    f(['-f', 'lavfi', '-i', 'color=c=gray:s=640x360:r=24:d=6', '-f', 'lavfi', '-i', 'sine=f=220:d=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', obra]);
    f(['-f', 'lavfi', '-i', 'color=c=0x00B140:s=640x360:r=24:d=3', '-vf', 'drawbox=x=270:y=60:w=100:h=240:color=red:t=fill', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipe]);
    f(['-f', 'lavfi', '-i', 'sine=f=880:sample_rate=48000:d=1', voz]);

    const blocos: BlocoAD[] = [{
      id: 'b', inicioMs: 3500, fimMs: 5000, texto: 'x', nota: '', aprovado: true, takeAtivoId: 't',
      takes: [{ id: 't', arquivo: null, duracaoMs: 1000, trimInicioMs: 0, trimFimMs: 1000, posicaoMs: 3800, ganhoDb: 0, gravadoEm: '' }],
    }];
    const clipes = clipesDosBlocos(blocos, PARAMETROS_AD_PADRAO);
    const rel = await renderizarEntrega(
      {
        videoCaminho: obra, nomeBase: 'obra', duracaoMs: 6000,
        libras: { caminho: clipe, inicioNaObraMs: 2000, janela: JANELA_PADRAO },
        ad: { clipes, curva: curvaDeDucking(clipes, PARAMETROS_AD_PADRAO), takes: [{ id: 't', bytes: readFileSync(voz) }] },
        legendaSrt: '1\n00:00:01,000 --> 00:00:02,500\n[ANA] Olá.\n',
      },
      d,
      () => {},
    );

    expect(rel.arquivo.endsWith('obra-acessivel.mp4')).toBe(true);
    expect(Math.abs(rel.duracaoMs - 6000)).toBeLessThan(150);
    expect(rel.faixas.audios).toEqual(['Original', 'Audiodescrição']);
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name:stream_tags=handler_name', '-of', 'csv=p=0', rel.arquivo]).toString().trim().split('\n');
    expect(probe).toEqual(['h264,video,VideoHandler', 'aac,audio,Original', 'aac,audio,Audiodescrição', 'mov_text,subtitle,LSE']);

    // janela de 1/2 × 1/4 no canto inferior direito: x 466–626, y 173–353 num quadro 640×360
    const px = (t: number, x: number, y: number) =>
      [...execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(t), '-i', rel.arquivo, '-frames:v', '1', '-vf', `crop=2:2:${x}:${y},format=rgb24`, '-f', 'rawvideo', '-']).subarray(0, 3)];
    const vermelho = (c: number[]) => c[0] > 180 && c[1] < 80 && c[2] < 80;
    const cinza = (c: number[]) => Math.abs(c[0] - 128) < 20 && Math.abs(c[1] - 128) < 20;
    expect(cinza(px(1, 546, 270))).toBe(true); // antes do clipe: imagem intacta
    expect(vermelho(px(3, 546, 270))).toBe(true); // intérprete
    expect(cinza(px(3, 470, 180))).toBe(true); // verde removido: aparece a obra
    expect(cinza(px(5.6, 546, 270))).toBe(true); // depois do clipe
  }, 60000);
});
