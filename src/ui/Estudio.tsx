import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Severity } from '../model/types';
import { DOCUMENT_SCOPE } from '../model/types';
import { useDespachar, useEstado, useResultadoFinal } from '../state/store';
import { analisarAudio, detectarCortes, ErroMidia, JANELA_MS } from '../mapa/midia';
import { detectarAtividade } from '../mapa/sinal';
import { lacunasCsv, lacunasParaAd } from '../mapa/lacunas';
import { PARAMETROS_ATIVIDADE_PADRAO } from '../mapa/tipos';
import { formatarTimecode } from '../core/texto';
import { LinhaDoTempo } from './LinhaDoTempo';

const PESO: Record<Severity, number> = { erro: 3, aviso: 2, revisao_manual: 1 };

type StatusAudio =
  | { tipo: 'ocioso' }
  | { tipo: 'analisando' }
  | { tipo: 'pronto' }
  | { tipo: 'erro'; mensagem: string };

function baixar(nome: string, conteudo: string, mime: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Estúdio: vídeo local + mapa temporal + linha do tempo, ligados à revisão.
 * Primeiro passo do programa unificado: a trilha de LSE sobre um mapa da obra
 * que, adiante, alimenta a audiodescrição (lacunas) e a janela de Libras.
 */
export function Estudio({ previa }: { previa: boolean }) {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const final = useResultadoFinal();
  const cues = previa ? final.cues : estado.cues;
  const { mapa, video, config } = estado;

  const elVideo = useRef<HTMLVideoElement>(null);
  const [tempoMs, setTempoMs] = useState(0);
  const [duracaoVideoMs, setDuracaoVideoMs] = useState(0);
  const [statusAudio, setStatusAudio] = useState<StatusAudio>(
    !mapa
      ? { tipo: 'ocioso' }
      : mapa.audio
        ? { tipo: 'pronto' }
        : { tipo: 'erro', mensagem: 'O áudio deste vídeo não pôde ser decodificado.' },
  );
  const [passoCortes, setPassoCortes] = useState(500);
  const abortar = useRef<AbortController | null>(null);

  useEffect(() => () => abortar.current?.abort(), []);

  // Cursor fluido durante a reprodução (timeupdate dispara só ~4×/s).
  useEffect(() => {
    const v = elVideo.current;
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

  // Pedidos de navegação vindos da lista de legendas.
  useEffect(() => {
    const v = elVideo.current;
    if (v && estado.pedidoSeek) {
      v.currentTime = estado.pedidoSeek.ms / 1000;
      setTempoMs(estado.pedidoSeek.ms);
    }
  }, [estado.pedidoSeek]);

  async function carregarVideo(f: File) {
    abortar.current?.abort();
    if (video) URL.revokeObjectURL(video.url);
    despachar({ tipo: 'video', url: URL.createObjectURL(f), nome: f.name });
    setStatusAudio({ tipo: 'analisando' });
    const parametros = PARAMETROS_ATIVIDADE_PADRAO;
    try {
      const { envelopeDb, duracaoMs } = await analisarAudio(f);
      const { atividade, pisoDb } = detectarAtividade(envelopeDb, JANELA_MS, parametros);
      despachar({
        tipo: 'mapa',
        mapa: {
          arquivoVideo: f.name,
          duracaoMs,
          audio: true,
          janelaMs: JANELA_MS,
          envelopeDb,
          pisoDb,
          parametros,
          atividade,
          cortes: [],
          statusCortes: { tipo: 'nao_detectado' },
        },
      });
      setStatusAudio({ tipo: 'pronto' });
    } catch (e) {
      const mensagem = e instanceof ErroMidia ? e.message : `Falha na análise do áudio: ${String(e)}`;
      // Sem áudio, o mapa ainda serve aos cortes; M1 e M3 não executam.
      despachar({
        tipo: 'mapa',
        mapa: {
          arquivoVideo: f.name,
          duracaoMs: 0,
          audio: false,
          janelaMs: JANELA_MS,
          envelopeDb: new Float32Array(0),
          pisoDb: -100,
          parametros,
          atividade: [],
          cortes: [],
          statusCortes: { tipo: 'nao_detectado' },
        },
      });
      setStatusAudio({ tipo: 'erro', mensagem });
    }
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

  // Pior severidade pendente por legenda, para colorir a trilha.
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

  const lacunas = useMemo(
    () => lacunasParaAd(cues, duracaoMs, config.lacunaMinimaAdMs, mapa?.audio ? mapa : null),
    [cues, duracaoMs, config.lacunaMinimaAdMs, mapa],
  );
  const totalLacunasMs = lacunas.reduce((a, l) => a + l.fimMs - l.inicioMs, 0);

  const atual = cues.find((c) => tempoMs >= c.startMs && tempoMs < c.endMs);
  const sc = mapa?.statusCortes;

  return (
    <section aria-labelledby={`${id}-t`} className="border-b border-paper-400 px-4 py-3">
      <h2 id={`${id}-t`} className="text-base font-semibold">
        Estúdio: vídeo e mapa temporal
      </h2>

      <div className="mt-2 flex flex-wrap items-end gap-3">
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
              if (f) void carregarVideo(f);
            }}
          />
        </div>
        <p className="pb-2 text-xs text-navy-500" role="status">
          {video ? <strong className="font-medium text-navy-700">{video.nome}</strong> : null}
          {video ? ' · ' : null}
          {statusAudio.tipo === 'ocioso' && 'O vídeo é lido do seu disco e não sai do navegador.'}
          {statusAudio.tipo === 'analisando' && 'Analisando o áudio…'}
          {statusAudio.tipo === 'pronto' && mapa
            ? `Áudio analisado: ${mapa.atividade.length} segmentos com som; piso de ruído ${mapa.pisoDb.toFixed(0)} dBFS.`
            : null}
        </p>
      </div>

      {statusAudio.tipo === 'erro' ? (
        <p className="mt-2 rounded border border-warn bg-warn-100 px-3 py-2 text-sm text-warn">
          <span aria-hidden="true">! </span>
          {statusAudio.mensagem} As verificações M1 e M3 e o mapa de som ficam indisponíveis.
        </p>
      ) : null}

      {video ? (
        <>
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="relative">
              <video
                ref={elVideo}
                src={video.url}
                controls
                className="block max-h-72 rounded border border-paper-400 bg-navy"
                onLoadedMetadata={(e) => setDuracaoVideoMs(Math.round(e.currentTarget.duration * 1000))}
                onTimeUpdate={(e) => setTempoMs(Math.round(e.currentTarget.currentTime * 1000))}
              />
              {atual ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-11 flex justify-center px-2"
                >
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
                {atual ? (
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
                      despachar({
                        tipo: 'atividade',
                        parametros: { ...mapa.parametros, limiarDb: Number(e.target.value) },
                      })
                    }
                    className="w-full max-w-xs"
                  />
                  <p className="text-xs text-navy-500">
                    Energia na banda de voz, não reconhecimento de fala: música e ruído também contam.
                  </p>
                </div>
              ) : null}

              {mapa ? (
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
                  Derivadas da própria legenda: legendas só com [efeito] ou ♪ não contam como fala.
                </p>
                {lacunas.length > 0 ? (
                  <button
                    type="button"
                    className="btn-fantasma mt-1"
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

          <LinhaDoTempo
            duracaoMs={duracaoMs}
            mapa={mapa}
            cues={cues}
            severidades={severidades}
            lacunas={lacunas}
            alertasSom={alertasSom}
            tempoMs={tempoMs}
            aoBuscar={(ms) => {
              const v = elVideo.current;
              if (v) v.currentTime = ms / 1000;
              setTempoMs(Math.round(ms));
            }}
            aoSelecionarLegenda={(index) => despachar({ tipo: 'irParaLegenda', index })}
          />
        </>
      ) : null}
    </section>
  );
}
