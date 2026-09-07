import type { Cue, RuleConfig, Suggestion, RuleMeta } from '../model/types';
import type { MotorSegmentacao } from '../nlp/tipos';

export interface ContextoRegras {
  /** motor de segmentação sintática de superfície; null quando desligado */
  nlp: MotorSegmentacao | null;
}

export const CONTEXTO_VAZIO: ContextoRegras = { nlp: null };

/** Uma regra é uma função pura sobre a lista de legendas. */
export type Regra = (cues: Cue[], config: RuleConfig, ctx: ContextoRegras) => Suggestion[];

export interface RegraRegistrada extends RuleMeta {
  executar: Regra;
}

/** Ids estáveis: sobrevivem à reanálise, preservando as decisões do usuário. */
export function idSugestao(ruleId: string, cueIndex: number, discriminante = ''): string {
  return discriminante ? `${ruleId}:${cueIndex}:${discriminante}` : `${ruleId}:${cueIndex}`;
}

export function instantaneo(cue: Cue) {
  return { lines: [...cue.lines], startMs: cue.startMs, endMs: cue.endMs };
}
