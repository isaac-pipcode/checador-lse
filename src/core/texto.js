/** Remove marcação de estilo (<i>, <b>, <u>, <font ...>) e tags de posição {\an8}. */
export function semMarcacao(s) {
    return s.replace(/<\/?[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '');
}
/**
 * Conta os caracteres efetivamente exibidos em uma linha.
 *
 * Default fiel ao Guia (MinC/SAv, 2016), que contabiliza espaços — o exemplo
 * "Empresário mata ex-mulher no centro de Fortaleza" é apresentado ali como
 * 48 caracteres. Os toggles permitem reproduzir normas de mercado que excluem
 * espaços, ou desconsiderar o conteúdo entre colchetes.
 */
export function contarCaracteres(linha, config) {
    let s = semMarcacao(linha);
    if (!config.contarColchetes)
        s = s.replace(/\[[^\]]*\]/g, '');
    if (!config.contarEspacos)
        s = s.replace(/\s/g, '');
    return [...s].length;
}
/** Soma dos caracteres de todas as linhas da legenda (a quebra não conta). */
export function caracteresDaLegenda(cue, config) {
    return cue.lines.reduce((acc, l) => acc + contarCaracteres(l, config), 0);
}
export function duracaoMs(cue) {
    return cue.endMs - cue.startMs;
}
/** cps = nº de caracteres / duração em segundos. Duração zero ⇒ Infinity. */
export function cpsDaLegenda(cue, config) {
    const segundos = duracaoMs(cue) / 1000;
    if (segundos <= 0)
        return Infinity;
    return caracteresDaLegenda(cue, config) / segundos;
}
export function faixaCps(cps, config) {
    if (cps <= config.cpsAlvo)
        return 'verde';
    if (cps <= config.cpsMaximo)
        return 'ambar';
    return 'vermelho';
}
export const ROTULO_FAIXA = {
    verde: 'dentro do alvo',
    ambar: 'acima do alvo',
    vermelho: 'acima do teto',
};
export function formatarTimecode(msTotal, separador = ',') {
    const sinal = msTotal < 0 ? '-' : '';
    const t = Math.abs(Math.round(msTotal));
    const h = Math.floor(t / 3600000);
    const m = Math.floor((t % 3600000) / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const milis = t % 1000;
    const p2 = (n) => String(n).padStart(2, '0');
    return `${sinal}${p2(h)}:${p2(m)}:${p2(s)}${separador}${String(milis).padStart(3, '0')}`;
}
export function formatarDuracao(msTotal) {
    return `${(msTotal / 1000).toFixed(2).replace('.', ',')} s`;
}
export function framesParaMs(frames, fps) {
    return Math.round((frames / fps) * 1000);
}
export function msParaFrames(msValor, fps) {
    return Math.round((msValor / 1000) * fps);
}
export function textoDaLegenda(lines) {
    return lines.join(' ');
}
/**
 * Reflow simples de um texto em até `maxLinhas` linhas de no máximo `cpl`
 * caracteres, escolhendo o ponto de quebra que mais equilibra as linhas.
 * É uma operação puramente tipográfica — não pretende respeitar sintagmas
 * (isso é papel de L1, no módulo NLP).
 */
export function reflowEquilibrado(texto, cpl) {
    const palavras = texto.split(/\s+/).filter(Boolean);
    if (palavras.length === 0)
        return null;
    if (texto.length <= cpl)
        return [texto];
    let melhor = null;
    for (let k = 1; k < palavras.length; k++) {
        const a = palavras.slice(0, k).join(' ');
        const b = palavras.slice(k).join(' ');
        if (a.length > cpl || b.length > cpl)
            continue;
        const desequilibrio = Math.abs(a.length - b.length);
        if (!melhor || desequilibrio < melhor.desequilibrio) {
            melhor = { linhas: [a, b], desequilibrio };
        }
    }
    return melhor ? melhor.linhas : null;
}
