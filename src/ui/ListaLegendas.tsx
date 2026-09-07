import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { DOCUMENT_SCOPE } from '../model/types';
import { useEstado, useResultadoFinal, useSugestoesFiltradas } from '../state/store';
import { ItemLegenda } from './ItemLegenda';
import { CardSugestao } from './CardSugestao';

export function ListaLegendas({ mostrarPrevia }: { mostrarPrevia: boolean }) {
  const { estado } = useEstado();
  const filtradas = useSugestoesFiltradas();
  const final = useResultadoFinal();
  const container = useRef<HTMLDivElement>(null);

  const porLegenda = useMemo(() => {
    const m = new Map<number, typeof filtradas>();
    for (const s of filtradas) {
      if (s.cueIndex === DOCUMENT_SCOPE) continue;
      const lista = m.get(s.cueIndex);
      if (lista) lista.push(s);
      else m.set(s.cueIndex, [s]);
    }
    return m;
  }, [filtradas]);

  const documento = useMemo(
    () => filtradas.filter((s) => s.cueIndex === DOCUMENT_SCOPE),
    [filtradas],
  );

  const f = estado.filtros;
  const filtroAtivo =
    f.regra !== 'todas' ||
    f.severidade !== 'todas' ||
    f.somentePendentes ||
    f.de !== null ||
    f.ate !== null ||
    f.busca.trim() !== '';

  const visiveis = useMemo(() => {
    if (!filtroAtivo) return estado.cues;
    return estado.cues.filter((c) => porLegenda.has(c.index));
  }, [estado.cues, porLegenda, filtroAtivo]);

  const finaisPorIndice = useMemo(
    () => new Map(final.cues.map((c) => [c.index, c.lines])),
    [final.cues],
  );

  /** Violações que sobrevivem às decisões tomadas, por legenda. */
  const remanescentesPorIndice = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of final.remanescentes) {
      if (s.cueIndex === DOCUMENT_SCOPE || s.severity === 'revisao_manual') continue;
      m.set(s.cueIndex, (m.get(s.cueIndex) ?? 0) + 1);
    }
    return m;
  }, [final.remanescentes]);

  // Virtualização ancorada na rolagem da própria página: evita um contêiner de
  // rolagem aninhado (armadilha de teclado e de leitor de tela) e continua
  // dando conta de milhares de legendas.
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const medir = () => {
      if (container.current) setOffset(container.current.offsetTop);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [visiveis.length, documento.length]);

  const virtualizer = useWindowVirtualizer({
    count: visiveis.length,
    estimateSize: () => 220,
    overscan: 6,
    scrollMargin: offset,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {documento.length > 0 ? (
        <section aria-labelledby="titulo-documento" className="border-b border-paper-400 px-4 py-3">
          <h3 id="titulo-documento" className="text-sm font-semibold">
            Apontamentos da obra inteira
          </h3>
          <ul className="mt-2 space-y-2">
            {documento.map((s) => {
              const item = estado.review[s.id];
              return item ? (
                <li key={s.id}>
                  <CardSugestao item={item} />
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}

      <div ref={container} aria-label="Lista de legendas">
        {visiveis.length === 0 ? (
          <p className="px-4 py-8 text-center text-navy-700">
            Nenhuma legenda corresponde aos filtros atuais.
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const cue = visiveis[v.index];
              return (
                <div
                  key={cue.index}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${v.start - offset}px)`,
                  }}
                >
                  <ItemLegenda
                    cue={cue}
                    sugestoes={porLegenda.get(cue.index) ?? []}
                    review={estado.review}
                    config={estado.config}
                    linhasFinais={finaisPorIndice.get(cue.index)}
                    remanescentes={remanescentesPorIndice.get(cue.index) ?? 0}
                    mostrarPrevia={mostrarPrevia}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
