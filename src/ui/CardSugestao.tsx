import { useId, useState } from 'react';
import type { ReviewItem } from '../model/types';
import { META_POR_ID } from '../rules';
import { useAcoes } from '../state/store';
import { ChipConfianca, ChipSeveridade, ChipVerificabilidade } from './primitivos';
import { formatarTimecode } from '../core/texto';
import { PainelLlm } from './PainelLlm';
import { Icone, type NomeIcone } from './icones';

const ROTULO_DECISAO = {
  pendente: { texto: 'Pendente', icone: 'etapaVazia' as NomeIcone, classe: 'border-navy-500 bg-paper text-navy-700' },
  aprovada: { texto: 'Aprovada', icone: 'ok' as NomeIcone, classe: 'border-ok bg-ok-100 text-ok' },
  rejeitada: { texto: 'Rejeitada', icone: 'erro' as NomeIcone, classe: 'border-bad bg-bad-100 text-bad' },
  editada: { texto: 'Editada', icone: 'rascunho' as NomeIcone, classe: 'border-ok bg-ok-100 text-ok' },
} as const;

export function CardSugestao({ item }: { item: ReviewItem }) {
  const acoes = useAcoes();
  const s = item.suggestion;
  const meta = META_POR_ID.get(s.ruleId);
  const idBase = useId();
  const [editando, setEditando] = useState(false);
  const propostaAtual = item.editedAfter?.lines ?? s.after?.lines ?? s.before.lines;
  const [rascunho, setRascunho] = useState(propostaAtual.join('\n'));

  const ehManual = s.verifiability === 'manual';
  const estado = ROTULO_DECISAO[item.decision];
  const mudaTempo =
    s.after &&
    ((typeof s.after.startMs === 'number' && s.after.startMs !== s.before.startMs) ||
      (typeof s.after.endMs === 'number' && s.after.endMs !== s.before.endMs));
  const mudaTexto = s.after && s.after.lines.join('\n') !== s.before.lines.join('\n');

  /** Move o foco para o apontamento anterior/seguinte já renderizado. */
  function irPara(passo: number) {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('article[data-sugestao]'),
    ).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const atual = cards.findIndex((c) => c.dataset.sugestao === s.id);
    const alvo = cards[atual + passo];
    if (alvo) {
      alvo.focus();
      alvo.scrollIntoView({ block: 'nearest' });
    }
  }

  function atalhos(e: React.KeyboardEvent) {
    if (editando) return;
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'a') {
      e.preventDefault();
      acoes.decidir(s.id, 'aprovada');
    } else if (k === 'r') {
      e.preventDefault();
      acoes.decidir(s.id, ehManual ? 'pendente' : 'rejeitada');
    } else if (k === 'e' && s.after) {
      e.preventDefault();
      setEditando(true);
    } else if (k === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      irPara(1);
    } else if (k === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      irPara(-1);
    }
  }

  return (
    <article
      className="rounded-lg border border-paper-400 bg-paper-200 p-3"
      data-sugestao={s.id}
      aria-labelledby={`${idBase}-titulo`}
      tabIndex={0}
      onKeyDown={atalhos}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h4 id={`${idBase}-titulo`} className="text-sm font-semibold">
          {s.ruleId} — {meta?.nome ?? 'Regra'}
        </h4>
        <ChipSeveridade severidade={s.severity} />
        <ChipVerificabilidade v={s.verifiability} />
        {typeof s.confidence === 'number' && s.confidence > 0 && !s.unavailable ? (
          <ChipConfianca valor={s.confidence} />
        ) : null}
        <span className={`chip ml-auto ${estado.classe}`}>
          <Icone nome={estado.icone} tamanho={12} />
          {estado.texto}
        </span>
      </header>

      <p className="mt-2 text-sm text-navy">{s.message}</p>
      {meta ? <p className="mt-1 text-xs text-navy-500">Fundamento: {meta.fundamento}</p> : null}

      {s.unavailable ? <PainelLlm sugestao={s} /> : null}

      {mudaTexto && !editando ? (
        <div className="mt-3 overflow-x-auto rounded border border-paper-400 bg-paper p-2 font-mono text-sm">
          <p className="sr-only">Texto original seguido do texto proposto.</p>
          {s.before.lines.map((l, i) => (
            <div key={`a${i}`} className="text-bad">
              <span aria-hidden="true">− </span>
              <span className="line-through decoration-bad">{l || '␣'}</span>
            </div>
          ))}
          {(item.editedAfter?.lines ?? s.after?.lines ?? []).map((l, i) => (
            <div key={`d${i}`} className="text-ok">
              <span aria-hidden="true">+ </span>
              <span>{l || '␣'}</span>
            </div>
          ))}
        </div>
      ) : null}

      {mudaTempo ? (
        <p className="mt-2 font-mono text-sm">
          <span className="text-bad line-through">
            {formatarTimecode(s.before.startMs ?? 0)} → {formatarTimecode(s.before.endMs ?? 0)}
          </span>{' '}
          <span aria-hidden="true">⇒</span>{' '}
          <span className="text-ok">
            {formatarTimecode(s.after?.startMs ?? s.before.startMs ?? 0)} →{' '}
            {formatarTimecode(s.after?.endMs ?? s.before.endMs ?? 0)}
          </span>
        </p>
      ) : null}

      {editando ? (
        <div className="mt-3 space-y-2">
          <label className="rotulo" htmlFor={`${idBase}-editor`}>
            Texto proposto (uma linha por linha da legenda)
          </label>
          <textarea
            id={`${idBase}-editor`}
            className="campo font-mono"
            rows={Math.max(2, rascunho.split('\n').length)}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primario"
              onClick={() => {
                acoes.editar(
                  s.id,
                  rascunho.split('\n').map((l) => l),
                );
                setEditando(false);
              }}
            >
              Salvar edição
            </button>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => {
                setRascunho(propostaAtual.join('\n'));
                setEditando(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {ehManual ? (
            <>
              <button
                type="button"
                className="btn-primario"
                onClick={() => acoes.decidir(s.id, 'aprovada')}
                aria-pressed={item.decision === 'aprovada'}
              >
                <Icone nome="ok" tamanho={14} /> Confirmar que revisei
              </button>
              <button
                type="button"
                className="btn-secundario"
                onClick={() => acoes.decidir(s.id, 'pendente')}
                aria-pressed={item.decision === 'pendente'}
              >
                Marcar como pendência
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-primario"
                onClick={() => acoes.decidir(s.id, 'aprovada')}
                aria-pressed={item.decision === 'aprovada'}
              >
                <Icone nome="ok" tamanho={14} /> Aprovar
                <span className="sr-only"> (tecla A)</span>
              </button>
              <button
                type="button"
                className="btn-secundario"
                onClick={() => acoes.decidir(s.id, 'rejeitada')}
                aria-pressed={item.decision === 'rejeitada'}
              >
                <Icone nome="erro" tamanho={14} /> Rejeitar
                <span className="sr-only"> (tecla R)</span>
              </button>
              {s.after ? (
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => {
                    setRascunho(propostaAtual.join('\n'));
                    setEditando(true);
                  }}
                >
                  <Icone nome="rascunho" tamanho={14} /> Editar
                  <span className="sr-only"> (tecla E)</span>
                </button>
              ) : null}
              {item.decision !== 'pendente' ? (
                <button
                  type="button"
                  className="btn-fantasma"
                  onClick={() => acoes.decidir(s.id, 'pendente')}
                >
                  Voltar a pendente
                </button>
              ) : null}
            </>
          )}
        </div>
      )}

      {!s.after && !ehManual ? (
        <p className="mt-2 text-xs text-navy-500">
          Esta regra não propõe correção automática: aprovar apenas registra a ciência da violação
          no relatório, sem alterar o arquivo.
        </p>
      ) : null}
    </article>
  );
}
