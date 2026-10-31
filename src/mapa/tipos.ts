/**
 * Mapa temporal da obra: a representação compartilhada que alimenta a trilha de
 * legenda (LSE) e, adiante, a de audiodescrição (lacunas) e a de Libras.
 *
 * Tudo aqui é *inferência sobre o sinal* — energia de áudio e diferença entre
 * quadros —, não reconhecimento de fala nem de plano. As regras que o consomem
 * declaram isso (verificabilidade `sinal`) e vêm sempre com grau de confiança.
 */

export interface Intervalo {
  inicioMs: number;
  fimMs: number;
}

export interface ParametrosAtividade {
  /** dB acima do piso de ruído estimado a partir do qual a janela conta como ativa */
  limiarDb: number;
  /** percentil (0..1) do envelope tomado como piso de ruído */
  percentilPiso: number;
  /** segmentos ativos mais curtos que isto são descartados (cliques, batidas) */
  duracaoMinimaMs: number;
  /** silêncios mais curtos que isto, entre dois segmentos, são fundidos (pausas de fala) */
  fusaoMs: number;
}

export const PARAMETROS_ATIVIDADE_PADRAO: ParametrosAtividade = {
  limiarDb: 12,
  percentilPiso: 0.1,
  duracaoMinimaMs: 150,
  fusaoMs: 300,
};

export interface Corte {
  ms: number;
  /** distância entre histogramas, 0..1 */
  intensidade: number;
  /** incerteza da localização (± ms) após o refinamento */
  precisaoMs: number;
}

export type StatusCortes =
  | { tipo: 'nao_detectado' }
  | { tipo: 'em_andamento'; progresso: number }
  | { tipo: 'concluido'; passoMs: number }
  | { tipo: 'cancelado' }
  | { tipo: 'erro'; mensagem: string };

export interface MapaTemporal {
  arquivoVideo: string;
  duracaoMs: number;
  /** falso quando o áudio não pôde ser decodificado: M1 e M3 não executam */
  audio: boolean;
  /** resolução do envelope */
  janelaMs: number;
  /** energia por janela, em dBFS, banda de voz (≈150–4000 Hz) */
  envelopeDb: Float32Array;
  pisoDb: number;
  parametros: ParametrosAtividade;
  /** derivado de envelope + parâmetros */
  atividade: Intervalo[];
  cortes: Corte[];
  statusCortes: StatusCortes;
}
