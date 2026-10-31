import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { decodificarStream } from './ffmpeg';
import { AcumuladorEnvelope } from '../src/mapa/sinal';
import { estimarInicio } from '../src/libras/sincronia';

const OBRA = 'exemplos/exemplo-estudio.webm';
const CLIPE = 'exemplos/exemplo-interprete.webm';
const pronto = spawnSync('ffmpeg', ['-version']).status === 0 && existsSync(OBRA) && existsSync(CLIPE);

/** Mesmo caminho do app: ffmpeg → 16 kHz mono, banda de voz → envelope de 10 ms. */
async function envelope(arq: string) {
  const a = new AcumuladorEnvelope(16000, 10);
  await decodificarStream(arq, 1, 16000, 'highpass=f=150,lowpass=f=4000', (x) => a.adicionar(x));
  return a.concluir();
}

describe.skipIf(!pronto)('sincronização com os arquivos de exemplo (ffmpeg)', () => {
  // O clipe do intérprete usa como som-guia o áudio da obra a partir de 2 s.
  // Regressão: antes da correlação de Pearson com sobreposição mínima, a busca
  // achava −25 s (sobreposição de ~20 amostras com correlação espúria de 1,0).
  it('encontra +2,0 s (± 1 janela) com confiança alta', async () => {
    const r = estimarInicio(await envelope(OBRA), await envelope(CLIPE), 10);
    expect(Math.abs(r.inicioNaObraMs - 2000)).toBeLessThanOrEqual(10);
    expect(r.correlacao).toBeGreaterThan(0.95);
    expect(r.confianca).toBeGreaterThan(0.8);
  }, 30000);
});

import { execFileSync } from 'node:child_process';
import { alfaChroma, uvDaCor } from '../src/libras/chroma';

describe.skipIf(!pronto)('chroma da prévia = chromakey do ffmpeg', () => {
  it('alfa por pixel coincide com o do ffmpeg num quadro do clipe de exemplo', () => {
    const [w, h] = [64, 36];
    const args = (filtro: string, fmt: string) => ['-loglevel', 'error', '-ss', '3', '-i', CLIPE, '-frames:v', '1', '-vf', `scale=${w}:${h}${filtro},format=${fmt}`, '-f', 'rawvideo', '-'];
    const rgb = execFileSync('ffmpeg', args('', 'rgb24'));
    const alfa = execFileSync('ffmpeg', args(',chromakey=0x00B140:0.12:0.08', 'rgba'));
    const chave = uvDaCor('#00B140');
    let iguais = 0;
    for (let i = 0; i < w * h; i++) {
      const nosso = alfaChroma(rgb[3 * i], rgb[3 * i + 1], rgb[3 * i + 2], chave, 0.12, 0.08) > 0.5;
      const deles = alfa[4 * i + 3] > 127;
      if (nosso === deles) iguais++;
    }
    // a diferença fica nas bordas (média 3×3 do ffmpeg) e no arredondamento de cor
    expect(iguais / (w * h)).toBeGreaterThan(0.97);
  });
});
