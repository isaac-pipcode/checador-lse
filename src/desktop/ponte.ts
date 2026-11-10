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
import type { InfoVideo } from '../midia/avaliacao';

export interface MidiaEscolhida {
  caminho: string;
  nome: string;
  /** URL servível pelo protocolo `midia://` (com suporte a Range) */
  url: string;
  /** sondagem do ffprobe (codec, resolução, cadência…), para decidir sobre proxy */
  info?: InfoVideo | null;
}

export interface ProjetoArquivo {
  formato: 'estudio-acessibilidade';
  versao: 1;
  salvoEm: string;
  video: { nome: string; caminho: string | null; proxy?: string | null; usarProxy?: boolean } | null;
  legenda: { nome: string; conteudo: string } | null;
  ad: { parametros: ParametrosAD; blocos: BlocoAD[] };
  /** passo 3 (ausente em projetos antigos) */
  libras?: Omit<JanelaLibras, 'clipe'> & {
    clipe: { nome: string; caminho: string | null; duracaoMs: number; proxy?: string | null } | null;
  };
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
    janela: Pick<
      JanelaLibras,
      'canto' | 'altura' | 'largura' | 'margem' | 'zoom' | 'deslocY' | 'deslocX' | 'chroma' | 'cor' | 'velocidade' | 'fundo' | 'corFundo'
    >;
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

export interface PedidoIntercambio {
  videoCaminho: string;
  nomeBase: string;
  duracaoMs: number;
  libras: NonNullable<PedidoEntrega['libras']>;
  formatos: { xmeml: boolean; fcpxml: boolean };
  /** incluir o clipe bruto do intérprete, sincronizado e desativado, na V3 */
  incluirBruto: boolean;
}

export interface RelatorioIntercambio {
  pasta: string;
  arquivos: string[];
  /** cadência da sequência, como fração (ex.: 24000/1001) */
  cadencia: string;
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

export interface EstadoMenu {
  projetoAberto: boolean;
  temVideo: boolean;
  pagina: 'projetos' | 'lse' | 'ad' | 'libras' | 'entrega';
  paineis: { esq: boolean; linha: boolean; dir: boolean };
  tema: 'escuro' | 'claro';
  ajudas: boolean;
}

export type EstadoAtualizacao =
  | { estado: 'desativada'; motivo: string }
  | { estado: 'verificando' }
  | { estado: 'atual'; versao: string }
  | { estado: 'disponivel'; versao: string; automatica: boolean; url: string }
  | { estado: 'baixando'; versao: string; fracao: number }
  | { estado: 'pronta'; versao: string }
  | { estado: 'erro'; mensagem: string };

export interface PonteDesktop {
  plataforma: string;
  ffmpeg(): Promise<{
    disponivel: boolean;
    versao: string | null;
    caminho: string;
    /** de onde veio: variável de ambiente, embutido no instalador, instalação do sistema ou PATH */
    origem: 'variavel' | 'embutido' | 'sistema' | 'path';
  }>;
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
  /** Libras tratada com alfa + sequência para Premiere (xmeml) e Resolve (FCPXML) */
  exportarParaEditores(
    pedido: PedidoIntercambio,
    aoProgredir: (fracao: number, etapa: string) => void,
  ): Promise<RelatorioIntercambio | null>;

  // ---- Mídia e proxy ------------------------------------------------------
  sondarMidia(caminho: string): Promise<InfoVideo>;
  /**
   * Gera (ou reaproveita) o proxy de edição. Fica em `proxies/` ao lado do
   * projeto, se houver; senão, na pasta de dados do aplicativo.
   */
  gerarProxy(
    caminho: string,
    projetoCaminho: string | null,
    aoProgredir: (fracao: number) => void,
  ): Promise<{ caminho: string; url: string; reaproveitado: boolean }>;
  cancelarProxy(caminho: string): Promise<void>;

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
  /** atualização do aplicativo (ver desktop/atualizacao.ts) */
  atualizacao: {
    versao(): Promise<string>;
    estado(): Promise<EstadoAtualizacao>;
    verificar(): Promise<EstadoAtualizacao>;
    reiniciar(): void;
    abrirPagina(url: string): void;
    aoMudar(cb: (e: EstadoAtualizacao) => void): () => void;
  };
  /** menu nativo (desktop/menu.ts): ações vindas dele e o estado que ele reflete */
  menu: {
    aoAcao(cb: (acao: string) => void): () => void;
    estado(e: Partial<EstadoMenu>): void;
  };
  /** diálogo do sistema para .srt/.vtt; devolve os bytes (a decodificação fica na interface) */
  escolherLegenda(): Promise<{ nome: string; bytes: Uint8Array } | null>;
  /** chamada à Responses API da Maritaca pelo processo principal (endpoint fixo); a chave não é guardada */
  llmMaritaca(apiKey: string, corpo: object): Promise<{ status: number; texto: string }>;
  /** monitores conectados (para decidir entre janela do locutor e monitor acoplado) */
  quantasTelas(): Promise<number>;
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
