/**
 * Janela de Libras: um clipe do intérprete (gravado em estúdio, em geral com
 * fundo verde) composto sobre a obra.
 *
 * Referência de dimensões: ABNT NBR 15290:2005 — altura mínima de 1/2 e largura
 * mínima de 1/4 da tela, segundo fontes secundárias (INES, Câmara dos
 * Deputados, MPF). O texto integral da norma não foi consultado: os limites
 * são parâmetros, e a interface declara a fonte.
 */

export type Canto = 'inf-dir' | 'inf-esq' | 'sup-dir' | 'sup-esq';

export interface ClipeLibras {
  nome: string;
  /** original: é dele que a entrega compõe a janela */
  caminho: string | null;
  /** URL em uso na prévia (do proxy, quando houver) */
  url: string;
  duracaoMs: number;
  urlOriginal?: string;
  proxy?: { caminho: string; url: string } | null;
}

export interface Chroma {
  ativo: boolean;
  /** cor-chave, #RRGGBB */
  cor: string;
  /** 0,01–0,5: distância de cor abaixo da qual o pixel some (mesmo sentido do chromakey do ffmpeg) */
  similaridade: number;
  /** 0–0,3: faixa de transição (borda suave) */
  suavidade: number;
  /** encolher o matte: iterações de erosão 3×3 (px do clipe), 0–6 — tira a franja verde da silhueta */
  encolher: number;
  /** suavizar a borda do matte: desfoque gaussiano (σ em px do clipe), 0–6 */
  suavizarBorda: number;
  /** supressão do reflexo verde (despill) na pele e na roupa */
  despill: { ativo: boolean; mistura: number; expandir: number };
  /** recorte das bordas do quadro do clipe (garbage matte), frações 0–0,4 */
  bordas: { esq: number; dir: number; topo: number; base: number };
}

/** Correção de cor do intérprete, aplicada depois do recorte (não altera a chave). */
export interface CorInterprete {
  /** −0,3 a 0,3 (somado à luminância) */
  brilho: number;
  /** 0,5 a 1,5 */
  contraste: number;
  /** 0 a 2 */
  saturacao: number;
}

export interface JanelaLibras {
  clipe: ClipeLibras | null;
  /** instante da obra em que o clipe começa (ms; negativo = clipe começa antes) */
  inicioNaObraMs: number;
  canto: Canto;
  /** frações do quadro da obra */
  altura: number;
  largura: number;
  margem: number;
  /** enquadramento do intérprete dentro da janela */
  zoom: number;
  /** deslocamento vertical do recorte, −1 (topo) a 1 (base) */
  deslocY: number;
  /** deslocamento horizontal do recorte, −1 (esquerda) a 1 (direita) */
  deslocX: number;
  chroma: Chroma;
  cor: CorInterprete;
  /**
   * Velocidade relativa do clipe: tempo na obra = início + tempo no clipe × velocidade.
   * 1 = sem deriva. A deriva vem do relógio de câmeras e gravadores diferentes
   * (dezenas de ppm), ou de conversões de cadência (ex.: 25 ↔ 23,976 qd/s: 4,3%).
   */
  velocidade: number;
  /** fundo da janela quando o chroma está ativo: transparente (sobre a imagem) ou cor sólida */
  fundo: 'transparente' | 'solido';
  corFundo: string;
  sincronia: {
    metodo: 'nenhuma' | 'manual' | 'audio';
    confianca: number | null;
    /** resultado da análise por janelas (som-guia), quando houver */
    relatorio?: RelatorioSincronia | null;
  };
}

export interface RelatorioSincronia {
  janelasValidas: number;
  janelasTotais: number;
  /** deriva medida, em ms por hora de clipe (positiva: o clipe atrasa ao longo do tempo) */
  derivaMsPorHora: number;
  /** desvio residual das janelas depois da correção (ms) */
  desvioMs: number;
  corrigida: boolean;
  /** pontos (tempo no clipe, defasagem residual) para o gráfico de conferência */
  pontos: Array<{ tClipeMs: number; residuoMs: number; corr: number }>;
}

export interface LimitesNorma {
  alturaMin: number;
  larguraMin: number;
  fonte: string;
}

export const NBR_15290: LimitesNorma = {
  alturaMin: 0.5,
  larguraMin: 0.25,
  fonte:
    'ABNT NBR 15290:2005, segundo fontes secundárias (INES; Câmara dos Deputados; MPF) — confirmar no texto da norma',
};

export const JANELA_PADRAO: JanelaLibras = {
  clipe: null,
  inicioNaObraMs: 0,
  canto: 'inf-dir',
  altura: 0.5,
  largura: 0.25,
  // 9% do lado menor: dentro da área segura de 5% em 16:9 e em 4:3
  margem: 0.09,
  zoom: 1,
  deslocY: 0,
  deslocX: 0,
  chroma: {
    ativo: true,
    cor: '#00B140',
    similaridade: 0.12,
    suavidade: 0.08,
    encolher: 1,
    suavizarBorda: 0.8,
    despill: { ativo: true, mistura: 0.5, expandir: 0 },
    bordas: { esq: 0, dir: 0, topo: 0, base: 0 },
  },
  cor: { brilho: 0, contraste: 1, saturacao: 1 },
  velocidade: 1,
  fundo: 'transparente',
  corFundo: '#1B2230',
  sincronia: { metodo: 'nenhuma', confianca: null },
};

/**
 * Completa uma janela parcial (projeto antigo, estado salvo em versão anterior)
 * com os padrões, campo a campo, inclusive nos objetos aninhados.
 */
export function normalizarJanela(p: Partial<JanelaLibras> | undefined | null): JanelaLibras {
  const q = p ?? {};
  const ch = (q.chroma ?? {}) as Partial<Chroma>;
  return {
    ...JANELA_PADRAO,
    ...q,
    clipe: q.clipe ?? null,
    chroma: {
      ...JANELA_PADRAO.chroma,
      ...ch,
      despill: { ...JANELA_PADRAO.chroma.despill, ...(ch.despill ?? {}) },
      bordas: { ...JANELA_PADRAO.chroma.bordas, ...(ch.bordas ?? {}) },
    },
    cor: { ...JANELA_PADRAO.cor, ...(q.cor ?? {}) },
    sincronia: { ...JANELA_PADRAO.sincronia, ...(q.sincronia ?? {}) },
  };
}
