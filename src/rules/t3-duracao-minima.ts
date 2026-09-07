import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';
import { duracaoMs, formatarDuracao } from '../core/texto';

/**
 * T3 — Duração mínima (≥ 1 s).
 * Abaixo disso a legenda "pisca" e não é lida. Não há correção automática:
 * esticar a legenda pode invadir a legenda seguinte ou o corte de cena.
 */
export const t3: Regra = (cues, config) => {
  const out: Suggestion[] = [];
  for (const cue of cues) {
    const d = duracaoMs(cue);
    if (d < config.duracaoMinimaMs) {
      out.push({
        id: idSugestao('T3', cue.index),
        ruleId: 'T3',
        cueIndex: cue.index,
        severity: 'erro' as const,
        verifiability: 'deterministica' as const,
        message: `Duração de ${formatarDuracao(d)}; o mínimo para leitura é ${formatarDuracao(config.duracaoMinimaMs)}.`,
        before: instantaneo(cue),
        autoFixable: false,
      });
    }
  }
  return out;
};
