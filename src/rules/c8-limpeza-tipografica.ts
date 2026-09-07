import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';

/**
 * C8 — Limpeza tipográfica.
 * Espaço duplo, espaço antes de pontuação, espaço interno em colchetes e
 * espaço no fim (ou início) da linha. Tudo determinístico e reversível.
 */
interface Correcao {
  nome: string;
  aplicar: (s: string) => string;
  detectar: RegExp;
}

const CORRECOES: Correcao[] = [
  {
    nome: 'espaço duplicado',
    detectar: /\S {2,}\S/,
    aplicar: (s) => s.replace(/ {2,}/g, ' '),
  },
  {
    nome: 'espaço antes de pontuação',
    detectar: /\s+[,.!?;:](?!\d)/,
    aplicar: (s) => s.replace(/\s+([,.!?;:])/g, '$1'),
  },
  {
    nome: 'espaço interno em colchetes',
    detectar: /\[\s+[^\]]*\]|\[[^\]]*\s+\]/,
    aplicar: (s) => s.replace(/\[\s*([^\]]*?)\s*\]/g, '[$1]'),
  },
  {
    nome: 'espaço no fim da linha',
    detectar: /\s+$/,
    aplicar: (s) => s.replace(/\s+$/, ''),
  },
  {
    nome: 'espaço no início da linha',
    detectar: /^\s+/,
    aplicar: (s) => s.replace(/^\s+/, ''),
  },
];

export const c8: Regra = (cues) => {
  const out: Suggestion[] = [];
  for (const cue of cues) {
    const encontradas = new Set<string>();
    const novas = cue.lines.map((linha) => {
      let s = linha;
      for (const c of CORRECOES) {
        if (c.detectar.test(s)) {
          encontradas.add(c.nome);
          s = c.aplicar(s);
        }
      }
      return s;
    });

    if (encontradas.size === 0) continue;
    if (novas.join('\n') === cue.lines.join('\n')) continue;

    out.push({
      id: idSugestao('C8', cue.index),
      ruleId: 'C8',
      cueIndex: cue.index,
      severity: 'aviso',
      verifiability: 'deterministica',
      message: `Limpeza tipográfica: ${[...encontradas].join(', ')}.`,
      before: instantaneo(cue),
      after: { lines: novas },
      autoFixable: true,
    });
  }
  return out;
};
