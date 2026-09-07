/** Ponto de quebra proposto entre duas palavras. */
export interface PropostaQuebra {
  linhas: string[];
  /** 0..1 — quão bem sustentada é a análise que gerou a proposta */
  confianca: number;
  /** por que a quebra atual é problemática, em uma frase */
  diagnostico: string;
}

export interface MotorSegmentacao {
  readonly nome: string;
  readonly disponivel: boolean;
  /**
   * Avalia a quebra atual entre `linhas` e, se ela violar a integridade de um
   * sintagma, propõe alternativa. Retorna null quando a quebra é aceitável ou
   * quando não há alternativa melhor.
   */
  avaliarQuebra(linhas: string[], maxCaracteresPorLinha: number): PropostaQuebra | null;
}
