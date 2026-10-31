/**
 * Camada de navegador do mapa temporal: decodificação do áudio e leitura de
 * quadros. Tudo local — o arquivo não sai da máquina.
 *
 * Limite conhecido: `decodeAudioData` decodifica a trilha inteira em memória.
 * Para obras longas (acima de ~1 h) o consumo pode passar de 1 GB; um
 * demultiplexador em streaming (WebCodecs) é o caminho para produção.
 */
import { envelopeRmsDb } from './sinal';
import { candidatosACorte, distancia, histogramaRgb, refinarCorte } from './cortes';
import type { Corte } from './tipos';

export const TAXA_ANALISE = 16000;
export const JANELA_MS = 10;

export class ErroMidia extends Error {}

export async function analisarAudio(arquivo: File): Promise<{ envelopeDb: Float32Array; duracaoMs: number }> {
  const bytes = await arquivo.arrayBuffer();
  let bruto: AudioBuffer;
  try {
    // O contexto offline a 16 kHz já reamostra na decodificação.
    bruto = await new OfflineAudioContext(1, 1, TAXA_ANALISE).decodeAudioData(bytes);
  } catch {
    throw new ErroMidia(
      'Não foi possível decodificar o áudio deste arquivo no navegador (codec não suportado ou arquivo sem trilha de áudio).',
    );
  }

  // Banda aproximada de voz: corta graves de trilha e ruído de alta frequência.
  const ctx = new OfflineAudioContext(1, bruto.length, TAXA_ANALISE);
  const fonte = ctx.createBufferSource();
  fonte.buffer = bruto;
  const passaAlta = ctx.createBiquadFilter();
  passaAlta.type = 'highpass';
  passaAlta.frequency.value = 150;
  const passaBaixa = ctx.createBiquadFilter();
  passaBaixa.type = 'lowpass';
  passaBaixa.frequency.value = 4000;
  fonte.connect(passaAlta).connect(passaBaixa).connect(ctx.destination);
  fonte.start();
  const filtrado = await ctx.startRendering();

  return {
    envelopeDb: envelopeRmsDb(filtrado.getChannelData(0), TAXA_ANALISE, JANELA_MS),
    duracaoMs: Math.round(bruto.duration * 1000),
  };
}

/** Lê quadros em instantes arbitrários, reduzidos a 64×36, como histogramas. */
class LeitorDeQuadros {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(url: string) {
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.preload = 'auto';
    this.video.src = url;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 36;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ErroMidia('Canvas 2D indisponível.');
    this.ctx = ctx;
  }

  pronto(): Promise<void> {
    if (this.video.readyState >= 2) return Promise.resolve();
    return new Promise((ok, falha) => {
      this.video.addEventListener('loadeddata', () => ok(), { once: true });
      this.video.addEventListener('error', () => falha(new ErroMidia('O navegador não conseguiu ler o vídeo.')), {
        once: true,
      });
    });
  }

  histograma(ms: number): Promise<Float32Array> {
    return new Promise((ok) => {
      const ler = () => {
        this.ctx.drawImage(this.video, 0, 0, 64, 36);
        ok(histogramaRgb(this.ctx.getImageData(0, 0, 64, 36).data));
      };
      const alvo = Math.max(0, ms / 1000);
      if (Math.abs(this.video.currentTime - alvo) < 1e-4 && this.video.readyState >= 2) {
        ler();
        return;
      }
      this.video.addEventListener('seeked', ler, { once: true });
      this.video.currentTime = alvo;
    });
  }

  descartar() {
    this.video.removeAttribute('src');
    this.video.load();
  }
}

/**
 * Detecção de cortes em duas passadas: amostragem grossa (um quadro a cada
 * `passoMs`), seguida de bisseção até ~1 quadro em torno de cada candidato.
 * Cortes mais próximos entre si que `passoMs` podem ser perdidos — limite
 * declarado na interface. Fusões e fades lentos não são detectados.
 */
export async function detectarCortes(
  url: string,
  duracaoMs: number,
  passoMs: number,
  fps: number,
  aoProgredir: (fracao: number) => void,
  sinal: AbortSignal,
): Promise<Corte[]> {
  const leitor = new LeitorDeQuadros(url);
  try {
    await leitor.pronto();
    const tempos: number[] = [];
    for (let t = 0; t < duracaoMs; t += passoMs) tempos.push(t);
    const hist: Float32Array[] = [];
    const total = tempos.length;
    let ultimoAviso = 0;
    for (let i = 0; i < total; i++) {
      if (sinal.aborted) throw new DOMException('cancelado', 'AbortError');
      hist.push(await leitor.histograma(tempos[i]));
      const f = (i + 1) / total;
      if (f - ultimoAviso >= 0.01) {
        aoProgredir(f * 0.9);
        ultimoAviso = f;
      }
    }

    const diffs = hist.slice(1).map((h, i) => distancia(hist[i], h));
    const candidatos = candidatosACorte(diffs);
    const quadroMs = 1000 / fps;
    const cortes: Corte[] = [];
    for (let k = 0; k < candidatos.length; k++) {
      if (sinal.aborted) throw new DOMException('cancelado', 'AbortError');
      const i = candidatos[k];
      cortes.push(await refinarCorte(tempos[i], tempos[i + 1], (ms) => leitor.histograma(ms), quadroMs));
      aoProgredir(0.9 + (0.1 * (k + 1)) / candidatos.length);
    }
    return cortes;
  } finally {
    leitor.descartar();
  }
}
