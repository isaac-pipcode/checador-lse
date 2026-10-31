/**
 * Contrato entre a interface (renderer) e o processo desktop (Electron main).
 * O renderer não tem acesso a Node: tudo que toca disco ou ffmpeg passa por
 * esta ponte, exposta pelo preload em `window.estudio`.
 *
 * Sem a ponte (navegador), o app continua funcionando para revisão de LSE e
 * para a prévia da AD; salvar projeto e renderizar a mixagem exigem o desktop.
 */
import type { Clipe, PontoGanho } from '../ad/mixagem';
import type { BlocoAD, ParametrosAD } from '../ad/tipos';

export interface MidiaEscolhida {
  caminho: string;
  nome: string;
  /** URL servível pelo protocolo `midia://` (com suporte a Range) */
  url: string;
}

export interface ProjetoArquivo {
  formato: 'estudio-acessibilidade';
  versao: 1;
  salvoEm: string;
  video: { nome: string; caminho: string | null } | null;
  legenda: { nome: string; conteudo: string } | null;
  ad: { parametros: ParametrosAD; blocos: BlocoAD[] };
}

export interface ArquivoTake {
  arquivo: string;
  bytes: Uint8Array;
}

export interface PedidoRender {
  videoCaminho: string;
  nomeBase: string;
  duracaoMs: number;
  clipes: Clipe[];
  curva: PontoGanho[];
  /** áudio de cada take, por id */
  takes: Array<{ id: string; bytes: Uint8Array }>;
  saidas: { mixagem: boolean; trilhaAd: boolean; video: boolean };
}

export interface RelatorioRender {
  pasta: string;
  arquivos: string[];
  duracaoMs: number;
  originalTemAudio: boolean;
  amostrasSaturadas: number;
  loudness: { integradoLufs: number | null; picoVerdadeiroDbtp: number | null } | null;
  avisos: string[];
}

export interface PonteDesktop {
  plataforma: string;
  ffmpeg(): Promise<{ disponivel: boolean; versao: string | null; caminho: string }>;
  escolherVideo(): Promise<MidiaEscolhida | null>;
  urlDeMidia(caminho: string): Promise<string>;
  analisarAudio(
    caminho: string,
    janelaMs: number,
    aoProgredir: (fracao: number) => void,
  ): Promise<{ envelopeDb: Float32Array; duracaoMs: number }>;
  salvarProjeto(pedido: {
    caminho: string | null;
    projeto: ProjetoArquivo;
    takes: ArquivoTake[];
  }): Promise<{ caminho: string } | null>;
  abrirProjeto(): Promise<{ caminho: string; projeto: ProjetoArquivo; takes: ArquivoTake[] } | null>;
  renderizar(pedido: PedidoRender, aoProgredir: (fracao: number, etapa: string) => void): Promise<RelatorioRender | null>;
  salvarTexto(nomeSugerido: string, conteudo: string): Promise<string | null>;
  mostrarNaPasta(caminho: string): Promise<void>;
}

declare global {
  interface Window {
    estudio?: PonteDesktop;
  }
}

export function ponte(): PonteDesktop | null {
  return typeof window !== 'undefined' && window.estudio ? window.estudio : null;
}
