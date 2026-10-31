import { useId } from 'react';
import { CATALOGO } from '../rules';
import { useAcoes, useEstado } from '../state/store';
import type { Severity } from '../model/types';

const REGRAS_LOTE = ['C8', 'C2', 'C1', 'C5', 'T6', 'T7'];

export function Filtros() {
  const { estado } = useEstado();
  const acoes = useAcoes();
  const idBase = useId();
  const f = estado.filtros;

  const pendentesPorRegra = (ruleId: string) =>
    Object.values(estado.review).filter(
      (i) =>
        i.suggestion.ruleId === ruleId &&
        i.decision === 'pendente' &&
        i.suggestion.autoFixable &&
        i.suggestion.verifiability === 'deterministica',
    ).length;

  return (
    <section aria-labelledby={`${idBase}-titulo`} className="border-b border-paper-400 px-3 py-2">
      <h3 id={`${idBase}-titulo`} className="sr-only">
        Filtros e ações em lote
      </h3>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="rotulo" htmlFor={`${idBase}-regra`}>
            Regra
          </label>
          <select
            id={`${idBase}-regra`}
            className="campo w-44"
            value={f.regra}
            onChange={(e) => acoes.filtros({ regra: e.target.value })}
          >
            <option value="todas">Todas as regras</option>
            {CATALOGO.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor={`${idBase}-sev`}>
            Severidade
          </label>
          <select
            id={`${idBase}-sev`}
            className="campo w-44"
            value={f.severidade}
            onChange={(e) => acoes.filtros({ severidade: e.target.value as Severity | 'todas' })}
          >
            <option value="todas">Todas</option>
            <option value="erro">Erro</option>
            <option value="aviso">Aviso</option>
            <option value="revisao_manual">Revisão manual</option>
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor={`${idBase}-de`}>
            Da legenda
          </label>
          <input
            id={`${idBase}-de`}
            className="campo w-24"
            type="number"
            min={1}
            value={f.de ?? ''}
            onChange={(e) => acoes.filtros({ de: e.target.value ? Number(e.target.value) : null })}
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`${idBase}-ate`}>
            até
          </label>
          <input
            id={`${idBase}-ate`}
            className="campo w-24"
            type="number"
            min={1}
            value={f.ate ?? ''}
            onChange={(e) => acoes.filtros({ ate: e.target.value ? Number(e.target.value) : null })}
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`${idBase}-busca`}>
            Buscar na justificativa
          </label>
          <input
            id={`${idBase}-busca`}
            className="campo w-44"
            type="search"
            value={f.busca}
            onChange={(e) => acoes.filtros({ busca: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={f.somentePendentes}
            onChange={(e) => acoes.filtros({ somentePendentes: e.target.checked })}
          />
          Somente pendentes
        </label>

        <button
          type="button"
          className="btn-fantasma mb-0.5"
          onClick={() =>
            acoes.filtros({
              regra: 'todas',
              severidade: 'todas',
              somentePendentes: false,
              de: null,
              ate: null,
              busca: '',
            })
          }
        >
          Limpar filtros
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy-700">Aprovar em lote:</span>
        {REGRAS_LOTE.map((id) => {
          const n = pendentesPorRegra(id);
          return (
            <button
              key={id}
              type="button"
              className="btn-secundario"
              disabled={n === 0}
              onClick={() => acoes.lote(id)}
            >
              {id} ({n})
            </button>
          );
        })}
        {estado.historicoLote.length > 0 ? (
          <button type="button" className="btn-fantasma" onClick={() => acoes.desfazerLote()}>
            <span aria-hidden="true">↶</span> Desfazer último lote
          </button>
        ) : null}
        <p className="w-full text-xs text-navy-500">
          O lote só alcança auto-correções determinísticas ainda pendentes. Sugestões assistidas
          (NLP/LLM) e pendências manuais exigem decisão uma a uma.
        </p>
      </div>
    </section>
  );
}
