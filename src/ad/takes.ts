import { envelopeRmsDb } from '../mapa/sinal';

const JANELA_MS = 10;
const RESPIRO_INICIO_MS = 60;
const RESPIRO_FIM_MS = 150;

/**
 * Apara silêncio de cabeça e cauda de um take: mantém do primeiro ao último
 * trecho acima de (pico − aparoDb), com um respiro para não cortar consoantes
 * iniciais nem a queda final da voz.
 */
export function aparar(
  amostras: Float32Array,
  taxa: number,
  aparoDb: number,
): { trimInicioMs: number; trimFimMs: number; duracaoMs: number; picoDb: number } {
  const duracaoMs = Math.round((amostras.length / taxa) * 1000);
  const env = envelopeRmsDb(amostras, taxa, JANELA_MS);
  let pico = -Infinity;
  for (const v of env) if (v > pico) pico = v;
  const limiar = pico - aparoDb;
  let a = -1;
  let b = -1;
  for (let i = 0; i < env.length; i++) {
    if (env[i] >= limiar) {
      if (a < 0) a = i;
      b = i;
    }
  }
  if (a < 0 || !Number.isFinite(pico)) return { trimInicioMs: 0, trimFimMs: duracaoMs, duracaoMs, picoDb: pico };
  return {
    trimInicioMs: Math.max(0, a * JANELA_MS - RESPIRO_INICIO_MS),
    trimFimMs: Math.min(duracaoMs, (b + 1) * JANELA_MS + RESPIRO_FIM_MS),
    duracaoMs,
    picoDb: pico,
  };
}

export function novoId(prefixo: string): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefixo}-${r}`;
}
