import type { Chroma, CorInterprete } from './tipos';
import { alfaChroma, uvDaCor } from './chroma';

/**
 * Tratamento do quadro do intérprete — a mesma cadeia, na mesma ordem, que a
 * entrega aplica com o ffmpeg (ver desktop/entrega.ts, `filtroLibras`):
 *
 *   chromakey → encolher matte (erosion) → suavizar borda (gblur no alfa)
 *   → cor (eq) → despill → recorte das bordas (crop + pad transparente)
 *
 * Opera em RGBA não pré-multiplicado (ImageData). `escala` é a razão entre a
 * resolução processada e a do clipe: na prévia, o quadro é reduzido, e os raios
 * (px do clipe) são convertidos.
 */
export interface ParamsTratamento {
  chroma: Chroma;
  cor: CorInterprete;
}

export function processarQuadro(px: Uint8ClampedArray, w: number, h: number, p: ParamsTratamento, escala = 1): void {
  const n = w * h;
  const alfa = new Float32Array(n).fill(1);
  const ch = p.chroma;

  if (ch.ativo) {
    const chave = uvDaCor(ch.cor);
    const sim = Math.max(0.01, ch.similaridade);
    for (let i = 0; i < n; i++) alfa[i] = alfaChroma(px[4 * i], px[4 * i + 1], px[4 * i + 2], chave, sim, ch.suavidade);

    const it = Math.round(ch.encolher * escala);
    if (it > 0) erodir(alfa, w, h, it);
    const sigma = ch.suavizarBorda * escala;
    if (sigma > 0.05) desfocar(alfa, w, h, sigma);
  }

  const c = p.cor;
  const comCor = c.brilho !== 0 || c.contraste !== 1 || c.saturacao !== 1;
  const desp = ch.ativo && ch.despill.ativo;
  if (comCor || desp) {
    const fator = (1 - ch.despill.mistura) * (1 - ch.despill.expandir);
    for (let i = 0; i < n; i++) {
      let r = px[4 * i] / 255;
      let g = px[4 * i + 1] / 255;
      let b = px[4 * i + 2] / 255;
      if (comCor) [r, g, b] = aplicarEq(r, g, b, c);
      if (desp) {
        // ffmpeg despill (type=green): mapa de reflexo = excesso de verde sobre a mistura de R e B
        const mapa = Math.max(g - (r * ch.despill.mistura + b * fator), 0);
        g = Math.max(g - mapa, 0);
      }
      px[4 * i] = Math.round(Math.min(1, r) * 255);
      px[4 * i + 1] = Math.round(Math.min(1, g) * 255);
      px[4 * i + 2] = Math.round(Math.min(1, b) * 255);
    }
  }

  if (ch.ativo) {
    const bd = ch.bordas;
    const x0 = Math.round(bd.esq * w);
    const x1 = w - Math.round(bd.dir * w);
    const y0 = Math.round(bd.topo * h);
    const y1 = h - Math.round(bd.base * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const fora = x < x0 || x >= x1 || y < y0 || y >= y1;
        px[4 * i + 3] = fora ? 0 : Math.round(alfa[i] * 255);
      }
    }
  }
}

/** eq do ffmpeg em YUV (BT.601, faixa total): contraste e brilho na luma, saturação no croma. */
function aplicarEq(r: number, g: number, b: number, c: CorInterprete): [number, number, number] {
  let y = 0.299 * r + 0.587 * g + 0.114 * b;
  let u = -0.168736 * r - 0.331264 * g + 0.5 * b;
  let v = 0.5 * r - 0.418688 * g - 0.081312 * b;
  y = (y - 0.5) * c.contraste + 0.5 + c.brilho;
  u *= c.saturacao;
  v *= c.saturacao;
  const cl = (x: number) => Math.min(1, Math.max(0, x));
  return [cl(y + 1.402 * v), cl(y - 0.344136 * u - 0.714136 * v), cl(y + 1.772 * u)];
}

/** Erosão 3×3 repetida `it` vezes = mínimo num quadrado (2·it+1)², separável. */
export function erodir(a: Float32Array, w: number, h: number, it: number): void {
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 1;
      for (let k = Math.max(0, x - it); k <= Math.min(w - 1, x + it); k++) m = Math.min(m, a[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 1;
      for (let k = Math.max(0, y - it); k <= Math.min(h - 1, y + it); k++) m = Math.min(m, tmp[k * w + x]);
      a[y * w + x] = m;
    }
  }
}

/** Desfoque gaussiano separável (raio 3σ, borda repetida). */
export function desfocar(a: Float32Array, w: number, h: number, sigma: number): void {
  const r = Math.max(1, Math.ceil(3 * sigma));
  const k = new Float32Array(2 * r + 1);
  let soma = 0;
  for (let i = -r; i <= r; i++) soma += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= soma;
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * a[y * w + Math.min(w - 1, Math.max(0, x + i))];
      tmp[y * w + x] = s;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
      a[y * w + x] = s;
    }
  }
}

/**
 * Cor-chave provável: mediana dos pixels de forte dominância verde (ou azul)
 * numa faixa nas bordas do quadro, onde costuma haver só fundo.
 */
export function detectarCorChave(px: Uint8ClampedArray, w: number, h: number): string | null {
  const faixa = Math.max(2, Math.round(Math.min(w, h) * 0.08));
  const verdes: number[][] = [];
  const azuis: number[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= faixa && x < w - faixa && y >= faixa && y < h - faixa) continue;
      const i = 4 * (y * w + x);
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      if (g > 60 && g > r * 1.3 && g > b * 1.3) verdes.push([r, g, b]);
      else if (b > 60 && b > r * 1.3 && b > g * 1.15) azuis.push([r, g, b]);
    }
  }
  const total = 2 * faixa * (w + h);
  const escolha = verdes.length >= azuis.length ? verdes : azuis;
  if (escolha.length < total * 0.2) return null; // fundo não é chroma
  const med = [0, 1, 2].map((c) => {
    const v = escolha.map((p) => p[c]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
  return `#${med
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
