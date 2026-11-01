import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Severidade e status nunca são sinalizados só por cor (WCAG 2.2, 1.4.1):
 * cada chip traz ícone textual + rótulo escrito.
 */
export const ICONE_SEVERIDADE = {
    erro: '✕',
    aviso: '!',
    revisao_manual: '?',
};
export const ROTULO_SEVERIDADE = {
    erro: 'Erro',
    aviso: 'Aviso',
    revisao_manual: 'Revisão manual',
};
const CLASSE_SEVERIDADE = {
    erro: 'border-bad bg-bad-100 text-bad',
    aviso: 'border-warn bg-warn-100 text-warn',
    revisao_manual: 'border-navy-500 bg-paper-200 text-navy-700',
};
export function ChipSeveridade({ severidade }) {
    return (_jsxs("span", { className: `chip ${CLASSE_SEVERIDADE[severidade]}`, children: [_jsx("span", { "aria-hidden": "true", children: ICONE_SEVERIDADE[severidade] }), ROTULO_SEVERIDADE[severidade]] }));
}
export const ROTULO_VERIFICABILIDADE = {
    deterministica: 'Determinística',
    nlp: 'Assistida (NLP)',
    llm: 'Assistida (LLM)',
    sinal: 'Assistida (sinal)',
    manual: 'Manual',
};
export const EXPLICACAO_VERIFICABILIDADE = {
    deterministica: 'Verificação objetiva a partir do próprio arquivo.',
    nlp: 'Inferência do módulo de segmentação; vem com grau de confiança.',
    llm: 'Proposta gerada por modelo de linguagem; vem com grau de confiança.',
    sinal: 'Inferência sobre o áudio e a imagem do vídeo (energia, diferença entre quadros); vem com grau de confiança.',
    manual: 'Não verificável a partir do texto isolado: exige o vídeo ou o áudio.',
};
export function ChipVerificabilidade({ v }) {
    return (_jsx("span", { className: "chip border-navy-500 bg-paper text-navy-700", title: EXPLICACAO_VERIFICABILIDADE[v], children: ROTULO_VERIFICABILIDADE[v] }));
}
export function ChipConfianca({ valor }) {
    const pct = Math.round(valor * 100);
    const nivel = valor >= 0.75 ? 'alta' : valor >= 0.5 ? 'média' : 'baixa';
    return (_jsxs("span", { className: "chip border-navy-500 bg-paper text-navy-700", children: ["Confian\u00E7a ", nivel, " (", pct, "%)"] }));
}
export function Campo({ id, rotulo, dica, children, }) {
    return (_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "rotulo", htmlFor: id, children: rotulo }), children, dica ? (_jsx("p", { className: "text-xs text-navy-500", id: `${id}-dica`, children: dica })) : null] }));
}
export function Metrica({ rotulo, valor, detalhe }) {
    return (_jsxs("div", { className: "rounded border border-paper-400 bg-paper-200 px-3 py-2", children: [_jsx("dt", { className: "text-xs uppercase tracking-wide text-navy-700", children: rotulo }), _jsx("dd", { className: "text-lg font-semibold text-navy", children: valor }), detalhe ? _jsx("dd", { className: "text-xs text-navy-700", children: detalhe }) : null] }));
}
