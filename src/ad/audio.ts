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
export const descartarTake = (id: string) => takes.delete(id);

export async function bytesDoTake(id: string): Promise<Uint8Array | null> {
  const t = takes.get(id);
  return t ? new Uint8Array(await t.blob.arrayBuffer()) : null;
}
