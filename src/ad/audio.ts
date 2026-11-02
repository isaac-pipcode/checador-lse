/**
 * Áudio dos takes no renderer: o Blob gravado (o que vai para o disco) e o
 * AudioBuffer decodificado (o que a prévia toca). Fica fora do estado React —
 * são dados binários grandes e não serializáveis.
 */
const takes = new Map<string, { blob: Blob; buffer: AudioBuffer }>();
let ctx: AudioContext | null = null;

export function contextoAudio(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

export async function registrarTake(id: string, blob: Blob): Promise<AudioBuffer> {
  const buffer = await contextoAudio().decodeAudioData(await blob.arrayBuffer());
  takes.set(id, { blob, buffer });
  return buffer;
}

export const audioDoTake = (id: string) => takes.get(id) ?? null;
export const descartarTake = (id: string) => {
  picos.delete(id);
  return takes.delete(id);
};

export async function bytesDoTake(id: string): Promise<Uint8Array | null> {
  const t = takes.get(id);
  return t ? new Uint8Array(await t.blob.arrayBuffer()) : null;
}

/** Picos (|amostra| máxima) do take inteiro, em janelas de `msPorPico`; calculados uma vez por take. */
const picos = new Map<string, Float32Array>();
export const MS_POR_PICO = 10;
export function picosDoTake(id: string): Float32Array | null {
  const pronto = picos.get(id);
  if (pronto) return pronto;
  const t = takes.get(id);
  if (!t) return null;
  const dados = t.buffer.getChannelData(0);
  const porJanela = Math.max(1, Math.round((t.buffer.sampleRate * MS_POR_PICO) / 1000));
  const saida = new Float32Array(Math.ceil(dados.length / porJanela));
  for (let j = 0; j < saida.length; j++) {
    let m = 0;
    const fim = Math.min(dados.length, (j + 1) * porJanela);
    for (let k = j * porJanela; k < fim; k++) {
      const v = Math.abs(dados[k]);
      if (v > m) m = v;
    }
    saida[j] = m;
  }
  picos.set(id, saida);
  return saida;
}
