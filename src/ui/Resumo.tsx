import { useMemo } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { calcularMetricas, contarPorSeveridade } from '../core/metricas';
import { Metrica } from './primitivos';

const n1 = (x: number) => x.toFixed(1).replace('.', ',');
const n2 = (x: number) => x.toFixed(2).replace('.', ',');

export function Resumo() {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const metricas = useMemo(
    () => calcularMetricas(estado.cues, estado.config),
    [estado.cues, estado.config],
  );
  const contagem = useMemo(() => contarPorSeveridade(estado.sugestoes), [estado.sugestoes]);
  const decisoes = useMemo(() => {
    const c = { pendente: 0, aprovada: 0, rejeitada: 0, editada: 0 };
    for (const i of Object.values(estado.review)) c[i.decision]++;
    return c;
  }, [estado.review]);

  return (
    <section aria-labelledby="titulo-resumo" className="border-b border-paper-400 px-3 py-2">
      <h2 id="titulo-resumo" className="sr-only-focusable">
        Resumo da análise
      </h2>

      <ul className="flex flex-wrap gap-1.5 text-sm">
        <li className="chip border-bad bg-bad-100 text-bad">
          <span aria-hidden="true">✕</span> {contagem.erro} erro{contagem.erro === 1 ? '' : 's'}
        </li>
        <li className="chip border-warn bg-warn-100 text-warn">
          <span aria-hidden="true">!</span> {contagem.aviso} aviso{contagem.aviso === 1 ? '' : 's'}
        </li>
        <li className="chip border-navy-500 bg-paper-200 text-navy-700">
          <span aria-hidden="true">?</span> {contagem.revisao_manual} para revisão manual
        </li>
        <li className="chip border-ok bg-ok-100 text-ok">
          <span aria-hidden="true">✓</span> {decisoes.aprovada + decisoes.editada} decididas
        </li>
        <li className="chip border-navy-500 bg-paper text-navy-700">
          {decisoes.pendente} pendentes
        </li>
      </ul>

      <details className="mt-1.5">
        <summary className="cursor-pointer text-2xs font-medium uppercase tracking-wide text-navy-500">Métricas da obra</summary>
      <dl className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Metrica rotulo="Legendas" valor={String(metricas.totalLegendas)} />
        <Metrica
          rotulo="CPS média"
          valor={n2(metricas.cpsMedia)}
          detalhe={`alvo ${estado.config.cpsAlvo}`}
        />
        <Metrica
          rotulo="CPS máxima"
          valor={n2(metricas.cpsMaxima)}
          detalhe={metricas.cpsMaximaIndice ? `legenda ${metricas.cpsMaximaIndice}` : undefined}
        />
        <Metrica
          rotulo="Dentro do alvo"
          valor={`${n1(metricas.percentualDentroDoAlvo)}%`}
          detalhe={`${n1(final.metricas.percentualDentroDoAlvo)}% após decisões`}
        />
        <Metrica
          rotulo={`Linhas > ${estado.config.maxCaracteresPorLinha}`}
          valor={String(metricas.linhasAcimaDoLimite)}
          detalhe={`${final.metricas.linhasAcimaDoLimite} após decisões`}
        />
        <Metrica
          rotulo="Sobreposições"
          valor={String(metricas.sobreposicoes)}
          detalhe={`${final.metricas.sobreposicoes} após decisões`}
        />
      </dl>
      </details>
    </section>
  );
}
