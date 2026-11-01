/**
 * Chroma key — a mesma fórmula do filtro `chromakey` do ffmpeg (distância em
 * U/V, normalizada por √2, com similaridade e mistura). Usada pelo caminho de
 * CPU da prévia; o shader WebGL a reproduz. O ffmpeg ainda tira a média de uma
 * vizinhança 3×3: nas bordas, a prévia pode diferir levemente da entrega.
 */
export function uvDaCor(hex) {
    const v = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
    return [(-0.168736 * r - 0.331264 * g + 0.5 * b) / 255 + 0.5, (0.5 * r - 0.418688 * g - 0.081312 * b) / 255 + 0.5];
}
/** Alfa (0–1) de um pixel RGB (0–255). */
export function alfaChroma(r, g, b, chave, sim, mistura) {
    const u = (-0.168736 * r - 0.331264 * g + 0.5 * b) / 255 + 0.5;
    const v = (0.5 * r - 0.418688 * g - 0.081312 * b) / 255 + 0.5;
    const du = u - chave[0];
    const dv = v - chave[1];
    const dif = Math.sqrt((du * du + dv * dv) / 2);
    if (mistura > 0.0001)
        return Math.min(1, Math.max(0, (dif - sim) / mistura));
    return dif > sim ? 1 : 0;
}
/**
 * Saturação da cor-chave: distância (na métrica do chromakey) entre ela e o
 * cinza neutro. Tons neutros — a roupa preta do intérprete, cabelo grisalho,
 * camisa branca — ficam todos a essa distância da chave, quaisquer que sejam.
 */
export function saturacaoDaChave(hex) {
    const [u, v] = uvDaCor(hex);
    return Math.sqrt(((u - 0.5) ** 2 + (v - 0.5) ** 2) / 2);
}
/**
 * Tolerância e transição a partir da saturação da chave, deixando folga para
 * os tons neutros: tolerância + transição = 75% da saturação. Um pano verde
 * real (menos saturado que o verde puro) pede tolerância menor.
 */
export function toleranciaSugerida(hex) {
    const d = saturacaoDaChave(hex);
    const r = (x) => Math.round(x * 100) / 100;
    return { similaridade: Math.max(0.02, r(0.45 * d)), suavidade: Math.max(0.01, r(0.3 * d)) };
}
/** Fração da saturação da chave consumida por tolerância + transição (> 1: neutros viram transparentes). */
export function invasaoDosNeutros(hex, similaridade, suavidade) {
    const d = saturacaoDaChave(hex);
    return d > 0 ? (similaridade + suavidade) / d : Infinity;
}
