import { useEffect, useMemo, useRef, useState } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { Gravador } from '../../ad/gravador';
import { contextoAudio, descartarTake, registrarTake } from '../../ad/audio';
import { aparar, novoId } from '../../ad/takes';
import type { Take } from '../../ad/tipos';
import { ajustarLegenda } from '../../ad/tipos';
import { takeAtivo } from '../../ad/tipos';
import {
  GRAVANDO,
  comandoDaTecla,
  montarEstadoPrompter,
  type ComandoGravacao,
  type EstadoPrompter,
  type FaseGravacao,
} from '../../ad/prompter';
import { ponte } from '../../desktop/ponte';

/** Folga antes do bloco: o que foi captado antes disso é pré-rolagem e é descartado. */
const FOLGA_INICIO_MS = 300;
/** Envio ao teleprompter: no máximo ~15 atualizações de tempo por segundo. */
const INTERVALO_ENVIO_MS = 66;

/**
 * Sessão de gravação de AD — máquina de estados:
 *
 *   ocioso → preroll → agora → processando → revisao ─┬─ manter/descartar → (próximo bloco | ocioso)
 *                ↑                                    └─ regravar ─┐
 *                └─────────────────────────────────────────────────┘
 *
 * A janela principal é a única dona do estado; o teleprompter (outra janela,
 * outro monitor) só exibe e devolve comandos. As mesmas teclas valem nas duas.
 */
export function useSessaoGravacao() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, tempoMs, previa, buscar } = useVideo();
  const desktop = ponte();

  const gravador = useRef(new Gravador());
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState('');
  const [erroMic, setErroMic] = useState<string | null>(null);
  const [nivel, setNivel] = useState(-Infinity);

  const [fase, setFaseEstado] = useState<FaseGravacao>('ocioso');
  const [fila, setFila] = useState<string[]>([]);
  const [blocoId, setBlocoId] = useState<string | null>(null);
  const [sequencia, setSequencia] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [prompterAberto, setPrompterAberto] = useState<string | null>(null);

  // Espelhos para o código assíncrono (que não pode depender de closures velhas).
  const r = useRef({ fase: 'ocioso' as FaseGravacao, fila: [] as string[], blocoId: null as string | null, sequencia: false });
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const vigia = useRef<number | null>(null);
  const inicioGravacaoMs = useRef(0);
  const ultimoTakeId = useRef<string | null>(null);

  const setFase = (f: FaseGravacao) => {
    r.current.fase = f;
    setFaseEstado(f);
  };

  useEffect(() => () => gravador.current.fechar(), []);

  useEffect(() => {
    let raf = 0;
    const laco = () => {
      if (gravador.current.aberto) setNivel(gravador.current.nivelDb());
      raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function abrirMic(deviceId?: string): Promise<boolean> {
    setErroMic(null);
    try {
      const ctx = contextoAudio();
      await ctx.resume(); // nasce suspenso até um gesto do usuário
      await gravador.current.abrir(ctx, deviceId || undefined);
      setMicrofones(await Gravador.microfones());
      return true;
    } catch (e) {
      setErroMic(`Não foi possível abrir o microfone: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  const bloco = (id: string | null) => estadoRef.current.ad.blocos.find((b) => b.id === id) ?? null;

  function pararVigia() {
    if (vigia.current) cancelAnimationFrame(vigia.current);
    vigia.current = null;
  }

  async function gravar(id: string) {
    const b = bloco(id);
    if (!b || !video) return;
    if (!gravador.current.aberto && !(await abrirMic(micId))) {
      encerrar('Sessão interrompida: microfone indisponível.');
      return;
    }
    setAviso(null);
    pararVigia();
    previa?.definirLigado(false); // o locutor ouve o original limpo
    video.pause();
    const p = estadoRef.current.ad.parametros;
    await new Promise<void>((ok) => {
      video.addEventListener('seeked', () => ok(), { once: true });
      video.currentTime = Math.max(0, b.inicioMs - p.prerollMs) / 1000;
    });
    r.current.blocoId = id;
    setBlocoId(id);
    setFase('preroll');
    await gravador.current.iniciar();
    inicioGravacaoMs.current = video.currentTime * 1000;
    await video.play();
    const limite = b.fimMs + p.posrollMs;
    const laco = () => {
      if (!GRAVANDO.has(r.current.fase)) return;
      const t = video.currentTime * 1000;
      if (r.current.fase === 'preroll' && t >= b.inicioMs) setFase('agora');
      if (r.current.fase === 'agora' && t >= b.fimMs) setFase('posroll');
      if (t >= limite || video.ended) void pararTake();
      else vigia.current = requestAnimationFrame(laco);
    };
    vigia.current = requestAnimationFrame(laco);
  }

  async function pararTake() {
    if (!GRAVANDO.has(r.current.fase)) return;
    pararVigia();
    const b = bloco(r.current.blocoId);
    setFase('processando');
    video?.pause();
    const blob = await gravador.current.parar();
    if (!b) return encerrar();
    const p = estadoRef.current.ad.parametros;
    const tid = novoId('t');
    const buffer = await registrarTake(tid, blob);
    const corte = aparar(buffer.getChannelData(0), buffer.sampleRate, p.aparoDb);
    // A pré-rolagem nunca é AD utilizável: descarta-se, haja ou não silêncio.
    const minimoInicio = Math.max(0, b.inicioMs - FOLGA_INICIO_MS - inicioGravacaoMs.current);
    const trimInicioMs = Math.min(Math.max(corte.trimInicioMs, minimoInicio), corte.trimFimMs);
    const take: Take = {
      id: tid,
      arquivo: null,
      duracaoMs: corte.duracaoMs,
      trimInicioMs,
      trimFimMs: corte.trimFimMs,
      posicaoMs: Math.round(inicioGravacaoMs.current + trimInicioMs),
      ganhoDb: 0,
      gravadoEm: new Date().toISOString(),
    };
    ultimoTakeId.current = tid;
    despachar({ tipo: 'adNovoTake', blocoId: b.id, take });
    setFase('revisao');
  }

  function descartarUltimo() {
    const id = r.current.blocoId;
    const tid = ultimoTakeId.current;
    if (!id || !tid) return;
    descartarTake(tid);
    despachar({ tipo: 'adRemoverTake', blocoId: id, takeId: tid });
    // volta ao take anterior, se houver
    const anterior = bloco(id)?.takes.filter((t) => t.id !== tid).slice(-1)[0];
    if (anterior) despachar({ tipo: 'adAtivarTake', blocoId: id, takeId: anterior.id });
    ultimoTakeId.current = null;
  }

  function seguir() {
    const { fila: f, blocoId: atual, sequencia: seq } = r.current;
    const proximo = f[f.indexOf(atual ?? '') + 1];
    if (seq && proximo) void gravar(proximo);
    else encerrar(seq ? 'Sequência concluída.' : null);
  }

  function encerrar(mensagem: string | null = null) {
    pararVigia();
    if (gravador.current.gravando) void gravador.current.parar(); // take parcial: descartado
    video?.pause();
    previa?.definirLigado(true);
    r.current = { fase: 'ocioso', fila: [], blocoId: null, sequencia: false };
    setFaseEstado('ocioso');
    setFila([]);
    setBlocoId(null);
    setSequencia(false);
    setAviso(mensagem);
    if (mensagem) despachar({ tipo: 'anunciar', texto: mensagem });
  }

  function ouvir() {
    const b = bloco(r.current.blocoId);
    if (!b || !video) return;
    previa?.definirLigado(true);
    buscar(Math.max(0, b.inicioMs - 1000));
    void video.play();
    const fim = b.fimMs + 500;
    const laco = () => {
      if (r.current.fase !== 'revisao') return;
      if (video.currentTime * 1000 >= fim || video.paused) {
        video.pause();
        previa?.definirLigado(false);
      } else vigia.current = requestAnimationFrame(laco);
    };
    pararVigia();
    vigia.current = requestAnimationFrame(laco);
  }

  function comando(c: ComandoGravacao) {
    const f = r.current.fase;
    if (c === 'fonteMais' || c === 'fonteMenos') {
      const atual = estadoRef.current.ad.parametros.legenda;
      const legenda = ajustarLegenda(atual, { escala: atual.escala + (c === 'fonteMais' ? 0.1 : -0.1) });
      despachar({ tipo: 'adParametros', mudanca: { legenda } });
      return;
    }
    if (c === 'encerrar') return encerrar('Sessão de gravação encerrada.');
    if (c === 'parar' && GRAVANDO.has(f)) return void pararTake();
    if (f !== 'revisao') return;
    pararVigia();
    video?.pause();
    if (c === 'manter') seguir();
    else if (c === 'descartar') {
      descartarUltimo();
      seguir();
    } else if (c === 'regravar') {
      descartarUltimo();
      void gravar(r.current.blocoId!);
    } else if (c === 'ouvir') ouvir();
  }
  const comandoRef = useRef(comando);
  comandoRef.current = comando;

  function iniciar(ids: string[], emSequencia: boolean) {
    if (ids.length === 0 || r.current.fase !== 'ocioso') return;
    r.current = { ...r.current, fila: ids, sequencia: emSequencia };
    setFila(ids);
    setSequencia(emSequencia);
    void gravar(ids[0]);
  }

  // Teclado na janela principal (operadora).
  useEffect(() => {
    if (fase === 'ocioso') return;
    // durante a sessão, o espaço é do gravador (encerrar o take, ouvir), não do play/pause global
    document.documentElement.dataset.sessaoGravacao = 'ativa';
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const emCampo = alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName);
      if (emCampo && e.key !== 'Escape') return;
      const c = comandoDaTecla(e.key, r.current.fase);
      if (c) {
        e.preventDefault();
        comandoRef.current(c);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      delete document.documentElement.dataset.sessaoGravacao;
    };
  }, [fase]);

  // Comandos vindos da janela do locutor.
  useEffect(() => {
    if (!desktop) return;
    const a = desktop.aoComandoDoPrompter((c) => comandoRef.current(c));
    const b = desktop.aoFecharPrompter(() => setPrompterAberto(null));
    return () => {
      a();
      b();
    };
  }, [desktop]);

  const estadoPrompter: EstadoPrompter = useMemo(
    () =>
      montarEstadoPrompter({
        blocos: estado.ad.blocos,
        fila,
        blocoId,
        fase,
        sequencia,
        videoUrl: estado.video?.url ?? null,
        tempoMs,
        tocando: !!video && !video.paused,
        aviso,
        parametros: estado.ad.parametros,
      }),
    [estado.ad.blocos, estado.ad.parametros, estado.video?.url, fila, blocoId, fase, sequencia, tempoMs, video, aviso],
  );

  // Publica para o teleprompter: mudanças de fase/texto na hora; tempo, com limite de taxa.
  const ultimoEnvio = useRef({ em: 0, chave: '' });
  useEffect(() => {
    if (!desktop || !prompterAberto) return;
    const { tempoMs: _t, ...resto } = estadoPrompter;
    const chave = JSON.stringify(resto);
    const agora = performance.now();
    if (chave === ultimoEnvio.current.chave && agora - ultimoEnvio.current.em < INTERVALO_ENVIO_MS) return;
    ultimoEnvio.current = { em: agora, chave };
    desktop.prompterEnviar(estadoPrompter);
  }, [estadoPrompter, desktop, prompterAberto]);

  async function abrirPrompter() {
    if (!desktop) return;
    const r2 = await desktop.prompterAbrir();
    setPrompterAberto(r2.secundario ? `segundo monitor: ${r2.monitor}` : `janela separada (só há um monitor: ${r2.monitor})`);
    ultimoEnvio.current = { em: 0, chave: '' };
    desktop.prompterEnviar(estadoPrompter);
  }

  const blocoAtual = bloco(blocoId);
  return {
    // microfone
    microfones,
    micId,
    setMicId: (id: string) => {
      setMicId(id);
      void abrirMic(id);
    },
    abrirMic: () => abrirMic(micId),
    micAberto: gravador.current.aberto,
    erroMic,
    nivel,
    // sessão
    fase,
    ativa: fase !== 'ocioso',
    blocoId,
    blocoAtual,
    takeAtualTemAtivo: blocoAtual ? takeAtivo(blocoAtual) !== null : false,
    aviso,
    gravarAvulso: (id: string) => iniciar([id], false),
    gravarSequencia: (ids: string[]) => iniciar(ids, true),
    comando: (c: ComandoGravacao) => comandoRef.current(c),
    estadoPrompter,
    // teleprompter
    prompterAberto,
    abrirPrompter,
    fecharPrompter: () => void desktop?.prompterFechar(),
  };
}

export type SessaoGravacao = ReturnType<typeof useSessaoGravacao>;
