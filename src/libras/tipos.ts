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
  caminho: string | null;
  url: string;
  duracaoMs: number;
}

export interface Chroma {
  ativo: boolean;
  /** cor-chave, #RRGGBB */
  cor: string;
  /** 0,01–0,5: distância de cor abaixo da qual o pixel some (mesmo sentido do chromakey do ffmpeg) */
  similaridade: number;
  /** 0–0,3: faixa de transição (borda suave) */
  suavidade: number;
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
  chroma: Chroma;
  /** fundo da janela quando o chroma está ativo: transparente (sobre a imagem) ou cor sólida */
  fundo: 'transparente' | 'solido';
  corFundo: string;
  sincronia: { metodo: 'nenhuma' | 'manual' | 'audio'; confianca: number | null };
}

export interface LimitesNorma {
  alturaMin: number;
  larguraMin: number;
  fonte: string;
}

export const NBR_15290: LimitesNorma = {
  alturaMin: 0.5,
  larguraMin: 0.25,
  fonte: 'ABNT NBR 15290:2005, segundo fontes secundárias (INES; Câmara dos Deputados; MPF) — confirmar no texto da norma',
};

export const JANELA_PADRAO: JanelaLibras = {
  clipe: null,
  inicioNaObraMs: 0,
  canto: 'inf-dir',
  altura: 0.5,
  largura: 0.25,
  margem: 0.02,
  zoom: 1,
  deslocY: 0,
  chroma: { ativo: true, cor: '#00B140', similaridade: 0.12, suavidade: 0.08 },
  fundo: 'transparente',
  corFundo: '#1B2230',
  sincronia: { metodo: 'nenhuma', confianca: null },
};
