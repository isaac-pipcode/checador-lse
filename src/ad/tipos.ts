/**
 * Modelo da trilha de audiodescrição (AD).
 *
 * Um bloco é uma inserção de AD: uma janela de tempo (em geral, uma lacuna do
 * mapa temporal), um texto de roteiro e zero ou mais gravações (takes). O take
 * ativo é o que entra na mixagem.
 */

export interface Take {
  id: string;
  /** nome do arquivo dentro da pasta do projeto; null enquanto não salvo */
  arquivo: string | null;
  /** duração total da gravação */
  duracaoMs: number;
  /** trecho útil, após aparar silêncio de cabeça e cauda */
  trimInicioMs: number;
  trimFimMs: number;
  /** onde o trecho útil começa na linha do tempo da obra */
  posicaoMs: number;
  ganhoDb: number;
  gravadoEm: string;
}

export interface BlocoAD {
  id: string;
  /** janela disponível para a inserção */
  inicioMs: number;
  fimMs: number;
  texto: string;
  takes: Take[];
  takeAtivoId: string | null;
  /** observação livre do roteirista para o locutor (não é lida) */
  nota: string;
}

export interface ParametrosAD {
  /** velocidade de leitura usada na estimativa, até haver takes para calibrar */
  palavrasPorMinuto: number;
  /** atenuação do áudio original sob a AD (dB, negativo) */
  duckingDb: number;
  ataqueMs: number;
  liberacaoMs: number;
  /** quanto tocar antes do bloco ao gravar */
  prerollMs: number;
  /** limiar para aparar silêncio dos takes, em dB abaixo do pico do take */
  aparoDb: number;
  /** compensação da latência de captura (ms, somada à posição do take) */
  latenciaMs: number;
}

export const PARAMETROS_AD_PADRAO: ParametrosAD = {
  // Estimativa inicial, a calibrar pelos takes do próprio locutor.
  palavrasPorMinuto: 160,
  duckingDb: -10,
  ataqueMs: 250,
  liberacaoMs: 500,
  prerollMs: 2000,
  aparoDb: 30,
  latenciaMs: 0,
};

export function takeAtivo(b: BlocoAD): Take | null {
  return b.takes.find((t) => t.id === b.takeAtivoId) ?? null;
}

export function duracaoUtil(t: Take): number {
  return Math.max(0, t.trimFimMs - t.trimInicioMs);
}
