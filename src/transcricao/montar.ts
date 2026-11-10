import type { Cue, RuleConfig } from '../model/types';
import { nivelDaQuebra, tokenizar } from '../nlp/segmentador';
import type { PalavraTranscrita } from './whisperJson';

/**
 * Rascunho de LSE a partir das palavras transcritas, já dentro das regras do
 * Guia que são mecânicas: caracteres por linha, número de linhas, duração
 * mínima e máxima, velocidade de leitura, intervalo entre legendas e quebra de
 * linha no mais alto nível sintático (o mesmo critério da regra L1).
 *
 * O que é interpretação fica para a revisão humana: identificação de falantes,
 * efeitos sonoros entre colchetes, condensação de falas rápidas (L2, que o
 * assistente pode propor) e a fidelidade do próprio texto transcrito.
 *
 * Algoritmo, em duas passadas:
 * 1. agrupa palavras em legendas: corta numa pausa longa, no fim de frase
 *    quando a legenda já tem corpo, ou quando a próxima palavra não caberia
 *    (texto ou duração); ao estourar, recua até o melhor ponto sintático das
 *    últimas palavras, que passam para a legenda seguinte;
 * 2. ajusta os tempos: entrada no início da fala; saída no fim da fala,
 *    estendida até a velocidade alvo e a duração mínima, sem invadir a
 *    próxima legenda (respeitado o intervalo mínimo) nem passar do máximo.
 */

export interface OpcoesMontagem {
  /** pausa a partir da qual a legenda termina (ms) */
  pausaCorteMs: number;
  /** extensão máxima da saída depois do fim da fala, para dar tempo de leitura (ms) */
  extensaoMaximaMs: number;
}

export const OPCOES_PADRAO: OpcoesMontagem = { pausaCorteMs: 700, extensaoMaximaMs: 1500 };

const juntar = (ws: PalavraTranscrita[]) => ws.map((w) => w.texto).join(' ');
const visivel = (t: string) => t.replace(/<\/?[^>]+>/g, '').length;

/** Melhor divisão do texto em até `maxLinhas` linhas de até `max` caracteres; null se não couber. */
export function dividirEmLinhas(texto: string, max: number, maxLinhas: number): string[] | null {
  if (visivel(texto) <= max) return [texto];
  if (maxLinhas < 2) return null;
  const ps = tokenizar(texto);
  let melhor: { k: number; nota: number } | null = null;
  for (let k = 1; k < ps.length; k++) {
    const a = visivel(
      ps
        .slice(0, k)
        .map((p) => p.texto)
        .join(' '),
    );
    const b = visivel(
      ps
        .slice(k)
        .map((p) => p.texto)
        .join(' '),
    );
    if (a > max || b > max) continue;
    const nivel = nivelDaQuebra(ps, k);
    // quebra proibida (separa regente de regido) só como último recurso
    const nota = (nivel ?? -50) * 10 - Math.abs(a - b);
    if (!melhor || nota > melhor.nota) melhor = { k, nota };
  }
  if (!melhor) return null;
  return [
    ps
      .slice(0, melhor.k)
      .map((p) => p.texto)
      .join(' '),
    ps
      .slice(melhor.k)
      .map((p) => p.texto)
      .join(' '),
  ];
}

const fimDeFrase = (t: string) => /[.!?…]["'”’)\]]?$/.test(t);

/** Onde cortar um grupo que estourou: o ponto sintático mais alto entre as últimas palavras. */
function pontoDeRecuo(grupo: PalavraTranscrita[]): number {
  const ps = tokenizar(juntar(grupo));
  if (ps.length !== grupo.length) return grupo.length; // tokenização divergente: corta no fim
  let melhor = { k: grupo.length, nota: -Infinity };
  // só recua até metade do grupo: legendas muito curtas seguidas de longas leem pior
  for (let k = grupo.length; k >= Math.ceil(grupo.length / 2); k--) {
    const nivel = k === grupo.length ? 70 : nivelDaQuebra(ps, k);
    if (nivel === null) continue;
    const nota = nivel - (grupo.length - k) * 4;
    if (nota > melhor.nota) melhor = { k, nota };
  }
  return melhor.k;
}

export function montarLegendas(
  palavras: PalavraTranscrita[],
  cfg: Pick<
    RuleConfig,
    'maxCaracteresPorLinha' | 'maxLinhas' | 'duracaoMinimaMs' | 'duracaoMaximaMs' | 'cpsAlvo' | 'intervaloMinimoMs'
  >,
  op: OpcoesMontagem = OPCOES_PADRAO,
): Cue[] {
  const ws = palavras.filter((w) => w.texto.trim());
  const grupos: PalavraTranscrita[][] = [];
  let g: PalavraTranscrita[] = [];
  const capacidade = cfg.maxCaracteresPorLinha * cfg.maxLinhas;

  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (g.length) {
      const ultima = g[g.length - 1];
      const pausa = w.inicioMs - ultima.fimMs;
      const corpo = visivel(juntar(g)) >= capacidade * 0.45;
      const candidato = [...g, w];
      const cabeTexto = dividirEmLinhas(juntar(candidato), cfg.maxCaracteresPorLinha, cfg.maxLinhas) !== null;
      const cabeTempo = w.fimMs - g[0].inicioMs <= cfg.duracaoMaximaMs;
      if (pausa >= op.pausaCorteMs || (fimDeFrase(ultima.texto) && corpo)) {
        grupos.push(g);
        g = [w];
        continue;
      }
      if (!cabeTexto || !cabeTempo) {
        const k = pontoDeRecuo(g);
        grupos.push(g.slice(0, k));
        g = [...g.slice(k), w];
        // o resto recuado mais a palavra nova ainda pode não caber (palavra enorme): corta já
        if (dividirEmLinhas(juntar(g), cfg.maxCaracteresPorLinha, cfg.maxLinhas) === null && g.length > 1) {
          grupos.push(g.slice(0, -1));
          g = [w];
        }
        continue;
      }
    }
    g.push(w);
  }
  if (g.length) grupos.push(g);

  // Fala curta demais para a duração mínima antes da próxima (ex.: "Sim." e logo outra
  // fala): junta com a seguinte quando cabe; se não couber, fica, e a regra T3 aponta.
  for (let i = 0; i < grupos.length - 1; i++) {
    const a = grupos[i];
    const b = grupos[i + 1];
    const folga = b[0].inicioMs - cfg.intervaloMinimoMs - a[0].inicioMs;
    if (folga >= cfg.duracaoMinimaMs) continue;
    const juntos = [...a, ...b];
    const cabe =
      dividirEmLinhas(juntar(juntos), cfg.maxCaracteresPorLinha, cfg.maxLinhas) !== null &&
      juntos[juntos.length - 1].fimMs - juntos[0].inicioMs <= cfg.duracaoMaximaMs;
    if (cabe) {
      grupos.splice(i, 2, juntos);
      i--;
    }
  }

  // ---- tempos -------------------------------------------------------------
  const cues: Cue[] = [];
  for (let i = 0; i < grupos.length; i++) {
    const gr = grupos[i];
    const texto = juntar(gr);
    const linhas = dividirEmLinhas(texto, cfg.maxCaracteresPorLinha, cfg.maxLinhas) ?? [texto];
    const inicio = gr[0].inicioMs;
    const fimFala = gr[gr.length - 1].fimMs;
    const leitura = (visivel(linhas.join('')) / cfg.cpsAlvo) * 1000;
    const proxima = grupos[i + 1]?.[0].inicioMs ?? Infinity;
    let fim = Math.max(
      fimFala,
      inicio + cfg.duracaoMinimaMs,
      Math.min(inicio + leitura, fimFala + op.extensaoMaximaMs),
    );
    fim = Math.min(fim, inicio + cfg.duracaoMaximaMs, proxima - cfg.intervaloMinimoMs);
    fim = Math.max(fim, Math.min(fimFala, proxima - cfg.intervaloMinimoMs), inicio + 1);
    cues.push({
      index: i + 1,
      startMs: Math.round(inicio),
      endMs: Math.round(fim),
      lines: linhas,
      raw: linhas.join('\n'),
    } as Cue);
  }
  return cues;
}
