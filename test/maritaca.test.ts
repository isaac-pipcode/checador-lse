import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cue } from '../src/model/types';
import {
  ClienteLlm,
  corpoMaritaca,
  descreverErroLlm,
  ErroProvedor,
  lerRespostaMaritaca,
  URL_MARITACA,
} from '../src/llm/cliente';
import { configDoPerfil, PERFIL_PADRAO } from '../src/model/perfis';
const DEFAULT_CONFIG = configDoPerfil(PERFIL_PADRAO.perfilId);

const cue: Cue = {
  index: 1,
  startMs: 0,
  endMs: 1500,
  lines: ['Eu não sei se vou conseguir chegar', 'a tempo para a reunião de amanhã cedo'],
  raw: '',
} as Cue;
const proposta = {
  propostaLinhas: ['Não sei se chego', 'a tempo à reunião.'],
  estrategia: 'condensacao',
  justificativa: 'Condensa.',
  confianca: 0.8,
};

afterEach(() => vi.unstubAllGlobals());

describe('Maritaca (Responses API)', () => {
  it('corpo: modelo S5-br-sp, saída estruturada só com palavras-chave aceitas', () => {
    const c = corpoMaritaca('S5-br-sp', 'x');
    expect(c.model).toBe('S5-br-sp');
    expect(c.text.format.type).toBe('json_schema');
    const json = JSON.stringify(c.text.format.schema);
    // a Maritaca recusa estas palavras-chave (docs.maritaca.ai/pt/structured-outputs)
    for (const k of [
      'minLength',
      'maxLength',
      'pattern',
      'format',
      'minimum',
      'maximum',
      'minItems',
      'maxItems',
      'allOf',
      'additionalProperties',
    ])
      expect(json).not.toContain(`"${k}"`);
    expect(c.instructions).toContain('JSON');
  });

  it('lê output_text, o item "message" e JSON cercado de crases; recusa vira erro', () => {
    expect(lerRespostaMaritaca({ output_text: JSON.stringify(proposta) }).confianca).toBe(0.8);
    const msg = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '```json\n' + JSON.stringify(proposta) + '\n```' }] },
      ],
    };
    expect(lerRespostaMaritaca(msg).propostaLinhas).toHaveLength(2);
    expect(() =>
      lerRespostaMaritaca({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'não' }] }] }),
    ).toThrow(/recusou/);
    expect(() => lerRespostaMaritaca({ output: [] })).toThrow();
  });

  it('chama o endpoint com Bearer e devolve a proposta normalizada', async () => {
    const f = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ output_text: JSON.stringify({ ...proposta, confianca: 7, estrategia: '???' }) }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', f);
    const r = await new ClienteLlm({ provedor: 'maritaca', apiKey: 'k', modelo: 'S5-br-sp' }).reduzir(
      cue,
      DEFAULT_CONFIG,
    );
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_MARITACA);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body)).model).toBe('S5-br-sp');
    expect(r.confianca).toBe(1);
    expect(r.estrategia).toBe('condensacao');
  });

  it('erros HTTP viram mensagens em português', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'Invalid API key' }), { status: 401 })),
    );
    const e = await new ClienteLlm({ provedor: 'maritaca', apiKey: 'x' }).reduzir(cue, DEFAULT_CONFIG).catch((x) => x);
    expect(e).toBeInstanceOf(ErroProvedor);
    expect(descreverErroLlm(e)).toBe('Chave de API inválida ou sem permissão.');
    expect(descreverErroLlm(new ErroProvedor(0, ''))).toMatch(/conectar/);
    expect(descreverErroLlm(new ErroProvedor(429, ''))).toMatch(/Limite/);
  });
});
