import type { BlocoAD } from './tipos';
import { duracaoUtil, takeAtivo } from './tipos';
import { formatarTimecode } from '../core/texto';

/** Formatos de saída do roteiro: texto para o locutor, VTT de descrições, CSV. */

function ordenados(blocos: BlocoAD[]) {
  return [...blocos].filter((b) => b.texto.trim()).sort((a, b) => a.inicioMs - b.inicioMs);
}

export function roteiroTexto(blocos: BlocoAD[], titulo: string): string {
  const l: string[] = [`ROTEIRO DE AUDIODESCRIÇÃO — ${titulo}`, ''];
  ordenados(blocos).forEach((b, i) => {
    l.push(`${String(i + 1).padStart(3, '0')}  ${formatarTimecode(b.inicioMs)} → ${formatarTimecode(b.fimMs)}  (${((b.fimMs - b.inicioMs) / 1000).toFixed(1).replace('.', ',')} s)`);
    if (b.nota.trim()) l.push(`     [nota: ${b.nota.trim()}]`);
    l.push(`     ${b.texto.trim()}`);
    l.push('');
  });
  return l.join('\r\n');
}

/**
 * WebVTT com as descrições, para players que leem `kind="descriptions"` por
 * síntese de voz. Usa a posição do take quando há gravação; senão, a janela.
 */
export function roteiroVtt(blocos: BlocoAD[]): string {
  const l = ['WEBVTT', ''];
  ordenados(blocos).forEach((b, i) => {
    const t = takeAtivo(b);
    const ini = t ? t.posicaoMs : b.inicioMs;
    const fim = t ? t.posicaoMs + duracaoUtil(t) : b.fimMs;
    l.push(String(i + 1), `${formatarTimecode(ini, '.')} --> ${formatarTimecode(fim, '.')}`, b.texto.trim(), '');
  });
  return l.join('\n');
}

export function roteiroCsv(blocos: BlocoAD[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const l = ['n;inicio;fim;texto;nota;take;duracao_take_s'];
  ordenados(blocos).forEach((b, i) => {
    const t = takeAtivo(b);
    l.push(
      [
        i + 1,
        formatarTimecode(b.inicioMs),
        formatarTimecode(b.fimMs),
        esc(b.texto.trim()),
        esc(b.nota.trim()),
        t?.arquivo ?? '',
        t ? (duracaoUtil(t) / 1000).toFixed(2).replace('.', ',') : '',
      ].join(';'),
    );
  });
  return l.join('\r\n') + '\r\n';
}
