/**
 * Tipos centrais do checador de LSE.
 *
 * Referência normativa: NAVES, S. B.; MAUCH, C.; ALVES, S. F.; ARAÚJO, V. L. S.
 * Guia para Produções Audiovisuais Acessíveis. Brasília: MinC/SAv, 2016.
 */

export interface Cue {
  /** ordem original (1-based) */
  index: number;
  startMs: number;
  endMs: number;
  /** linhas físicas, sem \n */
  lines: string[];
  /** bloco original íntegro (para diff e fallback) */
  raw: string;
}

export type Severity = 'erro' | 'aviso' | 'revisao_manual';
export type Verifiability = 'deterministica' | 'nlp' | 'llm' | 'manual';

export type RuleCategory = 'tecnica' | 'formatacao' | 'linguistica' | 'contextual';

export interface CueSnapshot {
  lines: string[];
  startMs?: number;
  endMs?: number;
}

export interface Suggestion {
  id: string;
  ruleId: string;
  /** índice da legenda (1-based). -1 = escopo do documento inteiro. */
  cueIndex: number;
  severity: Severity;
  verifiability: Verifiability;
  /** justificativa em 1 frase, citando a norma */
  message: string;
  /** 0..1 — obrigatório para nlp/llm */
  confidence?: number;
  before: CueSnapshot;
  /** ausente = só sinaliza, não auto-corrige */
  after?: CueSnapshot;
  autoFixable: boolean;
  /**
   * Verdadeiro quando a regra se aplica mas o módulo que produziria a correção
   * está desligado/indisponível. Nunca simular a análise: sinalizar honestamente.
   */
  unavailable?: boolean;
}

export type Decision = 'pendente' | 'aprovada' | 'rejeitada' | 'editada';

export interface ReviewItem {
  suggestion: Suggestion;
  decision: Decision;
  /** presente somente quando decision === 'editada' */
  editedAfter?: CueSnapshot;
}

export type ReviewState = Record<string, ReviewItem>;

export interface RuleMeta {
  id: string;
  nome: string;
  categoria: RuleCategory;
  verificabilidade: Verifiability;
  /** parágrafo curto exibido na UI e no relatório */
  fundamento: string;
}

export const DOCUMENT_SCOPE = -1;

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export interface RuleConfig {
  perfilId: string;
  perfilNome: string;
  /** T1 — caracteres por linha */
  maxCaracteresPorLinha: number;
  /** T2 — número máximo de linhas */
  maxLinhas: number;
  /** T3 — duração mínima (ms) */
  duracaoMinimaMs: number;
  /** T4 — duração acima da qual é aviso (ms) */
  duracaoAvisoMs: number;
  /** T4 — duração acima da qual é erro (ms) */
  duracaoMaximaMs: number;
  /** T5 — CPS alvo (verde até aqui) */
  cpsAlvo: number;
  /** T5 — teto absoluto; acima disso é erro */
  cpsMaximo: number;
  /** T7 — intervalo mínimo entre legendas (ms) */
  intervaloMinimoMs: number;
  /** T7 — taxa de quadros usada para converter frames↔ms na UI */
  fps: number;
  /** T8 — desequilíbrio tolerado entre as duas linhas (0..1) */
  desequilibrioMaximo: number;
  /** C6 — limiar de exclamações na obra inteira */
  maxExclamacoesPorObra: number;
  /** X1 — nº de legendas consecutivas sem rótulo que dispara a checagem */
  janelaSemRotulo: number;

  contarEspacos: boolean;
  contarColchetes: boolean;
  checarTracoDialogo: boolean;

  nlpAtivo: boolean;
  llmAtivo: boolean;
}

export interface Perfil extends RuleConfig {
  descricao: string;
  aderenteAoGuia: boolean;
}
