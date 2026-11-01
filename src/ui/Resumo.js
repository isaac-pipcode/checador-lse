import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { calcularMetricas, contarPorSeveridade } from '../core/metricas';
import { Metrica } from './primitivos';
const n1 = (x) => x.toFixed(1).replace('.', ',');
const n2 = (x) => x.toFixed(2).replace('.', ',');
/** `chips`: contadores (faixa fixa do painel); `metricas`: números da obra. */
export function Resumo({ variante }) {
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const metricas = useMemo(() => calcularMetricas(estado.cues, estado.config), [estado.cues, estado.config]);
    const contagem = useMemo(() => contarPorSeveridade(estado.sugestoes), [estado.sugestoes]);
    const decisoes = useMemo(() => {
        const c = { pendente: 0, aprovada: 0, rejeitada: 0, editada: 0 };
        for (const i of Object.values(estado.review))
            c[i.decision]++;
        return c;
    }, [estado.review]);
    if (variante === 'chips') {
        return (_jsxs("ul", { "aria-label": "Resumo da an\u00E1lise", className: "flex shrink-0 flex-wrap gap-1 border-b border-paper-400 px-3 py-1.5", children: [_jsxs("li", { className: "chip border-bad bg-bad-100 text-bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u2715" }), " ", contagem.erro, " erro", contagem.erro === 1 ? '' : 's'] }), _jsxs("li", { className: "chip border-warn bg-warn-100 text-warn", children: [_jsx("span", { "aria-hidden": "true", children: "!" }), " ", contagem.aviso, " aviso", contagem.aviso === 1 ? '' : 's'] }), _jsxs("li", { className: "chip border-navy-500 bg-paper-200 text-navy-700", children: [_jsx("span", { "aria-hidden": "true", children: "?" }), " ", contagem.revisao_manual, " manuais"] }), _jsxs("li", { className: "chip border-ok bg-ok-100 text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713" }), " ", decisoes.aprovada + decisoes.editada, " decididas"] }), _jsxs("li", { className: "chip border-navy-500 bg-paper text-navy-700", children: [decisoes.pendente, " pendentes"] })] }));
    }
    return (_jsxs("dl", { className: "grid grid-cols-2 gap-1.5", children: [_jsx(Metrica, { rotulo: "Legendas", valor: String(metricas.totalLegendas) }), _jsx(Metrica, { rotulo: "CPS m\u00E9dia", valor: n2(metricas.cpsMedia), detalhe: `alvo ${estado.config.cpsAlvo}` }), _jsx(Metrica, { rotulo: "CPS m\u00E1xima", valor: n2(metricas.cpsMaxima), detalhe: metricas.cpsMaximaIndice ? `legenda ${metricas.cpsMaximaIndice}` : undefined }), _jsx(Metrica, { rotulo: "Dentro do alvo", valor: `${n1(metricas.percentualDentroDoAlvo)}%`, detalhe: `${n1(final.metricas.percentualDentroDoAlvo)}% após decisões` }), _jsx(Metrica, { rotulo: `Linhas > ${estado.config.maxCaracteresPorLinha}`, valor: String(metricas.linhasAcimaDoLimite), detalhe: `${final.metricas.linhasAcimaDoLimite} após decisões` }), _jsx(Metrica, { rotulo: "Sobreposi\u00E7\u00F5es", valor: String(metricas.sobreposicoes), detalhe: `${final.metricas.sobreposicoes} após decisões` })] }));
}
