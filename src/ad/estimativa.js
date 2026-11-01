import { duracaoUtil, takeAtivo } from './tipos';
export function contarPalavras(texto) {
    const m = texto.trim().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu);
    return m ? m.length : 0;
}
export function duracaoEstimadaMs(texto, ppm) {
    return Math.round((contarPalavras(texto) / Math.max(1, ppm)) * 60000);
}
/** Quantas palavras cabem numa janela, à velocidade dada. */
export function palavrasQueCabem(janelaMs, ppm) {
    return Math.floor((janelaMs / 60000) * ppm);
}
/**
 * Velocidade real do locutor, a partir dos takes ativos: mediana de
 * palavras/minuto. Devolve null com menos de três takes — pouca amostra para
 * substituir a estimativa.
 */
export function calibrarPpm(blocos) {
    const taxas = [];
    for (const b of blocos) {
        const t = takeAtivo(b);
        const palavras = contarPalavras(b.texto);
        const d = t ? duracaoUtil(t) : 0;
        if (!t || palavras < 3 || d < 500)
            continue;
        taxas.push((palavras / d) * 60000);
    }
    if (taxas.length < 3)
        return null;
    taxas.sort((a, b) => a - b);
    return { ppm: Math.round(taxas[Math.floor(taxas.length / 2)]), amostras: taxas.length };
}
