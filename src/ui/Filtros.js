import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from "react";
import { CATALOGO } from "../rules";
import { useAcoes, useEstado } from "../state/store";
const REGRAS_LOTE = ["C8", "C2", "C1", "C5", "T6", "T7"];
/**
 * Barra de filtros compacta, no topo da lista: regra, severidade, busca e
 * pendentes à vista; o intervalo de legendas fica em "mais filtros".
 */
export function Filtros() {
    const { estado } = useEstado();
    const acoes = useAcoes();
    const idBase = useId();
    const f = estado.filtros;
    const [mais, setMais] = useState(f.de !== null || f.ate !== null);
    const ativos = (f.regra !== "todas" ? 1 : 0) +
        (f.severidade !== "todas" ? 1 : 0) +
        (f.somentePendentes ? 1 : 0) +
        (f.de !== null || f.ate !== null ? 1 : 0) +
        (f.busca.trim() ? 1 : 0);
    return (_jsxs("section", { "aria-label": "Filtros", className: "border-b border-paper-400 px-3 py-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-1.5", children: [_jsxs("select", { "aria-label": "Regra", className: "campo", value: f.regra, onChange: (e) => acoes.filtros({ regra: e.target.value }), children: [_jsx("option", { value: "todas", children: "Todas as regras" }), CATALOGO.map((r) => (_jsxs("option", { value: r.id, children: [r.id, " \u2014 ", r.nome] }, r.id)))] }), _jsxs("select", { "aria-label": "Severidade", className: "campo", value: f.severidade, onChange: (e) => acoes.filtros({ severidade: e.target.value }), children: [_jsx("option", { value: "todas", children: "Todas as severidades" }), _jsx("option", { value: "erro", children: "Erro" }), _jsx("option", { value: "aviso", children: "Aviso" }), _jsx("option", { value: "revisao_manual", children: "Revis\u00E3o manual" })] }), _jsx("input", { "aria-label": "Buscar na justificativa", placeholder: "Buscar na justificativa\u2026", className: "campo", type: "search", value: f.busca, onChange: (e) => acoes.filtros({ busca: e.target.value }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-1.5 text-xs", children: [_jsx("input", { type: "checkbox", checked: f.somentePendentes, onChange: (e) => acoes.filtros({ somentePendentes: e.target.checked }) }), "S\u00F3 pendentes"] }), _jsx("button", { type: "button", className: "btn-fantasma ml-auto h-7 px-2 text-2xs", "aria-expanded": mais, "aria-controls": `${idBase}-mais`, onClick: () => setMais((v) => !v), children: mais ? "Menos" : "Mais" })] })] }), _jsx("div", { id: `${idBase}-mais`, hidden: !mais, className: "mt-1.5", children: _jsxs("div", { className: "flex items-center gap-1.5 text-xs", children: [_jsx("label", { htmlFor: `${idBase}-de`, children: "Legendas de" }), _jsx("input", { id: `${idBase}-de`, className: "campo w-20", type: "number", min: 1, value: f.de ?? "", onChange: (e) => acoes.filtros({
                                de: e.target.value ? Number(e.target.value) : null,
                            }) }), _jsx("label", { htmlFor: `${idBase}-ate`, children: "at\u00E9" }), _jsx("input", { id: `${idBase}-ate`, className: "campo w-20", type: "number", min: 1, value: f.ate ?? "", onChange: (e) => acoes.filtros({
                                ate: e.target.value ? Number(e.target.value) : null,
                            }) })] }) }), ativos > 0 ? (_jsxs("p", { className: "mt-1.5 flex items-center text-2xs text-navy-500", role: "status", children: [ativos, " filtro", ativos > 1 ? "s" : "", " ativo", ativos > 1 ? "s" : "", _jsx("button", { type: "button", className: "btn-fantasma ml-auto h-6 px-2 text-2xs", onClick: () => acoes.filtros({
                            regra: "todas",
                            severidade: "todas",
                            somentePendentes: false,
                            de: null,
                            ate: null,
                            busca: "",
                        }), children: "Limpar filtros" })] })) : null] }));
}
/** Aprovação em lote — só auto-correções determinísticas pendentes. */
export function AcoesLote() {
    const { estado } = useEstado();
    const acoes = useAcoes();
    const pendentesPorRegra = (ruleId) => Object.values(estado.review).filter((i) => i.suggestion.ruleId === ruleId &&
        i.decision === "pendente" &&
        i.suggestion.autoFixable &&
        i.suggestion.verifiability === "deterministica").length;
    const meta = new Map(CATALOGO.map((r) => [r.id, r.nome]));
    return (_jsxs("div", { children: [_jsx("ul", { className: "space-y-1", children: REGRAS_LOTE.map((id) => {
                    const n = pendentesPorRegra(id);
                    return (_jsxs("li", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "w-8 font-mono text-navy-500", children: id }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: meta.get(id) }), _jsxs("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", disabled: n === 0, onClick: () => acoes.lote(id), children: ["Aprovar ", n] })] }, id));
                }) }), estado.historicoLote.length > 0 ? (_jsxs("button", { type: "button", className: "btn-fantasma mt-2 h-7 px-2 text-2xs", onClick: () => acoes.desfazerLote(), children: [_jsx("span", { "aria-hidden": "true", children: "\u21B6" }), " Desfazer \u00FAltimo lote"] })) : null] }));
}
