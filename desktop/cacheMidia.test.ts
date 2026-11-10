import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  chaveDeAnalise,
  gravarNoCache,
  lerDoCache,
  lerEnvelopeSerializado,
  limparCache,
  serializarEnvelope,
  tamanhoDoCache,
} from './cacheMidia';

const pastas: string[] = [];
const temp = () => {
  const p = mkdtempSync(join(tmpdir(), 'ouver-cache-'));
  pastas.push(p);
  return p;
};
afterEach(() => pastas.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })));

describe('cache das análises', () => {
  it('ida e volta do formato, inclusive de Buffer desalinhado', () => {
    const env = new Float32Array([-60, -12.5, 0, -99.25]);
    const b = serializarEnvelope(env, 1234.5);
    const desalinhado = Buffer.concat([Buffer.from([7]), b]).subarray(1);
    const r = lerEnvelopeSerializado(desalinhado)!;
    expect(r.duracaoMs).toBe(1234.5);
    expect([...r.envelopeDb]).toEqual([...env]);
    expect(lerEnvelopeSerializado(Buffer.from('lixo qualquer!!!!'))).toBeNull();
  });

  it('a chave muda quando o arquivo muda (tamanho ou data) ou os parâmetros mudam', () => {
    const d = temp();
    const arq = join(d, 'obra.mp4');
    writeFileSync(arq, 'abc');
    const k1 = chaveDeAnalise(arq, { janelaMs: 10 });
    expect(k1).toBe(chaveDeAnalise(arq, { janelaMs: 10 }));
    expect(chaveDeAnalise(arq, { janelaMs: 20 })).not.toBe(k1);
    writeFileSync(arq, 'abcd');
    expect(chaveDeAnalise(arq, { janelaMs: 10 })).not.toBe(k1);
    const k2 = chaveDeAnalise(arq, { janelaMs: 10 });
    utimesSync(arq, new Date(2020, 0, 1), new Date(2020, 0, 1));
    expect(chaveDeAnalise(arq, { janelaMs: 10 })).not.toBe(k2);
    expect(chaveDeAnalise(join(d, 'nao-existe.mp4'), {})).toBeNull();
  });

  it('grava, lê, poda as menos usadas acima do limite e limpa', () => {
    const d = temp();
    const env = new Float32Array(250); // 1000 bytes + 16 de cabeçalho
    gravarNoCache(d, 'a', env, 1, 10_000);
    gravarNoCache(d, 'b', env, 2, 10_000);
    expect(lerDoCache(d, 'a')?.duracaoMs).toBe(1);
    // "a" foi lida por último; com limite para duas entradas, a terceira tira "b"
    utimesSync(join(d, 'b.env'), new Date(2000, 0, 1), new Date(2000, 0, 1));
    gravarNoCache(d, 'c', env, 3, 2100);
    expect(lerDoCache(d, 'b')).toBeNull();
    expect(lerDoCache(d, 'a')).not.toBeNull();
    expect(tamanhoDoCache(d).entradas).toBe(2);
    limparCache(d);
    expect(tamanhoDoCache(d)).toEqual({ bytes: 0, entradas: 0 });
  });
});
