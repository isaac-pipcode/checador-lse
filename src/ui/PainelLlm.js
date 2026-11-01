import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useDespachar, useEstado } from '../state/store';
import { ClienteLlm, descreverErroLlm } from '../llm/cliente';
/**
 * Aparece dentro de sugestões cujo módulo assistido está indisponível.
 * Nenhuma chamada acontece sem que o usuário ligue o módulo e clique aqui.
 */
export function PainelLlm({ sugestao }) {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState(null);
    const ehL2 = sugestao.ruleId === 'L2';
    const ehL1 = sugestao.ruleId === 'L1';
    const podeChamar = estado.config.llmAtivo && estado.llm.apiKey.trim().length > 0 && ehL2;
    if (ehL1 && !estado.config.nlpAtivo) {
        return (_jsxs("p", { className: "mt-2 rounded border border-navy-500 bg-paper px-3 py-2 text-sm text-navy-700", children: ["Ligue o m\u00F3dulo de segmenta\u00E7\u00E3o nos par\u00E2metros para que L1 seja verificada. Enquanto desligado, esta regra permanece ", _jsx("strong", { children: "n\u00E3o verificada" }), " \u2014 o checador n\u00E3o substitui a an\u00E1lise por heur\u00EDstica fr\u00E1gil."] }));
    }
    if (!ehL2)
        return null;
    const cue = estado.cues.find((c) => c.index === sugestao.cueIndex);
    async function gerar() {
        if (!cue)
            return;
        setErro(null);
        setOcupado(true);
        try {
            const cliente = new ClienteLlm({ apiKey: estado.llm.apiKey, modelo: estado.llm.modelo });
            const p = await cliente.reduzir(cue, estado.config);
            despachar({
                tipo: 'sugestaoLlm',
                base: sugestao,
                after: { lines: p.propostaLinhas },
                confianca: p.confianca,
                texto: `Redução por ${p.estrategia}: ${p.justificativa}`,
            });
        }
        catch (e) {
            setErro(descreverErroLlm(e));
        }
        finally {
            setOcupado(false);
        }
    }
    return (_jsx("div", { className: "mt-2 rounded border border-navy-500 bg-paper px-3 py-2 text-sm", children: podeChamar ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-navy-700", children: "A proposta de redu\u00E7\u00E3o ser\u00E1 gerada pelo modelo e vir\u00E1 com grau de confian\u00E7a, para sua aprova\u00E7\u00E3o. O texto desta legenda ser\u00E1 enviado ao provedor." }), _jsx("button", { type: "button", className: "btn-secundario mt-2", onClick: gerar, disabled: ocupado, children: ocupado ? 'Consultando…' : 'Gerar proposta de redução' }), erro ? (_jsxs("p", { role: "alert", className: "mt-2 text-bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u2715 " }), erro] })) : null] })) : (_jsxs("p", { className: "text-navy-700", children: ["Redu\u00E7\u00E3o textual exige o m\u00F3dulo assistido, que est\u00E1 desligado. Ative-o em", ' ', _jsx("strong", { children: "M\u00F3dulo assistido" }), ", no topo da tela, ciente de que isso envia o texto das legendas escolhidas ao provedor."] })) }));
}
