import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Painéis redimensionáveis e recolhíveis, como nos editores de vídeo:
 * divisórias arrastáveis entre as colunas e acima da linha do tempo; cada
 * painel pode ser recolhido; o arranjo inteiro pode ser salvo com um nome
 * (como os "workspaces" do Resolve). Larguras e recolhidos são lembrados por
 * página; a linha do tempo vale para todas. Preferência do usuário, não do
 * projeto: fica no armazenamento local, como o tema.
 *
 * Cada divisória segue o padrão WAI-ARIA "window splitter": `role=separator`
 * focável, com valor atual, mínimo e máximo; setas movem 16 px (Shift: 64 px),
 * Home/End vão aos limites, Enter e o duplo clique restauram o padrão.
 */

export interface MedidasPagina {
  esq?: number;
  dir?: number;
  /** painel esquerdo recolhido */
  semEsq?: boolean;
  /** inspetor recolhido */
  semDir?: boolean;
}

/** Arranjo dos painéis: larguras e recolhidos por página; altura da linha do tempo, global. */
export interface Layout {
  paginas: Record<string, MedidasPagina>;
  linha?: number;
  semLinha?: boolean;
}

const CHAVE = 'estudio:paineis';

function ler(): Layout {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Layout>;
    return {
      paginas: l.paginas ?? {},
      linha: typeof l.linha === 'number' ? l.linha : undefined,
      semLinha: l.semLinha === true ? true : undefined,
    };
  } catch {
    return { paginas: {} };
  }
}

/** Forma canônica (sem chaves vazias, em ordem), para comparar layouts. */
export function canonico(l: Layout): string {
  const paginas: Record<string, MedidasPagina> = {};
  for (const k of Object.keys(l.paginas).sort()) {
    const m = l.paginas[k];
    const limpo: MedidasPagina = {};
    if (m.esq !== undefined) limpo.esq = m.esq;
    if (m.dir !== undefined) limpo.dir = m.dir;
    if (m.semEsq) limpo.semEsq = true;
    if (m.semDir) limpo.semDir = true;
    if (Object.keys(limpo).length) paginas[k] = limpo;
  }
  return JSON.stringify({ paginas, linha: l.linha ?? null, semLinha: l.semLinha === true });
}

export type Painel = 'esq' | 'dir' | 'linha';

export function usePaineis(pagina: string) {
  const [layout, setLayout] = useState<Layout>(ler);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(layout));
    } catch {
      /* sem armazenamento: vale só para a sessão */
    }
  }, [layout]);
  const medidas = layout.paginas[pagina] ?? {};
  const recolhido: Record<Painel, boolean> = {
    esq: !!medidas.semEsq,
    dir: !!medidas.semDir,
    linha: !!layout.semLinha,
  };
  const definir = (m: MedidasPagina) =>
    setLayout((l) => ({ ...l, paginas: { ...l.paginas, [pagina]: { ...l.paginas[pagina], ...m } } }));
  return {
    layout,
    medidas,
    linha: layout.linha,
    recolhido,
    definir,
    definirLinha: (h: number | undefined) => setLayout((l) => ({ ...l, linha: h })),
    alternar: (p: Painel) => {
      if (p === 'linha') setLayout((l) => ({ ...l, semLinha: l.semLinha ? undefined : true }));
      else if (p === 'esq') definir({ semEsq: medidas.semEsq ? undefined : true });
      else definir({ semDir: medidas.semDir ? undefined : true });
    },
    aplicar: (l: Layout) => setLayout(structuredClone(l)),
  };
}

// ---- layouts nomeados ------------------------------------------------------

const PAGINAS = ['lse', 'ad', 'libras', 'entrega'];

/** Layouts prontos: não podem ser sobrescritos nem excluídos. */
export const PRONTOS: Record<string, Layout> = {
  Padrão: { paginas: {} },
  'Foco no monitor': {
    paginas: Object.fromEntries(PAGINAS.map((p) => [p, { semEsq: true, semDir: true }])),
  },
};

const CHAVE_NOMEADOS = 'estudio:layouts';

function lerNomeados(): Record<string, Layout> {
  try {
    const o = JSON.parse(localStorage.getItem(CHAVE_NOMEADOS) ?? '{}') as Record<string, Layout>;
    return Object.fromEntries(Object.entries(o).filter(([, l]) => l && typeof l === 'object' && l.paginas));
  } catch {
    return {};
  }
}

export function useLayoutsNomeados() {
  const [salvos, setSalvos] = useState<Record<string, Layout>>(lerNomeados);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_NOMEADOS, JSON.stringify(salvos));
    } catch {
      /* sem armazenamento */
    }
  }, [salvos]);
  return {
    salvos,
    salvar: (nome: string, l: Layout) => setSalvos((s) => ({ ...s, [nome]: structuredClone(l) })),
    excluir: (nome: string) =>
      setSalvos((s) => {
        const { [nome]: _fora, ...resto } = s;
        return resto;
      }),
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
