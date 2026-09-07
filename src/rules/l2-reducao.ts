import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';
import { cpsDaLegenda } from '../core/texto';

const n1 = (x: number) => x.toFixed(1).replace('.', ',');

/**
 * L2 — Redução textual quando a velocidade excede o alvo.
 *
 * A geração de uma versão condensada é tarefa do módulo LLM (opcional,
 * desligado por padrão). Esta regra apenas *identifica as candidatas*: marca a
 * legenda como pendente de redução e, sem o módulo, declara-se indisponível em
 * vez de simular uma reescrita.
 */
export const l2: Regra = (cues, config) => {
  const out: Suggestion[] = [];
  for (const cue of cues) {
    if (cue.endMs <= cue.startMs) continue;
    const cps = cpsDaLegenda(cue, config);
    if (cps <= config.cpsAlvo) continue;

    out.push({
      id: idSugestao('L2', cue.index),
      ruleId: 'L2',
      cueIndex: cue.index,
      severity: 'aviso',
      verifiability: 'llm',
      message: config.llmAtivo
        ? `Candidata a redução textual: ${n1(cps)} cps contra o alvo de ${config.cpsAlvo} cps. Peça a proposta ao módulo assistido.`
        : `Candidata a redução textual (${n1(cps)} cps contra alvo de ${config.cpsAlvo}); a proposta de condensação exige o módulo assistido, que está desligado.`,
      confidence: 0,
      before: instantaneo(cue),
      autoFixable: false,
      unavailable: !config.llmAtivo,
    });
  }
  return out;
};
