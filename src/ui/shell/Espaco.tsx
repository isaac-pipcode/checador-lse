import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Severity } from '../../model/types';
import { DOCUMENT_SCOPE } from '../../model/types';
import { useDespachar, useEstado, useResultadoFinal, type Pagina } from '../../state/store';
import { analisarAudio, JANELA_MS } from '../../mapa/midia';
import { ponte } from '../../desktop/ponte';
import { LinhaDoTempo, type BlocoNaLinha } from '../LinhaDoTempo';
import { carregarMidia } from '../carregarMidia';
import { CtxVideo } from '../contextoVideo';
import { MotorPrevia } from '../../ad/previa';
import { clipesDosBlocos, curvaDeDucking } from '../../ad/mixagem';
import { verificarBloco, nivelDoBloco } from '../../ad/verificacoes';
import { duracaoUtil, takeAtivo } from '../../ad/tipos';
import { CamadaLibras } from '../libras/CamadaLibras';
import { tcSmpte, useLacunas } from '../comum';
import { BarraSuperior } from './BarraSuperior';
import { BarraPaginas } from './BarraPaginas';
import { AvisoOriginal, ControleProxy } from './ControleProxy';
import { avaliarMidia } from '../../midia/avaliacao';
import { gerarProxyDe } from '../proxy';
import { toleranciaSugerida } from '../../libras/chroma';
import { LseEsquerda, LseDireita } from '../paginas/PaginaLSE';
import { AdEsquerda, AdDireita, ProvedorPaginaAD } from '../paginas/PaginaAD';
import { LibrasEsquerda, LibrasDireita } from '../paginas/PaginaLibras';
import { EntregaEsquerda, EntregaDireita } from '../paginas/PaginaEntrega';

const PESO: Record<Severity, number> = { erro: 3, aviso: 2, revisao_manual: 1 };

/** Colunas por página: painel esquerdo · monitor · inspetor. */
const COLUNAS: Record<Exclude<Pagina, 'projetos'>, string> = {
  lse: 'minmax(360px, 1.05fr) minmax(420px, 1.4fr) minmax(280px, 320px)',
  ad: 'minmax(380px, 1.1fr) minmax(420px, 1.35fr) minmax(300px, 340px)',
  libras: 'minmax(300px, 340px) minmax(480px, 1.8fr) minmax(300px, 340px)',
  entrega: 'minmax(340px, 1fr) minmax(420px, 1.3fr) minmax(320px, 380px)',
};

/**
 * Espaço de trabalho do editor. Dono do vídeo (um só elemento, compartilhado
 * por todas as páginas), da prévia de mixagem e da linha do tempo unificada.
 */
export function Espaco() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const final = useResultadoFinal();
  const pagina = estado.pagina as Exclude<Pagina, 'projetos'>;
  const { mapa, video, ad, libras, config } = estado;
  const desktop = ponte();

  const elVideo = useRef<HTMLVideoElement>(null);
  const [videoPronto, setVideoPronto] = useState<HTMLVideoElement | null>(null);
  const [tempoMs, setTempoMs] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [duracaoVideoMs, setDuracaoVideoMs] = useState(0);
  const [progressoAudio, setProgressoAudio] = useState<number | null>(null);
  const [ouvirAd, setOuvirAd] = useState(true);
  const [legendaRevisada, setLegendaRevisada] = useState(true);
  const [verLse, setVerLse] = useState(true);
  const [verLibras, setVerLibras] = useState(true);
  const [erroVideo, setErroVideo] = useState(false);
  // trocar entre proxy e original recria o elemento de vídeo: a posição é preservada
  const ultimoTempo = useRef(0);
  ultimoTempo.current = tempoMs;
  useEffect(() => setErroVideo(false), [video?.url]);

  // relógio fluido durante a reprodução
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
      setTocando(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(laco);
    };
    const parar = () => {
      setTocando(!v.paused);
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

  // prévia de mixagem da AD: sempre ligada ao vídeo; o botão AD do transporte liga/desliga
  const [motor, setMotor] = useState<MotorPrevia | null>(null);
  useEffect(() => {
    if (!videoPronto) return;
    const m = new MotorPrevia(videoPronto);
    setMotor(m);
    return () => {
      m.descartar();
      setMotor(null);
    };
  }, [videoPronto]);
  const clipes = useMemo(() => clipesDosBlocos(ad.blocos, ad.parametros), [ad.blocos, ad.parametros]);
  const curva = useMemo(() => curvaDeDucking(clipes, ad.parametros), [clipes, ad.parametros]);
  useEffect(() => motor?.atualizar(clipes, curva), [motor, clipes, curva]);
  useEffect(() => motor?.definirLigado(ouvirAd), [motor, ouvirAd]);
  useEffect(() => motor?.definirEscuta(estado.librasUi.escuta), [motor, estado.librasUi.escuta]);

  const duracaoMs = Math.max(
    mapa?.duracaoMs ?? 0,
    duracaoVideoMs,
    estado.cues.length ? Math.max(...estado.cues.map((c) => c.endMs)) : 0,
  );

  const buscar = (ms: number) => {
    const v = elVideo.current;
    const alvo = Math.max(0, Math.min(ms, duracaoMs || ms));
    if (v) v.currentTime = alvo / 1000;
    setTempoMs(Math.round(alvo));
  };

  async function abrirVideo(f?: File) {
    if (f) {
      if (video?.url.startsWith('blob:')) URL.revokeObjectURL(video.url);
      await carregarMidia(despachar, { url: URL.createObjectURL(f), nome: f.name, caminho: null }, () => analisarAudio(f));
      return;
    }
    if (!desktop) return;
    const m = await desktop.escolherVideo();
    if (!m) return;
    setProgressoAudio(0);
    ultimoTempo.current = 0;
    const analise = carregarMidia(despachar, m, () => desktop.analisarAudio(m.caminho, JANELA_MS, setProgressoAudio));
    // formato de finalização: o proxy é gerado já, em paralelo à análise do áudio
    if (m.info && avaliarMidia(m.info).necessidade === 'obrigatorio') {
      void gerarProxyDe(despachar, m.caminho, estado.projeto.caminho).then((px) => {
        if (px) despachar({ tipo: 'videoProxy', proxy: px, usar: true });
      });
    }
    await analise;
    setProgressoAudio(null);
  }

  // ---- dados da linha do tempo ----------------------------------------------
  const cuesMonitor = pagina === 'lse' && !legendaRevisada ? estado.cues : final.cues;
  const severidades = useMemo(() => {
    const m = new Map<number, Severity>();
    for (const s of estado.sugestoes) {
      if (s.cueIndex === DOCUMENT_SCOPE || estado.review[s.id]?.decision !== 'pendente') continue;
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
  const { lacunas } = useLacunas();
  const trilhaAd: BlocoNaLinha[] = useMemo(
    () =>
      ad.blocos.map((b) => {
        const t = takeAtivo(b);
        return {
          id: b.id,
          inicioMs: b.inicioMs,
          fimMs: b.fimMs,
          texto: b.texto,
          take: t ? { inicioMs: t.posicaoMs, fimMs: t.posicaoMs + duracaoUtil(t) } : null,
          nivel: nivelDoBloco(verificarBloco(b, final.cues, ad.parametros)),
        };
      }),
    [ad.blocos, ad.parametros, final.cues],
  );
  const trilhaLibras = libras.clipe
    ? { inicioMs: libras.inicioNaObraMs, fimMs: libras.inicioNaObraMs + libras.clipe.duracaoMs, rotulo: libras.clipe.nome }
    : null;

  const atual = cuesMonitor.find((c) => tempoMs >= c.startMs && tempoMs < c.endMs);
  const quadroMs = 1000 / config.fps;

  const lados: Record<typeof pagina, [ReactNode, ReactNode]> = {
    lse: [<LseEsquerda key="e" />, <LseDireita key="d" />],
    ad: [<AdEsquerda key="e" />, <AdDireita key="d" />],
    libras: [<LibrasEsquerda key="e" />, <LibrasDireita key="d" />],
    entrega: [<EntregaEsquerda key="e" />, <EntregaDireita key="d" />],
  };

  const status = !video
    ? null
    : !mapa
      ? `Analisando o áudio${progressoAudio !== null ? ` · ${Math.round(progressoAudio * 100)}%` : '…'}`
      : mapa.audio
        ? null
        : mapa.erroAudio ?? 'Áudio não analisado';

  return (
    <CtxVideo.Provider value={{ video: videoPronto, tempoMs, buscar, previa: motor, duracaoMs }}>
      <ProvedorPaginaAD>
        <div className="grid h-screen grid-rows-[44px_minmax(0,1fr)_auto_40px] bg-fundo text-navy">
          <BarraSuperior />

          <main id="conteudo" className="grid min-h-0 gap-1.5 p-1.5 pb-0" style={{ gridTemplateColumns: COLUNAS[pagina] }}>
            {lados[pagina][0]}

            {/* ---- Monitor ---- */}
            <section className="painel" aria-label="Monitor">
              <header className="painel-cabeca">
                <h2>Monitor</h2>
                <span className="min-w-0 truncate font-normal normal-case tracking-normal text-navy-500">
                  {video ? `${video.nome}${video.usarProxy ? ' (proxy)' : ''}` : 'sem vídeo'}
                  {status ? ` · ${status}` : ''}
                </span>
                <span className="ml-auto flex min-w-0 items-center gap-1 normal-case tracking-normal">
                  <ControleProxy />
                  {video ? (
                    desktop ? (
                      <button type="button" className="btn-fantasma h-6 px-2 text-2xs" onClick={() => void abrirVideo()}>
                        Trocar vídeo…
                      </button>
                    ) : (
                      <label className="btn-fantasma h-6 cursor-pointer px-2 text-2xs">
                        Trocar vídeo…
                        <input type="file" accept="video/*,audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void abrirVideo(e.target.files[0])} />
                      </label>
                    )
                  ) : null}
                </span>
              </header>
              <div className="relative min-h-0 flex-1 bg-preto">
                {video ? (
                  <>
                    <video
                      key={video.url}
                      ref={elVideo}
                      src={video.url}
                      crossOrigin="anonymous"
                      className="absolute inset-0 h-full w-full object-contain"
                      onLoadedMetadata={(e) => {
                        setDuracaoVideoMs(Math.round(e.currentTarget.duration * 1000));
                        if (ultimoTempo.current > 0) e.currentTarget.currentTime = ultimoTempo.current / 1000;
                      }}
                      onError={() => setErroVideo(true)}
                      onTimeUpdate={(e) => setTempoMs(Math.round(e.currentTarget.currentTime * 1000))}
                      onClick={(e) => void (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
                    />
                    <AvisoOriginal erroDeReproducao={erroVideo} />
                    {verLibras && (libras.clipe || pagina === 'libras') ? (
                      <CamadaLibras
                        principal={videoPronto}
                        janela={libras}
                        tempoMs={tempoMs}
                        tocando={tocando}
                        guia={pagina === 'libras'}
                        ui={estado.librasUi}
                        aoPegarCor={(cor) => {
                          despachar({ tipo: 'libras', mudanca: { chroma: { ...libras.chroma, cor, ...toleranciaSugerida(cor) } } });
                          despachar({ tipo: 'librasUi', mudanca: { contaGotas: false } });
                          despachar({ tipo: 'anunciar', texto: `Cor-chave definida: ${cor}.` });
                        }}
                      />
                    ) : null}
                    {verLse && atual ? (
                      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[6%] flex justify-center px-4">
                        <div className="max-w-[60%] rounded bg-preto/80 px-2 py-0.5 text-center font-mono text-[clamp(0.75rem,1.4vw,1.05rem)] text-cabine-texto">
                          {atual.lines.map((l, i) => (
                            <div key={i}>{l.replace(/<\/?[^>]+>/g, '')}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-cabine-suave">Nenhum vídeo no projeto.</p>
                    {desktop ? (
                      <button type="button" className="btn-primario" onClick={() => void abrirVideo()}>
                        Abrir vídeo…
                      </button>
                    ) : (
                      <label className="btn-primario cursor-pointer">
                        Abrir vídeo…
                        <input type="file" accept="video/*,audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void abrirVideo(e.target.files[0])} />
                      </label>
                    )}
                    <p className="max-w-xs text-2xs text-cabine-suave">O arquivo é lido do disco e não sai da máquina.</p>
                  </div>
                )}
              </div>

              {/* ---- Transporte ---- */}
              <div className="flex h-10 shrink-0 items-center gap-1 border-t border-paper-400 bg-paper-200 px-2" role="toolbar" aria-label="Transporte">
                <button type="button" className="btn-icone" aria-label="Ir ao início" onClick={() => buscar(0)} disabled={!video}>
                  <span aria-hidden="true">⏮</span>
                </button>
                <button type="button" className="btn-icone" aria-label="Voltar 1 quadro" onClick={() => buscar(tempoMs - quadroMs)} disabled={!video}>
                  <span aria-hidden="true">◂|</span>
                </button>
                <button
                  type="button"
                  className="btn-icone h-8 w-10 bg-paper text-navy"
                  aria-label={tocando ? 'Pausar' : 'Reproduzir'}
                  onClick={() => videoPronto && void (videoPronto.paused ? videoPronto.play() : videoPronto.pause())}
                  disabled={!video}
                >
                  <span aria-hidden="true">{tocando ? '❚❚' : '▶'}</span>
                </button>
                <button type="button" className="btn-icone" aria-label="Avançar 1 quadro" onClick={() => buscar(tempoMs + quadroMs)} disabled={!video}>
                  <span aria-hidden="true">|▸</span>
                </button>
                <span className="ml-2 font-mono text-sm tabular-nums text-terra-700" aria-label="Posição">
                  {tcSmpte(tempoMs, config.fps)}
                </span>
                <span className="font-mono text-xs tabular-nums text-navy-500"> / {tcSmpte(duracaoMs, config.fps)}</span>

                <div className="ml-auto flex items-center gap-1" role="group" aria-label="Camadas do monitor">
                  {pagina === 'lse' ? (
                    <button type="button" className="segmento" aria-pressed={legendaRevisada} onClick={() => setLegendaRevisada((v) => !v)}>
                      {legendaRevisada ? 'LSE revisada' : 'LSE original'}
                    </button>
                  ) : null}
                  <button type="button" className="segmento" aria-pressed={verLse} onClick={() => setVerLse((v) => !v)}>
                    LSE
                  </button>
                  <button type="button" className="segmento" aria-pressed={verLibras} onClick={() => setVerLibras((v) => !v)}>
                    Libras
                  </button>
                  <button type="button" className="segmento" aria-pressed={ouvirAd} onClick={() => setOuvirAd((v) => !v)} title="Ouvir a prévia da mixagem com audiodescrição">
                    AD
                  </button>
                </div>
              </div>
            </section>

            {lados[pagina][1]}
          </main>

          <div className="min-h-0 px-1.5 pt-1.5">
            {video ? (
              <LinhaDoTempo
                duracaoMs={duracaoMs}
                mapa={mapa}
                cues={cuesMonitor}
                severidades={pagina === 'lse' ? severidades : new Map()}
                lacunas={lacunas}
                alertasSom={pagina === 'lse' ? alertasSom : []}
                tempoMs={tempoMs}
                aoBuscar={buscar}
                aoSelecionarLegenda={(index) => {
                  despachar({ tipo: 'navegar', pagina: 'lse' });
                  despachar({ tipo: 'irParaLegenda', index });
                }}
                trilhaAd={trilhaAd}
                curvaGanho={ouvirAd ? curva : undefined}
                trilhaLibras={trilhaLibras}
                aoSelecionarBloco={(bid) => {
                  if (pagina !== 'ad') despachar({ tipo: 'navegar', pagina: 'ad' });
                  requestAnimationFrame(() => {
                    document.getElementById(`bloco-${bid}`)?.scrollIntoView({ block: 'center' });
                    document.getElementById(`texto-${bid}`)?.focus({ preventScroll: true });
                  });
                }}
              />
            ) : null}
          </div>

          <BarraPaginas />
        </div>
      </ProvedorPaginaAD>
    </CtxVideo.Provider>
  );
}
