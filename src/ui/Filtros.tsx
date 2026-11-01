import { useId, useState } from 'react';
import { CATALOGO } from '../rules';
import { useAcoes, useEstado } from '../state/store';
import type { Severity } from '../model/types';
import { Icone } from './icones';

const REGRAS_LOTE = ['C8', 'C2', 'C1', 'C5', 'T6', 'T7'];

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
  const ativos =
    (f.regra !== 'todas' ? 1 : 0) +
    (f.severidade !== 'todas' ? 1 : 0) +
    (f.somentePendentes ? 1 : 0) +
    (f.de !== null || f.ate !== null ? 1 : 0) +
    (f.busca.trim() ? 1 : 0);

  return (
    <section aria-label="Filtros" className="border-b border-paper-400 px-3 py-2">
      <div className="grid grid-cols-2 gap-1.5">
        <select
          aria-label="Regra"
          className="campo"
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
        <select
          aria-label="Severidade"
          className="campo"
          value={f.severidade}
          onChange={(e) => acoes.filtros({ severidade: e.target.value as Severity | 'todas' })}
        >
          <option value="todas">Todas as severidades</option>
          <option value="erro">Erro</option>
          <option value="aviso">Aviso</option>
          <option value="revisao_manual">Revisão manual</option>
        </select>
        <input
          aria-label="Buscar na justificativa"
          placeholder="Buscar na justificativa…"
          className="campo"
          type="search"
          value={f.busca}
          onChange={(e) => acoes.filtros({ busca: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={f.somentePendentes}
              onChange={(e) => acoes.filtros({ somentePendentes: e.target.checked })}
            />
            Só pendentes
          </label>
          <button
            type="button"
            className="btn-fantasma ml-auto h-7 px-2 text-2xs"
            aria-expanded={mais}
            aria-controls={`${idBase}-mais`}
            onClick={() => setMais((v) => !v)}
          >
            {mais ? 'Menos' : 'Mais'}
          </button>
        </div>
      </div>

      <div id={`${idBase}-mais`} hidden={!mais} className="mt-1.5">
        <div className="flex items-center gap-1.5 text-xs">
          <label htmlFor={`${idBase}-de`}>Legendas de</label>
          <input
            id={`${idBase}-de`}
            className="campo w-20"
            type="number"
            min={1}
            value={f.de ?? ''}
            onChange={(e) => acoes.filtros({ de: e.target.value ? Number(e.target.value) : null })}
          />
          <label htmlFor={`${idBase}-ate`}>até</label>
          <input
            id={`${idBase}-ate`}
            className="campo w-20"
            type="number"
            min={1}
            value={f.ate ?? ''}
            onChange={(e) => acoes.filtros({ ate: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      {ativos > 0 ? (
        <p className="mt-1.5 flex items-center text-2xs text-navy-500" role="status">
          {ativos} filtro{ativos > 1 ? 's' : ''} ativo{ativos > 1 ? 's' : ''}
          <button
            type="button"
            className="btn-fantasma ml-auto h-6 px-2 text-2xs"
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
        </p>
      ) : null}
    </section>
  );
}

/** Aprovação em lote — só auto-correções determinísticas pendentes. */
export function AcoesLote() {
  const { estado } = useEstado();
  const acoes = useAcoes();
  const pendentesPorRegra = (ruleId: string) =>
    Object.values(estado.review).filter(
      (i) =>
        i.suggestion.ruleId === ruleId &&
        i.decision === 'pendente' &&
        i.suggestion.autoFixable &&
        i.suggestion.verifiability === 'deterministica',
    ).length;
  const meta = new Map(CATALOGO.map((r) => [r.id, r.nome]));

  return (
    <div>
      <ul className="space-y-1">
        {REGRAS_LOTE.map((id) => {
          const n = pendentesPorRegra(id);
          return (
            <li key={id} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-mono text-navy-500">{id}</span>
              <span className="min-w-0 flex-1 truncate">{meta.get(id)}</span>
              <button
                type="button"
                className="btn-secundario h-7 px-2 text-2xs"
                disabled={n === 0}
                onClick={() => acoes.lote(id)}
              >
                Aprovar {n}
              </button>
            </li>
          );
        })}
      </ul>
      {estado.historicoLote.length > 0 ? (
        <button type="button" className="btn-fantasma mt-2 h-7 px-2 text-2xs" onClick={() => acoes.desfazerLote()}>
          <Icone nome="desfazer" tamanho={14} /> Desfazer último lote
        </button>
      ) : null}
    </div>
  );
}
