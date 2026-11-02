import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { executarComProgresso, sondarVideo } from './ffmpeg';

/** Altura máxima do proxy. 720p basta para revisar legenda, roteiro e Libras. */
export const ALTURA_PROXY = 720;

/**
 * Nome estável: depende do caminho, do tamanho e da data do original — trocar o
 * arquivo de origem (mesmo nome, outro conteúdo) gera outro proxy.
 */
export function nomeDoProxy(original: string): string {
  const st = statSync(original);
  const h = createHash('sha1').update(`${original}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 10);
  return `${basename(original, extname(original))}.${h}.proxy.mp4`;
}

/**
 * Argumentos do ffmpeg para o proxy: H.264 8 bits 4:2:0 (reproduzível em
 * qualquer máquina), no máximo 720p, quadro-chave a cada 12 quadros (busca
 * quadro a quadro instantânea), AAC estéreo, `faststart`. Timestamps
 * preservados: o proxy tem a mesma linha do tempo do original.
 */
export function argsDoProxy(original: string, destino: string): string[] {
  return [
    '-y', '-i', original,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `scale=-2:'min(${ALTURA_PROXY},ih)':flags=bicubic,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '160k', '-ac', '2',
    '-movflags', '+faststart',
    '-f', 'mp4', destino,
  ];
}

/** Gera (ou reaproveita) o proxy na pasta indicada. Escreve em .parcial e renomeia ao fim. */
export async function gerarProxy(
  original: string,
  pasta: string,
  aoProgredir: (fracao: number) => void,
  sinal?: AbortSignal,
): Promise<{ caminho: string; reaproveitado: boolean }> {
  mkdirSync(pasta, { recursive: true });
  const destino = join(pasta, nomeDoProxy(original));
  if (existsSync(destino)) return { caminho: destino, reaproveitado: true };
  const parcial = `${destino}.parcial`;
  const info = await sondarVideo(original);
  const r = await executarComProgresso(argsDoProxy(original, parcial), info.duracaoMs, aoProgredir, sinal);
  if (sinal?.aborted) {
    rmSync(parcial, { force: true });
    throw new DOMException('cancelado', 'AbortError');
  }
  if (r.codigo !== 0) {
    rmSync(parcial, { force: true });
    throw new Error(`ffmpeg: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
  }
  renameSync(parcial, destino);
  return { caminho: destino, reaproveitado: false };
}
