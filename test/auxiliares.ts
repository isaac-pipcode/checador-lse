import { parseSubtitle } from '../src/parser/srt';
import { analisar } from '../src/rules';
import { SegmentadorPtBr } from '../src/nlp/segmentador';
import { configDoPerfil } from '../src/model/perfis';
import type { RuleConfig, Suggestion } from '../src/model/types';

export function config(over: Partial<RuleConfig> = {}): RuleConfig {
  return { ...configDoPerfil('guia-145'), ...over };
}

export function cuesDe(srt: string) {
  const r = parseSubtitle(srt.trim());
  return r;
}

export function rodar(srt: string, over: Partial<RuleConfig> = {}) {
  const cfg = config(over);
  const { cues, erros, avisos } = cuesDe(srt);
  const sugestoes = analisar(cues, cfg, {
    nlp: cfg.nlpAtivo ? new SegmentadorPtBr() : null,
  });
  return { cues, erros, avisos, sugestoes, config: cfg };
}

export const daRegra = (s: Suggestion[], id: string) => s.filter((x) => x.ruleId === id);
