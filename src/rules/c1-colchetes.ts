import type { Suggestion } from '../model/types';
import type { Regra } from './tipos';
import { idSugestao, instantaneo } from './tipos';

/**
 * C1 — Informação adicional entre colchetes, não entre parênteses.
 * O Guia reserva os colchetes à identificação de falante e aos efeitos sonoros.
 * A detecção é conservadora: só sinaliza parênteses que se pareçam com rótulo
 * (início de legenda ou de linha, poucas palavras, ou verbo/substantivo de som).
 * Parênteses legítimos dentro da fala existem — daí o `confidence` reduzido.
 */

const VERBOS_DE_SOM =
  /^(passos|risos|risada|gritos?|choro|tiros?|explos[ãa]o|sirene|trov[ãa]o|batidas?|porta|telefone|celular|campainha|m[úu]sica|canta|cantando|suspiro|gemido|late|latido|palmas|aplausos|vidro|estrondo|assobio|sussurro|ru[íi]do|barulho|motor|freada|buzina|chuva|vento|passarinhos?|p[áa]ssaros?|silencio|sil[êe]ncio|off|voz)\b/i;

function pareceRotulo(conteudo: string, noInicio: boolean): number {
  const limpo = conteudo.trim();
  if (!limpo) return 0;
  const palavras = limpo.split(/\s+/);
  if (VERBOS_DE_SOM.test(limpo)) return noInicio ? 0.85 : 0.7;
  if (limpo === limpo.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(limpo)) return 0.8;
  if (noInicio && palavras.length <= 3) return 0.6;
  return 0;
}

export const c1: Regra = (cues) => {
  const out: Suggestion[] = [];
  for (const cue of cues) {
    let alterou = false;
    let confianca = 0;
    const exemplos: string[] = [];

    const novas = cue.lines.map((linha) => {
      let resultado = '';
      let resto = linha;
      let offsetLinha = 0;
      for (;;) {
        const m = /\(([^()]*)\)/.exec(resto);
        if (!m) {
          resultado += resto;
          break;
        }
        const posAbsoluta = offsetLinha + (m.index ?? 0);
        const noInicio = /^\s*$/.test(linha.slice(0, posAbsoluta));
        const c = pareceRotulo(m[1], noInicio);
        resultado += resto.slice(0, m.index);
        if (c > 0) {
          resultado += `[${m[1]}]`;
          alterou = true;
          confianca = Math.max(confianca, c);
          exemplos.push(`(${m[1]})`);
        } else {
          resultado += m[0];
        }
        offsetLinha = posAbsoluta + m[0].length;
        resto = resto.slice((m.index ?? 0) + m[0].length);
      }
      return resultado;
    });

    if (alterou) {
      out.push({
        id: idSugestao('C1', cue.index),
        ruleId: 'C1',
        cueIndex: cue.index,
        severity: 'aviso',
        verifiability: 'deterministica',
        message: `${exemplos.join(', ')} parece identificação de falante ou efeito sonoro; o Guia usa colchetes para essa informação adicional.`,
        confidence: confianca,
        before: instantaneo(cue),
        after: { lines: novas },
        autoFixable: true,
      });
    }
  }
  return out;
};
