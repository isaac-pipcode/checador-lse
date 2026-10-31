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

import { processarQuadro } from '../src/libras/tratamento';
import { JANELA_PADRAO } from '../src/libras/tipos';

describe.skipIf(!pronto)('tratamento da prévia = cadeia do ffmpeg na entrega', () => {
  it('alfa e cor coincidem num quadro real, com todos os controles ativos', () => {
    const [w, h] = [320, 360];
    const chroma = { ...JANELA_PADRAO.chroma, encolher: 1, suavizarBorda: 1, bordas: { esq: 0.05, dir: 0.05, topo: 0.03, base: 0 } };
    const cor = { brilho: 0.04, contraste: 1.1, saturacao: 1.15 };
    const cadeia = [
      'crop=320:360:160:0', 'format=yuva444p', 'chromakey=0x00B140:0.120:0.080',
      'erosion=threshold0=0:threshold1=0:threshold2=0', 'gblur=sigma=1.00:planes=8',
      'eq=brightness=0.040:contrast=1.100:saturation=1.150', 'format=gbrap', 'despill=type=green:mix=0.500:expand=0.000',
      'format=yuva444p', 'crop=288:349:16:11', 'pad=320:360:16:11:color=black@0', 'format=rgba',
    ].join(',');
    const fonte = execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', '3', '-i', CLIPE, '-frames:v', '1', '-vf', 'crop=320:360:160:0,format=rgba', '-f', 'rawvideo', '-']);
    const ref = execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', '3', '-i', CLIPE, '-frames:v', '1', '-vf', cadeia, '-f', 'rawvideo', '-']);
    const nosso = new Uint8ClampedArray(fonte);
    processarQuadro(nosso, w, h, { chroma, cor });

    let alfaIgual = 0;
    let difCor = 0;
    let opacos = 0;
    for (let i = 0; i < w * h; i++) {
      if ((nosso[4 * i + 3] > 127) === (ref[4 * i + 3] > 127)) alfaIgual++;
      if (nosso[4 * i + 3] > 240 && ref[4 * i + 3] > 240) {
        opacos++;
        for (let c = 0; c < 3; c++) difCor += Math.abs(nosso[4 * i + c] - ref[4 * i + c]);
      }
    }
    expect(alfaIgual / (w * h)).toBeGreaterThan(0.97);
    expect(opacos).toBeGreaterThan(5000);
    // diferença média de cor por canal (0–255) nas áreas opacas: conversões YUV/RGB diferentes
    expect(difCor / (opacos * 3)).toBeLessThan(8);
  });
});

import { mkdtempSync } from 'node:fs';
import { join as juntar } from 'node:path';
import { tmpdir } from 'node:os';
import { analisarSincronia } from '../src/libras/sincronia';

describe.skipIf(!pronto)('sincronia com conversão de cadência em mídia real (ffmpeg)', () => {
  it('som-guia acelerado 4,27% (23,976 → 25 qd/s), começando 1,5 s depois: identifica a razão', async () => {
    const d = mkdtempSync(juntar(tmpdir(), 'cadencia-'));
    const guia = juntar(d, 'guia.wav');
    const v = 25 / (24000 / 1001);
    // tObra = 1,5 s + tClipe × v  →  o som-guia é a obra a partir de 1,5 s, tocada v vezes mais rápido
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.5', '-i', OBRA, '-vn', '-af', `atempo=${v.toFixed(6)}`, guia]);
    const r = analisarSincronia(await envelope(OBRA), await envelope(guia), 10);
    expect(r.razaoCadencia.rotulo).toBe('25 ↔ 23,976 qd/s');
    expect(Math.abs(r.velocidade - v)).toBeLessThan(0.001);
    expect(Math.abs(r.inicioNaObraMs - 1500)).toBeLessThanOrEqual(40);
  }, 60000);
});
