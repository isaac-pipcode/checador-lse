import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cpsDaLegenda, duracaoMs, faixaCps, formatarDuracao, formatarTimecode, ROTULO_FAIXA } from '../core/texto';
import { Regua } from './Regua';
import { CardSugestao } from './CardSugestao';
const CLASSE_FAIXA = {
    verde: 'border-ok bg-ok-100 text-ok',
    ambar: 'border-warn bg-warn-100 text-warn',
    vermelho: 'border-bad bg-bad-100 text-bad',
};
const ICONE_FAIXA = { verde: '✓', ambar: '!', vermelho: '✕' };
export function BadgeCps({ cue, config }) {
    const cps = cpsDaLegenda(cue, config);
    const faixa = faixaCps(cps, config);
    const texto = Number.isFinite(cps) ? cps.toFixed(1).replace('.', ',') : '∞';
    return (_jsxs("span", { className: `chip ${CLASSE_FAIXA[faixa]}`, children: [_jsx("span", { "aria-hidden": "true", children: ICONE_FAIXA[faixa] }), texto, " cps \u2014 ", ROTULO_FAIXA[faixa]] }));
}
export function ItemLegenda({ cue, sugestoes, review, config, linhasFinais, remanescentes, mostrarPrevia, aoVerNoVideo, }) {
    const alterada = mostrarPrevia && linhasFinais && linhasFinais.join('\n') !== cue.lines.join('\n');
    const linhas = mostrarPrevia && linhasFinais ? linhasFinais : cue.lines;
    return (_jsxs("article", { "aria-labelledby": `legenda-${cue.index}`, className: "border-b border-paper-400 px-3 py-3", id: `cue-${cue.index}`, children: [_jsxs("header", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("h3", { id: `legenda-${cue.index}`, className: "text-sm font-semibold", children: ["Legenda ", cue.index] }), _jsxs("span", { className: "font-mono text-xs text-navy-700", children: [formatarTimecode(cue.startMs), " \u2192 ", formatarTimecode(cue.endMs)] }), _jsx("span", { className: "text-xs text-navy-700", children: formatarDuracao(duracaoMs(cue)) }), _jsx(BadgeCps, { cue: cue, config: config }), alterada ? (_jsxs("span", { className: "chip border-ok bg-ok-100 text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u270E" }), " alterada na pr\u00E9via"] })) : null, mostrarPrevia && remanescentes > 0 ? (_jsxs("span", { className: "chip border-bad bg-bad-100 text-bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u2715" }), " ", remanescentes, " viola\u00E7\u00E3o(\u00F5es) permanecem"] })) : null, aoVerNoVideo ? (_jsxs("button", { type: "button", className: "btn-fantasma py-0.5 text-xs", onClick: aoVerNoVideo, children: [_jsx("span", { "aria-hidden": "true", children: "\u25B6" }), " Ver no v\u00EDdeo"] })) : null, sugestoes.length > 0 ? (_jsxs("span", { className: "ml-auto text-xs text-navy-700", children: [sugestoes.length, " apontamento", sugestoes.length > 1 ? 's' : ''] })) : null] }), _jsx("div", { className: "mt-2 rounded border border-paper-400 bg-preto px-3 py-2", children: _jsx("div", { className: "mx-auto max-w-[38ch] text-center font-mono text-sm text-cabine-texto", children: linhas.map((l, i) => (_jsx("div", { className: "whitespace-pre-wrap", children: l.replace(/<\/?[^>]+>/g, '') || ' ' }, i))) }) }), _jsx("div", { className: "mt-2 space-y-0.5", children: linhas.map((l, i) => (_jsx(Regua, { linha: l, config: config }, i))) }), sugestoes.length > 0 ? (_jsx("ul", { className: "mt-3 space-y-2", children: sugestoes.map((s) => {
                    const item = review[s.id];
                    if (!item)
                        return null;
                    return (_jsx("li", { children: _jsx(CardSugestao, { item: item }) }, s.id));
                }) })) : null] }));
}
