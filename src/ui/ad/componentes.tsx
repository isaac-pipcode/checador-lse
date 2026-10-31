import { useId } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { formatarTimecode } from '../../core/texto';
import type { BlocoAD, Take } from '../../ad/tipos';
import { ajustarLegenda, duracaoUtil, LIMITES_LEGENDA, takeAtivo, type LegendaPrompter } from '../../ad/tipos';
import { contarPalavras, duracaoEstimadaMs, palavrasQueCabem } from '../../ad/estimativa';
import { nivelDoBloco, type ApontamentoAD, type NivelAD } from '../../ad/verificacoes';
import { descartarTake } from '../../ad/audio';
import { COR_LEGENDA } from './Teleprompter';

/** Peças da interface de AD reutilizadas pelas páginas (cartão de bloco, take, ajustes). */

export const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

export const CLASSE_NIVEL: Record<NivelAD, string> = {
  ok: 'border-ok bg-ok-100 text-ok',
  aviso: 'border-warn bg-warn-100 text-warn',
  erro: 'border-bad bg-bad-100 text-bad',
  pendente: 'border-navy-300 bg-paper-200 text-navy-700',
};
export const ICONE: Record<NivelAD, string> = { ok: '✓', aviso: '!', erro: '✕', pendente: '…' };
export const ROTULO_NIVEL: Record<NivelAD, string> = { ok: 'Pronto', aviso: 'Aviso', erro: 'Erro', pendente: 'Pendente' };


export function AjustesLegenda() {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const l = estado.ad.parametros.legenda;
  const mudar = (m: Partial<LegendaPrompter>) =>
    despachar({ tipo: 'adParametros', mudanca: { legenda: ajustarLegenda(l, m) } });
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="Cor do texto" className="flex gap-2">
          {(['branco', 'amarelo'] as const).map((c) => (
            <label
              key={c}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm ${l.cor === c ? 'border-navy bg-paper-200' : 'border-paper-400'}`}
            >
              <input type="radio" name={`${id}-cor`} checked={l.cor === c} onChange={() => mudar({ cor: c })} />
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-8 items-center justify-center rounded bg-preto text-xs font-bold"
                style={{ color: COR_LEGENDA[c] }}
              >
                Aa
              </span>
              {c === 'branco' ? 'Branco' : 'Amarelo'}
            </label>
          ))}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Tamanho da letra">
          <button
            type="button"
            className="btn-secundario px-2 py-0.5"
            disabled={l.escala <= LIMITES_LEGENDA.escala[0]}
            onClick={() => mudar({ escala: l.escala - 0.1 })}
          >
            A<span className="sr-only-focusable"> menor</span>−
          </button>
          <span className="w-24 text-center text-sm">Letra {pct(l.escala)}</span>
          <button
            type="button"
            className="btn-secundario px-2 py-0.5"
            disabled={l.escala >= LIMITES_LEGENDA.escala[1]}
            onClick={() => mudar({ escala: l.escala + 0.1 })}
          >
            A<span className="sr-only-focusable"> maior</span>+
          </button>
        </div>
      </div>

      <label className="rotulo mt-3" htmlFor={`${id}-altura`}>
        Altura máxima da caixa: {pct(l.alturaMaxima)} da imagem
      </label>
      <input
        id={`${id}-altura`}
        type="range"
        min={LIMITES_LEGENDA.alturaMaxima[0]}
        max={LIMITES_LEGENDA.alturaMaxima[1]}
        step={0.01}
        value={l.alturaMaxima}
        onChange={(e) => mudar({ alturaMaxima: Number(e.target.value) })}
        className="w-full max-w-xs"
      />
      <p className="mt-1 text-xs text-navy-500">
        Se o texto não couber, a letra diminui sozinha (até 60% do tamanho escolhido); se ainda assim não couber, o
        teleprompter avisa. Na cabine, <kbd>+</kbd> e <kbd>−</kbd> mudam o tamanho durante a sessão. Salvo no projeto.
      </p>
    </div>
  );
}

// ===========================================================================
// Componentes comuns
// ===========================================================================

export function Numero({
  rotulo,
  valor,
  passo,
  min = 0,
  max,
  aoMudar,
}: {
  rotulo: string;
  valor: number;
  passo: number;
  min?: number;
  max?: number;
  aoMudar: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label className="rotulo text-xs" htmlFor={id}>
        {rotulo}
      </label>
      <input
        id={id}
        className="campo"
        type="number"
        step={passo}
        min={min}
        max={max}
        value={valor}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) aoMudar(n);
        }}
      />
    </div>
  );
}

export function CartaoBloco({
  n,
  bloco: b,
  apontamentos,
  ppm,
  aoFocar,
  podeGravar,
  aoGravar,
  aoOuvir,
}: {
  n: number;
  bloco: BlocoAD;
  apontamentos: ApontamentoAD[];
  ppm: number;
  aoFocar: () => void;
  podeGravar: boolean;
  aoGravar: () => void;
  aoOuvir: () => void;
}) {
  const despachar = useDespachar();
  const janela = b.fimMs - b.inicioMs;
  const est = duracaoEstimadaMs(b.texto, ppm);
  const palavras = contarPalavras(b.texto);
  const cabem = palavrasQueCabem(janela, ppm);
  const nivel = nivelDoBloco(apontamentos);
  const ativo = takeAtivo(b);
  const fracao = Math.min(1.5, est / Math.max(1, janela));
  const temTexto = b.texto.trim() !== '';

  const mover = (campo: 'inicioMs' | 'fimMs', delta: number) =>
    despachar({ tipo: 'adEditar', id: b.id, mudanca: { [campo]: Math.max(0, b[campo] + delta) } });

  return (
    <article
      id={`bloco-${b.id}`}
      aria-labelledby={`titulo-${b.id}`}
      onFocus={aoFocar}
      className={`rounded border-y border-l-4 border-r border-paper-400 bg-paper p-3 ${nivel === 'erro' ? 'border-l-bad' : nivel === 'aviso' ? 'border-l-warn' : nivel === 'ok' ? 'border-l-ok' : 'border-l-navy-300'}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={`titulo-${b.id}`} className="text-sm font-semibold">
          Bloco {n}
        </h3>
        <span className="font-mono text-xs text-navy-700">
          {formatarTimecode(b.inicioMs)} → {formatarTimecode(b.fimMs)}
        </span>
        <span className="text-xs text-navy-700">janela de {seg(janela)}</span>
        <span className={`chip ${CLASSE_NIVEL[nivel]}`}>
          <span aria-hidden="true">{ICONE[nivel]}</span>
          {ROTULO_NIVEL[nivel]}
        </span>
        <span className={`chip ${b.aprovado ? 'border-ok bg-ok-100 text-ok' : 'border-navy-300 bg-paper-200 text-navy-700'}`}>
          <span aria-hidden="true">{b.aprovado ? '✓' : '✎'}</span>
          {b.aprovado ? 'Aprovado para gravação' : 'Rascunho'}
        </span>
        <span className="ml-auto flex flex-wrap gap-1" role="group" aria-label={`Ajustar janela do bloco ${n}`}>
          <button type="button" className="btn-fantasma px-2 py-0.5 text-xs" onClick={() => mover('inicioMs', -250)}>
            Início −¼ s
          </button>
          <button type="button" className="btn-fantasma px-2 py-0.5 text-xs" onClick={() => mover('inicioMs', 250)}>
            Início +¼ s
          </button>
          <button type="button" className="btn-fantasma px-2 py-0.5 text-xs" onClick={() => mover('fimMs', -250)}>
            Fim −¼ s
          </button>
          <button type="button" className="btn-fantasma px-2 py-0.5 text-xs" onClick={() => mover('fimMs', 250)}>
            Fim +¼ s
          </button>
          <button
            type="button"
            className="btn-fantasma px-2 py-0.5 text-xs text-bad"
            onClick={() => {
              if (!temTexto && b.takes.length === 0) despachar({ tipo: 'adRemover', id: b.id });
              else if (window.confirm(`Excluir o bloco ${n}, com roteiro e gravações?`)) {
                b.takes.forEach((t) => descartarTake(t.id));
                despachar({ tipo: 'adRemover', id: b.id });
              }
            }}
          >
            Excluir
          </button>
        </span>
      </header>

      <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className="rotulo sr-only-focusable" htmlFor={`texto-${b.id}`}>
            Roteiro do bloco {n}
          </label>
          <textarea
            id={`texto-${b.id}`}
            className="campo min-h-[4.5rem] font-sans text-base leading-snug"
            value={b.texto}
            placeholder="Descreva o que é relevante e não está no diálogo…"
            onChange={(e) => despachar({ tipo: 'adEditar', id: b.id, mudanca: { texto: e.target.value } })}
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-navy-700">
            <div className="h-1.5 w-40 rounded bg-paper-200" aria-hidden="true">
              <div
                className={`h-1.5 rounded ${fracao > 1.15 ? 'bg-bad' : fracao > 1 ? 'bg-warn' : 'bg-ok'}`}
                style={{ width: `${Math.min(100, fracao * 100)}%` }}
              />
            </div>
            <span>
              {palavras} palavras · ~{seg(est)} de {seg(janela)} · cabem ~{cabem} a {ppm} ppm (estimativa)
            </span>
          </div>
          <label className="rotulo mt-2 text-xs" htmlFor={`nota-${b.id}`}>
            Nota para o locutor (aparece no teleprompter, não é lida)
          </label>
          <input
            id={`nota-${b.id}`}
            className="campo text-xs"
            value={b.nota}
            onChange={(e) => despachar({ tipo: 'adEditar', id: b.id, mudanca: { nota: e.target.value } })}
          />
        </div>

        <div className="flex flex-col gap-2 md:w-64">
          <button
            type="button"
            className={b.aprovado ? 'btn-secundario justify-center' : 'btn-primario justify-center'}
            disabled={!temTexto}
            aria-pressed={!!b.aprovado}
            onClick={() => despachar({ tipo: 'adAprovar', id: b.id, aprovado: !b.aprovado })}
          >
            {b.aprovado ? 'Retirar aprovação' : 'Aprovar para gravação'}
          </button>
          <button type="button" className="btn-secundario justify-center" disabled={!podeGravar} onClick={aoOuvir}>
            <span aria-hidden="true">▶</span> Ouvir o trecho
          </button>
          <button
            type="button"
            className="btn-secundario justify-center"
            disabled={!podeGravar || !b.aprovado}
            title={b.aprovado ? undefined : 'Aprove o roteiro para gravar'}
            onClick={aoGravar}
          >
            <span aria-hidden="true">●</span> {b.takes.length ? 'Gravar outro take' : 'Gravar este bloco'}
          </button>
          {b.takes.length > 0 ? (
            <ul className="space-y-1 text-xs" aria-label={`Gravações do bloco ${n}`}>
              {b.takes.map((t, k) => (
                <LinhaTake key={t.id} blocoId={b.id} take={t} k={k + 1} ativo={ativo?.id === t.id} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {apontamentos.filter((a) => a.nivel !== 'pendente').length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {apontamentos
            .filter((a) => a.nivel !== 'pendente')
            .map((a) => (
              <li key={a.codigo} className={a.nivel === 'erro' ? 'text-bad' : 'text-warn'}>
                <span aria-hidden="true">{a.nivel === 'erro' ? '✕ ' : '! '}</span>
                <span className="font-mono text-xs">{a.codigo}</span> {a.mensagem}
              </li>
            ))}
        </ul>
      ) : null}
    </article>
  );
}

export function LinhaTake({ blocoId, take: t, k, ativo }: { blocoId: string; take: Take; k: number; ativo: boolean }) {
  const despachar = useDespachar();
  const ajustar = (mudanca: Partial<Take>) => despachar({ tipo: 'adAjustarTake', blocoId, takeId: t.id, mudanca });
  return (
    <li className={`rounded border px-2 py-1 ${ativo ? 'border-navy-500 bg-paper-200' : 'border-paper-400'}`}>
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={`take-${blocoId}`}
            checked={ativo}
            onChange={() => despachar({ tipo: 'adAtivarTake', blocoId, takeId: t.id })}
          />
          Take {k} · {seg(duracaoUtil(t))}
        </label>
        <span className="ml-auto font-mono text-[11px] text-navy-500">{formatarTimecode(t.posicaoMs)}</span>
      </div>
      {ativo ? (
        <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label={`Ajustes do take ${k}`}>
          <button type="button" className="btn-fantasma px-1.5 py-0 text-[11px]" onClick={() => ajustar({ posicaoMs: t.posicaoMs - 100 })}>
            ◂ 0,1 s
          </button>
          <button type="button" className="btn-fantasma px-1.5 py-0 text-[11px]" onClick={() => ajustar({ posicaoMs: t.posicaoMs + 100 })}>
            0,1 s ▸
          </button>
          <button type="button" className="btn-fantasma px-1.5 py-0 text-[11px]" onClick={() => ajustar({ ganhoDb: t.ganhoDb - 1 })}>
            −1 dB
          </button>
          <button type="button" className="btn-fantasma px-1.5 py-0 text-[11px]" onClick={() => ajustar({ ganhoDb: t.ganhoDb + 1 })}>
            +1 dB
          </button>
          <span className="self-center text-[11px] text-navy-500">
            {t.ganhoDb > 0 ? '+' : ''}
            {t.ganhoDb} dB
          </span>
          <button
            type="button"
            className="btn-fantasma ml-auto px-1.5 py-0 text-[11px] text-bad"
            onClick={() => {
              descartarTake(t.id);
              despachar({ tipo: 'adRemoverTake', blocoId, takeId: t.id });
            }}
          >
            Descartar
          </button>
        </div>
      ) : null}
    </li>
  );
}
