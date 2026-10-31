import { contextoAudio, audioDoTake } from './audio';
import { dbParaLinear, ganhoEm, type Clipe, type PontoGanho } from './mixagem';

/** Um MediaElementSource por elemento: a API não permite criar dois. */
const fontes = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/**
 * Prévia da mixagem em tempo real: o áudio do vídeo passa por um ganho que
 * segue a curva de ducking, e os takes são agendados no relógio do
 * AudioContext. A cada play, pausa, busca ou mudança de velocidade, tudo é
 * reagendado a partir do tempo do vídeo.
 *
 * Limite: em reprodução longa sem interrupção, os relógios de vídeo e de áudio
 * podem divergir alguns milissegundos. A renderização final não tem esse
 * problema (é amostra a amostra).
 */
export class MotorPrevia {
  private ctx = contextoAudio();
  private fonte: MediaElementAudioSourceNode;
  private ganhoOriginal: GainNode;
  private ganhoAd: GainNode;
  private ativos: AudioBufferSourceNode[] = [];
  private clipes: Clipe[] = [];
  private curva: PontoGanho[] = [];
  private ligado = true;
  private eventos = ['play', 'pause', 'seeked', 'ratechange'] as const;
  private reagendar = () => this.reprogramar();

  constructor(private video: HTMLVideoElement) {
    let f = fontes.get(video);
    if (!f) {
      f = this.ctx.createMediaElementSource(video);
      fontes.set(video, f);
    }
    this.fonte = f;
    this.fonte.disconnect();
    this.ganhoOriginal = this.ctx.createGain();
    this.ganhoAd = this.ctx.createGain();
    this.fonte.connect(this.ganhoOriginal).connect(this.ctx.destination);
    this.ganhoAd.connect(this.ctx.destination);
    for (const e of this.eventos) video.addEventListener(e, this.reagendar);
  }

  atualizar(clipes: Clipe[], curva: PontoGanho[]) {
    this.clipes = clipes;
    this.curva = curva;
    this.reprogramar();
  }

  /** desligado: original sem ducking e sem AD (para gravar ou comparar) */
  definirLigado(ligado: boolean) {
    this.ligado = ligado;
    this.reprogramar();
  }

  private parar() {
    for (const s of this.ativos) {
      try {
        s.stop();
      } catch {
        /* já terminou */
      }
    }
    this.ativos = [];
    const g = this.ganhoOriginal.gain;
    g.cancelScheduledValues(0);
    g.value = this.ligado ? ganhoEm(this.curva, this.video.currentTime * 1000) : 1;
  }

  private reprogramar() {
    this.parar();
    if (this.video.paused || !this.ligado) return;
    void this.ctx.resume();
    const agora = this.ctx.currentTime + 0.01;
    const t0 = this.video.currentTime * 1000;
    const vel = this.video.playbackRate || 1;
    const quando = (ms: number) => agora + (ms - t0) / 1000 / vel;

    const g = this.ganhoOriginal.gain;
    g.setValueAtTime(ganhoEm(this.curva, t0), agora);
    for (const p of this.curva) if (p.ms > t0) g.linearRampToValueAtTime(p.ganho, quando(p.ms));

    for (const c of this.clipes) {
      if (c.posicaoMs + c.duracaoMs <= t0) continue;
      const audio = audioDoTake(c.takeId);
      if (!audio) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = audio.buffer;
      src.playbackRate.value = vel;
      const ganho = this.ctx.createGain();
      // mesma lei de pan da renderização (voz mono no centro, −3 dB)
      ganho.gain.value = dbParaLinear(c.ganhoDb) * Math.SQRT1_2;
      src.connect(ganho).connect(this.ganhoAd);
      const decorrido = Math.max(0, t0 - c.posicaoMs);
      src.start(
        c.posicaoMs >= t0 ? quando(c.posicaoMs) : agora,
        (c.offsetMs + decorrido) / 1000,
        (c.duracaoMs - decorrido) / 1000,
      );
      this.ativos.push(src);
    }
  }

  descartar() {
    this.parar();
    for (const e of this.eventos) this.video.removeEventListener(e, this.reagendar);
    this.fonte.disconnect();
    this.ganhoOriginal.disconnect();
    this.ganhoAd.disconnect();
    // devolve o som do vídeo ao destino, sem processamento
    this.fonte.connect(this.ctx.destination);
  }
}
