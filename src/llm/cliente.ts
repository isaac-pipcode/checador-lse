import Anthropic from '@anthropic-ai/sdk';
import type { Cue, RuleConfig } from '../model/types';
import { caracteresDaLegenda, duracaoMs } from '../core/texto';

/**
 * Cliente LLM opcional — DESLIGADO POR PADRÃO.
 *
 * Ativá-lo significa enviar o texto das legendas selecionadas ao provedor
 * (Anthropic). A interface avisa disso antes de qualquer chamada. A chave de
 * API fica apenas em memória, nunca em localStorage nem em disco.
 *
 * Toda saída do modelo entra no fluxo como Suggestion com `confidence` e passa
 * pela mesma aprovação humana das demais. Sem exceção.
 */

export const MODELOS = [
  { id: 'claude-sonnet-5', rotulo: 'Claude Sonnet 5' },
  { id: 'claude-opus-5', rotulo: 'Claude Opus 5' },
  { id: 'claude-haiku-4-5', rotulo: 'Claude Haiku 4.5' },
] as const;

export const MODELO_PADRAO = 'claude-sonnet-5';

export type Estrategia = 'condensacao' | 'omissao' | 'resegmentacao';

export interface PropostaLlm {
  propostaLinhas: string[];
  estrategia: Estrategia;
  justificativa: string;
  confianca: number;
}

const SISTEMA = `Você revisa legendas para surdos e ensurdecidos (LSE) em português brasileiro, segundo o Guia para Produções Audiovisuais Acessíveis (MinC/SAv, 2016).

Regras invioláveis:
- Não altere o sentido do enunciado. Não invente informação que não esteja no texto original.
- Não traduza, não corrija o registro de fala e não "melhore" o estilo do autor.
- Respeite os limites de caracteres por linha e de número de linhas informados.
- Preserve a marcação existente: colchetes de identificação de falante e efeito sonoro, itálico <i>, traço de diálogo colado à palavra.
- Ao resegmentar, quebre no mais alto nível sintático: nunca separe determinante de núcleo, preposição de complemento, auxiliar de principal, nem conjunção da oração que ela introduz.
- Se não houver solução que respeite tudo isso sem perda de sentido, devolva o texto original com confianca baixa e explique o impasse na justificativa.

Responda exclusivamente pela ferramenta, sem preâmbulo.`;

const FERRAMENTA: Anthropic.Tool = {
  name: 'propor_legenda',
  description: 'Devolve a proposta de legenda revisada.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      propostaLinhas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Linhas da legenda proposta, sem quebras de linha internas.',
      },
      estrategia: { type: 'string', enum: ['condensacao', 'omissao', 'resegmentacao'] },
      justificativa: { type: 'string', description: 'Uma frase explicando a mudança.' },
      confianca: {
        type: 'number',
        description: 'Confiança de 0 a 1 em que a proposta preserva o sentido e respeita os limites.',
      },
    },
    required: ['propostaLinhas', 'estrategia', 'justificativa', 'confianca'],
    additionalProperties: false,
  },
};

export interface OpcoesLlm {
  apiKey: string;
  modelo?: string;
}

export class ClienteLlm {
  private client: Anthropic;
  readonly modelo: string;

  constructor(opcoes: OpcoesLlm) {
    this.modelo = opcoes.modelo ?? MODELO_PADRAO;
    this.client = new Anthropic({
      apiKey: opcoes.apiKey,
      // Uso client-side deliberado: o app não tem backend. A chave é do usuário
      // e vive apenas na memória da aba.
      dangerouslyAllowBrowser: true,
    });
  }

  private async pedir(prompt: string): Promise<PropostaLlm> {
    const resposta = await this.client.messages.create({
      model: this.modelo,
      max_tokens: 1024,
      system: SISTEMA,
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: 'propor_legenda' },
      messages: [{ role: 'user', content: prompt }],
    });

    if (resposta.stop_reason === 'refusal') {
      throw new Error('O modelo recusou a solicitação.');
    }
    const bloco = resposta.content.find((b) => b.type === 'tool_use');
    if (!bloco || bloco.type !== 'tool_use') {
      throw new Error('O modelo não devolveu a estrutura esperada.');
    }
    const dados = bloco.input as Partial<PropostaLlm>;
    if (!Array.isArray(dados.propostaLinhas) || dados.propostaLinhas.length === 0) {
      throw new Error('Proposta vazia.');
    }
    return {
      propostaLinhas: dados.propostaLinhas.map((l) => String(l)),
      estrategia: (dados.estrategia ?? 'condensacao') as Estrategia,
      justificativa: String(dados.justificativa ?? ''),
      confianca: Math.max(0, Math.min(1, Number(dados.confianca ?? 0.5))),
    };
  }

  /** L2 — redução textual para trazer a velocidade ao alvo. */
  async reduzir(cue: Cue, config: RuleConfig): Promise<PropostaLlm> {
    const segundos = duracaoMs(cue) / 1000;
    const chars = caracteresDaLegenda(cue, config);
    const alvoChars = Math.floor(config.cpsAlvo * segundos);
    const prompt = [
      'Reduza a legenda abaixo para que caiba na velocidade de leitura alvo.',
      '',
      `Legenda atual (${cue.lines.length} linha(s), ${chars} caracteres):`,
      cue.lines.map((l) => `«${l}»`).join('\n'),
      '',
      `Duração em tela: ${segundos.toFixed(2)} s`,
      `Velocidade atual: ${(chars / segundos).toFixed(1)} caracteres por segundo`,
      `Velocidade alvo: ${config.cpsAlvo} cps — no máximo ${alvoChars} caracteres no total`,
      `Limite por linha: ${config.maxCaracteresPorLinha} caracteres · máximo de ${config.maxLinhas} linhas`,
      '',
      'Prefira condensação (reformular mantendo o sentido) a omissão. Só omita o que for redundante com a imagem ou com a fala anterior.',
    ].join('\n');
    return this.pedir(prompt);
  }

  /** L1 — resegmentação quando não há módulo NLP local disponível. */
  async ressegmentar(cue: Cue, config: RuleConfig): Promise<PropostaLlm> {
    const prompt = [
      'Reposicione a quebra de linha da legenda abaixo para o mais alto nível sintático, sem alterar uma palavra sequer do texto.',
      '',
      'Legenda atual:',
      cue.lines.map((l) => `«${l}»`).join('\n'),
      '',
      `Limite por linha: ${config.maxCaracteresPorLinha} caracteres · máximo de ${config.maxLinhas} linhas`,
      '',
      'A sequência de palavras deve permanecer idêntica; muda apenas onde a linha quebra. Prefira linhas de comprimento próximo quando houver empate entre pontos de quebra do mesmo nível.',
    ].join('\n');
    return this.pedir(prompt);
  }
}

export function descreverErroLlm(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Chave de API inválida ou sem permissão.';
  if (e instanceof Anthropic.RateLimitError) return 'Limite de requisições atingido; tente de novo em instantes.';
  if (e instanceof Anthropic.BadRequestError) return `Requisição rejeitada: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError)
    return 'Não foi possível conectar ao provedor. Verifique a rede — o restante do checador funciona offline.';
  if (e instanceof Anthropic.APIError) return `Erro ${e.status} do provedor: ${e.message}`;
  return e instanceof Error ? e.message : 'Falha desconhecida ao consultar o modelo.';
}
