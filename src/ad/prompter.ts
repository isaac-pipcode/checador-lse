import type { BlocoAD, LegendaPrompter, ParametrosAD } from './tipos';
import { duracaoUtil, takeAtivo } from './tipos';

/**
 * Estado do teleprompter — serializável, pois atravessa processos (janela
 * principal → janela do locutor, via processo desktop). A janela principal é a
 * única fonte de verdade; a do locutor só exibe e devolve comandos.
 */

export type FaseGravacao = 'ocioso' | 'preroll' | 'agora' | 'posroll' | 'processando' | 'revisao';

/** fases em que o microfone está gravando */
export const GRAVANDO: ReadonlySet<FaseGravacao> = new Set(['preroll', 'agora', 'posroll']);

export interface EstadoPrompter {
  videoUrl: string | null;
  tempoMs: number;
  tocando: boolean;
  fase: FaseGravacao;
  /** sessão em sequência (avança sozinha) ou bloco avulso */
  sequencia: boolean;
  bloco: {
    n: number;
    total: number;
    texto: string;
    nota: string;
    inicioMs: number;
    fimMs: number;
    /** fim da captura: fim do bloco + pós-rolagem */
    fimCapturaMs: number;
  } | null;
  proximo: { texto: string; inicioMs: number } | null;
  /** resultado do último take, na fase de revisão */
  take: { duracaoMs: number; cabe: boolean; posicaoMs: number } | null;
  aviso: string | null;
  legenda: LegendaPrompter;
}

export type ComandoGravacao =
  | 'parar'
  | 'manter'
  | 'regravar'
  | 'descartar'
  | 'ouvir'
  | 'encerrar'
  | 'fonteMais'
  | 'fonteMenos';

/** Teclas da sessão, iguais nas duas janelas. Devolve null se a tecla não é da sessão. */
export function comandoDaTecla(tecla: string, fase: FaseGravacao): ComandoGravacao | null {
  if (tecla === 'Escape') return 'encerrar';
  // tamanho da letra: vale em qualquer fase, inclusive lendo
  if (tecla === '+' || tecla === '=') return 'fonteMais';
  if (tecla === '-' || tecla === '_') return 'fonteMenos';
  if (GRAVANDO.has(fase)) return tecla === 'Enter' || tecla === ' ' ? 'parar' : null;
  if (fase === 'revisao') {
    if (tecla === 'Enter') return 'manter';
    if (tecla === 'r' || tecla === 'R') return 'regravar';
    if (tecla === 'Backspace' || tecla === 'Delete') return 'descartar';
    if (tecla === ' ') return 'ouvir';
  }
  return null;
}

export const ESTADO_PROMPTER_OCIOSO: EstadoPrompter = {
  videoUrl: null,
  tempoMs: 0,
  tocando: false,
  fase: 'ocioso',
  sequencia: false,
  bloco: null,
  proximo: null,
  take: null,
  aviso: null,
  legenda: { cor: 'branco', escala: 1, alturaMaxima: 0.33 },
};

/** Blocos que entram no modo de gravação: aprovados e com texto, em ordem. */
export function blocosGravaveis(blocos: BlocoAD[], somenteSemTake: boolean): BlocoAD[] {
  return blocos.filter((b) => b.aprovado && b.texto.trim() !== '' && (!somenteSemTake || !takeAtivo(b)));
}

export function montarEstadoPrompter(args: {
  blocos: BlocoAD[];
  fila: string[];
  blocoId: string | null;
  fase: FaseGravacao;
  sequencia: boolean;
  videoUrl: string | null;
  tempoMs: number;
  tocando: boolean;
  aviso: string | null;
  parametros: ParametrosAD;
}): EstadoPrompter {
  const { blocos, fila, blocoId } = args;
  const b = blocos.find((x) => x.id === blocoId) ?? null;
  const i = blocoId ? fila.indexOf(blocoId) : -1;
  const prox = i >= 0 && args.sequencia ? blocos.find((x) => x.id === fila[i + 1]) ?? null : null;
  const t = b && args.fase === 'revisao' ? takeAtivo(b) : null;
  return {
    videoUrl: args.videoUrl,
    tempoMs: args.tempoMs,
    tocando: args.tocando,
    fase: args.fase,
    sequencia: args.sequencia,
    bloco: b
      ? {
          n: i >= 0 ? i + 1 : 1,
          total: i >= 0 ? fila.length : 1,
          texto: b.texto,
          nota: b.nota,
          inicioMs: b.inicioMs,
          fimMs: b.fimMs,
          fimCapturaMs: b.fimMs + args.parametros.posrollMs,
        }
      : null,
    proximo: prox ? { texto: prox.texto, inicioMs: prox.inicioMs } : null,
    take: t
      ? {
          duracaoMs: duracaoUtil(t),
          posicaoMs: t.posicaoMs,
          cabe: t.posicaoMs >= b!.inicioMs && t.posicaoMs + duracaoUtil(t) <= b!.fimMs,
        }
      : null,
    aviso: args.aviso,
    legenda: args.parametros.legenda,
  };
}
