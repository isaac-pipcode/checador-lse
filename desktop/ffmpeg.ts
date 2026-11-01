import { spawn } from 'node:child_process';

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fpsDeFracao, type InfoVideo } from '../src/midia/avaliacao';

/**
 * Onde procurar o ffmpeg: variável de ambiente (OUVER_FFMPEG; CHECADOR_FFMPEG,
 * nome antigo, ainda vale), depois os locais usuais de instalação e, por fim,
 * o PATH. Os locais usuais importam no app instalado: no macOS, um app aberto
 * pelo Finder não herda o PATH do terminal, e o ffmpeg do Homebrew ficaria
 * invisível.
 */
export function resolverFfmpeg(
  env: NodeJS.ProcessEnv = process.env,
  plataforma: NodeJS.Platform = process.platform,
  existe: (c: string) => boolean = existsSync,
): { ffmpeg: string; ffprobe: string } {
  const exe = plataforma === 'win32' ? '.exe' : '';
  const indicado = env.OUVER_FFMPEG || env.CHECADOR_FFMPEG;
  const probeIndicado = env.OUVER_FFPROBE || env.CHECADOR_FFPROBE;
  const vizinho = (f: string) => join(dirname(f), `ffprobe${exe}`);
  if (indicado) return { ffmpeg: indicado, ffprobe: probeIndicado || vizinho(indicado) };
  const pastas =
    plataforma === 'darwin'
      ? ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin']
      : plataforma === 'win32'
        ? [
            'C:\\ffmpeg\\bin',
            join(env.ProgramFiles ?? 'C:\\Program Files', 'ffmpeg', 'bin'),
            join(env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Links'),
          ]
        : ['/usr/bin', '/usr/local/bin', '/snap/bin'];
  for (const p of pastas) {
    const f = join(p, `ffmpeg${exe}`);
    if (existe(f)) return { ffmpeg: f, ffprobe: probeIndicado || vizinho(f) };
  }
  return { ffmpeg: `ffmpeg${exe}`, ffprobe: probeIndicado || `ffprobe${exe}` };
}

const resolvido = resolverFfmpeg();
export const FFMPEG = resolvido.ffmpeg;
export const FFPROBE = resolvido.ffprobe;

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

export interface InfoMidia {
  duracaoMs: number;
  largura: number;
  altura: number;
  codecVideo: string | null;
  temAudio: boolean;
}

export function sondar(arquivo: string): Promise<InfoMidia> {
  return new Promise((ok, falha) => {
    const p = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', arquivo]);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', falha);
    p.on('close', (c) => {
      if (c !== 0) return falha(new Error(`ffprobe: ${err.trim().split('\n').pop()}`));
      const j = JSON.parse(out) as {
        format?: { duration?: string };
        streams?: Array<{ codec_type: string; codec_name?: string; width?: number; height?: number }>;
      };
      const v = j.streams?.find((s) => s.codec_type === 'video');
      ok({
        duracaoMs: Math.round(Number(j.format?.duration ?? 0) * 1000),
        largura: v?.width ?? 0,
        altura: v?.height ?? 0,
        codecVideo: v?.codec_name ?? null,
        temAudio: !!j.streams?.some((s) => s.codec_type === 'audio'),
      });
    });
  });
}

/** Executa o ffmpeg informando o progresso pelo campo time= do stderr. */
export function executarComProgresso(
  args: string[],
  duracaoMs: number,
  aoProgredir: (fracao: number) => void,
  sinal?: AbortSignal,
): Promise<{ codigo: number; stderr: string }> {
  return new Promise((ok, falha) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-nostdin', ...args]);
    sinal?.addEventListener('abort', () => p.kill('SIGKILL'), { once: true });
    let stderr = '';
    p.stderr.on('data', (d: Buffer) => {
      const txt = d.toString();
      stderr = (stderr + txt).slice(-20000);
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/g;
      let ult: RegExpExecArray | null = null;
      for (let x = m.exec(txt); x; x = m.exec(txt)) ult = x;
      if (ult && duracaoMs > 0) {
        const ms = (Number(ult[1]) * 3600 + Number(ult[2]) * 60 + Number(ult[3])) * 1000;
        aoProgredir(Math.min(1, ms / duracaoMs));
      }
    });
    p.on('error', falha);
    p.on('close', (c) => ok({ codigo: c ?? -1, stderr }));
  });
}

/** Sondagem para a avaliação de proxy (codec, perfil, bits, cadência, taxa). */
export function sondarVideo(arquivo: string): Promise<InfoVideo> {
  return new Promise((ok, falha) => {
    const p = spawn(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration,bit_rate:stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,channels',
      '-of', 'json', arquivo,
    ]);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', falha);
    p.on('close', (c) => {
      if (c !== 0) return falha(new Error(`ffprobe: ${err.trim().split('\n').pop()}`));
      const j = JSON.parse(out) as {
        format?: { duration?: string; bit_rate?: string };
        streams?: Array<{ codec_type: string; codec_name?: string; profile?: string; pix_fmt?: string; width?: number; height?: number; r_frame_rate?: string; channels?: number }>;
      };
      const v = j.streams?.find((s) => s.codec_type === 'video');
      const a = j.streams?.find((s) => s.codec_type === 'audio');
      ok({
        codec: v?.codec_name ?? null,
        perfil: v?.profile ?? null,
        pixFmt: v?.pix_fmt ?? null,
        largura: v?.width ?? 0,
        altura: v?.height ?? 0,
        fps: fpsDeFracao(v?.r_frame_rate),
        bitrate: j.format?.bit_rate ? Number(j.format.bit_rate) : null,
        duracaoMs: Math.round(Number(j.format?.duration ?? 0) * 1000),
        temAudio: !!a,
        canaisAudio: a?.channels ?? null,
      });
    });
  });
}
