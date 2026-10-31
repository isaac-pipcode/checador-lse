import { describe, expect, it } from 'vitest';
import { recorteNaFonte, retanguloJanela, verificarJanela } from '../src/libras/geometria';
import { estimarInicio } from '../src/libras/sincronia';
import { JANELA_PADRAO, NBR_15290, type JanelaLibras } from '../src/libras/tipos';
import { cuesDe } from './auxiliares';

const J = (over: Partial<JanelaLibras> = {}): JanelaLibras => ({ ...JANELA_PADRAO, ...over });

describe('geometria da janela', () => {
  it('canto inferior direito, 1/2 × 1/4 de um quadro 1920×1080, com margem', () => {
    expect(retanguloJanela(J(), 1920, 1080)).toEqual({ x: 1920 - 480 - 22, y: 1080 - 540 - 22, w: 480, h: 540 });
  });
  it('dimensões pares (yuv420p) e cantos', () => {
    const r = retanguloJanela(J({ canto: 'sup-esq', largura: 0.251, altura: 0.501 }), 1281, 721);
    expect(r.w % 2).toBe(0);
    expect(r.h % 2).toBe(0);
    expect(r.x).toBe(Math.round(0.02 * 721));
  });
  it('enquadramento cobre a janela; deslocY sobe/desce o recorte', () => {
    const c = recorteNaFonte({ w: 480, h: 540 }, { w: 1920, h: 1080 }, 1, 0);
    expect(c.h).toBe(1080);
    expect(c.w).toBeCloseTo(960);
    expect(c.x).toBeCloseTo(480);
    const topo = recorteNaFonte({ w: 480, h: 540 }, { w: 1920, h: 1080 }, 2, -1);
    expect(topo.y).toBe(0);
    expect(topo.h).toBeCloseTo(540);
  });
});

describe('verificações da janela (J1–J6)', () => {
  const { cues } = cuesDe(`1
00:00:01,000 --> 00:00:03,000
Fala.`);
  const clipe = { nome: 'int.mp4', caminho: '/x', url: 'midia://x', duracaoMs: 10000 };

  it('J1/J2 abaixo do mínimo da norma', () => {
    const ap = verificarJanela(J({ altura: 0.4, largura: 0.2 }), NBR_15290, 10000, []);
    expect(ap.filter((a) => a.nivel === 'erro').map((a) => a.codigo)).toEqual(['J1', 'J2']);
  });
  it('J3 sem clipe; J4 cobertura parcial; J6 sem sincronia', () => {
    expect(verificarJanela(J(), NBR_15290, 10000, []).map((a) => a.codigo)).toEqual(['J3']);
    const ap = verificarJanela(J({ clipe, inicioNaObraMs: 2000 }), NBR_15290, 15000, []);
    expect(ap.map((a) => a.codigo)).toEqual(['J4', 'J6']);
    expect(ap[0].mensagem).toBe('A janela não cobre a obra inteira: faltam 2,0 s no início e 3,0 s no fim.');
  });
  it('J5: no mínimo da norma (1/4 da largura) a janela no canto já invade a faixa central da LSE', () => {
    const sinc = { metodo: 'manual' as const, confianca: null };
    const minima = verificarJanela(J({ clipe, sincronia: sinc }), NBR_15290, 10000, cues);
    expect(minima.map((a) => a.codigo)).toEqual(['J5']);
    // sem legenda carregada, não há o que verificar
    expect(verificarJanela(J({ clipe, sincronia: sinc }), NBR_15290, 10000, []).map((a) => a.codigo)).toEqual([]);
  });

  it('J5 quando a janela larga invade a faixa da legenda; não quando estreita no canto', () => {
    const sinc = { metodo: 'manual' as const, confianca: null };
    const larga = verificarJanela(J({ clipe, largura: 0.45, sincronia: sinc }), NBR_15290, 10000, cues);
    expect(larga.map((a) => a.codigo)).toContain('J5');
    const estreita = verificarJanela(J({ clipe, largura: 0.12, sincronia: sinc }), NBR_15290, 10000, cues);
    expect(estreita.map((a) => a.codigo)).not.toContain('J5');
  });
});

describe('sincronização pelo som-guia', () => {
  /** "obra": rajadas de som em instantes pseudoaleatórios, em envelope de 10 ms (dB). */
  function envelopeObra(n: number, semente = 7): Float32Array {
    let s = semente;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const env = new Float32Array(n).fill(-70);
    let i = 0;
    while (i < n) {
      const dur = 20 + Math.floor(r() * 150);
      const pausa = 10 + Math.floor(r() * 120);
      const nivel = -30 + r() * 20;
      for (let k = i; k < Math.min(n, i + dur); k++) env[k] = nivel;
      i += dur + pausa;
    }
    return env;
  }

  it('recupera o início do clipe (positivo e negativo) com ruído no som-guia', () => {
    const obra = envelopeObra(60000); // 10 min
    for (const inicioMs of [3730, -1250]) {
      const lag = inicioMs / 10;
      let s = 3;
      const ruido = () => ((s = (s * 48271) % 2147483647) / 2147483647 - 0.5) * 8;
      // clipe[j] = obra[j + lag]: o som-guia é a obra, mais baixo e com ruído
      const clipe = Float32Array.from({ length: 50000 }, (_, j) => {
        const k = j + lag;
        return (k >= 0 && k < obra.length ? obra[k] - 12 : -70) + ruido();
      });
      // um trecho em que o intérprete fala por cima / o som-guia some
      clipe.fill(-75, 2000, 2600);
      const r = estimarInicio(obra, clipe, 10);
      expect(r.inicioNaObraMs).toBe(inicioMs);
      expect(r.confianca).toBeGreaterThan(0.5);
    }
  });

  it('sem som-guia (ruído puro) a confiança é baixa', () => {
    const obra = envelopeObra(30000);
    let s = 11;
    const clipe = Float32Array.from({ length: 30000 }, () => -60 + ((s = (s * 16807) % 2147483647) / 2147483647) * 4);
    expect(estimarInicio(obra, clipe, 10).confianca).toBeLessThan(0.5);
  });
});
