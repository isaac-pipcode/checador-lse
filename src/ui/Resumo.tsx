import { useMemo } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { calcularMetricas, contarPorSeveridade } from '../core/metricas';
import { Metrica } from './primitivos';
import { Icone } from './icones';

const n1 = (x: number) => x.toFixed(1).replace('.', ',');
const n2 = (x: number) => x.toFixed(2).replace('.', ',');

/** `chips`: contadores (faixa fixa do painel); `metricas`: números da obra. */
export function Resumo({ variante }: { variante: 'chips' | 'metricas' }) {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const metricas = useMemo(() => calcularMetricas(estado.cues, estado.config), [estado.cues, estado.config]);
  const contagem = useMemo(() => contarPorSeveridade(estado.sugestoes), [estado.sugestoes]);
  const decisoes = useMemo(() => {
    const c = { pendente: 0, aprovada: 0, rejeitada: 0, editada: 0 };
    for (const i of Object.values(estado.review)) c[i.decision]++;
    return c;
  }, [estado.review]);

  if (variante === 'chips') {
    return (
      <ul
        aria-label="Resumo da análise"
        className="flex shrink-0 flex-wrap gap-1 border-b border-paper-400 px-3 py-1.5"
      >
        <li className="chip border-bad bg-bad-100 text-bad">
          <Icone nome="erro" tamanho={14} /> {contagem.erro} erro{contagem.erro === 1 ? '' : 's'}
        </li>
        <li className="chip border-warn bg-warn-100 text-warn">
          <Icone nome="aviso" tamanho={14} /> {contagem.aviso} aviso{contagem.aviso === 1 ? '' : 's'}
        </li>
        <li className="chip border-navy-500 bg-paper-200 text-navy-700">
          <span aria-hidden="true">?</span> {contagem.revisao_manual} manuais
        </li>
        <li className="chip border-ok bg-ok-100 text-ok">
          <Icone nome="ok" tamanho={14} /> {decisoes.aprovada + decisoes.editada} decididas
        </li>
        <li className="chip border-navy-500 bg-paper text-navy-700">{decisoes.pendente} pendentes</li>
      </ul>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-1.5">
      <Metrica rotulo="Legendas" valor={String(metricas.totalLegendas)} />
      <Metrica rotulo="CPS média" valor={n2(metricas.cpsMedia)} detalhe={`alvo ${estado.config.cpsAlvo}`} />
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
  );
}
