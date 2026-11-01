import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { formatarTimecode } from '../../core/texto';
import { ajustarLegenda, duracaoUtil, LIMITES_LEGENDA, takeAtivo } from '../../ad/tipos';
import { contarPalavras, duracaoEstimadaMs, palavrasQueCabem } from '../../ad/estimativa';
import { nivelDoBloco } from '../../ad/verificacoes';
import { descartarTake } from '../../ad/audio';
import { COR_LEGENDA } from './Teleprompter';
/** Peças da interface de AD reutilizadas pelas páginas (cartão de bloco, take, ajustes). */
export const seg = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
export const CLASSE_NIVEL = {
    ok: 'border-ok bg-ok-100 text-ok',
    aviso: 'border-warn bg-warn-100 text-warn',
    erro: 'border-bad bg-bad-100 text-bad',
    pendente: 'border-navy-300 bg-paper-200 text-navy-700',
};
export const ICONE = { ok: '✓', aviso: '!', erro: '✕', pendente: '…' };
export const ROTULO_NIVEL = { ok: 'Pronto', aviso: 'Aviso', erro: 'Erro', pendente: 'Pendente' };
export function AjustesLegenda() {
    const id = useId();
    const { estado } = useEstado();
    const despachar = useDespachar();
    const l = estado.ad.parametros.legenda;
    const mudar = (m) => despachar({ tipo: 'adParametros', mudanca: { legenda: ajustarLegenda(l, m) } });
    const pct = (v) => `${Math.round(v * 100)}%`;
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsx("div", { role: "radiogroup", "aria-label": "Cor do texto", className: "flex gap-2", children: ['branco', 'amarelo'].map((c) => (_jsxs("label", { className: `flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm ${l.cor === c ? 'border-navy bg-paper-200' : 'border-paper-400'}`, children: [_jsx("input", { type: "radio", name: `${id}-cor`, checked: l.cor === c, onChange: () => mudar({ cor: c }) }), _jsx("span", { "aria-hidden": "true", className: "inline-flex h-5 w-8 items-center justify-center rounded bg-preto text-xs font-bold", style: { color: COR_LEGENDA[c] }, children: "Aa" }), c === 'branco' ? 'Branco' : 'Amarelo'] }, c))) }), _jsxs("div", { className: "flex items-center gap-1", role: "group", "aria-label": "Tamanho da letra", children: [_jsxs("button", { type: "button", className: "btn-secundario px-2 py-0.5", disabled: l.escala <= LIMITES_LEGENDA.escala[0], onClick: () => mudar({ escala: l.escala - 0.1 }), children: ["A", _jsx("span", { className: "sr-only-focusable", children: " menor" }), "\u2212"] }), _jsxs("span", { className: "w-24 text-center text-sm", children: ["Letra ", pct(l.escala)] }), _jsxs("button", { type: "button", className: "btn-secundario px-2 py-0.5", disabled: l.escala >= LIMITES_LEGENDA.escala[1], onClick: () => mudar({ escala: l.escala + 0.1 }), children: ["A", _jsx("span", { className: "sr-only-focusable", children: " maior" }), "+"] })] })] }), _jsxs("label", { className: "rotulo mt-3", htmlFor: `${id}-altura`, children: ["Altura m\u00E1xima da caixa: ", pct(l.alturaMaxima), " da imagem"] }), _jsx("input", { id: `${id}-altura`, type: "range", min: LIMITES_LEGENDA.alturaMaxima[0], max: LIMITES_LEGENDA.alturaMaxima[1], step: 0.01, value: l.alturaMaxima, onChange: (e) => mudar({ alturaMaxima: Number(e.target.value) }), className: "w-full max-w-xs" }), _jsxs("p", { className: "mt-1 text-xs text-navy-500", children: ["Se o texto n\u00E3o couber, a letra diminui sozinha (at\u00E9 60% do tamanho escolhido); se ainda assim n\u00E3o couber, o teleprompter avisa. Na cabine, ", _jsx("kbd", { children: "+" }), " e ", _jsx("kbd", { children: "\u2212" }), " mudam o tamanho durante a sess\u00E3o. Salvo no projeto."] })] }));
}
// ===========================================================================
// Componentes comuns
// ===========================================================================
export function Numero({ rotulo, valor, passo, min = 0, max, aoMudar, }) {
    const id = useId();
    return (_jsxs("div", { children: [_jsx("label", { className: "rotulo text-xs", htmlFor: id, children: rotulo }), _jsx("input", { id: id, className: "campo", type: "number", step: passo, min: min, max: max, value: valor, onChange: (e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n))
                        aoMudar(n);
                } })] }));
}
export function CartaoBloco({ n, bloco: b, apontamentos, ppm, aoFocar, podeGravar, aoGravar, aoOuvir, }) {
    const despachar = useDespachar();
    const janela = b.fimMs - b.inicioMs;
    const est = duracaoEstimadaMs(b.texto, ppm);
    const palavras = contarPalavras(b.texto);
    const cabem = palavrasQueCabem(janela, ppm);
    const nivel = nivelDoBloco(apontamentos);
    const ativo = takeAtivo(b);
    const fracao = Math.min(1.5, est / Math.max(1, janela));
    const temTexto = b.texto.trim() !== '';
    const mover = (campo, delta) => despachar({ tipo: 'adEditar', id: b.id, mudanca: { [campo]: Math.max(0, b[campo] + delta) } });
    return (_jsxs("article", { id: `bloco-${b.id}`, "aria-labelledby": `titulo-${b.id}`, onFocus: aoFocar, className: `rounded border-y border-l-4 border-r border-paper-400 bg-paper p-3 ${nivel === 'erro' ? 'border-l-bad' : nivel === 'aviso' ? 'border-l-warn' : nivel === 'ok' ? 'border-l-ok' : 'border-l-navy-300'}`, children: [_jsxs("header", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("h3", { id: `titulo-${b.id}`, className: "text-sm font-semibold", children: ["Bloco ", n] }), _jsxs("span", { className: "font-mono text-xs text-navy-700", children: [formatarTimecode(b.inicioMs), " \u2192 ", formatarTimecode(b.fimMs)] }), _jsxs("span", { className: "text-xs text-navy-700", children: ["janela de ", seg(janela)] }), _jsxs("span", { className: `chip ${CLASSE_NIVEL[nivel]}`, children: [_jsx("span", { "aria-hidden": "true", children: ICONE[nivel] }), ROTULO_NIVEL[nivel]] }), _jsxs("span", { className: `chip ${b.aprovado ? 'border-ok bg-ok-100 text-ok' : 'border-navy-300 bg-paper-200 text-navy-700'}`, children: [_jsx("span", { "aria-hidden": "true", children: b.aprovado ? '✓' : '✎' }), b.aprovado ? 'Aprovado para gravação' : 'Rascunho'] })] }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsxs("div", { children: [_jsxs("label", { className: "rotulo sr-only-focusable", htmlFor: `texto-${b.id}`, children: ["Roteiro do bloco ", n] }), _jsx("textarea", { id: `texto-${b.id}`, className: "campo min-h-[4.5rem] font-sans text-base leading-snug", value: b.texto, placeholder: "Descreva o que \u00E9 relevante e n\u00E3o est\u00E1 no di\u00E1logo\u2026", onChange: (e) => despachar({ tipo: 'adEditar', id: b.id, mudanca: { texto: e.target.value } }) }), _jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs text-navy-700", children: [_jsx("div", { className: "h-1.5 w-40 rounded bg-paper-200", "aria-hidden": "true", children: _jsx("div", { className: `h-1.5 rounded ${fracao > 1.15 ? 'bg-bad' : fracao > 1 ? 'bg-warn' : 'bg-ok'}`, style: { width: `${Math.min(100, fracao * 100)}%` } }) }), _jsxs("span", { children: [palavras, " palavras \u00B7 ~", seg(est), " de ", seg(janela), " \u00B7 cabem ~", cabem, " a ", ppm, " ppm (estimativa)"] })] }), _jsx("label", { className: "rotulo mt-2 text-xs", htmlFor: `nota-${b.id}`, children: "Nota para o locutor (aparece no teleprompter, n\u00E3o \u00E9 lida)" }), _jsx("input", { id: `nota-${b.id}`, className: "campo text-xs", value: b.nota, onChange: (e) => despachar({ tipo: 'adEditar', id: b.id, mudanca: { nota: e.target.value } }) })] }), _jsxs("div", { className: "flex flex-wrap items-start gap-1.5", children: [_jsx("button", { type: "button", className: b.aprovado ? 'btn-secundario' : 'btn-primario', disabled: !temTexto, "aria-pressed": !!b.aprovado, onClick: () => despachar({ tipo: 'adAprovar', id: b.id, aprovado: !b.aprovado }), children: b.aprovado ? 'Retirar aprovação' : 'Aprovar para gravação' }), _jsxs("button", { type: "button", className: "btn-secundario", disabled: !podeGravar, onClick: aoOuvir, children: [_jsx("span", { "aria-hidden": "true", children: "\u25B6" }), " Ouvir o trecho"] }), _jsxs("button", { type: "button", className: "btn-secundario", disabled: !podeGravar || !b.aprovado, title: b.aprovado ? undefined : 'Aprove o roteiro para gravar', onClick: aoGravar, children: [_jsx("span", { "aria-hidden": "true", children: "\u25CF" }), " ", b.takes.length ? 'Gravar outro take' : 'Gravar este bloco'] }), b.takes.length > 0 ? (_jsx("ul", { className: "w-full space-y-1 text-xs", "aria-label": `Gravações do bloco ${n}`, children: b.takes.map((t, k) => (_jsx(LinhaTake, { blocoId: b.id, take: t, k: k + 1, ativo: ativo?.id === t.id }, t.id))) })) : null] })] }), _jsxs("details", { className: "mt-2 border-t border-paper-400 pt-1.5", children: [_jsx("summary", { className: "cursor-pointer text-2xs font-medium text-navy-500", children: "Janela e op\u00E7\u00F5es" }), _jsxs("span", { className: "mt-1.5 flex flex-wrap gap-1", role: "group", "aria-label": `Ajustar janela do bloco ${n}`, children: [_jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", onClick: () => mover('inicioMs', -250), children: "In\u00EDcio \u2212\u00BC s" }), _jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", onClick: () => mover('inicioMs', 250), children: "In\u00EDcio +\u00BC s" }), _jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", onClick: () => mover('fimMs', -250), children: "Fim \u2212\u00BC s" }), _jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", onClick: () => mover('fimMs', 250), children: "Fim +\u00BC s" }), _jsx("button", { type: "button", className: "btn-fantasma ml-auto h-7 px-2 text-2xs text-bad", onClick: () => {
                                    if (!temTexto && b.takes.length === 0)
                                        despachar({ tipo: 'adRemover', id: b.id });
                                    else if (window.confirm(`Excluir o bloco ${n}, com roteiro e gravações?`)) {
                                        b.takes.forEach((t) => descartarTake(t.id));
                                        despachar({ tipo: 'adRemover', id: b.id });
                                    }
                                }, children: "Excluir" })] })] }), apontamentos.filter((a) => a.nivel !== 'pendente').length > 0 ? (_jsx("ul", { className: "mt-2 space-y-1 text-sm", children: apontamentos
                    .filter((a) => a.nivel !== 'pendente')
                    .map((a) => (_jsxs("li", { className: a.nivel === 'erro' ? 'text-bad' : 'text-warn', children: [_jsx("span", { "aria-hidden": "true", children: a.nivel === 'erro' ? '✕ ' : '! ' }), _jsx("span", { className: "font-mono text-xs", children: a.codigo }), " ", a.mensagem] }, a.codigo))) })) : null] }));
}
export function LinhaTake({ blocoId, take: t, k, ativo }) {
    const despachar = useDespachar();
    const ajustar = (mudanca) => despachar({ tipo: 'adAjustarTake', blocoId, takeId: t.id, mudanca });
    return (_jsxs("li", { className: `rounded border px-2 py-1 ${ativo ? 'border-navy-500 bg-paper-200' : 'border-paper-400'}`, children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("label", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "radio", name: `take-${blocoId}`, checked: ativo, onChange: () => despachar({ tipo: 'adAtivarTake', blocoId, takeId: t.id }) }), "Take ", k, " \u00B7 ", seg(duracaoUtil(t))] }), _jsx("span", { className: "ml-auto font-mono text-[11px] text-navy-500", children: formatarTimecode(t.posicaoMs) })] }), ativo ? (_jsxs("div", { className: "mt-1 flex flex-wrap gap-1", role: "group", "aria-label": `Ajustes do take ${k}`, children: [_jsx("button", { type: "button", className: "btn-fantasma px-1.5 py-0 text-[11px]", onClick: () => ajustar({ posicaoMs: t.posicaoMs - 100 }), children: "\u25C2 0,1 s" }), _jsx("button", { type: "button", className: "btn-fantasma px-1.5 py-0 text-[11px]", onClick: () => ajustar({ posicaoMs: t.posicaoMs + 100 }), children: "0,1 s \u25B8" }), _jsx("button", { type: "button", className: "btn-fantasma px-1.5 py-0 text-[11px]", onClick: () => ajustar({ ganhoDb: t.ganhoDb - 1 }), children: "\u22121 dB" }), _jsx("button", { type: "button", className: "btn-fantasma px-1.5 py-0 text-[11px]", onClick: () => ajustar({ ganhoDb: t.ganhoDb + 1 }), children: "+1 dB" }), _jsxs("span", { className: "self-center text-[11px] text-navy-500", children: [t.ganhoDb > 0 ? '+' : '', t.ganhoDb, " dB"] }), _jsx("button", { type: "button", className: "btn-fantasma ml-auto px-1.5 py-0 text-[11px] text-bad", onClick: () => {
                            descartarTake(t.id);
                            despachar({ tipo: 'adRemoverTake', blocoId, takeId: t.id });
                        }, children: "Descartar" })] })) : null] }));
}
