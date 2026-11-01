import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Painéis redimensionáveis, como nos editores de vídeo: divisórias arrastáveis
 * entre as colunas e acima da linha do tempo. As larguras são lembradas por
 * página; a altura da linha do tempo vale para todas. Preferência do usuário,
 * não do projeto: fica no armazenamento local, como o tema.
 *
 * Cada divisória segue o padrão WAI-ARIA "window splitter": `role=separator`
 * focável, com valor atual, mínimo e máximo; setas movem 16 px (Shift: 64 px),
 * Home/End vão aos limites, Enter e o duplo clique restauram o padrão.
 */

export interface MedidasPagina {
  esq?: number;
  dir?: number;
}

interface Layout {
  paginas: Record<string, MedidasPagina>;
  linha?: number;
}

const CHAVE = 'estudio:paineis';

function ler(): Layout {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Layout>;
    return { paginas: l.paginas ?? {}, linha: typeof l.linha === 'number' ? l.linha : undefined };
  } catch {
    return { paginas: {} };
  }
}

export function usePaineis(pagina: string) {
  const [layout, setLayout] = useState<Layout>(ler);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(layout));
    } catch {
      /* sem armazenamento: vale só para a sessão */
    }
  }, [layout]);
  return {
    medidas: layout.paginas[pagina] ?? {},
    linha: layout.linha,
    definir: (m: MedidasPagina) =>
      setLayout((l) => ({ ...l, paginas: { ...l.paginas, [pagina]: { ...l.paginas[pagina], ...m } } })),
    definirLinha: (h: number | undefined) => setLayout((l) => ({ ...l, linha: h })),
  };
}

/** Largura (ou altura) da janela, para limitar os painéis quando ela encolhe. */
export function useJanela() {
  const [t, setT] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setT({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return t;
}

const limitar = (v: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, v)));

export function Divisoria({
  orientacao,
  rotulo,
  medir,
  min,
  max,
  sentido = 1,
  aoMudar,
  aoRestaurar,
}: {
  /** vertical: separa colunas (arrasta na horizontal); horizontal: separa linhas */
  orientacao: 'vertical' | 'horizontal';
  rotulo: string;
  /** tamanho atual do painel controlado, medido na tela */
  medir: () => number;
  min: number;
  max: number;
  /** +1: arrastar para a direita/baixo aumenta o painel; −1: diminui */
  sentido?: 1 | -1;
  aoMudar: (v: number) => void;
  aoRestaurar: () => void;
}) {
  const inicio = useRef<{ p: number; v: number } | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const vertical = orientacao === 'vertical';
  const maxSeguro = Math.max(min, max);

  // valor anunciado (aria-valuenow): medido depois de cada renderização
  useEffect(() => {
    const v = Math.round(medir());
    if (v !== valor) setValor(v);
  });

  function mudar(v: number) {
    const n = limitar(v, min, maxSeguro);
    aoMudar(n);
    setValor(n);
  }

  function baixar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { p: vertical ? e.clientX : e.clientY, v: medir() };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    const i = inicio.current;
    if (!i) return;
    mudar(i.v + sentido * ((vertical ? e.clientX : e.clientY) - i.p));
  }
  function soltar(e: PointerEvent<HTMLDivElement>) {
    inicio.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const passo = e.shiftKey ? 64 : 16;
    const menos = vertical ? 'ArrowLeft' : 'ArrowUp';
    const mais = vertical ? 'ArrowRight' : 'ArrowDown';
    if (e.key === menos) mudar(medir() - sentido * passo);
    else if (e.key === mais) mudar(medir() + sentido * passo);
    else if (e.key === 'Home') mudar(min);
    else if (e.key === 'End') mudar(maxSeguro);
    else if (e.key === 'Enter') aoRestaurar();
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientacao}
      aria-label={rotulo}
      aria-valuenow={valor ?? undefined}
      aria-valuemin={min}
      aria-valuemax={maxSeguro}
      title={`${rotulo}: arraste; duplo clique restaura`}
      onPointerDown={baixar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onDoubleClick={aoRestaurar}
      onKeyDown={teclado}
      className={`divisoria ${vertical ? 'divisoria-v' : 'divisoria-h'}`}
    />
  );
}
