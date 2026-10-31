import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Severity } from '../model/types';
import { DOCUMENT_SCOPE } from '../model/types';
import { useDespachar, useEstado, useResultadoFinal } from '../state/store';
import { analisarAudio, detectarCortes, JANELA_MS } from '../mapa/midia';
import { lacunasCsv, lacunasParaAd, lacunasPorSilencio, type Lacuna } from '../mapa/lacunas';
import { formatarTimecode } from '../core/texto';
import { ponte } from '../desktop/ponte';
import { LinhaDoTempo, type BlocoNaLinha } from './LinhaDoTempo';
import { carregarMidia } from './carregarMidia';
import { CtxVideo } from './contextoVideo';
import { MotorPrevia } from '../ad/previa';
import { clipesDosBlocos, curvaDeDucking } from '../ad/mixagem';
import { verificarBloco, nivelDoBloco } from '../ad/verificacoes';
import { duracaoUtil, takeAtivo } from '../ad/tipos';

const PESO: Record<Severity, number> = { erro: 3, aviso: 2, revisao_manual: 1 };

/** Salva texto: diálogo do sistema no desktop; download no navegador. */
export function baixar(nome: string, conteudo: string, mime: string) {
  const p = ponte();
  if (p) {
    void p.salvarTexto(nome, conteudo);
    return;
  }
  const url = URL.createObjectURL(new Blob([conteudo], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lacunas da obra: da legenda, se houver; senão, dos silêncios do áudio. */
export function useLacunas(): { lacunas: Lacuna[]; fonte: 'legenda' | 'silencio' | null } {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const { mapa, config } = estado;
  const cues = final.cues;
  return useMemo(() => {
    const duracaoMs = Math.max(mapa?.duracaoMs ?? 0, cues.length ? Math.max(...cues.map((c) => c.endMs)) : 0);
    if (cues.length > 0) {
      return {
        lacunas: lacunasParaAd(cues, duracaoMs, config.lacunaMinimaAdMs, mapa?.audio ? mapa : null),
        fonte: 'legenda' as const,
      };
    }
    if (mapa?.audio) return { lacunas: lacunasPorSilencio(mapa, config.lacunaMinimaAdMs), fonte: 'silencio' as const };
    return { lacunas: [], fonte: null };
  }, [cues, mapa, config.lacunaMinimaAdMs]);
}

/**
 * Estúdio: vídeo + mapa temporal + linha do tempo. Serve aos dois módulos:
 * `lse` (revisão de legenda: cortes, M1–M3) e `ad` (audiodescrição: trilha de
 * blocos, prévia da mixagem). O conteúdo específico de cada módulo entra como
 * `children`, com acesso ao vídeo pelo contexto.
 */
export function Estudio({ previa, modo, children }: { previa: boolean; modo: 'lse' | 'ad'; children?: ReactNode }) {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const final = useResultadoFinal();
  const cues = previa ? final.cues : estado.cues;
  const { mapa, video, config, ad } = estado;
  const desktop = ponte();

  const elVideo = useRef<HTMLVideoElement>(null);
  const [videoPronto, setVideoPronto] = useState<HTMLVideoElement | null>(null);
  const [tempoMs, setTempoMs] = useState(0);
  const [duracaoVideoMs, setDuracaoVideoMs] = useState(0);
  const [progressoAudio, setProgressoAudio] = useState<number | null>(null);
  const [passoCortes, setPassoCortes] = useState(500);
  const abortar = useRef<AbortController | null>(null);

  useEffect(() => () => abortar.current?.abort(), []);

  // Cursor fluido durante a reprodução (timeupdate dispara só ~4×/s).
  useEffect(() => {
    const v = elVideo.current;
    setVideoPronto(v);
    if (!v) return;
    let raf = 0;
    const laco = () => {
      setTempoMs(Math.round(v.currentTime * 1000));
      raf = requestAnimationFrame(laco);
    };
    const tocar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(laco);
    };
    const parar = () => {
      cancelAnimationFrame(raf);
      setTempoMs(Math.round(v.currentTime * 1000));
    };
    v.addEventListener('play', tocar);
    v.addEventListener('pause', parar);
    v.addEventListener('seeked', parar);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('play', tocar);
      v.removeEventListener('pause', parar);
      v.removeEventListener('seeked', parar);
    };
  }, [video?.url]);

  useEffect(() => {
    const v = elVideo.current;
    if (v && estado.pedidoSeek) {
      v.currentTime = estado.pedidoSeek.ms / 1000;
      setTempoMs(estado.pedidoSeek.ms);
    }
  }, [estado.pedidoSeek]);

  // ---- Prévia da mixagem de AD -------------------------------------------
  const [motor, setMotor] = useState<MotorPrevia | null>(null);
  const [ouvirAd, setOuvirAd] = useState(true);
  useEffect(() => {
    if (modo !== 'ad' || !videoPronto) return;
    const m = new MotorPrevia(videoPronto);
    setMotor(m);
    return () => {
      m.descartar();
      setMotor(null);
    };
  }, [modo, videoPronto]);
  const clipes = useMemo(() => clipesDosBlocos(ad.blocos, ad.parametros), [ad.blocos, ad.parametros]);
  const curva = useMemo(() => curvaDeDucking(clipes, ad.parametros), [clipes, ad.parametros]);
  useEffect(() => motor?.atualizar(clipes, curva), [motor, clipes, curva]);
  useEffect(() => motor?.definirLigado(ouvirAd), [motor, ouvirAd]);

  // ---- Carregamento ------------------------------------------------------
  async function abrirNoNavegador(f: File) {
    abortar.current?.abort();
    if (video?.url.startsWith('blob:')) URL.revokeObjectURL(video.url);
    await carregarMidia(despachar, { url: URL.createObjectURL(f), nome: f.name, caminho: null }, () => analisarAudio(f));
  }

  async function abrirNoDesktop() {
    if (!desktop) return;
    const m = await desktop.escolherVideo();
    if (!m) return;
    abortar.current?.abort();
    setProgressoAudio(0);
    await carregarMidia(despachar, m, () => desktop.analisarAudio(m.caminho, JANELA_MS, setProgressoAudio));
    setProgressoAudio(null);
  }

  const duracaoMs = Math.max(
    mapa?.duracaoMs ?? 0,
    duracaoVideoMs,
    cues.length ? Math.max(...cues.map((c) => c.endMs)) : 0,
  );

  async function rodarCortes() {
    if (!video || !mapa) return;
    const ctrl = new AbortController();
    abortar.current = ctrl;
    despachar({ tipo: 'cortes', status: { tipo: 'em_andamento', progresso: 0 } });
    try {
      const cortes = await detectarCortes(
        video.url,
        duracaoMs,
        passoCortes,
        config.fps,
        (f) => despachar({ tipo: 'cortes', status: { tipo: 'em_andamento', progresso: f } }),
        ctrl.signal,
      );
      despachar({ tipo: 'cortes', status: { tipo: 'concluido', passoMs: passoCortes }, cortes });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        despachar({ tipo: 'cortes', status: { tipo: 'cancelado' }, cortes: [] });
      } else {
        despachar({ tipo: 'cortes', status: { tipo: 'erro', mensagem: String(e) }, cortes: [] });
      }
    }
  }

  const severidades = useMemo(() => {
    const m = new Map<number, Severity>();
    for (const s of estado.sugestoes) {
      if (s.cueIndex === DOCUMENT_SCOPE) continue;
      if (estado.review[s.id]?.decision !== 'pendente') continue;
      const atual = m.get(s.cueIndex);
      if (!atual || PESO[s.severity] > PESO[atual]) m.set(s.cueIndex, s.severity);
    }
    return m;
  }, [estado.sugestoes, estado.review]);

  const alertasSom = useMemo(
    () =>
      estado.sugestoes
        .filter((s) => s.ruleId === 'M3' && estado.review[s.id]?.decision === 'pendente')
        .map((s) => ({ inicioMs: s.before.startMs ?? 0, fimMs: s.before.endMs ?? 0 })),
    [estado.sugestoes, estado.review],
  );

  const { lacunas, fonte } = useLacunas();
  const totalLacunasMs = lacunas.reduce((a, l) => a + l.fimMs - l.inicioMs, 0);

  const trilhaAd: BlocoNaLinha[] | undefined = useMemo(() => {
    if (modo !== 'ad') return undefined;
    return ad.blocos.map((b) => {
      const t = takeAtivo(b);
      return {
        id: b.id,
        inicioMs: b.inicioMs,
        fimMs: b.fimMs,
        texto: b.texto,
        take: t ? { inicioMs: t.posicaoMs, fimMs: t.posicaoMs + duracaoUtil(t) } : null,
        nivel: nivelDoBloco(verificarBloco(b, final.cues, ad.parametros)),
      };
    });
  }, [modo, ad.blocos, ad.parametros, final.cues]);

  const atual = cues.find((c) => tempoMs >= c.startMs && tempoMs < c.endMs);
  const sc = mapa?.statusCortes;
  const buscar = (ms: number) => {
    const v = elVideo.current;
    if (v) v.currentTime = ms / 1000;
    setTempoMs(Math.round(ms));
  };

  const statusAudio = !video
    ? 'O vídeo é lido do seu disco e não sai da máquina.'
    : !mapa
      ? progressoAudio !== null
        ? `Analisando o áudio… ${Math.round(progressoAudio * 100)}%`
        : 'Analisando o áudio…'
      : mapa.audio
        ? `Áudio analisado: ${mapa.atividade.length} segmentos com som; piso de ruído ${mapa.pisoDb.toFixed(0)} dBFS.`
        : '';

  return (
    <CtxVideo.Provider value={{ video: videoPronto, tempoMs, buscar, previa: motor }}>
      <section aria-labelledby={`${id}-t`} className="border-b border-paper-400 px-4 py-3">
        <h2 id={`${id}-t`} className="text-base font-semibold">
          {modo === 'ad' ? 'Audiodescrição: vídeo e trilha' : 'Estúdio: vídeo e mapa temporal'}
        </h2>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          {desktop ? (
            <button type="button" className="btn-secundario" onClick={() => void abrirNoDesktop()}>
              {video ? 'Trocar vídeo…' : 'Abrir vídeo…'}
            </button>
          ) : (
            <div>
              <label className="rotulo" htmlFor={`${id}-video`}>
                Vídeo local
              </label>
              <input
                id={`${id}-video`}
                type="file"
                accept="video/*,audio/*"
                className="campo max-w-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void abrirNoNavegador(f);
                }}
              />
            </div>
          )}
          <p className="pb-2 text-xs text-navy-500" role="status">
            {video ? <strong className="font-medium text-navy-700">{video.nome}</strong> : null}
            {video ? ' · ' : null}
            {statusAudio}
          </p>
        </div>

        {mapa && !mapa.audio ? (
          <p className="mt-2 rounded border border-warn bg-warn-100 px-3 py-2 text-sm text-warn">
            <span aria-hidden="true">! </span>
            {mapa.erroAudio ?? 'O áudio deste vídeo não pôde ser analisado.'} O mapa de som fica indisponível
            {modo === 'lse' ? ', assim como as verificações M1 e M3' : ''}.
          </p>
        ) : null}

        {video ? (
          <>
            <div className="mt-3 flex flex-wrap gap-4">
              <div className="relative">
                <video
                  key={video.url}
                  ref={elVideo}
                  src={video.url}
                  crossOrigin="anonymous"
                  controls
                  className="block max-h-80 rounded border border-paper-400 bg-navy"
                  onLoadedMetadata={(e) => setDuracaoVideoMs(Math.round(e.currentTarget.duration * 1000))}
                  onTimeUpdate={(e) => setTempoMs(Math.round(e.currentTarget.currentTime * 1000))}
                />
                {atual ? (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-11 flex justify-center px-2">
                    <div className="max-w-[38ch] rounded bg-navy/80 px-2 py-0.5 text-center font-mono text-sm text-paper">
                      {atual.lines.map((l, i) => (
                        <div key={i}>{l.replace(/<\/?[^>]+>/g, '')}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="min-w-64 flex-1 space-y-3 text-sm">
                <p className="font-mono text-xs text-navy-700">
                  {formatarTimecode(tempoMs)}
                  {atual && modo === 'lse' ? (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => despachar({ tipo: 'irParaLegenda', index: atual.index })}
                      >
                        legenda {atual.index}
                      </button>
                    </>
                  ) : null}
                </p>

                {modo === 'ad' ? (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5" checked={ouvirAd} onChange={(e) => setOuvirAd(e.target.checked)} />
                    <span>
                      Ouvir com a audiodescrição (prévia da mixagem)
                      <span className="block text-xs text-navy-500">
                        Desligado: o som original, sem ducking. A prévia usa a mesma curva da mixagem final.
                      </span>
                    </span>
                  </label>
                ) : null}

                {mapa?.audio ? (
                  <div>
                    <label className="rotulo" htmlFor={`${id}-limiar`}>
                      Sensibilidade da detecção de som: {mapa.parametros.limiarDb} dB acima do piso
                    </label>
                    <input
                      id={`${id}-limiar`}
                      type="range"
                      min={3}
                      max={30}
                      step={1}
                      value={mapa.parametros.limiarDb}
                      onChange={(e) =>
                        despachar({ tipo: 'atividade', parametros: { ...mapa.parametros, limiarDb: Number(e.target.value) } })
                      }
                      className="w-full max-w-xs"
                    />
                    <p className="text-xs text-navy-500">
                      Energia na banda de voz, não reconhecimento de fala: música e ruído também contam.
                    </p>
                  </div>
                ) : null}

                {mapa && modo === 'lse' ? (
                  <fieldset className="rounded border border-paper-400 p-2">
                    <legend className="px-1 text-sm font-medium">Cortes de plano</legend>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm" htmlFor={`${id}-passo`}>
                        Amostrar a cada
                        <select
                          id={`${id}-passo`}
                          className="campo w-auto"
                          value={passoCortes}
                          onChange={(e) => setPassoCortes(Number(e.target.value))}
                          disabled={sc?.tipo === 'em_andamento'}
                        >
                          <option value={250}>250 ms</option>
                          <option value={500}>500 ms</option>
                          <option value={1000}>1 s</option>
                        </select>
                      </label>
                      {sc?.tipo === 'em_andamento' ? (
                        <>
                          <progress max={1} value={sc.progresso} className="w-32" aria-label="Progresso da detecção de cortes" />
                          <span className="text-xs">{Math.round(sc.progresso * 100)}%</span>
                          <button type="button" className="btn-secundario" onClick={() => abortar.current?.abort()}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn-secundario" onClick={() => void rodarCortes()}>
                          {sc?.tipo === 'concluido' ? 'Detectar de novo' : 'Detectar cortes'}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-navy-500">
                      {sc?.tipo === 'concluido'
                        ? `${mapa.cortes.length} cortes detectados, refinados a ~1 quadro. Cortes a menos de ${sc.passoMs} ms um do outro e fusões lentas podem escapar.`
                        : sc?.tipo === 'cancelado'
                          ? 'Detecção cancelada; a regra M2 não foi verificada.'
                          : sc?.tipo === 'erro'
                            ? `Erro: ${sc.mensagem}`
                            : 'Lê um quadro por amostra e compara histogramas de cor; leva alguns minutos por hora de vídeo. Sem isso, M2 não é verificada.'}
                    </p>
                  </fieldset>
                ) : null}

                <div>
                  <p>
                    <strong>{lacunas.length}</strong> lacunas para audiodescrição (≥{' '}
                    {(config.lacunaMinimaAdMs / 1000).toLocaleString('pt-BR')} s sem fala), somando{' '}
                    {(totalLacunasMs / 1000).toFixed(0)} s.
                  </p>
                  <p className="text-xs text-navy-500">
                    {fonte === 'silencio'
                      ? 'Sem legenda carregada: lacunas tiradas dos silêncios do áudio — trilha musical as encobre. Carregue a LSE para lacunas mais confiáveis.'
                      : 'Derivadas da própria legenda: legendas só com [efeito] ou ♪ não contam como fala.'}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {modo === 'ad' && lacunas.length > 0 ? (
                      <button type="button" className="btn-secundario" onClick={() => despachar({ tipo: 'adCriarDasLacunas', lacunas })}>
                        Criar blocos de AD nas lacunas
                      </button>
                    ) : null}
                    {modo === 'lse' && lacunas.length > 0 ? (
                      <button
                        type="button"
                        className="btn-fantasma"
                        onClick={() =>
                          baixar(
                            `${(estado.arquivoNome ?? video.nome).replace(/\.[^.]+$/, '')}-lacunas-ad.csv`,
                            lacunasCsv(lacunas, (ms) => formatarTimecode(ms)),
                            'text/csv',
                          )
                        }
                      >
                        Exportar lacunas (CSV)
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <LinhaDoTempo
              duracaoMs={duracaoMs}
              mapa={mapa}
              cues={cues}
              severidades={modo === 'lse' ? severidades : new Map()}
              lacunas={lacunas}
              alertasSom={modo === 'lse' ? alertasSom : []}
              tempoMs={tempoMs}
              aoBuscar={buscar}
              aoSelecionarLegenda={(index) => {
                if (modo === 'lse') despachar({ tipo: 'irParaLegenda', index });
              }}
              trilhaAd={trilhaAd}
              curvaGanho={modo === 'ad' && ouvirAd ? curva : undefined}
              aoSelecionarBloco={(bid) => {
                document.getElementById(`bloco-${bid}`)?.scrollIntoView({ block: 'center' });
                document.getElementById(`texto-${bid}`)?.focus({ preventScroll: true });
              }}
            />
          </>
        ) : null}
      </section>
      {children}
    </CtxVideo.Provider>
  );
}
