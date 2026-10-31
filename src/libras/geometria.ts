import type { Cue } from '../model/types';
import type { JanelaLibras, LimitesNorma } from './tipos';

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Retângulo da janela em pixels de um quadro w×h. Arredonda para pares (exigência do yuv420p). */
export function retanguloJanela(j: Pick<JanelaLibras, 'canto' | 'altura' | 'largura' | 'margem'>, w: number, h: number): Retangulo {
  const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const jw = par(j.largura * w);
  const jh = par(j.altura * h);
  const m = Math.round(j.margem * Math.min(w, h));
  const x = j.canto.endsWith('dir') ? w - jw - m : m;
  const y = j.canto.startsWith('inf') ? h - jh - m : m;
  return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(jw, w), h: Math.min(jh, h) };
}

/**
 * Enquadramento "cobrir": o clipe preenche a janela, cortando o excesso, com
 * zoom e deslocamento vertical (para subir o intérprete, por exemplo). Devolve
 * o recorte na fonte, em pixels da fonte.
 */
export function recorteNaFonte(
  janela: { w: number; h: number },
  fonte: { w: number; h: number },
  zoom: number,
  deslocY: number,
): Retangulo {
  const escala = Math.max(janela.w / fonte.w, janela.h / fonte.h) * Math.max(1, zoom);
  const rw = Math.min(fonte.w, janela.w / escala);
  const rh = Math.min(fonte.h, janela.h / escala);
  const x = (fonte.w - rw) / 2;
  const folgaY = fonte.h - rh;
  const y = (folgaY / 2) * (1 + Math.max(-1, Math.min(1, deslocY)));
  return { x, y, w: rw, h: rh };
}

export type CodigoLibras = 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'J6';

export interface ApontamentoLibras {
  codigo: CodigoLibras;
  nivel: 'erro' | 'aviso' | 'pendente';
  mensagem: string;
}

/** Faixa da tela que a LSE ocupa (frações). Heurística: base, centralizada. */
export const AREA_LEGENDA = { x0: 0.15, x1: 0.85, y0: 0.78, y1: 0.96 };

const pct = (f: number) => `${Math.round(f * 100)}%`;
const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/**
 * Verificações da janela.
 * J1 altura mínima · J2 largura mínima · J3 sem clipe · J4 cobertura temporal
 * (Libras durante toda a obra) · J5 sobreposição com a área da legenda ·
 * J6 sincronia não verificada.
 */
export function verificarJanela(
  j: JanelaLibras,
  norma: LimitesNorma,
  duracaoObraMs: number,
  cues: Cue[],
): ApontamentoLibras[] {
  const out: ApontamentoLibras[] = [];
  if (j.altura + 1e-9 < norma.alturaMin) {
    out.push({ codigo: 'J1', nivel: 'erro', mensagem: `Altura de ${pct(j.altura)} da tela; o mínimo é ${pct(norma.alturaMin)}.` });
  }
  if (j.largura + 1e-9 < norma.larguraMin) {
    out.push({ codigo: 'J2', nivel: 'erro', mensagem: `Largura de ${pct(j.largura)} da tela; o mínimo é ${pct(norma.larguraMin)}.` });
  }
  if (!j.clipe) {
    out.push({ codigo: 'J3', nivel: 'pendente', mensagem: 'Nenhum vídeo do intérprete carregado.' });
    return out;
  }
  const ini = j.inicioNaObraMs;
  const fim = j.inicioNaObraMs + j.clipe.duracaoMs;
  const faltaInicio = Math.max(0, ini);
  const faltaFim = Math.max(0, duracaoObraMs - fim);
  if (duracaoObraMs > 0 && (faltaInicio > 500 || faltaFim > 500)) {
    out.push({
      codigo: 'J4',
      nivel: 'aviso',
      mensagem: `A janela não cobre a obra inteira: faltam ${[
        faltaInicio > 500 ? `${seg(faltaInicio)} no início` : '',
        faltaFim > 500 ? `${seg(faltaFim)} no fim` : '',
      ]
        .filter(Boolean)
        .join(' e ')}.`,
    });
  }
  if (cues.length > 0) {
    // quadro de referência; arredondar em 1×1 px inflaria a janela
    const R = retanguloJanela(j, 1920, 1080);
    const r = { x: R.x / 1920, y: R.y / 1080, w: R.w / 1920, h: R.h / 1080 };
    const a = AREA_LEGENDA;
    const sobrepoe = r.x < a.x1 && r.x + r.w > a.x0 && r.y < a.y1 && r.y + r.h > a.y0;
    if (sobrepoe) {
      out.push({
        codigo: 'J5',
        nivel: 'aviso',
        mensagem:
          'A janela invade a faixa onde a LSE costuma aparecer (base, centro). Estimativa: confira no monitor se a legenda encobre o intérprete; se sim, posicione a legenda no lado oposto.',
      });
    }
  }
  if (j.sincronia.metodo === 'nenhuma') {
    out.push({ codigo: 'J6', nivel: 'pendente', mensagem: 'Sincronia não verificada: use a sincronização pelo áudio ou ajuste à mão.' });
  } else if (j.sincronia.metodo === 'audio' && (j.sincronia.confianca ?? 0) < 0.5) {
    out.push({ codigo: 'J6', nivel: 'aviso', mensagem: 'Sincronização automática com baixa confiança: confira no monitor.' });
  }
  return out;
}
