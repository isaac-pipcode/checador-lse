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
import type { ComandoGravacao, EstadoPrompter } from '../ad/prompter';
import type { JanelaLibras } from '../libras/tipos';

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
  /** passo 3 (ausente em projetos antigos) */
  libras?: Omit<JanelaLibras, 'clipe'> & { clipe: { nome: string; caminho: string | null; duracaoMs: number } | null };
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

export interface PedidoEntrega {
  videoCaminho: string;
  nomeBase: string;
  duracaoMs: number;
  /** janela de Libras a queimar no vídeo */
  libras: {
    caminho: string;
    inicioNaObraMs: number;
    janela: Pick<JanelaLibras, 'canto' | 'altura' | 'largura' | 'margem' | 'zoom' | 'deslocY' | 'chroma' | 'fundo' | 'corFundo'>;
  } | null;
  /** faixa de AD: os mesmos dados da renderização do passo 2 */
  ad: Pick<PedidoRender, 'clipes' | 'curva' | 'takes'> | null;
  /** LSE (com as decisões aprovadas) como legenda selecionável */
  legendaSrt: string | null;
}

export interface RelatorioEntrega {
  arquivo: string;
  duracaoMs: number;
  faixas: { video: string; audios: string[]; legenda: string | null };
  loudnessAd: { integradoLufs: number | null; picoVerdadeiroDbtp: number | null } | null;
  avisos: string[];
}

export interface ResumoProjeto {
  caminho: string;
  nome: string;
  atualizadoEm: string;
  video: string | null;
  miniatura: string | null;
  lse: { legendas: number } | null;
  ad: { blocos: number; aprovados: number; gravados: number };
  libras: { clipe: boolean; sincronizado: boolean };
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

  // ---- Libras e entrega -------------------------------------------------
  escolherClipeLibras(): Promise<(MidiaEscolhida & { duracaoMs: number; largura: number; altura: number }) | null>;
  renderizarEntrega(pedido: PedidoEntrega, aoProgredir: (fracao: number, etapa: string) => void): Promise<RelatorioEntrega | null>;

  // ---- Projetos ----------------------------------------------------------
  projetosRecentes(): Promise<ResumoProjeto[]>;
  /** pergunta a pasta e devolve o caminho do novo .estudio.json (ainda não escrito) */
  novoProjeto(nome: string): Promise<string | null>;
  abrirProjetoEm(caminho: string): Promise<{ caminho: string; projeto: ProjetoArquivo; takes: ArquivoTake[] } | null>;
  esquecerProjeto(caminho: string): Promise<void>;

  // ---- Teleprompter (janela do locutor) ----------------------------------
  /** abre (ou traz à frente) a janela do locutor, no segundo monitor se houver */
  prompterAbrir(): Promise<{ monitor: string; secundario: boolean }>;
  prompterFechar(): Promise<void>;
  /** janela principal → locutor */
  prompterEnviar(estado: EstadoPrompter): void;
  /** janela principal: comandos vindos do locutor; devolve função para cancelar */
  aoComandoDoPrompter(cb: (c: ComandoGravacao) => void): () => void;
  aoFecharPrompter(cb: () => void): () => void;
  /** janela do locutor: estado vindo da principal */
  aoEstadoDoPrompter(cb: (e: EstadoPrompter) => void): () => void;
  /** janela do locutor → principal */
  enviarComando(c: ComandoGravacao): void;
}

declare global {
  interface Window {
    estudio?: PonteDesktop;
  }
}

export function ponte(): PonteDesktop | null {
  return typeof window !== 'undefined' && window.estudio ? window.estudio : null;
}
