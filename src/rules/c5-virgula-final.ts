import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';
import { semMarcacao } from '../core/texto';

/**
 * C5 — Vírgula ao fim de legenda cujo sentido continua na legenda seguinte.
 * O Guia a considera dispensável: a própria quebra entre legendas já marca a
 * pausa. Só sinaliza quando a legenda seguinte começa em minúscula (indício de
 * continuidade sintática) — se começa em maiúscula, a vírgula pode ser interna
 * a um período que se encerrou.
 */
export const c5: Regra = (cues) => {
  const out: Suggestion[] = [];
  for (let i = 0; i + 1 < cues.length; i++) {
    const cue = cues[i];
    const ultima = cue.lines[cue.lines.length - 1] ?? '';
    if (!/,\s*$/.test(semMarcacao(ultima))) continue;

    const proximaPrimeira = semMarcacao(cues[i + 1].lines[0] ?? '').trim().replace(/^[-–—\s]+/, '');
    const primeiroChar = [...proximaPrimeira][0] ?? '';
    if (!primeiroChar || primeiroChar !== primeiroChar.toLowerCase()) continue;

    const novas = [...cue.lines];
    novas[novas.length - 1] = ultima.replace(/,(\s*)$/, '$1');

    out.push({
      id: idSugestao('C5', cue.index),
      ruleId: 'C5',
      cueIndex: cue.index,
      severity: 'aviso',
      verifiability: 'deterministica',
      message: `A frase continua na legenda ${cues[i + 1].index}; a vírgula final é dispensável, pois a mudança de legenda já marca a pausa.`,
      confidence: 0.7,
      before: instantaneo(cue),
      after: { lines: novas },
      autoFixable: true,
    });
  }
  return out;
};
