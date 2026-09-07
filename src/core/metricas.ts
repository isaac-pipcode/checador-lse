import type { Cue, RuleConfig, Suggestion } from '../model/types';
import { caracteresDaLegenda, contarCaracteres, cpsDaLegenda, duracaoMs } from './texto';

export interface Metricas {
  totalLegendas: number;
  duracaoTotalMs: number;
  totalCaracteres: number;
  cpsMedia: number;
  cpsMaxima: number;
  cpsMaximaIndice: number | null;
  percentualDentroDoAlvo: number;
  linhasAcimaDoLimite: number;
  legendasAcimaDoTeto: number;
  sobreposicoes: number;
}

export function calcularMetricas(cues: Cue[], config: RuleConfig): Metricas {
  if (cues.length === 0) {
    return {
      totalLegendas: 0,
      duracaoTotalMs: 0,
      totalCaracteres: 0,
      cpsMedia: 0,
      cpsMaxima: 0,
      cpsMaximaIndice: null,
      percentualDentroDoAlvo: 100,
      linhasAcimaDoLimite: 0,
      legendasAcimaDoTeto: 0,
      sobreposicoes: 0,
    };
  }

  let somaCps = 0;
  let comCps = 0;
  let cpsMaxima = 0;
  let cpsMaximaIndice: number | null = null;
  let dentroDoAlvo = 0;
  let linhasAcimaDoLimite = 0;
  let legendasAcimaDoTeto = 0;
  let totalCaracteres = 0;
  let duracaoTotalMs = 0;

  for (const cue of cues) {
    totalCaracteres += caracteresDaLegenda(cue, config);
    duracaoTotalMs += Math.max(0, duracaoMs(cue));
    for (const linha of cue.lines) {
      if (contarCaracteres(linha, config) > config.maxCaracteresPorLinha) linhasAcimaDoLimite++;
    }
    const cps = cpsDaLegenda(cue, config);
    if (Number.isFinite(cps)) {
      somaCps += cps;
      comCps++;
      if (cps > cpsMaxima) {
        cpsMaxima = cps;
        cpsMaximaIndice = cue.index;
      }
      if (cps <= config.cpsAlvo) dentroDoAlvo++;
      if (cps > config.cpsMaximo) legendasAcimaDoTeto++;
    }
  }

  let sobreposicoes = 0;
  for (let i = 0; i + 1 < cues.length; i++) {
    if (cues[i + 1].startMs < cues[i].endMs) sobreposicoes++;
  }

  return {
    totalLegendas: cues.length,
    duracaoTotalMs,
    totalCaracteres,
    cpsMedia: comCps > 0 ? somaCps / comCps : 0,
    cpsMaxima,
    cpsMaximaIndice,
    percentualDentroDoAlvo: comCps > 0 ? (dentroDoAlvo / comCps) * 100 : 100,
    linhasAcimaDoLimite,
    legendasAcimaDoTeto,
    sobreposicoes,
  };
}

export interface Contagem {
  erro: number;
  aviso: number;
  revisao_manual: number;
}

export function contarPorSeveridade(sugestoes: Suggestion[]): Contagem {
  const c: Contagem = { erro: 0, aviso: 0, revisao_manual: 0 };
  for (const s of sugestoes) c[s.severity]++;
  return c;
}
