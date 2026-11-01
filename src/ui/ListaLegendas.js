import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DOCUMENT_SCOPE } from '../model/types';
import { useEstado, useResultadoFinal, useSugestoesFiltradas } from '../state/store';
import { ItemLegenda } from './ItemLegenda';
import { CardSugestao } from './CardSugestao';
export function ListaLegendas({ mostrarPrevia, rolagem, }) {
    const { estado, despachar } = useEstado();
    const filtradas = useSugestoesFiltradas();
    const final = useResultadoFinal();
    const container = useRef(null);
    const porLegenda = useMemo(() => {
        const m = new Map();
        for (const s of filtradas) {
            if (s.cueIndex === DOCUMENT_SCOPE)
                continue;
            const lista = m.get(s.cueIndex);
            if (lista)
                lista.push(s);
            else
                m.set(s.cueIndex, [s]);
        }
        return m;
    }, [filtradas]);
    const documento = useMemo(() => filtradas.filter((s) => s.cueIndex === DOCUMENT_SCOPE), [filtradas]);
    const f = estado.filtros;
    const filtroAtivo = f.regra !== 'todas' ||
        f.severidade !== 'todas' ||
        f.somentePendentes ||
        f.de !== null ||
        f.ate !== null ||
        f.busca.trim() !== '';
    const visiveis = useMemo(() => {
        if (!filtroAtivo)
            return estado.cues;
        return estado.cues.filter((c) => porLegenda.has(c.index));
    }, [estado.cues, porLegenda, filtroAtivo]);
    const finaisPorIndice = useMemo(() => new Map(final.cues.map((c) => [c.index, c.lines])), [final.cues]);
    /** Violações que sobrevivem às decisões tomadas, por legenda. */
    const remanescentesPorIndice = useMemo(() => {
        const m = new Map();
        for (const s of final.remanescentes) {
            if (s.cueIndex === DOCUMENT_SCOPE || s.severity === 'revisao_manual')
                continue;
            m.set(s.cueIndex, (m.get(s.cueIndex) ?? 0) + 1);
        }
        return m;
    }, [final.remanescentes]);
    // Virtualização dentro do painel (layout de editor: cada painel rola por si).
    // O deslocamento é a posição da lista dentro do elemento que rola.
    const [offset, setOffset] = useState(0);
    useLayoutEffect(() => {
        const medir = () => {
            const c = container.current;
            const r = rolagem.current;
            if (c && r)
                setOffset(c.getBoundingClientRect().top - r.getBoundingClientRect().top + r.scrollTop);
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [visiveis.length, documento.length, rolagem]);
    const virtualizer = useVirtualizer({
        count: visiveis.length,
        getScrollElement: () => rolagem.current,
        estimateSize: () => 220,
        overscan: 6,
        scrollMargin: offset,
    });
    // Pedido vindo da linha do tempo: rola até a legenda (mesmo fora da janela
    // virtualizada) e leva o foco ao seu título.
    const pedido = estado.pedidoLista;
    useEffect(() => {
        if (!pedido)
            return;
        const i = visiveis.findIndex((c) => c.index === pedido.index);
        if (i < 0)
            return;
        virtualizer.scrollToIndex(i, { align: 'center' });
        const t = window.setTimeout(() => {
            const el = document.getElementById(`legenda-${pedido.index}`);
            if (el) {
                el.setAttribute('tabindex', '-1');
                el.focus({ preventScroll: true });
            }
        }, 120);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pedido]);
    const temVideo = estado.video !== null;
    return (_jsx("div", { className: "flex min-h-0 flex-1 flex-col", children: _jsx("div", { ref: container, role: "region", "aria-label": "Lista de legendas", children: visiveis.length === 0 ? (_jsx("p", { className: "px-4 py-8 text-center text-navy-700", children: "Nenhuma legenda corresponde aos filtros atuais." })) : (_jsx("div", { style: { height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }, children: virtualizer.getVirtualItems().map((v) => {
                    const cue = visiveis[v.index];
                    return (_jsx("div", { "data-index": v.index, ref: virtualizer.measureElement, style: {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${v.start - offset}px)`,
                        }, children: _jsx(ItemLegenda, { cue: cue, sugestoes: porLegenda.get(cue.index) ?? [], review: estado.review, config: estado.config, linhasFinais: finaisPorIndice.get(cue.index), remanescentes: remanescentesPorIndice.get(cue.index) ?? 0, mostrarPrevia: mostrarPrevia, aoVerNoVideo: temVideo ? () => despachar({ tipo: 'seek', ms: cue.startMs }) : undefined }) }, cue.index));
                }) })) }) }));
}
/**
 * Apontamentos de escopo da obra inteira (checklists manuais, som sem legenda…),
 * numa aba própria para não empurrar a lista de legendas.
 */
export function ApontamentosObra() {
    const { estado } = useEstado();
    const filtradas = useSugestoesFiltradas();
    const documento = filtradas.filter((s) => s.cueIndex === DOCUMENT_SCOPE);
    if (documento.length === 0) {
        return (_jsx("p", { className: "p-4 text-center text-xs text-navy-500", children: "Nenhum apontamento de escopo da obra com os filtros atuais." }));
    }
    return (_jsx("ul", { className: "space-y-2 p-3", children: documento.map((s) => {
            const item = estado.review[s.id];
            return item ? (_jsx("li", { children: _jsx(CardSugestao, { item: item }) }, s.id)) : null;
        }) }));
}
export function useContagemObra() {
    const { estado } = useEstado();
    const doc = estado.sugestoes.filter((s) => s.cueIndex === DOCUMENT_SCOPE);
    return { total: doc.length, pendentes: doc.filter((s) => estado.review[s.id]?.decision === 'pendente').length };
}
