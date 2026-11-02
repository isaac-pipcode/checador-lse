import type { ReactNode } from 'react';
import type { Severity, Verifiability } from '../model/types';
import { Icone, type NomeIcone } from './icones';

/**
 * Severidade e status nunca são sinalizados só por cor (WCAG 2.2, 1.4.1):
 * cada chip traz ícone + rótulo escrito.
 */

export const ICONE_SEVERIDADE: Record<Severity, NomeIcone> = {
  erro: 'erro',
  aviso: 'aviso',
  revisao_manual: 'revisao',
};

export const ROTULO_SEVERIDADE: Record<Severity, string> = {
  erro: 'Erro',
  aviso: 'Aviso',
  revisao_manual: 'Revisão manual',
};

const CLASSE_SEVERIDADE: Record<Severity, string> = {
  erro: 'border-bad bg-bad-100 text-bad',
  aviso: 'border-warn bg-warn-100 text-warn',
  revisao_manual: 'border-navy-500 bg-paper-200 text-navy-700',
};

export function ChipSeveridade({ severidade }: { severidade: Severity }) {
  return (
    <span className={`chip ${CLASSE_SEVERIDADE[severidade]}`}>
      <Icone nome={ICONE_SEVERIDADE[severidade]} tamanho={12} />
      {ROTULO_SEVERIDADE[severidade]}
    </span>
  );
}

export const ROTULO_VERIFICABILIDADE: Record<Verifiability, string> = {
  deterministica: 'Determinística',
  nlp: 'Assistida (NLP)',
  llm: 'Assistida (LLM)',
  sinal: 'Assistida (sinal)',
  manual: 'Manual',
};

export const EXPLICACAO_VERIFICABILIDADE: Record<Verifiability, string> = {
  deterministica: 'Verificação objetiva a partir do próprio arquivo.',
  nlp: 'Inferência do módulo de segmentação; vem com grau de confiança.',
  llm: 'Proposta gerada por modelo de linguagem; vem com grau de confiança.',
  sinal: 'Inferência sobre o áudio e a imagem do vídeo (energia, diferença entre quadros); vem com grau de confiança.',
  manual: 'Não verificável a partir do texto isolado: exige o vídeo ou o áudio.',
};

export function ChipVerificabilidade({ v }: { v: Verifiability }) {
  return (
    <span className="chip border-navy-500 bg-paper text-navy-700" title={EXPLICACAO_VERIFICABILIDADE[v]}>
      {ROTULO_VERIFICABILIDADE[v]}
    </span>
  );
}

export function ChipConfianca({ valor }: { valor: number }) {
  const pct = Math.round(valor * 100);
  const nivel = valor >= 0.75 ? 'alta' : valor >= 0.5 ? 'média' : 'baixa';
  return (
    <span className="chip border-navy-500 bg-paper text-navy-700">
      Confiança {nivel} ({pct}%)
    </span>
  );
}

export function Campo({
  id,
  rotulo,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="rotulo" htmlFor={id}>
        {rotulo}
      </label>
      {children}
      {dica ? (
        <p className="text-xs text-navy-500" id={`${id}-dica`}>
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export function Metrica({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded border border-paper-400 bg-paper-200 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-navy-700">{rotulo}</dt>
      <dd className="text-lg font-semibold text-navy">{valor}</dd>
      {detalhe ? <dd className="text-xs text-navy-700">{detalhe}</dd> : null}
    </div>
  );
}
