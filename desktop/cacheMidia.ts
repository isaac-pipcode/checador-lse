import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Cache em disco das análises de mídia (hoje: o envelope de áudio que alimenta
 * o mapa temporal, a forma de onda e a sincronia de Libras). Reimportar o mesmo
 * arquivo, reabrir o projeto ou trocar de projeto não decodifica o áudio de novo.
 *
 * A chave é o arquivo como está no disco: caminho absoluto, tamanho e data de
 * modificação, mais os parâmetros da análise e a versão do formato. Arquivo
 * editado ou substituído gera outra chave; nada velho é servido por engano.
 *
 * Formato de cada entrada: 4 bytes "OUVE", uint32 versão, float64 duração (ms),
 * float32[] envelope (dB), tudo little-endian. Sem dependências de Electron:
 * quem chama passa a pasta (userData/cache/analises).
 */

export const VERSAO_CACHE = 1;
const MAGICO = 0x4556554f; // "OUVE" em little-endian
const CABECALHO = 16;

export function chaveDeAnalise(caminho: string, parametros: object): string | null {
  let st;
  try {
    st = statSync(caminho);
  } catch {
    return null;
  }
  return createHash('sha256')
    .update(JSON.stringify([VERSAO_CACHE, resolve(caminho), st.size, Math.round(st.mtimeMs), parametros]))
    .digest('hex')
    .slice(0, 40);
}

export function serializarEnvelope(envelopeDb: Float32Array, duracaoMs: number): Buffer {
  const b = Buffer.alloc(CABECALHO + envelopeDb.byteLength);
  b.writeUInt32LE(MAGICO, 0);
  b.writeUInt32LE(VERSAO_CACHE, 4);
  b.writeDoubleLE(duracaoMs, 8);
  Buffer.from(envelopeDb.buffer, envelopeDb.byteOffset, envelopeDb.byteLength).copy(b, CABECALHO);
  return b;
}

export function lerEnvelopeSerializado(b: Buffer): { envelopeDb: Float32Array; duracaoMs: number } | null {
  if (b.length < CABECALHO || (b.length - CABECALHO) % 4 !== 0) return null;
  if (b.readUInt32LE(0) !== MAGICO || b.readUInt32LE(4) !== VERSAO_CACHE) return null;
  const duracaoMs = b.readDoubleLE(8);
  // cópia alinhada: o Buffer lido pode não começar em múltiplo de 4
  const envelopeDb = new Float32Array(
    b.subarray(CABECALHO).buffer.slice(b.byteOffset + CABECALHO, b.byteOffset + b.length),
  );
  return { envelopeDb, duracaoMs };
}

export function lerDoCache(pasta: string, chave: string) {
  const arq = join(pasta, `${chave}.env`);
  if (!existsSync(arq)) return null;
  try {
    const r = lerEnvelopeSerializado(readFileSync(arq));
    if (!r) return null;
    const agora = new Date();
    utimesSync(arq, agora, agora); // uso recente: é o último a ser podado
    return r;
  } catch {
    return null;
  }
}

/** Grava e poda: acima do limite, saem as entradas usadas há mais tempo. */
export function gravarNoCache(
  pasta: string,
  chave: string,
  envelopeDb: Float32Array,
  duracaoMs: number,
  limiteBytes = LIMITE_PADRAO,
) {
  try {
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, `${chave}.env`), serializarEnvelope(envelopeDb, duracaoMs));
    podar(pasta, limiteBytes);
  } catch {
    /* cache é otimização: falha ao gravar não interrompe a análise */
  }
}

/** 500 MB: um envelope de 10 ms ocupa ~1,4 MB por hora de obra. */
export const LIMITE_PADRAO = 500 * 1024 * 1024;

function entradas(pasta: string) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((n) => n.endsWith('.env'))
    .map((n) => {
      const st = statSync(join(pasta, n));
      return { arq: join(pasta, n), bytes: st.size, usado: st.mtimeMs };
    });
}

export function podar(pasta: string, limiteBytes: number) {
  const lista = entradas(pasta).sort((a, b) => a.usado - b.usado);
  let total = lista.reduce((s, e) => s + e.bytes, 0);
  for (const e of lista) {
    if (total <= limiteBytes) break;
    rmSync(e.arq, { force: true });
    total -= e.bytes;
  }
}

export function tamanhoDoCache(pasta: string): { bytes: number; entradas: number } {
  const lista = entradas(pasta);
  return { bytes: lista.reduce((s, e) => s + e.bytes, 0), entradas: lista.length };
}

export function limparCache(pasta: string) {
  for (const e of entradas(pasta)) rmSync(e.arq, { force: true });
}
