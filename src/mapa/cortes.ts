import type { Corte } from './tipos';

/** Bins por canal do histograma de cor. 3 × 16 = 48 valores por quadro. */
export const BINS = 16;

/** Histograma RGB normalizado a partir de pixels RGBA (ImageData.data). */
export function histogramaRgb(rgba: Uint8ClampedArray): Float32Array {
  const h = new Float32Array(BINS * 3);
  const desloc = 8 - Math.log2(BINS);
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    h[rgba[i] >> desloc]++;
    h[BINS + (rgba[i + 1] >> desloc)]++;
    h[2 * BINS + (rgba[i + 2] >> desloc)]++;
    n++;
  }
  if (n > 0) for (let i = 0; i < h.length; i++) h[i] /= n;
  return h;
}

/** Distância L1 normalizada entre histogramas: 0 (idênticos) a 1 (disjuntos). */
export function distancia(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / 6; // 3 canais, cada um soma no máximo 2
}

export interface ParametrosCortes {
  /** distância mínima absoluta para considerar corte */
  limiarAbsoluto: number;
  /** a distância precisa superar k × a mediana da vizinhança */
  fatorVizinhanca: number;
  /** amostras de cada lado consideradas como vizinhança */
  raioVizinhanca: number;
}

export const PARAMETROS_CORTES_PADRAO: ParametrosCortes = {
  limiarAbsoluto: 0.25,
  fatorVizinhanca: 3,
  raioVizinhanca: 6,
};

function mediana(v: number[]): number {
  if (v.length === 0) return 0;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

/**
 * Dadas as distâncias entre amostras consecutivas (diffs[i] = d(q[i], q[i+1])),
 * devolve os índices i que são candidatos a corte. O limiar relativo à
 * vizinhança evita que movimento de câmera ou de cena (que eleva todas as
 * distâncias de um trecho) seja lido como sequência de cortes.
 */
export function candidatosACorte(diffs: number[], p: ParametrosCortes = PARAMETROS_CORTES_PADRAO): number[] {
  const out: number[] = [];
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i];
    if (d < p.limiarAbsoluto) continue;
    const viz: number[] = [];
    for (let k = Math.max(0, i - p.raioVizinhanca); k <= Math.min(diffs.length - 1, i + p.raioVizinhanca); k++) {
      if (k !== i) viz.push(diffs[k]);
    }
    if (d < p.fatorVizinhanca * mediana(viz)) continue;
    // máximo local, para não marcar dois cortes numa transição de duas amostras
    if (i > 0 && diffs[i - 1] > d) continue;
    if (i + 1 < diffs.length && diffs[i + 1] >= d) continue;
    out.push(i);
  }
  return out;
}

/**
 * Refina a posição de um corte por bisseção entre dois instantes, usando uma
 * função que devolve o histograma do quadro em `ms`. A cada passo, o ponto
 * médio é atribuído ao lado cujo histograma mais se parece com o seu.
 */
export async function refinarCorte(
  antesMs: number,
  depoisMs: number,
  quadro: (ms: number) => Promise<Float32Array>,
  precisaoAlvoMs: number,
): Promise<Corte> {
  let a = antesMs;
  let b = depoisMs;
  let ha = await quadro(a);
  let hb = await quadro(b);
  const intensidade = distancia(ha, hb);
  while (b - a > precisaoAlvoMs) {
    const m = (a + b) / 2;
    const hm = await quadro(m);
    if (distancia(hm, ha) <= distancia(hm, hb)) {
      a = m;
      ha = hm;
    } else {
      b = m;
      hb = hm;
    }
  }
  return { ms: Math.round(b), intensidade, precisaoMs: Math.ceil((b - a) / 2) };
}
