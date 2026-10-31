import { spawn } from 'node:child_process';

/** Ordem de busca: variável de ambiente, depois o PATH. */
export const FFMPEG = process.env.CHECADOR_FFMPEG || 'ffmpeg';

export function versaoFfmpeg(): Promise<string | null> {
  return new Promise((ok) => {
    try {
      const p = spawn(FFMPEG, ['-hide_banner', '-version']);
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('error', () => ok(null));
      p.on('close', (c) => ok(c === 0 ? (out.split('\n')[0] ?? '').trim() : null));
    } catch {
      ok(null);
    }
  });
}

/**
 * Decodifica para PCM float32 intercalado, entregando blocos ao consumidor
 * (streaming: a obra inteira nunca fica em memória).
 */
export function decodificarStream(
  entrada: string,
  canais: number,
  taxa: number,
  filtros: string | null,
  aoReceber: (amostras: Float32Array) => void,
  aoDuracao?: (ms: number) => void,
): Promise<{ bytes: number; stderr: string }> {
  return new Promise((ok, falha) => {
    const args = ['-hide_banner', '-nostdin', '-i', entrada, '-vn', '-ac', String(canais), '-ar', String(taxa)];
    if (filtros) args.push('-af', filtros);
    args.push('-f', 'f32le', 'pipe:1');
    const p = spawn(FFMPEG, args);
    let resto: Buffer = Buffer.alloc(0);
    let bytes = 0;
    let stderr = '';
    const quadro = 4 * canais;
    p.stdout.on('data', (d: Buffer) => {
      const buf = resto.length ? Buffer.concat([resto, d]) : d;
      const util = buf.length - (buf.length % quadro);
      if (util > 0) {
        // cópia alinhada: o Buffer do Node pode não estar em offset múltiplo de 4
        const copia = new Float32Array(util / 4);
        new Uint8Array(copia.buffer).set(buf.subarray(0, util));
        aoReceber(copia);
        bytes += util;
      }
      resto = buf.subarray(util);
    });
    p.stderr.on('data', (d) => {
      stderr += d;
      if (aoDuracao) {
        const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
        if (m) {
          aoDuracao((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
          aoDuracao = undefined;
        }
      }
    });
    p.on('error', falha);
    p.on('close', (c) => {
      const semAudio = /does not contain any stream|matches no streams/i.test(stderr);
      if (c !== 0 && bytes === 0 && !semAudio) {
        return falha(new Error(`ffmpeg terminou com código ${c}: ${stderr.trim().split('\n').slice(-3).join(' ')}`));
      }
      ok({ bytes, stderr });
    });
  });
}

export async function decodificarInteiro(entrada: string, canais: number, taxa: number): Promise<Float32Array> {
  const partes: Float32Array[] = [];
  let n = 0;
  await decodificarStream(entrada, canais, taxa, null, (a) => {
    partes.push(a);
    n += a.length;
  });
  const out = new Float32Array(n);
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

export function executar(args: string[]): Promise<{ codigo: number; stderr: string }> {
  return new Promise((ok, falha) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-nostdin', ...args]);
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d));
    p.on('error', falha);
    p.on('close', (c) => ok({ codigo: c ?? -1, stderr }));
  });
}

/** Loudness integrada (EBU R128) e pico verdadeiro, via filtro ebur128. */
export async function medirLoudness(arquivo: string) {
  const { stderr } = await executar(['-nostats', '-i', arquivo, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  const resumo = stderr.slice(stderr.lastIndexOf('Summary:'));
  const i = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(resumo);
  const pk = /True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(resumo);
  const num = (s: string | undefined) => (s && s !== '-inf' ? Number(s) : null);
  return { integradoLufs: num(i?.[1]), picoVerdadeiroDbtp: num(pk?.[1]) };
}
