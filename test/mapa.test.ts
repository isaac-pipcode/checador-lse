import { describe, expect, it } from 'vitest';
import { complemento, detectarAtividade, envelopeRmsDb, sobreposicaoMs } from '../src/mapa/sinal';
import { candidatosACorte, distancia, histogramaRgb, refinarCorte } from '../src/mapa/cortes';
import { ehLegendaDeFala, lacunasParaAd } from '../src/mapa/lacunas';
import { PARAMETROS_ATIVIDADE_PADRAO, type MapaTemporal } from '../src/mapa/tipos';
import { analisar } from '../src/rules';
import { config, cuesDe, daRegra } from './auxiliares';

const TAXA = 16000;
const JANELA = 10;

/** Sinal sintético: ruído de fundo baixo + "falas" (senoides) nos intervalos dados. */
function sinal(duracaoMs: number, falas: Array<[number, number]>): Float32Array {
  const n = Math.round((duracaoMs / 1000) * TAXA);
  const out = new Float32Array(n);
  let semente = 1;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < n; i++) out[i] = aleatorio() * 0.002;
  for (const [a, b] of falas) {
    for (let i = Math.round((a / 1000) * TAXA); i < Math.round((b / 1000) * TAXA); i++) {
      out[i] += 0.3 * Math.sin((2 * Math.PI * 440 * i) / TAXA);
    }
  }
  return out;
}

function mapaDe(duracaoMs: number, falas: Array<[number, number]>, extra: Partial<MapaTemporal> = {}): MapaTemporal {
  const envelopeDb = envelopeRmsDb(sinal(duracaoMs, falas), TAXA, JANELA);
  const { atividade, pisoDb } = detectarAtividade(envelopeDb, JANELA, PARAMETROS_ATIVIDADE_PADRAO);
  return {
    arquivoVideo: 'teste.webm',
    duracaoMs,
    audio: true,
    janelaMs: JANELA,
    envelopeDb,
    pisoDb,
    parametros: PARAMETROS_ATIVIDADE_PADRAO,
    atividade,
    cortes: [],
    statusCortes: { tipo: 'nao_detectado' },
    ...extra,
  };
}

function rodarComMapa(srt: string, mapa: MapaTemporal) {
  const cfg = config({ nlpAtivo: false });
  const { cues } = cuesDe(srt);
  return analisar(cues, cfg, { nlp: null, mapa });
}

describe('detecção de atividade sonora', () => {
  it('encontra os segmentos com tolerância de uma janela', () => {
    const m = mapaDe(10000, [
      [1000, 3000],
      [6000, 6800],
    ]);
    expect(m.atividade).toHaveLength(2);
    expect(Math.abs(m.atividade[0].inicioMs - 1000)).toBeLessThanOrEqual(JANELA);
    expect(Math.abs(m.atividade[0].fimMs - 3000)).toBeLessThanOrEqual(JANELA);
    expect(Math.abs(m.atividade[1].inicioMs - 6000)).toBeLessThanOrEqual(JANELA);
  });

  it('funde pausas curtas e descarta estalos', () => {
    const m = mapaDe(6000, [
      [1000, 1800],
      [1950, 2800], // pausa de 150 ms < fusão de 300 ms
      [4000, 4050], // 50 ms < duração mínima de 150 ms
    ]);
    expect(m.atividade).toHaveLength(1);
    expect(m.atividade[0].fimMs).toBeGreaterThan(2700);
  });

  it('complemento e sobreposição', () => {
    const ints = [
      { inicioMs: 100, fimMs: 200 },
      { inicioMs: 500, fimMs: 900 },
    ];
    expect(complemento(ints, 1000)).toEqual([
      { inicioMs: 0, fimMs: 100 },
      { inicioMs: 200, fimMs: 500 },
      { inicioMs: 900, fimMs: 1000 },
    ]);
    expect(sobreposicaoMs({ inicioMs: 150, fimMs: 600 }, ints)).toBe(150);
  });
});

describe('cortes de plano', () => {
  const cor = (r: number, g: number, b: number) => {
    const px = new Uint8ClampedArray(64 * 36 * 4);
    for (let i = 0; i < px.length; i += 4) [px[i], px[i + 1], px[i + 2], px[i + 3]] = [r, g, b, 255];
    return histogramaRgb(px);
  };

  it('distância é 0 para quadros iguais e 1 para cores disjuntas', () => {
    expect(distancia(cor(10, 10, 10), cor(10, 10, 10))).toBe(0);
    expect(distancia(cor(0, 0, 0), cor(255, 255, 255))).toBeCloseTo(1);
  });

  it('candidatos ignoram trechos de movimento contínuo', () => {
    const diffs = [0.02, 0.03, 0.9, 0.02, 0.3, 0.32, 0.31, 0.33, 0.3, 0.32, 0.31, 0.02];
    expect(candidatosACorte(diffs)).toEqual([2]);
  });

  it('bisseção localiza o corte a ~1 quadro', async () => {
    const a = cor(200, 30, 30);
    const b = cor(30, 30, 200);
    const corte = await refinarCorte(1000, 1500, async (ms) => (ms < 1234 ? a : b), 1000 / 24);
    expect(Math.abs(corte.ms - 1234)).toBeLessThanOrEqual(42);
    expect(corte.intensidade).toBeGreaterThan(0.5);
  });
});

describe('lacunas para audiodescrição', () => {
  it('legendas só de efeito não fecham lacuna', () => {
    expect(ehLegendaDeFala({ lines: ['[PORTA BATE]'] })).toBe(false);
    expect(ehLegendaDeFala({ lines: ['♪ música suave ♪'] })).toBe(true); // há texto fora das notas
    expect(ehLegendaDeFala({ lines: ['♪ ♪'] })).toBe(false);
    expect(ehLegendaDeFala({ lines: ['[JOÃO] Oi.'] })).toBe(true);

    const { cues } = cuesDe(`1
00:00:01,000 --> 00:00:03,000
Bom dia.

2
00:00:06,000 --> 00:00:07,500
[PORTA BATE]

3
00:00:12,000 --> 00:00:14,000
Quem é?`);
    const lac = lacunasParaAd(cues, 20000, 3000, null);
    expect(lac.map((l) => [l.inicioMs, l.fimMs])).toEqual([
      [3200, 11800],
      [14200, 20000],
    ]);
    expect(lac[0].efeitos).toEqual([2]);
  });
});

describe('regras M (com mapa temporal)', () => {
  it('sem mapa, não executam', () => {
    const { cues } = cuesDe(`1
00:00:01,000 --> 00:00:03,000
Olá.`);
    const s = analisar(cues, config(), { nlp: null });
    expect(s.filter((x) => x.ruleId.startsWith('M'))).toHaveLength(0);
  });

  it('M1 propõe entrada no início do som quando a legenda está atrasada', () => {
    const mapa = mapaDe(8000, [[2000, 4000]]);
    const s = daRegra(
      rodarComMapa(
        `1
00:00:02,600 --> 00:00:04,500
Atrasada.`,
        mapa,
      ),
      'M1',
    );
    expect(s).toHaveLength(1);
    expect(s[0].verifiability).toBe('sinal');
    expect(s[0].confidence).toBeLessThan(1);
    expect(Math.abs((s[0].after?.startMs ?? 0) - 2000)).toBeLessThanOrEqual(JANELA);
  });

  it('M1 tolera defasagem pequena e sinaliza legenda sobre silêncio', () => {
    const mapa = mapaDe(10000, [[2000, 4000]]);
    const s = daRegra(
      rodarComMapa(
        `1
00:00:02,100 --> 00:00:04,000
No tempo.

2
00:00:06,000 --> 00:00:08,000
Sobre silêncio.`,
        mapa,
      ),
      'M1',
    );
    expect(s.map((x) => x.id)).toEqual(['M1:2:silencio']);
    expect(s[0].autoFixable).toBe(false);
  });

  it('M2 cola a saída ao corte quando a legenda invade o plano seguinte', () => {
    const mapa = mapaDe(8000, [[1000, 4000]], {
      cortes: [{ ms: 3700, intensidade: 0.8, precisaoMs: 21 }],
      statusCortes: { tipo: 'concluido', passoMs: 500 },
    });
    const s = daRegra(
      rodarComMapa(
        `1
00:00:01,000 --> 00:00:04,000
Passa do corte.`,
        mapa,
      ),
      'M2',
    );
    expect(s).toHaveLength(1);
    expect(s[0].id).toBe('M2:1:fim');
    expect(s[0].after?.endMs).toBe(3700);
  });

  it('M2 não executa sem detecção de cortes concluída', () => {
    const mapa = mapaDe(8000, [[1000, 4000]], { cortes: [{ ms: 3700, intensidade: 0.8, precisaoMs: 21 }] });
    expect(
      daRegra(
        rodarComMapa(
          `1
00:00:01,000 --> 00:00:04,000
x`,
          mapa,
        ),
        'M2',
      ),
    ).toHaveLength(0);
  });

  it('M3 aponta som longo sem legenda, como revisão manual', () => {
    const mapa = mapaDe(12000, [
      [1000, 3000],
      [6000, 9000],
    ]);
    const s = daRegra(
      rodarComMapa(
        `1
00:00:01,000 --> 00:00:03,000
Coberto.`,
        mapa,
      ),
      'M3',
    );
    expect(s).toHaveLength(1);
    expect(s[0].severity).toBe('revisao_manual');
    expect(s[0].cueIndex).toBe(-1);
  });
});

describe('M1 — antecipação longa', () => {
  it('aponta legenda que entra muito antes da fala, se a fala começa com ela na tela', () => {
    const mapa = mapaDe(8000, [[3700, 5500]]);
    const s = daRegra(
      rodarComMapa(
        `1
00:00:02,000 --> 00:00:05,500
Cedo demais.`,
        mapa,
      ),
      'M1',
    );
    expect(s.map((x) => x.id)).toEqual(['M1:1:entrada']);
    expect(s[0].message).toMatch(/antes/);
  });
});
