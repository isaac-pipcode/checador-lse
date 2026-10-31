import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDespachar, useEstado, useResultadoFinal } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { formatarTimecode } from '../../core/texto';
import type { BlocoAD, Take } from '../../ad/tipos';
import { duracaoUtil, takeAtivo } from '../../ad/tipos';
import { calibrarPpm, contarPalavras, duracaoEstimadaMs, palavrasQueCabem } from '../../ad/estimativa';
import { verificarBloco, nivelDoBloco, type ApontamentoAD, type NivelAD } from '../../ad/verificacoes';
import { descartarTake } from '../../ad/audio';
import { blocosGravaveis, GRAVANDO } from '../../ad/prompter';
import { ponte } from '../../desktop/ponte';
import { useSessaoGravacao, type SessaoGravacao } from './useSessaoGravacao';
import { COR_LEGENDA, Teleprompter } from './Teleprompter';
import { ajustarLegenda, LIMITES_LEGENDA, type LegendaPrompter } from '../../ad/tipos';

const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

const CLASSE_NIVEL: Record<NivelAD, string> = {
  ok: 'border-ok bg-ok-100 text-ok',
  aviso: 'border-warn bg-warn-100 text-warn',
  erro: 'border-bad bg-bad-100 text-bad',
  pendente: 'border-navy-300 bg-paper-200 text-navy-700',
};
const ICONE: Record<NivelAD, string> = { ok: '✓', aviso: '!', erro: '✕', pendente: '…' };
const ROTULO_NIVEL: Record<NivelAD, string> = { ok: 'Pronto', aviso: 'Aviso', erro: 'Erro', pendente: 'Pendente' };

type Modo = 'roteiro' | 'gravacao';

/**
 * Painel da audiodescrição, em dois modos que espelham a divisão de trabalho:
 * **Roteiro** (editora escreve e aprova) e **Gravação** (operadora conduz,
 * locutor lê no teleprompter, em outro monitor). Só blocos aprovados chegam à
 * gravação.
 */
export function PainelAD() {
  const id = useId();
  const sessao = useSessaoGravacao();
  const [modo, setModo] = useState<Modo>('roteiro');

  // Qualquer gravação leva ao console de gravação.
  useEffect(() => {
    if (sessao.ativa) setModo('gravacao');
  }, [sessao.ativa]);

  return (
    <section aria-labelledby={`${id}-t`} className="px-4 py-3">
      <h2 id={`${id}-t`} className="sr-only">
        Roteiro e gravação
      </h2>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Modo de trabalho">
        {(
          [
            ['roteiro', 'Roteiro', 'escrever e aprovar'],
            ['gravacao', 'Gravação', 'conduzir o locutor'],
          ] as const
        ).map(([m, rotulo, dica]) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            disabled={sessao.ativa && m === 'roteiro'}
            className={modo === m ? 'btn-primario' : 'btn-secundario'}
            onClick={() => setModo(m)}
          >
            {rotulo} <span className="font-normal opacity-80">— {dica}</span>
          </button>
        ))}
      </div>
      {modo === 'roteiro' ? <ModoRoteiro sessao={sessao} /> : <ModoGravacao sessao={sessao} />}
    </section>
  );
}

// ===========================================================================
// Modo Roteiro
// ===========================================================================

function ModoRoteiro({ sessao }: { sessao: SessaoGravacao }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, tempoMs, buscar } = useVideo();
  const final = useResultadoFinal();
  const { blocos, parametros } = estado.ad;
  const [foco, setFoco] = useState<string | null>(null);
  const [repetir, setRepetir] = useState(true);
  const calibracao = useMemo(() => calibrarPpm(blocos), [blocos]);
  const focoRef = useRef(foco);
  focoRef.current = foco;

  const resumo = useMemo(() => {
    const n: Record<NivelAD, number> = { ok: 0, aviso: 0, erro: 0, pendente: 0 };
    for (const b of blocos) n[nivelDoBloco(verificarBloco(b, final.cues, parametros))]++;
    return n;
  }, [blocos, final.cues, parametros]);
  const aprovaveis = blocos.filter((b) => !b.aprovado && b.texto.trim());
  const aprovados = blocos.filter((b) => b.aprovado).length;

  // "Escrever assistindo": com um bloco em foco e o vídeo tocando, o trecho repete.
  useEffect(() => {
    if (!repetir || !video || !foco) return;
    const b = blocos.find((x) => x.id === foco);
    if (!b) return;
    if (!video.paused && tempoMs > b.fimMs + 700) buscar(Math.max(0, b.inicioMs - 1500));
  }, [tempoMs, repetir, foco, blocos, video, buscar]);

  function irPara(b: BlocoAD) {
    buscar(Math.max(0, b.inicioMs - 1500));
    const el = document.getElementById(`texto-${b.id}`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus({ preventScroll: true });
  }

  // Atalhos da editora (Ctrl ou ⌘), valem também com o cursor na caixa de texto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const atual = blocos.findIndex((b) => b.id === focoRef.current);
      let feito = true;
      if (e.key === ' ') {
        if (video) void (video.paused ? video.play() : video.pause());
      } else if (e.key === 'b' || e.key === 'B') {
        despachar({ tipo: 'adAdicionar', inicioMs: tempoMs, fimMs: tempoMs + 3000 });
        // o novo bloco ganha foco quando aparecer
        pendenteFoco.current = tempoMs;
      } else if (e.key === 'ArrowLeft') buscar(Math.max(0, tempoMs - 2000));
      else if (e.key === 'ArrowRight') buscar(tempoMs + 2000);
      else if (e.key === 'ArrowDown' && atual < blocos.length - 1) irPara(blocos[atual + 1]);
      else if (e.key === 'ArrowUp' && atual > 0) irPara(blocos[atual - 1]);
      else if (e.key === 'Enter' && atual >= 0) {
        const b = blocos[atual];
        if (b.texto.trim()) despachar({ tipo: 'adAprovar', id: b.id, aprovado: true });
        if (atual < blocos.length - 1) irPara(blocos[atual + 1]);
      } else feito = false;
      if (feito) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const pendenteFoco = useRef<number | null>(null);
  useEffect(() => {
    if (pendenteFoco.current === null) return;
    const b = blocos.find((x) => x.inicioMs === pendenteFoco.current);
    if (b) {
      pendenteFoco.current = null;
      document.getElementById(`texto-${b.id}`)?.focus();
    }
  }, [blocos]);

  return (
    <>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="rounded border border-paper-400 p-3 text-sm lg:col-span-2">
          <p className="font-medium">Atalhos (Ctrl ou ⌘), inclusive escrevendo</p>
          <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-navy-700 sm:grid-cols-2">
            <li><kbd>Ctrl+Espaço</kbd> tocar/pausar</li>
            <li><kbd>Ctrl+←</kbd>/<kbd>→</kbd> voltar/avançar 2 s</li>
            <li><kbd>Ctrl+B</kbd> novo bloco na posição atual</li>
            <li><kbd>Ctrl+↑</kbd>/<kbd>↓</kbd> bloco anterior/seguinte</li>
            <li><kbd>Ctrl+Enter</kbd> aprovar o bloco e ir ao seguinte</li>
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
            Repetir o trecho do bloco em foco enquanto escrevo
          </label>
        </div>
        <div className="rounded border border-paper-400 p-3 text-sm">
          <p className="font-medium">
            {blocos.length} blocos · {aprovados} aprovados para gravação
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {(['ok', 'aviso', 'erro', 'pendente'] as NivelAD[]).map((n) => (
              <li key={n} className={`chip ${CLASSE_NIVEL[n]}`}>
                <span aria-hidden="true">{ICONE[n]}</span>
                {resumo[n]} {n === 'ok' ? 'prontos' : n === 'pendente' ? 'pendentes' : n === 'aviso' ? 'com aviso' : 'com erro'}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="btn-fantasma"
              disabled={!video}
              onClick={() => despachar({ tipo: 'adAdicionar', inicioMs: tempoMs, fimMs: tempoMs + 3000 })}
            >
              + Bloco em {formatarTimecode(tempoMs)}
            </button>
            {aprovaveis.length > 0 ? (
              <button
                type="button"
                className="btn-fantasma"
                onClick={() => {
                  if (window.confirm(`Aprovar para gravação os ${aprovaveis.length} blocos com texto ainda em rascunho?`)) {
                    aprovaveis.forEach((b) => despachar({ tipo: 'adAprovar', id: b.id, aprovado: true }));
                  }
                }}
              >
                Aprovar todos com texto ({aprovaveis.length})
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Parametros calibracao={calibracao} />

      {blocos.length === 0 ? (
        <p className="mt-6 text-center text-navy-700">
          Nenhum bloco ainda. Use <em>Criar blocos de AD nas lacunas</em> acima, ou <kbd>Ctrl+B</kbd> na posição do vídeo.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {blocos.map((b, i) => (
            <li key={b.id}>
              <CartaoBloco
                n={i + 1}
                bloco={b}
                apontamentos={verificarBloco(b, final.cues, parametros)}
                ppm={parametros.palavrasPorMinuto}
                aoFocar={() => setFoco(b.id)}
                podeGravar={!!video && !sessao.ativa}
                aoGravar={() => sessao.gravarAvulso(b.id)}
                aoOuvir={() => {
                  buscar(Math.max(0, b.inicioMs - 2000));
                  void video?.play();
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Parametros({ calibracao }: { calibracao: { ppm: number; amostras: number } | null }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const p = estado.ad.parametros;
  const mudar = (mudanca: Partial<typeof p>) => despachar({ tipo: 'adParametros', mudanca });
  return (
    <details className="mt-3 rounded border border-paper-400 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Leitura e mixagem: {p.palavrasPorMinuto} ppm · ducking {p.duckingDb} dB
      </summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Velocidade (ppm)" valor={p.palavrasPorMinuto} passo={5} aoMudar={(v) => mudar({ palavrasPorMinuto: v })} />
        <Numero rotulo="Ducking (dB)" valor={p.duckingDb} passo={1} min={-40} max={0} aoMudar={(v) => mudar({ duckingDb: v })} />
        <Numero rotulo="Ataque (ms)" valor={p.ataqueMs} passo={50} aoMudar={(v) => mudar({ ataqueMs: v })} />
        <Numero rotulo="Liberação (ms)" valor={p.liberacaoMs} passo={50} aoMudar={(v) => mudar({ liberacaoMs: v })} />
      </div>
      <p className="mt-2 text-xs text-navy-500">
        {calibracao ? (
          <>
            Velocidade medida nas gravações: <strong>{calibracao.ppm} ppm</strong> ({calibracao.amostras} takes).{' '}
            {calibracao.ppm !== p.palavrasPorMinuto ? (
              <button type="button" className="underline" onClick={() => mudar({ palavrasPorMinuto: calibracao.ppm })}>
                Usar na estimativa
              </button>
            ) : null}
          </>
        ) : (
          'A velocidade é uma estimativa até haver três gravações; depois, o estúdio mede a do locutor.'
        )}
      </p>
    </details>
  );
}

// ===========================================================================
// Modo Gravação
// ===========================================================================

function ModoGravacao({ sessao }: { sessao: SessaoGravacao }) {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, buscar } = useVideo();
  const final = useResultadoFinal();
  const desktop = ponte();
  const { blocos, parametros } = estado.ad;
  const [somenteSemTake, setSomenteSemTake] = useState(true);
  const [telaCheia, setTelaCheia] = useState(false);

  const fila = blocosGravaveis(blocos, somenteSemTake);
  const todosAprovados = blocosGravaveis(blocos, false);
  const naoAprovados = blocos.filter((b) => !b.aprovado && b.texto.trim()).length;
  const nivelPct = Number.isFinite(sessao.nivel) ? Math.max(0, Math.min(100, ((sessao.nivel + 60) / 60) * 100)) : 0;

  // Teleprompter na própria janela (navegador, ou desktop com um só monitor): Esc fecha quando ocioso.
  useEffect(() => {
    if (!telaCheia || sessao.ativa) return;
    const t = (e: KeyboardEvent) => e.key === 'Escape' && setTelaCheia(false);
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [telaCheia, sessao.ativa]);

  return (
    <>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <fieldset className="rounded border border-paper-400 p-3">
            <legend className="px-1 text-sm font-medium">Teleprompter do locutor</legend>
            {desktop ? (
              sessao.prompterAberto ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="chip border-ok bg-ok-100 text-ok">
                    <span aria-hidden="true">✓</span> Aberto em {sessao.prompterAberto}
                  </span>
                  <button type="button" className="btn-fantasma" onClick={sessao.fecharPrompter}>
                    Fechar
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-secundario" onClick={() => void sessao.abrirPrompter()}>
                  Abrir no monitor do locutor
                </button>
              )
            ) : (
              <button type="button" className="btn-secundario" onClick={() => setTelaCheia(true)}>
                Abrir em tela cheia nesta janela
              </button>
            )}
            <p className="mt-2 text-xs text-navy-500">
              Abre em tela cheia no segundo monitor; com um só, em janela separada. O locutor vê o vídeo (mudo), o texto
              grande e o tempo; as teclas da sessão funcionam nas duas janelas.
            </p>
          </fieldset>

          <fieldset className="rounded border border-paper-400 p-3">
            <legend className="px-1 text-sm font-medium">Microfone</legend>
            {sessao.micAberto ? (
              <>
                <label className="rotulo" htmlFor={`${id}-mic`}>
                  Entrada
                </label>
                <select id={`${id}-mic`} className="campo" value={sessao.micId} onChange={(e) => sessao.setMicId(e.target.value)}>
                  <option value="">Padrão do sistema</option>
                  {sessao.microfones.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label || `Microfone ${m.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
                <div className="mt-2 h-2 w-full rounded bg-paper-200" aria-hidden="true">
                  <div
                    className={`h-2 rounded ${sessao.nivel > -3 ? 'bg-bad' : sessao.nivel > -12 ? 'bg-warn' : 'bg-ok'}`}
                    style={{ width: `${nivelPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-navy-700">
                  Pico: {Number.isFinite(sessao.nivel) ? `${sessao.nivel.toFixed(0)} dBFS` : '—'}
                  {sessao.nivel > -3 ? ' · perto de saturar' : ''}
                </p>
              </>
            ) : (
              <button type="button" className="btn-secundario" onClick={() => void sessao.abrirMic()}>
                Abrir microfone
              </button>
            )}
            {sessao.erroMic ? <p className="mt-2 text-sm text-bad">{sessao.erroMic}</p> : null}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Numero
                rotulo="Pré-rolagem (ms)"
                valor={parametros.prerollMs}
                passo={500}
                aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { prerollMs: v } })}
              />
              <Numero
                rotulo="Pós-rolagem (ms)"
                valor={parametros.posrollMs}
                passo={500}
                aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { posrollMs: v } })}
              />
              <Numero
                rotulo="Latência (ms)"
                valor={parametros.latenciaMs}
                passo={10}
                min={-500}
                aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { latenciaMs: v } })}
              />
            </div>
            <p className="mt-2 text-xs text-navy-500">
              Fones para o locutor: o som do vídeo toca durante a gravação. Eco, ruído e ganho automáticos do sistema
              ficam desligados.
            </p>
          </fieldset>

          <fieldset className="rounded border border-paper-400 p-3">
            <legend className="px-1 text-sm font-medium">Sessão</legend>
            {sessao.ativa ? (
              <div className="flex flex-wrap gap-2">
                {GRAVANDO.has(sessao.fase) ? (
                  <button type="button" className="btn-primario" onClick={() => sessao.comando('parar')}>
                    Encerrar take (Enter)
                  </button>
                ) : null}
                {sessao.fase === 'revisao' ? (
                  <>
                    <button type="button" className="btn-primario" onClick={() => sessao.comando('manter')}>
                      Manter (Enter)
                    </button>
                    <button type="button" className="btn-secundario" onClick={() => sessao.comando('regravar')}>
                      Regravar (R)
                    </button>
                    <button type="button" className="btn-secundario" onClick={() => sessao.comando('ouvir')}>
                      Ouvir (Espaço)
                    </button>
                    <button type="button" className="btn-secundario" onClick={() => sessao.comando('descartar')}>
                      Descartar (Backspace)
                    </button>
                  </>
                ) : null}
                <button type="button" className="btn-fantasma text-bad" onClick={() => sessao.comando('encerrar')}>
                  Encerrar sessão (Esc)
                </button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={somenteSemTake} onChange={(e) => setSomenteSemTake(e.target.checked)} />
                  Só blocos ainda sem gravação
                </label>
                <button
                  type="button"
                  className="btn-primario mt-2"
                  disabled={!video || fila.length === 0}
                  onClick={() => sessao.gravarSequencia(fila.map((b) => b.id))}
                >
                  <span aria-hidden="true">●</span> Gravar em sequência ({fila.length} blocos)
                </button>
                {sessao.aviso ? <p className="mt-2 text-sm text-navy-700" role="status">{sessao.aviso}</p> : null}
                {naoAprovados > 0 ? (
                  <p className="mt-2 text-xs text-warn">
                    <span aria-hidden="true">! </span>
                    {naoAprovados} bloco(s) com texto ainda em rascunho não entram na gravação. Aprove-os no modo Roteiro.
                  </p>
                ) : null}
              </>
            )}
          </fieldset>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-navy-700">O que o locutor vê</p>
          <Teleprompter estado={sessao.estadoPrompter} compacto />
          <AjustesLegenda />
        </div>
      </div>

      <h3 className="mt-5 text-sm font-semibold">Blocos aprovados ({todosAprovados.length})</h3>
      {todosAprovados.length === 0 ? (
        <p className="mt-2 text-sm text-navy-700">Nenhum bloco aprovado ainda. A aprovação é feita no modo Roteiro.</p>
      ) : (
        <ol className="mt-2 divide-y divide-paper-400 rounded border border-paper-400">
          {todosAprovados.map((b, i) => {
            const t = takeAtivo(b);
            const nivel = nivelDoBloco(verificarBloco(b, final.cues, parametros));
            const atual = sessao.blocoId === b.id;
            return (
              <li key={b.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${atual ? 'bg-bad-100' : ''}`}>
                <span className="w-6 text-right font-mono text-xs text-navy-500">{i + 1}</span>
                <span className="font-mono text-xs text-navy-700">{formatarTimecode(b.inicioMs)}</span>
                <span className={`chip ${CLASSE_NIVEL[nivel]}`}>
                  <span aria-hidden="true">{ICONE[nivel]}</span>
                  {ROTULO_NIVEL[nivel]}
                </span>
                <span className="min-w-0 flex-1 truncate" title={b.texto}>
                  {b.texto}
                </span>
                <span className="text-xs text-navy-700">
                  {t ? `${b.takes.length} take(s) · ativo ${seg(duracaoUtil(t))}` : 'sem gravação'}
                </span>
                <button type="button" className="btn-fantasma px-2 py-0.5 text-xs" onClick={() => buscar(Math.max(0, b.inicioMs - 2000))}>
                  Ir
                </button>
                <button
                  type="button"
                  className="btn-secundario px-2 py-0.5 text-xs"
                  disabled={!video || sessao.ativa}
                  onClick={() => sessao.gravarAvulso(b.id)}
                >
                  <span aria-hidden="true">●</span> Gravar
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {telaCheia ? (
        <div className="fixed inset-0 z-50">
          <Teleprompter estado={sessao.estadoPrompter} />
          {!sessao.ativa ? (
            <button type="button" className="btn-secundario fixed right-4 top-14" onClick={() => setTelaCheia(false)}>
              Fechar (Esc)
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Cor, tamanho e altura máxima do roteiro no teleprompter. */
function AjustesLegenda() {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const l = estado.ad.parametros.legenda;
  const mudar = (m: Partial<LegendaPrompter>) =>
    despachar({ tipo: 'adParametros', mudanca: { legenda: ajustarLegenda(l, m) } });
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <fieldset className="mt-3 rounded border border-paper-400 p-3">
      <legend className="px-1 text-sm font-medium">Legenda do teleprompter</legend>
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
                className="inline-flex h-5 w-8 items-center justify-center rounded bg-black text-xs font-bold"
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
    </fieldset>
  );
}

// ===========================================================================
// Componentes comuns
// ===========================================================================

function Numero({
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

function CartaoBloco({
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

function LinhaTake({ blocoId, take: t, k, ativo }: { blocoId: string; take: Take; k: number; ativo: boolean }) {
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
