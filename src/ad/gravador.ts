/**
 * Captura de voz para os takes. Desliga o processamento do navegador
 * (cancelamento de eco, supressão de ruído, ganho automático): eles são
 * pensados para chamada, não para locução, e alteram o timbre.
 */
export class Gravador {
  private stream: MediaStream | null = null;
  private analisador: AnalyserNode | null = null;
  private amostras = new Float32Array(2048);
  private recorder: MediaRecorder | null = null;
  private partes: Blob[] = [];

  static async microfones(): Promise<MediaDeviceInfo[]> {
    const todos = await navigator.mediaDevices.enumerateDevices();
    return todos.filter((d) => d.kind === 'audioinput');
  }

  async abrir(ctx: AudioContext, deviceId?: string) {
    this.fechar();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    this.analisador = ctx.createAnalyser();
    this.analisador.fftSize = 2048;
    ctx.createMediaStreamSource(this.stream).connect(this.analisador);
  }

  get aberto() {
    return this.stream !== null;
  }

  /** pico do último quadro, em dBFS (para o medidor) */
  nivelDb(): number {
    if (!this.analisador) return -Infinity;
    this.analisador.getFloatTimeDomainData(this.amostras);
    let pico = 0;
    for (const v of this.amostras) pico = Math.max(pico, Math.abs(v));
    return pico > 0 ? 20 * Math.log10(pico) : -Infinity;
  }

  iniciar(): Promise<void> {
    if (!this.stream) throw new Error('Microfone não aberto.');
    const tipo = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    this.partes = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: tipo, audioBitsPerSecond: 256000 });
    this.recorder.ondataavailable = (e) => e.data.size && this.partes.push(e.data);
    return new Promise((ok) => {
      this.recorder!.onstart = () => ok();
      this.recorder!.start();
    });
  }

  parar(): Promise<Blob> {
    const r = this.recorder;
    if (!r) return Promise.reject(new Error('Nada sendo gravado.'));
    return new Promise((ok) => {
      r.onstop = () => ok(new Blob(this.partes, { type: r.mimeType }));
      r.stop();
      this.recorder = null;
    });
  }

  get gravando() {
    return this.recorder?.state === 'recording';
  }

  fechar() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analisador = null;
  }
}
