import type { BlocoAD, ParametrosAD } from './tipos';
import { duracaoUtil, takeAtivo } from './tipos';

/**
 * Plano de mixagem — a mesma descrição alimenta a prévia (Web Audio) e a
 * renderização final (processo desktop), para que o que se ouve seja o que se
 * entrega.
 */

export interface Clipe {
  blocoId: string;
  takeId: string;
  /** posição na obra (ms) */
  posicaoMs: number;
  /** de onde ler dentro do arquivo do take (ms) */
  offsetMs: number;
  duracaoMs: number;
  ganhoDb: number;
}

/** Ponto da curva de ganho do áudio original: (tempo, ganho linear). */
export interface PontoGanho {
  ms: number;
  ganho: number;
}

export const dbParaLinear = (db: number) => Math.pow(10, db / 20);
export const linearParaDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

export function clipesDosBlocos(blocos: BlocoAD[], p: ParametrosAD): Clipe[] {
  const out: Clipe[] = [];
  for (const b of blocos) {
    const t = takeAtivo(b);
    if (!t || duracaoUtil(t) <= 0) continue;
    out.push({
      blocoId: b.id,
      takeId: t.id,
      posicaoMs: Math.max(0, t.posicaoMs + p.latenciaMs),
      offsetMs: t.trimInicioMs,
      duracaoMs: duracaoUtil(t),
      ganhoDb: t.ganhoDb,
    });
  }
  return out.sort((a, b) => a.posicaoMs - b.posicaoMs);
}

/**
 * Curva de ducking: o original desce de 1 até g durante o ataque, que termina
 * no início do clipe, fica em g e sobe durante a liberação, depois do fim.
 * Clipes cujas rampas se tocariam são fundidos num patamar só — evita o
 * "bombeamento" do fundo entre frases próximas.
 */
export function curvaDeDucking(clipes: Clipe[], p: ParametrosAD): PontoGanho[] {
  const g = dbParaLinear(p.duckingDb);
  const patamares: Array<{ ini: number; fim: number }> = [];
  for (const c of clipes) {
    const ini = c.posicaoMs;
    const fim = c.posicaoMs + c.duracaoMs;
    const ultimo = patamares[patamares.length - 1];
    if (ultimo && ini - p.ataqueMs <= ultimo.fim + p.liberacaoMs) ultimo.fim = Math.max(ultimo.fim, fim);
    else patamares.push({ ini, fim });
  }
  const pontos: PontoGanho[] = [{ ms: 0, ganho: 1 }];
  for (const s of patamares) {
    const a = Math.max(0, s.ini - p.ataqueMs);
    if (a > pontos[pontos.length - 1].ms) pontos.push({ ms: a, ganho: 1 });
    pontos.push({ ms: Math.max(a, s.ini), ganho: g });
    pontos.push({ ms: s.fim, ganho: g });
    pontos.push({ ms: s.fim + p.liberacaoMs, ganho: 1 });
  }
  return pontos;
}

/** Ganho linear em `ms`, por interpolação linear entre os pontos. */
export function ganhoEm(curva: PontoGanho[], ms: number): number {
  if (curva.length === 0) return 1;
  let lo = 0;
  let hi = curva.length - 1;
  if (ms <= curva[0].ms) return curva[0].ganho;
  if (ms >= curva[hi].ms) return curva[hi].ganho;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (curva[m].ms <= ms) lo = m;
    else hi = m;
  }
  const a = curva[lo];
  const b = curva[hi];
  if (b.ms === a.ms) return b.ganho;
  return a.ganho + ((b.ganho - a.ganho) * (ms - a.ms)) / (b.ms - a.ms);
}

/**
 * Iterador monotônico da curva, para a renderização amostra a amostra sem
 * busca binária a cada amostra.
 */
export class CursorDeGanho {
  private i = 0;
  constructor(private curva: PontoGanho[]) {}
  em(ms: number): number {
    const c = this.curva;
    if (c.length === 0) return 1;
    while (this.i + 1 < c.length && c[this.i + 1].ms <= ms) this.i++;
    const a = c[this.i];
    const b = c[this.i + 1];
    if (!b || ms <= a.ms) return ms < a.ms ? c[0].ganho : a.ganho;
    if (b.ms === a.ms) return b.ganho;
    return a.ganho + ((b.ganho - a.ganho) * (ms - a.ms)) / (b.ms - a.ms);
  }
}
