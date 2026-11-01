/**
 * Modelo da trilha de audiodescrição (AD).
 *
 * Um bloco é uma inserção de AD: uma janela de tempo (em geral, uma lacuna do
 * mapa temporal), um texto de roteiro e zero ou mais gravações (takes). O take
 * ativo é o que entra na mixagem.
 */
export const LEGENDA_PROMPTER_PADRAO = { cor: 'branco', escala: 1, alturaMaxima: 0.33 };
export const LIMITES_LEGENDA = { escala: [0.6, 2], alturaMaxima: [0.2, 0.5] };
export function ajustarLegenda(atual, mudanca) {
    const limitar = (v, [a, b]) => Math.round(Math.min(b, Math.max(a, v)) * 100) / 100;
    const n = { ...atual, ...mudanca };
    return {
        cor: n.cor === 'amarelo' ? 'amarelo' : 'branco',
        escala: limitar(n.escala, LIMITES_LEGENDA.escala),
        alturaMaxima: limitar(n.alturaMaxima, LIMITES_LEGENDA.alturaMaxima),
    };
}
export const PARAMETROS_AD_PADRAO = {
    // Estimativa inicial, a calibrar pelos takes do próprio locutor.
    palavrasPorMinuto: 160,
    duckingDb: -10,
    ataqueMs: 250,
    liberacaoMs: 500,
    prerollMs: 3000,
    posrollMs: 2000,
    aparoDb: 30,
    latenciaMs: 0,
    legenda: LEGENDA_PROMPTER_PADRAO,
};
export function takeAtivo(b) {
    return b.takes.find((t) => t.id === b.takeAtivoId) ?? null;
}
export function duracaoUtil(t) {
    return Math.max(0, t.trimFimMs - t.trimInicioMs);
}
