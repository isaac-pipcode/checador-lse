/**
 * Chroma key — a mesma fórmula do filtro `chromakey` do ffmpeg (distância em
 * U/V, normalizada por √2, com similaridade e mistura). Usada pelo caminho de
 * CPU da prévia; o shader WebGL a reproduz. O ffmpeg ainda tira a média de uma
 * vizinhança 3×3: nas bordas, a prévia pode diferir levemente da entrega.
 */

export function uvDaCor(hex: string): [number, number] {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return [(-0.168736 * r - 0.331264 * g + 0.5 * b) / 255 + 0.5, (0.5 * r - 0.418688 * g - 0.081312 * b) / 255 + 0.5];
}

/** Alfa (0–1) de um pixel RGB (0–255). */
export function alfaChroma(r: number, g: number, b: number, chave: [number, number], sim: number, mistura: number): number {
  const u = (-0.168736 * r - 0.331264 * g + 0.5 * b) / 255 + 0.5;
  const v = (0.5 * r - 0.418688 * g - 0.081312 * b) / 255 + 0.5;
  const du = u - chave[0];
  const dv = v - chave[1];
  const dif = Math.sqrt((du * du + dv * dv) / 2);
  if (mistura > 0.0001) return Math.min(1, Math.max(0, (dif - sim) / mistura));
  return dif > sim ? 1 : 0;
}
