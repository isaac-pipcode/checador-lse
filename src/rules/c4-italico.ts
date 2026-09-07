import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';

/**
 * C4 — Itálico (voz mediada/off, canção, palavra estrangeira).
 * O *uso* correto do itálico não é verificável a partir do texto isolado — isso
 * fica para o checklist manual. O que é verificável é a *consistência do
 * markup*: tags `<i>` abertas e não fechadas dentro da mesma legenda.
 */
export const c4: Regra = (cues) => {
  const out: Suggestion[] = [];
  for (const cue of cues) {
    const texto = cue.lines.join('\n');
    const abre = (texto.match(/<i>/gi) ?? []).length;
    const fecha = (texto.match(/<\/i>/gi) ?? []).length;
    if (abre === fecha) continue;

    let novas = [...cue.lines];
    let corrigivel = false;
    if (abre > fecha) {
      novas = [...cue.lines];
      novas[novas.length - 1] = `${novas[novas.length - 1]}</i>`.repeat(1);
      corrigivel = abre - fecha === 1;
    } else if (fecha - abre === 1) {
      novas = [...cue.lines];
      novas[0] = `<i>${novas[0]}`;
      corrigivel = true;
    }

    out.push({
      id: idSugestao('C4-markup', cue.index),
      ruleId: 'C4',
      cueIndex: cue.index,
      severity: 'aviso',
      verifiability: 'deterministica',
      message: `Markup de itálico inconsistente: ${abre} abertura(s) para ${fecha} fechamento(s). O itálico marca voz mediada/off e canção, e deve fechar dentro da mesma legenda.`,
      before: instantaneo(cue),
      ...(corrigivel ? { after: { lines: novas } } : {}),
      autoFixable: corrigivel,
    });
  }
  return out;
};
