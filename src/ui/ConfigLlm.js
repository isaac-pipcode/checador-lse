import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from 'react';
import { MODELOS } from '../llm/cliente';
import { useAcoes, useDespachar, useEstado } from '../state/store';
import { Campo } from './primitivos';
/**
 * Configuração do módulo opcional de LLM. Desligado por padrão, com aviso
 * explícito. A chave fica só em memória: recarregar a página a descarta.
 */
export function ConfigLlm() {
    const { estado } = useEstado();
    const acoes = useAcoes();
    const despachar = useDespachar();
    const [aberto, setAberto] = useState(false);
    const idBase = useId();
    const ativo = estado.config.llmAtivo;
    return (_jsxs("div", { className: "text-sm", children: [_jsxs("button", { type: "button", className: "btn-fantasma", "aria-expanded": aberto, "aria-controls": `${idBase}-corpo`, onClick: () => setAberto((v) => !v), children: [_jsx("span", { "aria-hidden": "true", children: aberto ? '▾' : '▸' }), "M\u00F3dulo assistido (LLM): ", ativo ? 'ativo' : 'desligado'] }), _jsxs("div", { id: `${idBase}-corpo`, hidden: !aberto, className: "mt-2 max-w-xl rounded border border-paper-400 bg-paper p-3", children: [_jsxs("p", { className: "text-navy-700", children: ["Todo o restante do checador funciona ", _jsx("strong", { children: "offline" }), ". Ativando este m\u00F3dulo, o texto das legendas para as quais voc\u00EA pedir uma proposta \u2014 e somente elas \u2014 \u00E9 enviado \u00E0 API da Anthropic. A chave fica apenas na mem\u00F3ria desta aba e n\u00E3o \u00E9 gravada em lugar nenhum."] }), _jsxs("label", { className: "mt-3 flex items-start gap-2", children: [_jsx("input", { type: "checkbox", className: "mt-1", checked: ativo, onChange: (e) => acoes.config({ llmAtivo: e.target.checked }) }), _jsxs("span", { children: ["Ativar chamadas ao provedor", _jsx("span", { className: "block text-xs text-navy-500", children: "Toda sa\u00EDda do modelo entra como sugest\u00E3o e passa pela sua aprova\u00E7\u00E3o." })] })] }), ativo ? (_jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsx(Campo, { id: `${idBase}-chave`, rotulo: "Chave de API (Anthropic)", dica: "Somente em mem\u00F3ria; n\u00E3o \u00E9 salva.", children: _jsx("input", { id: `${idBase}-chave`, className: "campo", type: "password", autoComplete: "off", value: estado.llm.apiKey, onChange: (e) => despachar({ tipo: 'llm', mudanca: { apiKey: e.target.value } }) }) }), _jsx(Campo, { id: `${idBase}-modelo`, rotulo: "Modelo", children: _jsx("select", { id: `${idBase}-modelo`, className: "campo", value: estado.llm.modelo, onChange: (e) => despachar({ tipo: 'llm', mudanca: { modelo: e.target.value } }), children: MODELOS.map((m) => (_jsx("option", { value: m.id, children: m.rotulo }, m.id))) }) })] })) : null] })] }));
}
