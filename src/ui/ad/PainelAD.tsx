import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDespachar, useEstado, useResultadoFinal } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { formatarTimecode } from '../../core/texto';
import type { BlocoAD, Take } from '../../ad/tipos';
import { duracaoUtil, takeAtivo } from '../../ad/tipos';
import { calibrarPpm, contarPalavras, duracaoEstimadaMs, palavrasQueCabem } from '../../ad/estimativa';
import { verificarBloco, nivelDoBloco, type ApontamentoAD, type NivelAD } from '../../ad/verificacoes';
import { Gravador } from '../../ad/gravador';
import { contextoAudio, descartarTake, registrarTake } from '../../ad/audio';
import { aparar, novoId } from '../../ad/takes';

const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

const CLASSE_NIVEL: Record<NivelAD, string> = {
  ok: 'border-ok bg-ok-100 text-ok',
  aviso: 'border-warn bg-warn-100 text-warn',
  erro: 'border-bad bg-bad-100 text-bad',
  pendente: 'border-navy-300 bg-paper-200 text-navy-700',
};
const ICONE: Record<NivelAD, string> = { ok: '✓', aviso: '!', erro: '✕', pendente: '…' };

/** Estado da sessão de gravação, compartilhado pelos blocos. */
interface Sessao {
  blocoId: string;
  fase: 'preroll' | 'agora' | 'processando';
}

/**
 * Painel da audiodescrição: microfone, parâmetros e a lista de blocos, cada um
 * com roteiro, estimativa de leitura, gravação e takes.
 */
export function PainelAD() {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, tempoMs, previa, buscar } = useVideo();
  const final = useResultadoFinal();
  const { blocos, parametros } = estado.ad;

  const gravador = useRef(new Gravador());
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState('');
  const [erroMic, setErroMic] = useState<string | null>(null);
  const [nivel, setNivel] = useState(-Infinity);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const pararAgendado = useRef<number | null>(null);

  useEffect(() => () => gravador.current.fechar(), []);

  // Medidor de nível enquanto o microfone está aberto.
  useEffect(() => {
    let raf = 0;
    const laco = () => {
      if (gravador.current.aberto) setNivel(gravador.current.nivelDb());
      raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function abrirMic(deviceId?: string) {
    setErroMic(null);
    try {
      const ctx = contextoAudio();
      await ctx.resume(); // nasce suspenso até um gesto do usuário; sem isso o medidor fica mudo
      await gravador.current.abrir(ctx, deviceId || undefined);
      setMicrofones(await Gravador.microfones());
    } catch (e) {
      setErroMic(`Não foi possível abrir o microfone: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const calibracao = useMemo(() => calibrarPpm(blocos), [blocos]);

  async function gravar(b: BlocoAD) {
    if (!video) return;
    if (!gravador.current.aberto) await abrirMic(micId);
    if (!gravador.current.aberto) return;
    previa?.definirLigado(false); // locutor ouve o original limpo
    video.pause();
    const inicio = Math.max(0, b.inicioMs - parametros.prerollMs);
    await new Promise<void>((ok) => {
      video.addEventListener('seeked', () => ok(), { once: true });
      video.currentTime = inicio / 1000;
    });
    setSessao({ blocoId: b.id, fase: 'preroll' });
    await gravador.current.iniciar();
    // tempo do vídeo no instante em que a captura começou
    const inicioGravacaoMs = video.currentTime * 1000;
    await video.play();
    const fimMs = b.fimMs + 1500;
    const vigiar = () => {
      if (!gravador.current.gravando) return;
      const t = video.currentTime * 1000;
      setSessao((s) => (s && s.fase === 'preroll' && t >= b.inicioMs ? { ...s, fase: 'agora' } : s));
      if (t >= fimMs || video.ended) void concluir(b, inicioGravacaoMs);
      else pararAgendado.current = requestAnimationFrame(vigiar);
    };
    pararAgendado.current = requestAnimationFrame(vigiar);
    sessaoAtiva.current = { bloco: b, inicioGravacaoMs };
  }

  const sessaoAtiva = useRef<{ bloco: BlocoAD; inicioGravacaoMs: number } | null>(null);

  async function concluir(b: BlocoAD, inicioGravacaoMs: number) {
    if (pararAgendado.current) cancelAnimationFrame(pararAgendado.current);
    sessaoAtiva.current = null;
    setSessao({ blocoId: b.id, fase: 'processando' });
    video?.pause();
    try {
      const blob = await gravador.current.parar();
      const tid = novoId('t');
      const buffer = await registrarTake(tid, blob);
      const corte = aparar(buffer.getChannelData(0), buffer.sampleRate, parametros.aparoDb);
      // O que foi captado na pré-rolagem nunca é AD utilizável (cairia antes da
      // janela): descarta-se até 300 ms antes do bloco, haja ou não silêncio.
      const minimoInicio = Math.max(0, b.inicioMs - 300 - inicioGravacaoMs);
      const trimInicioMs = Math.min(Math.max(corte.trimInicioMs, minimoInicio), corte.trimFimMs);
      const take: Take = {
        id: tid,
        arquivo: null,
        duracaoMs: corte.duracaoMs,
        trimInicioMs,
        trimFimMs: corte.trimFimMs,
        posicaoMs: Math.round(inicioGravacaoMs + trimInicioMs),
        ganhoDb: 0,
        gravadoEm: new Date().toISOString(),
      };
      despachar({ tipo: 'adNovoTake', blocoId: b.id, take });
    } finally {
      setSessao(null);
      previa?.definirLigado(true);
    }
  }

  function interromper() {
    const s = sessaoAtiva.current;
    if (s) void concluir(s.bloco, s.inicioGravacaoMs);
  }

  // Esc encerra a gravação em curso.
  useEffect(() => {
    if (!sessao) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') interromper();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const blocoAtual = blocos.find((b) => tempoMs >= b.inicioMs && tempoMs < b.fimMs);
  const resumo = useMemo(() => {
    const n: Record<NivelAD, number> = { ok: 0, aviso: 0, erro: 0, pendente: 0 };
    for (const b of blocos) n[nivelDoBloco(verificarBloco(b, final.cues, parametros))]++;
    return n;
  }, [blocos, final.cues, parametros]);

  const nivelPct = Number.isFinite(nivel) ? Math.max(0, Math.min(100, ((nivel + 60) / 60) * 100)) : 0;

  return (
    <section aria-labelledby={`${id}-t`} className="px-4 py-3">
      <h2 id={`${id}-t`} className="sr-only">
        Roteiro e gravação
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <fieldset className="rounded border border-paper-400 p-3">
          <legend className="px-1 text-sm font-medium">Microfone</legend>
          {gravador.current.aberto ? (
            <>
              <label className="rotulo" htmlFor={`${id}-mic`}>
                Entrada
              </label>
              <select
                id={`${id}-mic`}
                className="campo"
                value={micId}
                onChange={(e) => {
                  setMicId(e.target.value);
                  void abrirMic(e.target.value);
                }}
              >
                <option value="">Padrão do sistema</option>
                {microfones.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Microfone ${m.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
              <div className="mt-2" aria-hidden="true">
                <div className="h-2 w-full rounded bg-paper-200">
                  <div
                    className={`h-2 rounded ${nivel > -3 ? 'bg-bad' : nivel > -12 ? 'bg-warn' : 'bg-ok'}`}
                    style={{ width: `${nivelPct}%` }}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-navy-700">
                Pico: {Number.isFinite(nivel) ? `${nivel.toFixed(0)} dBFS` : '—'}
                {nivel > -3 ? ' · perto de saturar, afaste-se ou baixe o ganho' : ''}
              </p>
            </>
          ) : (
            <button type="button" className="btn-secundario" onClick={() => void abrirMic()}>
              Abrir microfone
            </button>
          )}
          {erroMic ? <p className="mt-2 text-sm text-bad">{erroMic}</p> : null}
          <p className="mt-2 text-xs text-navy-500">
            Use fones: o som do vídeo toca durante a gravação e vazaria para o microfone. Eco, ruído e ganho
            automáticos do sistema ficam desligados.
          </p>
        </fieldset>

        <fieldset className="rounded border border-paper-400 p-3">
          <legend className="px-1 text-sm font-medium">Leitura e mixagem</legend>
          <div className="grid grid-cols-2 gap-2">
            <Numero
              rotulo="Velocidade (ppm)"
              valor={parametros.palavrasPorMinuto}
              passo={5}
              aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { palavrasPorMinuto: v } })}
            />
            <Numero
              rotulo="Ducking (dB)"
              valor={parametros.duckingDb}
              passo={1}
              max={0}
              aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { duckingDb: v } })}
            />
            <Numero
              rotulo="Ataque (ms)"
              valor={parametros.ataqueMs}
              passo={50}
              aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { ataqueMs: v } })}
            />
            <Numero
              rotulo="Liberação (ms)"
              valor={parametros.liberacaoMs}
              passo={50}
              aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { liberacaoMs: v } })}
            />
            <Numero
              rotulo="Pré-rolagem (ms)"
              valor={parametros.prerollMs}
              passo={500}
              aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { prerollMs: v } })}
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
            {calibracao ? (
              <>
                Velocidade medida nas gravações: <strong>{calibracao.ppm} ppm</strong> ({calibracao.amostras} takes).{' '}
                {calibracao.ppm !== parametros.palavrasPorMinuto ? (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => despachar({ tipo: 'adParametros', mudanca: { palavrasPorMinuto: calibracao.ppm } })}
                  >
                    Usar na estimativa
                  </button>
                ) : null}
              </>
            ) : (
              'A velocidade é uma estimativa até haver três gravações; depois, o estúdio mede a do locutor.'
            )}
          </p>
        </fieldset>

        <div className="rounded border border-paper-400 p-3 text-sm">
          <p className="font-medium">{blocos.length} blocos</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {(['ok', 'aviso', 'erro', 'pendente'] as NivelAD[]).map((n) => (
              <li key={n} className={`chip ${CLASSE_NIVEL[n]}`}>
                <span aria-hidden="true">{ICONE[n]}</span>
                {resumo[n]} {n === 'ok' ? 'prontos' : n === 'pendente' ? 'pendentes' : n === 'aviso' ? 'com aviso' : 'com erro'}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-fantasma mt-2"
            disabled={!video}
            onClick={() => despachar({ tipo: 'adAdicionar', inicioMs: tempoMs, fimMs: tempoMs + 3000 })}
          >
            + Bloco na posição atual ({formatarTimecode(tempoMs)})
          </button>
          {blocoAtual ? (
            <button
              type="button"
              className="btn-fantasma"
              onClick={() => document.getElementById(`texto-${blocoAtual.id}`)?.focus()}
            >
              Ir ao bloco sob o cursor
            </button>
          ) : null}
        </div>
      </div>

      {sessao ? (
        <div
          role="status"
          className={`sticky top-2 z-20 mt-3 flex items-center gap-3 rounded border-2 px-3 py-2 ${sessao.fase === 'agora' ? 'border-bad bg-bad-100 text-bad' : 'border-navy-500 bg-paper-200 text-navy'}`}
        >
          <span aria-hidden="true" className="text-lg">
            ●
          </span>
          <strong>
            {sessao.fase === 'preroll'
              ? 'Gravando — aguarde: pré-rolagem'
              : sessao.fase === 'agora'
                ? 'Gravando — LEIA AGORA'
                : 'Processando a gravação…'}
          </strong>
          {sessao.fase !== 'processando' ? (
            <button type="button" className="btn-secundario ml-auto" onClick={interromper}>
              Parar (Esc)
            </button>
          ) : null}
        </div>
      ) : null}

      {blocos.length === 0 ? (
        <p className="mt-6 text-center text-navy-700">
          Nenhum bloco ainda. Use <em>Criar blocos de AD nas lacunas</em> acima, ou crie um na posição atual do vídeo.
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
                emCurso={sessao?.blocoId === b.id}
                ocupado={sessao !== null}
                podeGravar={!!video}
                aoGravar={() => void gravar(b)}
                aoOuvir={(ms) => {
                  buscar(ms);
                  void video?.play();
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

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
  emCurso,
  ocupado,
  podeGravar,
  aoGravar,
  aoOuvir,
}: {
  n: number;
  bloco: BlocoAD;
  apontamentos: ApontamentoAD[];
  ppm: number;
  emCurso: boolean;
  ocupado: boolean;
  podeGravar: boolean;
  aoGravar: () => void;
  aoOuvir: (ms: number) => void;
}) {
  const despachar = useDespachar();
  const janela = b.fimMs - b.inicioMs;
  const est = duracaoEstimadaMs(b.texto, ppm);
  const palavras = contarPalavras(b.texto);
  const cabem = palavrasQueCabem(janela, ppm);
  const nivel = nivelDoBloco(apontamentos);
  const ativo = takeAtivo(b);
  const fracao = Math.min(1.5, est / Math.max(1, janela));

  const mover = (campo: 'inicioMs' | 'fimMs', delta: number) =>
    despachar({ tipo: 'adEditar', id: b.id, mudanca: { [campo]: Math.max(0, b[campo] + delta) } });

  return (
    <article
      id={`bloco-${b.id}`}
      aria-labelledby={`titulo-${b.id}`}
      className={`rounded border-l-4 border-y border-r border-paper-400 bg-paper p-3 ${emCurso ? 'ring-2 ring-bad' : ''} ${nivel === 'erro' ? 'border-l-bad' : nivel === 'aviso' ? 'border-l-warn' : nivel === 'ok' ? 'border-l-ok' : 'border-l-navy-300'}`}
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
          {nivel === 'ok' ? 'Pronto' : nivel === 'pendente' ? 'Pendente' : nivel === 'aviso' ? 'Aviso' : 'Erro'}
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
              if (b.texto.trim() === '' && b.takes.length === 0) despachar({ tipo: 'adRemover', id: b.id });
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
          {/* barra de ocupação: quanto da janela a leitura estimada consome */}
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
            Nota para o locutor (não é lida)
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
            className="btn-primario justify-center"
            disabled={!podeGravar || ocupado || b.texto.trim() === ''}
            onClick={aoGravar}
          >
            <span aria-hidden="true">●</span> {b.takes.length ? 'Gravar outro take' : 'Gravar'}
          </button>
          <button type="button" className="btn-secundario justify-center" disabled={!podeGravar} onClick={() => aoOuvir(Math.max(0, b.inicioMs - 2000))}>
            <span aria-hidden="true">▶</span> Ouvir o trecho
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
          <span className="self-center text-[11px] text-navy-500">{t.ganhoDb > 0 ? '+' : ''}{t.ganhoDb} dB</span>
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
