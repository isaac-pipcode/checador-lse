import Anthropic from '@anthropic-ai/sdk';
import type { Cue, RuleConfig } from '../model/types';
import { caracteresDaLegenda, duracaoMs } from '../core/texto';
import { ponte } from '../desktop/ponte';

/**
 * Cliente LLM opcional — DESLIGADO POR PADRÃO.
 *
 * Ativá-lo significa enviar o texto das legendas selecionadas ao provedor
 * escolhido (Maritaca ou Anthropic). A interface avisa disso antes de qualquer
 * chamada. A chave de API fica apenas em memória, nunca em localStorage nem em
 * disco; trocar de provedor a descarta (uma chave nunca vai ao provedor errado).
 *
 * Toda saída do modelo entra no fluxo como Suggestion com `confidence` e passa
 * pela mesma aprovação humana das demais. Sem exceção.
 */

export type Provedor = 'maritaca' | 'anthropic';

export const PROVEDORES: Record<
  Provedor,
  { rotulo: string; empresa: string; modelos: ReadonlyArray<{ id: string; rotulo: string }>; padrao: string }
> = {
  maritaca: {
    rotulo: 'Maritaca (Sabiá)',
    empresa: 'Maritaca AI',
    // ids conforme docs.maritaca.ai/pt/modelos; "-br-sp": inferência em São Paulo
    modelos: [
      { id: 'S5-br-sp', rotulo: 'S5 · processado no Brasil (São Paulo)' },
      { id: 'S5', rotulo: 'S5' },
      { id: 'sabia-4-br-sp', rotulo: 'Sabiá 4 · processado no Brasil (São Paulo)' },
    ],
    padrao: 'S5-br-sp',
  },
  anthropic: {
    rotulo: 'Anthropic (Claude)',
    empresa: 'Anthropic',
    modelos: [
      { id: 'claude-sonnet-5', rotulo: 'Claude Sonnet 5' },
      { id: 'claude-opus-5', rotulo: 'Claude Opus 5' },
      { id: 'claude-haiku-4-5', rotulo: 'Claude Haiku 4.5' },
    ],
    padrao: 'claude-sonnet-5',
  },
};

export const PROVEDOR_PADRAO: Provedor = 'maritaca';
export const MODELO_PADRAO = PROVEDORES[PROVEDOR_PADRAO].padrao;

/** Endpoint da Responses API da Maritaca (compatível com a da OpenAI). */
export const URL_MARITACA = 'https://chat.maritaca.ai/api/responses';

/** Erro HTTP de um provedor sem SDK próprio (Maritaca). */
export class ErroProvedor extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

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
  provedor?: Provedor;
  modelo?: string;
}

/** Corpo da Responses API (Maritaca) com saída estruturada pelo mesmo esquema da ferramenta. */
export function corpoMaritaca(modelo: string, prompt: string) {
  // a Maritaca não documenta additionalProperties nem `strict` no esquema: ficam de fora
  const { additionalProperties: _a, ...esquema } = FERRAMENTA.input_schema as Record<string, unknown>;
  return {
    model: modelo,
    instructions: SISTEMA.replace(
      'Responda exclusivamente pela ferramenta, sem preâmbulo.',
      'Responda exclusivamente com o JSON pedido, sem preâmbulo.',
    ),
    input: prompt,
    temperature: 0.2,
    text: { format: { type: 'json_schema', name: FERRAMENTA.name, schema: esquema } },
  };
}

/** Extrai o JSON da resposta da Responses API (item "message", conteúdo "output_text"). */
export function lerRespostaMaritaca(dados: unknown): Partial<PropostaLlm> {
  const d = dados as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  };
  let texto = typeof d.output_text === 'string' ? d.output_text : '';
  for (const item of d.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === 'refusal' || c.refusal) throw new Error('O modelo recusou a solicitação.');
      if (!texto && typeof c.text === 'string') texto = c.text;
    }
  }
  if (!texto) throw new Error('O modelo não devolveu a estrutura esperada.');
  // tolera cerca de código (```json … ```) em volta do objeto
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  try {
    return JSON.parse(inicio >= 0 && fim > inicio ? texto.slice(inicio, fim + 1) : texto) as Partial<PropostaLlm>;
  } catch {
    throw new Error('O modelo não devolveu um JSON válido.');
  }
}

export class ClienteLlm {
  private client: Anthropic | null = null;
  readonly provedor: Provedor;
  readonly modelo: string;
  private readonly apiKey: string;

  constructor(opcoes: OpcoesLlm) {
    this.provedor = opcoes.provedor ?? PROVEDOR_PADRAO;
    this.modelo = opcoes.modelo ?? PROVEDORES[this.provedor].padrao;
    this.apiKey = opcoes.apiKey;
    if (this.provedor === 'anthropic')
      this.client = new Anthropic({
        apiKey: opcoes.apiKey,
        // Uso client-side deliberado: o app não tem backend. A chave é do usuário
        // e vive apenas na memória da aba.
        dangerouslyAllowBrowser: true,
      });
  }

  private async pedirMaritaca(prompt: string): Promise<Partial<PropostaLlm>> {
    const corpo = corpoMaritaca(this.modelo, prompt);
    const desktop = ponte();
    let status: number;
    let texto: string;
    if (desktop?.llmMaritaca) {
      // no desktop, a chamada sai pelo processo principal (sem CORS, pelo proxy do sistema)
      ({ status, texto } = await desktop.llmMaritaca(this.apiKey, corpo));
    } else {
      let r: Response;
      try {
        r = await fetch(URL_MARITACA, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
        });
      } catch {
        throw new ErroProvedor(0, 'sem conexão');
      }
      status = r.status;
      texto = await r.text();
    }
    if (status < 200 || status >= 300) {
      let msg = texto.slice(0, 300);
      try {
        const j = JSON.parse(texto) as { detail?: unknown; error?: { message?: string }; message?: string };
        msg = String(
          j.error?.message ?? j.message ?? (typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? msg)),
        );
      } catch {
        /* corpo não é JSON */
      }
      throw new ErroProvedor(status, msg);
    }
    return lerRespostaMaritaca(JSON.parse(texto));
  }

  private async pedir(prompt: string): Promise<PropostaLlm> {
    const dados = this.provedor === 'maritaca' ? await this.pedirMaritaca(prompt) : await this.pedirAnthropic(prompt);
    if (!Array.isArray(dados.propostaLinhas) || dados.propostaLinhas.length === 0) {
      throw new Error('Proposta vazia.');
    }
    return {
      propostaLinhas: dados.propostaLinhas.map((l) => String(l)),
      estrategia: (['condensacao', 'omissao', 'resegmentacao'].includes(String(dados.estrategia))
        ? dados.estrategia
        : 'condensacao') as Estrategia,
      justificativa: String(dados.justificativa ?? ''),
      confianca: Math.max(0, Math.min(1, Number(dados.confianca ?? 0.5))),
    };
  }

  private async pedirAnthropic(prompt: string): Promise<Partial<PropostaLlm>> {
    const resposta = await this.client!.messages.create({
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
    return bloco.input as Partial<PropostaLlm>;
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
  if (e instanceof ErroProvedor) {
    if (e.status === 0)
      return 'Não foi possível conectar ao provedor. Verifique a rede — o restante do checador funciona offline.';
    if (e.status === 401 || e.status === 403) return 'Chave de API inválida ou sem permissão.';
    if (e.status === 402) return 'Sem créditos na conta do provedor.';
    if (e.status === 429) return 'Limite de requisições atingido; tente de novo em instantes.';
    if (e.status === 400 || e.status === 422) return `Requisição rejeitada: ${e.message}`;
    return `Erro ${e.status} do provedor: ${e.message}`;
  }
  if (e instanceof Anthropic.AuthenticationError) return 'Chave de API inválida ou sem permissão.';
  if (e instanceof Anthropic.RateLimitError) return 'Limite de requisições atingido; tente de novo em instantes.';
  if (e instanceof Anthropic.BadRequestError) return `Requisição rejeitada: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError)
    return 'Não foi possível conectar ao provedor. Verifique a rede — o restante do checador funciona offline.';
  if (e instanceof Anthropic.APIError) return `Erro ${e.status} do provedor: ${e.message}`;
  return e instanceof Error ? e.message : 'Falha desconhecida ao consultar o modelo.';
}
