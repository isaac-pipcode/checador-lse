/**
 * Janela de Libras: um clipe do intérprete (gravado em estúdio, em geral com
 * fundo verde) composto sobre a obra.
 *
 * Referência de dimensões: ABNT NBR 15290:2005 — altura mínima de 1/2 e largura
 * mínima de 1/4 da tela, segundo fontes secundárias (INES, Câmara dos
 * Deputados, MPF). O texto integral da norma não foi consultado: os limites
 * são parâmetros, e a interface declara a fonte.
 */
export const NBR_15290 = {
    alturaMin: 0.5,
    larguraMin: 0.25,
    fonte: 'ABNT NBR 15290:2005, segundo fontes secundárias (INES; Câmara dos Deputados; MPF) — confirmar no texto da norma',
};
export const JANELA_PADRAO = {
    clipe: null,
    inicioNaObraMs: 0,
    canto: 'inf-dir',
    altura: 0.5,
    largura: 0.25,
    // 9% do lado menor: dentro da área segura de 5% em 16:9 e em 4:3
    margem: 0.09,
    zoom: 1,
    deslocY: 0,
    deslocX: 0,
    chroma: {
        ativo: true,
        cor: '#00B140',
        similaridade: 0.12,
        suavidade: 0.08,
        encolher: 1,
        suavizarBorda: 0.8,
        despill: { ativo: true, mistura: 0.5, expandir: 0 },
        bordas: { esq: 0, dir: 0, topo: 0, base: 0 },
    },
    cor: { brilho: 0, contraste: 1, saturacao: 1 },
    velocidade: 1,
    fundo: 'transparente',
    corFundo: '#1B2230',
    sincronia: { metodo: 'nenhuma', confianca: null },
};
/**
 * Completa uma janela parcial (projeto antigo, estado salvo em versão anterior)
 * com os padrões, campo a campo, inclusive nos objetos aninhados.
 */
export function normalizarJanela(p) {
    const q = p ?? {};
    const ch = (q.chroma ?? {});
    return {
        ...JANELA_PADRAO,
        ...q,
        clipe: q.clipe ?? null,
        chroma: {
            ...JANELA_PADRAO.chroma,
            ...ch,
            despill: { ...JANELA_PADRAO.chroma.despill, ...(ch.despill ?? {}) },
            bordas: { ...JANELA_PADRAO.chroma.bordas, ...(ch.bordas ?? {}) },
        },
        cor: { ...JANELA_PADRAO.cor, ...(q.cor ?? {}) },
        sincronia: { ...JANELA_PADRAO.sincronia, ...(q.sincronia ?? {}) },
    };
}
