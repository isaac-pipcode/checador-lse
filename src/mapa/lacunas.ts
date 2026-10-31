import type { Cue } from '../model/types';
import type { Intervalo, MapaTemporal } from './tipos';
import { complemento, sobreposicaoMs } from './sinal';

export interface Lacuna extends Intervalo {
  /** fração da lacuna com atividade sonora detectada (null sem mapa de áudio) */
  fracaoComSom: number | null;
  /** legendas só de efeito/música ([…], ♪) que caem dentro da lacuna */
  efeitos: number[];
}

const RE_COLCHETES = /\[[^\]]*\]/g;
const RE_MARCACAO = /<\/?[^>]+>/g;

/**
 * Uma legenda "de fala" é a que tem texto fora dos colchetes e das notas
 * musicais. Legendas só com [efeito sonoro] ou ♪ não ocupam o espaço da voz e,
 * portanto, não fecham uma lacuna para a audiodescrição.
 */
export function ehLegendaDeFala(cue: Pick<Cue, 'lines'>): boolean {
  const resto = cue.lines
    .join(' ')
    .replace(RE_MARCACAO, '')
    .replace(RE_COLCHETES, '')
    .replace(/[♪♫#\-–—\s.,!?…:;"']/g, '');
  return /\p{L}|\p{N}/u.test(resto);
}

/**
 * Lacunas candidatas à audiodescrição: intervalos sem legenda de fala, com
 * duração mínima. A própria trilha de legenda serve de mapa de diálogo — é o
 * reaproveitamento que justifica o mapa compartilhado. Com o áudio analisado,
 * cada lacuna informa quanto dela tem som (música, ruído, efeitos), o que a
 * audiodescrição terá de disputar ou respeitar.
 */
export function lacunasParaAd(
  cues: Cue[],
  duracaoMs: number,
  minimaMs: number,
  mapa: Pick<MapaTemporal, 'atividade'> | null,
  /** respiro deixado antes e depois de cada fala */
  margemMs = 200,
): Lacuna[] {
  const fala = cues
    .filter(ehLegendaDeFala)
    .map((c) => ({ inicioMs: Math.max(0, c.startMs - margemMs), fimMs: c.endMs + margemMs }));
  const efeitos = cues.filter((c) => !ehLegendaDeFala(c));

  return complemento(fala, duracaoMs)
    .filter((l) => l.fimMs - l.inicioMs >= minimaMs)
    .map((l) => ({
      ...l,
      fracaoComSom: mapa ? sobreposicaoMs(l, mapa.atividade) / (l.fimMs - l.inicioMs) : null,
      efeitos: efeitos.filter((c) => c.startMs < l.fimMs && c.endMs > l.inicioMs).map((c) => c.index),
    }));
}

export function lacunasCsv(lacunas: Lacuna[], tc: (ms: number) => string): string {
  const linhas = ['n;inicio;fim;duracao_s;fracao_com_som;legendas_de_efeito'];
  lacunas.forEach((l, i) => {
    linhas.push(
      [
        i + 1,
        tc(l.inicioMs),
        tc(l.fimMs),
        ((l.fimMs - l.inicioMs) / 1000).toFixed(1).replace('.', ','),
        l.fracaoComSom === null ? '' : l.fracaoComSom.toFixed(2).replace('.', ','),
        l.efeitos.join(' '),
      ].join(';'),
    );
  });
  return linhas.join('\r\n') + '\r\n';
}
