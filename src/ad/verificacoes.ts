import type { Cue } from '../model/types';
import type { BlocoAD, ParametrosAD } from './tipos';
import { duracaoUtil, takeAtivo } from './tipos';
import { duracaoEstimadaMs } from './estimativa';
import { ehLegendaDeFala } from '../mapa/lacunas';

export type NivelAD = 'ok' | 'aviso' | 'erro' | 'pendente';

export interface ApontamentoAD {
  codigo: 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
  nivel: Exclude<NivelAD, 'ok'>;
  mensagem: string;
}

const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/**
 * Verificações de um bloco de AD. Puras e determinísticas sobre o modelo; a
 * única inferência é a duração estimada (A1), declarada como estimativa.
 *
 * A1 texto estimado não cabe na janela · A2 take passa da janela ·
 * A3 take sobrepõe legenda de fala · A4 sem texto · A5 sem take.
 */
export function verificarBloco(b: BlocoAD, cues: Cue[], p: ParametrosAD): ApontamentoAD[] {
  const out: ApontamentoAD[] = [];
  const janela = b.fimMs - b.inicioMs;
  const t = takeAtivo(b);

  if (b.texto.trim() === '') {
    out.push({ codigo: 'A4', nivel: 'pendente', mensagem: 'Bloco sem roteiro.' });
  } else if (!t) {
    const est = duracaoEstimadaMs(b.texto, p.palavrasPorMinuto);
    if (est > janela) {
      out.push({
        codigo: 'A1',
        nivel: est > janela * 1.15 ? 'erro' : 'aviso',
        mensagem: `Leitura estimada em ${seg(est)} (${p.palavrasPorMinuto} ppm) para uma janela de ${seg(janela)}.`,
      });
    }
  }

  if (!t) {
    if (b.texto.trim() !== '') out.push({ codigo: 'A5', nivel: 'pendente', mensagem: 'Sem gravação.' });
    return out;
  }

  const ini = t.posicaoMs;
  const fim = t.posicaoMs + duracaoUtil(t);
  if (ini < b.inicioMs || fim > b.fimMs) {
    const excesso = Math.max(b.inicioMs - ini, fim - b.fimMs);
    out.push({
      codigo: 'A2',
      nivel: excesso > 300 ? 'erro' : 'aviso',
      mensagem: `A gravação sai da janela do bloco em ${excesso} ms.`,
    });
  }

  const conflitos = cues.filter((c) => ehLegendaDeFala(c) && c.startMs < fim && c.endMs > ini);
  if (conflitos.length > 0) {
    out.push({
      codigo: 'A3',
      nivel: 'erro',
      mensagem: `A gravação se sobrepõe à fala da(s) legenda(s) ${conflitos.map((c) => c.index).join(', ')}.`,
    });
  }
  return out;
}

export function nivelDoBloco(ap: ApontamentoAD[]): NivelAD {
  if (ap.some((a) => a.nivel === 'erro')) return 'erro';
  if (ap.some((a) => a.nivel === 'aviso')) return 'aviso';
  if (ap.some((a) => a.nivel === 'pendente')) return 'pendente';
  return 'ok';
}
