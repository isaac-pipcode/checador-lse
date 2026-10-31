import { describe, expect, it } from 'vitest';
import { recorteNaFonte, retanguloJanela, verificarJanela } from '../src/libras/geometria';
import { analisarSincronia, estimarInicio } from '../src/libras/sincronia';
import { JANELA_PADRAO, NBR_15290, type JanelaLibras } from '../src/libras/tipos';
import { cuesDe } from './auxiliares';

const J = (over: Partial<JanelaLibras> = {}): JanelaLibras => ({ ...JANELA_PADRAO, ...over });

describe('geometria da janela', () => {
  it('canto inferior direito, 1/2 × 1/4 de um quadro 1920×1080, com margem', () => {
    expect(retanguloJanela(J({ margem: 0.02 }), 1920, 1080)).toEqual({ x: 1920 - 480 - 22, y: 1080 - 540 - 22, w: 480, h: 540 });
  });
  it('padrão: dentro da área segura de 5% em 16:9 e 4:3', async () => {
    const { dentroDaAreaSegura } = await import('../src/libras/enquadramento');
    expect(dentroDaAreaSegura(J(), { w: 1920, h: 1080 })).toBe(true);
    expect(dentroDaAreaSegura(J(), { w: 1440, h: 1080 })).toBe(true);
    expect(dentroDaAreaSegura(J({ margem: 0.02 }), { w: 1920, h: 1080 })).toBe(false);
  });
  it('dimensões pares (yuv420p) e cantos', () => {
    const r = retanguloJanela(J({ canto: 'sup-esq', largura: 0.251, altura: 0.501, margem: 0.02 }), 1281, 721);
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
    const estreita = verificarJanela(J({ clipe, largura: 0.12, margem: 0.02, sincronia: sinc }), NBR_15290, 10000, cues);
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

describe('sincronia com deriva', () => {
  /** obra sintética; o clipe reproduz a obra com início `inicio` e velocidade `v` */
  function cenario(inicioMs: number, v: number, duracaoS = 1200) {
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = duracaoS * 100;
    const obra = new Float32Array(n).fill(-70);
    for (let i = 0; i < n; ) {
      const dur = 15 + Math.floor(r() * 120);
      const nivel = -35 + r() * 25;
      for (let k = i; k < Math.min(n, i + dur); k++) obra[k] = nivel;
      i += dur + 10 + Math.floor(r() * 90);
    }
    const nc = Math.floor((n - Math.max(0, inicioMs / 10)) / v) - 10;
    const clipe = Float32Array.from({ length: nc }, (_, j) => {
      const k = Math.round(inicioMs / 10 + j * v); // tempo na obra = início + tClipe × v
      return (k >= 0 && k < n ? obra[k] - 10 : -70) + (r() - 0.5) * 6;
    });
    return { obra, clipe };
  }

  it('sem deriva: velocidade 1 e resíduo pequeno', () => {
    const { obra, clipe } = cenario(2000, 1);
    const r = analisarSincronia(obra, clipe, 10);
    expect(r.velocidade).toBe(1);
    expect(Math.abs(r.inicioNaObraMs - 2000)).toBeLessThanOrEqual(10);
    expect(r.relatorio.corrigida).toBe(false);
    expect(r.relatorio.janelasValidas).toBeGreaterThan(20);
  });

  it('deriva de relógio (+150 ppm em 20 min): mede e corrige', () => {
    const v = 1.00015;
    const { obra, clipe } = cenario(3500, v);
    const r = analisarSincronia(obra, clipe, 10);
    expect(r.relatorio.corrigida).toBe(true);
    expect(r.relatorio.derivaMsPorHora).toBeGreaterThan(400);
    expect(r.relatorio.derivaMsPorHora).toBeLessThan(680);
    expect(Math.abs(r.velocidade - v)).toBeLessThan(0.00003);
    expect(Math.abs(r.inicioNaObraMs - 3500)).toBeLessThanOrEqual(20);
    expect(r.relatorio.desvioMs).toBeLessThanOrEqual(15);
  });
});

describe('sincronia com conversão de cadência', () => {
  it('clipe 4,3% mais lento (25 ↔ 23,976 qd/s): identifica a razão e sincroniza', () => {
    let s = 21;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = 600 * 100; // 10 min
    const obra = new Float32Array(n).fill(-70);
    for (let i = 0; i < n; ) {
      const dur = 15 + Math.floor(r() * 120);
      const nivel = -35 + r() * 25;
      for (let k = i; k < Math.min(n, i + dur); k++) obra[k] = nivel;
      i += dur + 10 + Math.floor(r() * 90);
    }
    const v = 25 / (24000 / 1001);
    const inicio = 1500;
    const nc = Math.floor((n - inicio / 10) / v) - 10;
    const clipe = Float32Array.from({ length: nc }, (_, j) => obra[Math.round(inicio / 10 + j * v)] - 8 + (r() - 0.5) * 6);
    const a = analisarSincronia(obra, clipe, 10);
    expect(a.razaoCadencia.rotulo).toBe('25 ↔ 23,976 qd/s');
    expect(Math.abs(a.velocidade - v)).toBeLessThan(0.0005);
    expect(Math.abs(a.inicioNaObraMs - inicio)).toBeLessThanOrEqual(30);
    expect(a.relatorio.corrigida).toBe(true);
  });
});

describe('enquadramento e proporção', () => {
  it('proporção NBR em 16:9 é 8:9 e respeita os mínimos', async () => {
    const { propostas, aplicarProporcao } = await import('../src/libras/enquadramento');
    const q = { w: 1920, h: 1080 };
    const nbr = propostas(q, NBR_15290)[0];
    expect(nbr.rotulo).toBe('NBR (8:9)');
    // 1:1 a partir da altura mínima: a largura (0,28) passa do mínimo, ok
    expect(aplicarProporcao(0.5, 1, q, NBR_15290)).toEqual({ altura: 0.5, largura: 0.281 });
    // 9:16 a partir de 0,5 daria largura 0,14 < 0,25: a altura cresce até caber (e é limitada a 95%)
    const alta = aplicarProporcao(0.5, 9 / 16, q, NBR_15290);
    expect(alta.largura).toBeGreaterThanOrEqual(0.25 * 0.95 / (0.95));
    expect(alta.altura).toBeLessThanOrEqual(0.95);
  });

  it('caixa do intérprete une os quadros (mãos em movimento) e ignora ruído', async () => {
    const { caixaDoInterprete } = await import('../src/libras/enquadramento');
    const w = 100, h = 100;
    const q = (x0: number, x1: number) => {
      const a = new Uint8Array(w * h);
      for (let y = 20; y < 90; y++) for (let x = x0; x < x1; x++) a[y * w + x] = 255;
      a[5 * w + 5] = 255; // pixel isolado: ruído
      return a;
    };
    expect(caixaDoInterprete([q(40, 60), q(30, 50), q(50, 75)], w, h)).toEqual({ x: 30, y: 20, w: 45, h: 70, ignorados: [] });
    // tripé de refletor na borda esquerda, separado por um vão: fica de fora
    const comTripe = q(40, 60);
    for (let y = 0; y < h; y++) for (let x = 2; x < 6; x++) comTripe[y * w + x] = 255;
    const c = caixaDoInterprete([comTripe, q(30, 50)], w, h)!;
    expect([c.x, c.w, c.y]).toEqual([30, 30, 20]);
    expect(c.ignorados).toEqual([{ x0: 2, x1: 5 }]);
  });

  it('enquadramento automático contém a caixa, com folga, na proporção da janela', async () => {
    const { enquadramentoPara } = await import('../src/libras/enquadramento');
    const fonte = { w: 1920, h: 1080 };
    const janela = { w: 480, h: 540 };
    const caixa = { x: 1300, y: 200, w: 400, h: 800 };
    const e = enquadramentoPara(caixa, fonte, janela);
    const rc = recorteNaFonte(janela, fonte, e.zoom, e.deslocY, e.deslocX);
    expect(rc.x).toBeLessThanOrEqual(caixa.x);
    expect(rc.x + rc.w).toBeGreaterThanOrEqual(caixa.x + caixa.w);
    expect(rc.y).toBeLessThanOrEqual(caixa.y);
    expect(rc.y + rc.h).toBeGreaterThanOrEqual(caixa.y + caixa.h - 1);
    expect(rc.w / rc.h).toBeCloseTo(janela.w / janela.h, 2);
    expect(e.zoom).toBeGreaterThan(1);
  });
});

describe('tratamento (cadeia da prévia)', () => {
  it('cor-chave detectada nas bordas de um quadro verde', async () => {
    const { detectarCorChave } = await import('../src/libras/tratamento');
    const w = 50, h = 50;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) [px[4 * i], px[4 * i + 1], px[4 * i + 2], px[4 * i + 3]] = [10, 170, 70, 255];
    for (let y = 15; y < 50; y++) for (let x = 20; x < 30; x++) [px[4 * (y * w + x)], px[4 * (y * w + x) + 1]] = [200, 120];
    expect(detectarCorChave(px, w, h)).toBe('#0AAA46');
    // fundo cinza: não é chroma
    const cinza = new Uint8ClampedArray(w * h * 4).fill(128);
    expect(detectarCorChave(cinza, w, h)).toBeNull();
  });

  it('despill tira o verde excedente de um pixel de pele esverdeado; bordas zeram o alfa', async () => {
    const { processarQuadro } = await import('../src/libras/tratamento');
    const px = new Uint8ClampedArray([200, 180, 140, 255, 200, 180, 140, 255]);
    processarQuadro(px, 2, 1, {
      chroma: { ...JANELA_PADRAO.chroma, encolher: 0, suavizarBorda: 0, bordas: { esq: 0.5, dir: 0, topo: 0, base: 0 } },
      cor: JANELA_PADRAO.cor,
    });
    expect(px[3]).toBe(0); // primeiro pixel cortado pela borda
    expect(px[5]).toBe(170); // verde limitado à média de R e B
    expect(px[7]).toBe(255);
  });
});

describe('tolerância do recorte e tons neutros', () => {
  it('pano verde real (menos saturado) pede tolerância menor; a sugerida deixa folga', async () => {
    const { saturacaoDaChave, toleranciaSugerida, invasaoDosNeutros, alfaChroma, uvDaCor } = await import('../src/libras/chroma');
    expect(saturacaoDaChave('#00B140')).toBeGreaterThan(saturacaoDaChave('#149749'));
    // padrão (0,12 + 0,08) com o pano real: invade os neutros
    expect(invasaoDosNeutros('#149749', 0.12, 0.08)).toBeGreaterThan(1);
    const t = toleranciaSugerida('#149749');
    expect(invasaoDosNeutros('#149749', t.similaridade, t.suavidade)).toBeCloseTo(0.75, 1);
    // roupa preta: opaca com a sugerida, translúcida com a padrão
    const chave = uvDaCor('#149749');
    expect(alfaChroma(43, 43, 51, chave, t.similaridade, t.suavidade)).toBe(1);
    // com a padrão: alfa ≈ 0,65 — 35% transparente, o filme vaza pela roupa
    expect(alfaChroma(43, 43, 51, chave, 0.12, 0.08)).toBeLessThan(0.7);
  });

  it('J8 aponta tolerância que alcança os neutros', () => {
    const clipe = { nome: 'i.mp4', caminho: '/i', url: 'midia://i', duracaoMs: 10000 };
    const j = J({ clipe, chroma: { ...JANELA_PADRAO.chroma, cor: '#149749' }, sincronia: { metodo: 'manual', confianca: null } });
    expect(verificarJanela(j, NBR_15290, 0, []).find((a) => a.codigo === 'J8')?.nivel).toBe('erro');
  });
});
