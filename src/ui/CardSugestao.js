import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useState } from 'react';
import { META_POR_ID } from '../rules';
import { useAcoes } from '../state/store';
import { ChipConfianca, ChipSeveridade, ChipVerificabilidade } from './primitivos';
import { formatarTimecode } from '../core/texto';
import { PainelLlm } from './PainelLlm';
const ROTULO_DECISAO = {
    pendente: { texto: 'Pendente', icone: '○', classe: 'border-navy-500 bg-paper text-navy-700' },
    aprovada: { texto: 'Aprovada', icone: '✓', classe: 'border-ok bg-ok-100 text-ok' },
    rejeitada: { texto: 'Rejeitada', icone: '✕', classe: 'border-bad bg-bad-100 text-bad' },
    editada: { texto: 'Editada', icone: '✎', classe: 'border-ok bg-ok-100 text-ok' },
};
export function CardSugestao({ item }) {
    const acoes = useAcoes();
    const s = item.suggestion;
    const meta = META_POR_ID.get(s.ruleId);
    const idBase = useId();
    const [editando, setEditando] = useState(false);
    const propostaAtual = item.editedAfter?.lines ?? s.after?.lines ?? s.before.lines;
    const [rascunho, setRascunho] = useState(propostaAtual.join('\n'));
    const ehManual = s.verifiability === 'manual';
    const estado = ROTULO_DECISAO[item.decision];
    const mudaTempo = s.after &&
        ((typeof s.after.startMs === 'number' && s.after.startMs !== s.before.startMs) ||
            (typeof s.after.endMs === 'number' && s.after.endMs !== s.before.endMs));
    const mudaTexto = s.after && s.after.lines.join('\n') !== s.before.lines.join('\n');
    /** Move o foco para o apontamento anterior/seguinte já renderizado. */
    function irPara(passo) {
        const cards = Array.from(document.querySelectorAll('article[data-sugestao]')).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const atual = cards.findIndex((c) => c.dataset.sugestao === s.id);
        const alvo = cards[atual + passo];
        if (alvo) {
            alvo.focus();
            alvo.scrollIntoView({ block: 'nearest' });
        }
    }
    function atalhos(e) {
        if (editando)
            return;
        const alvo = e.target;
        if (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT')
            return;
        const k = e.key.toLowerCase();
        if (k === 'a') {
            e.preventDefault();
            acoes.decidir(s.id, 'aprovada');
        }
        else if (k === 'r') {
            e.preventDefault();
            acoes.decidir(s.id, ehManual ? 'pendente' : 'rejeitada');
        }
        else if (k === 'e' && s.after) {
            e.preventDefault();
            setEditando(true);
        }
        else if (k === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            irPara(1);
        }
        else if (k === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            irPara(-1);
        }
    }
    return (_jsxs("article", { className: "rounded-lg border border-paper-400 bg-paper-200 p-3", "data-sugestao": s.id, "aria-labelledby": `${idBase}-titulo`, tabIndex: 0, onKeyDown: atalhos, children: [_jsxs("header", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("h4", { id: `${idBase}-titulo`, className: "text-sm font-semibold", children: [s.ruleId, " \u2014 ", meta?.nome ?? 'Regra'] }), _jsx(ChipSeveridade, { severidade: s.severity }), _jsx(ChipVerificabilidade, { v: s.verifiability }), typeof s.confidence === 'number' && s.confidence > 0 && !s.unavailable ? (_jsx(ChipConfianca, { valor: s.confidence })) : null, _jsxs("span", { className: `chip ml-auto ${estado.classe}`, children: [_jsx("span", { "aria-hidden": "true", children: estado.icone }), estado.texto] })] }), _jsx("p", { className: "mt-2 text-sm text-navy", children: s.message }), meta ? _jsxs("p", { className: "mt-1 text-xs text-navy-500", children: ["Fundamento: ", meta.fundamento] }) : null, s.unavailable ? _jsx(PainelLlm, { sugestao: s }) : null, mudaTexto && !editando ? (_jsxs("div", { className: "mt-3 overflow-x-auto rounded border border-paper-400 bg-paper p-2 font-mono text-sm", children: [_jsx("p", { className: "sr-only", children: "Texto original seguido do texto proposto." }), s.before.lines.map((l, i) => (_jsxs("div", { className: "text-bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u2212 " }), _jsx("span", { className: "line-through decoration-bad", children: l || '␣' })] }, `a${i}`))), (item.editedAfter?.lines ?? s.after?.lines ?? []).map((l, i) => (_jsxs("div", { className: "text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "+ " }), _jsx("span", { children: l || '␣' })] }, `d${i}`)))] })) : null, mudaTempo ? (_jsxs("p", { className: "mt-2 font-mono text-sm", children: [_jsxs("span", { className: "text-bad line-through", children: [formatarTimecode(s.before.startMs ?? 0), " \u2192 ", formatarTimecode(s.before.endMs ?? 0)] }), ' ', _jsx("span", { "aria-hidden": "true", children: "\u21D2" }), ' ', _jsxs("span", { className: "text-ok", children: [formatarTimecode(s.after?.startMs ?? s.before.startMs ?? 0), " \u2192", ' ', formatarTimecode(s.after?.endMs ?? s.before.endMs ?? 0)] })] })) : null, editando ? (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("label", { className: "rotulo", htmlFor: `${idBase}-editor`, children: "Texto proposto (uma linha por linha da legenda)" }), _jsx("textarea", { id: `${idBase}-editor`, className: "campo font-mono", rows: Math.max(2, rascunho.split('\n').length), value: rascunho, onChange: (e) => setRascunho(e.target.value) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: "btn-primario", onClick: () => {
                                    acoes.editar(s.id, rascunho.split('\n').map((l) => l));
                                    setEditando(false);
                                }, children: "Salvar edi\u00E7\u00E3o" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => {
                                    setRascunho(propostaAtual.join('\n'));
                                    setEditando(false);
                                }, children: "Cancelar" })] })] })) : (_jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: ehManual ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "btn-primario", onClick: () => acoes.decidir(s.id, 'aprovada'), "aria-pressed": item.decision === 'aprovada', children: [_jsx("span", { "aria-hidden": "true", children: "\u2713" }), " Confirmar que revisei"] }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => acoes.decidir(s.id, 'pendente'), "aria-pressed": item.decision === 'pendente', children: "Marcar como pend\u00EAncia" })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "btn-primario", onClick: () => acoes.decidir(s.id, 'aprovada'), "aria-pressed": item.decision === 'aprovada', children: [_jsx("span", { "aria-hidden": "true", children: "\u2713" }), " Aprovar", _jsx("span", { className: "sr-only", children: " (tecla A)" })] }), _jsxs("button", { type: "button", className: "btn-secundario", onClick: () => acoes.decidir(s.id, 'rejeitada'), "aria-pressed": item.decision === 'rejeitada', children: [_jsx("span", { "aria-hidden": "true", children: "\u2715" }), " Rejeitar", _jsx("span", { className: "sr-only", children: " (tecla R)" })] }), s.after ? (_jsxs("button", { type: "button", className: "btn-secundario", onClick: () => {
                                setRascunho(propostaAtual.join('\n'));
                                setEditando(true);
                            }, children: [_jsx("span", { "aria-hidden": "true", children: "\u270E" }), " Editar", _jsx("span", { className: "sr-only", children: " (tecla E)" })] })) : null, item.decision !== 'pendente' ? (_jsx("button", { type: "button", className: "btn-fantasma", onClick: () => acoes.decidir(s.id, 'pendente'), children: "Voltar a pendente" })) : null] })) })), !s.after && !ehManual ? (_jsx("p", { className: "mt-2 text-xs text-navy-500", children: "Esta regra n\u00E3o prop\u00F5e corre\u00E7\u00E3o autom\u00E1tica: aprovar apenas registra a ci\u00EAncia da viola\u00E7\u00E3o no relat\u00F3rio, sem alterar o arquivo." })) : null] }));
}
