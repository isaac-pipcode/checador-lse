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
  /**
   * Roteiro liberado para gravação. Só blocos aprovados aparecem no modo de
   * gravação; qualquer mudança no texto revoga a aprovação. Ausente em
   * projetos antigos = não aprovado.
   */
  aprovado?: boolean;
}

/** Aparência do roteiro no teleprompter (preferência da cabine, salva no projeto). */
export interface LegendaPrompter {
  cor: 'branco' | 'amarelo';
  /** multiplicador do tamanho-base da fonte (0,6 a 2,0) */
  escala: number;
  /** altura máxima da caixa, como fração da altura da imagem (0,2 a 0,5) */
  alturaMaxima: number;
}

export const LEGENDA_PROMPTER_PADRAO: LegendaPrompter = { cor: 'branco', escala: 1, alturaMaxima: 0.33 };
export const LIMITES_LEGENDA = { escala: [0.6, 2] as const, alturaMaxima: [0.2, 0.5] as const };

export function ajustarLegenda(atual: LegendaPrompter, mudanca: Partial<LegendaPrompter>): LegendaPrompter {
  const limitar = (v: number, [a, b]: readonly [number, number]) => Math.round(Math.min(b, Math.max(a, v)) * 100) / 100;
  const n = { ...atual, ...mudanca };
  return {
    cor: n.cor === 'amarelo' ? 'amarelo' : 'branco',
    escala: limitar(n.escala, LIMITES_LEGENDA.escala),
    alturaMaxima: limitar(n.alturaMaxima, LIMITES_LEGENDA.alturaMaxima),
  };
}

export interface ParametrosAD {
  /** velocidade de leitura usada na estimativa, até haver takes para calibrar */
  palavrasPorMinuto: number;
  /** atenuação do áudio original sob a AD (dB, negativo) */
  duckingDb: number;
  ataqueMs: number;
  liberacaoMs: number;
  /** quanto tocar antes do bloco ao gravar: tempo para o locutor se preparar */
  prerollMs: number;
  /** quanto continuar gravando depois do fim do bloco, para não cortar a frase */
  posrollMs: number;
  /** limiar para aparar silêncio dos takes, em dB abaixo do pico do take */
  aparoDb: number;
  /** compensação da latência de captura (ms, somada à posição do take) */
  latenciaMs: number;
  legenda: LegendaPrompter;
}

export const PARAMETROS_AD_PADRAO: ParametrosAD = {
  // Estimativa inicial, a calibrar pelos takes do próprio locutor.
  palavrasPorMinuto: 160,
  duckingDb: -10,
  ataqueMs: 250,
  liberacaoMs: 500,
  prerollMs: 3000,
  posrollMs: 2000,
  aparoDb: 30,
  latenciaMs: 0,
  legenda: LEGENDA_PROMPTER_PADRAO,
};

export function takeAtivo(b: BlocoAD): Take | null {
  return b.takes.find((t) => t.id === b.takeAtivoId) ?? null;
}

export function duracaoUtil(t: Take): number {
  return Math.max(0, t.trimFimMs - t.trimInicioMs);
}
