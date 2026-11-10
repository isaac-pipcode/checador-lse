import { app, net } from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { modeloWhisper, MODELOS_WHISPER, URL_MODELOS_WHISPER } from '../src/transcricao/modelos';
import { executarComProgresso, sondar } from './ffmpeg';

/**
 * Transcrição local com o whisper.cpp (MIT). Nada sai do computador: o áudio é
 * extraído pelo ffmpeg (16 kHz, mono) e transcrito pelo `whisper-cli`, que vai
 * embutido no instalador (compilado no CI a partir do código oficial; ver
 * desktop/whisper-embutido.json e scripts/compilar-whisper.mjs).
 *
 * Os modelos (centenas de MB a 3 GB) não vão no instalador: são baixados uma
 * vez, sob demanda, do repositório oficial no Hugging Face, e conferidos por
 * SHA-256 antes de serem usados.
 */

function pastaEmbutida(): string | null {
  const recursos = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return recursos ? join(recursos, 'whisper') : null;
}

/**
 * Onde está o whisper-cli, em ordem: OUVER_WHISPER; o embutido (resources/whisper);
 * em desenvolvimento, vendor/whisper/<plataforma>-<arq>; o PATH.
 */
export function resolverWhisper(
  env: NodeJS.ProcessEnv = process.env,
  plataforma: NodeJS.Platform = process.platform,
  existe: (c: string) => boolean = existsSync,
  embutido: string | null = pastaEmbutida(),
  arq: string = process.arch,
): { caminho: string; origem: 'variavel' | 'embutido' | 'desenvolvimento' | 'path' } {
  const exe = plataforma === 'win32' ? '.exe' : '';
  if (env.OUVER_WHISPER) return { caminho: env.OUVER_WHISPER, origem: 'variavel' };
  if (embutido && existe(join(embutido, `whisper-cli${exe}`)))
    return { caminho: join(embutido, `whisper-cli${exe}`), origem: 'embutido' };
  const dev = join(process.cwd(), 'vendor', 'whisper', `${plataforma}-${arq}`, `whisper-cli${exe}`);
  if (existe(dev)) return { caminho: dev, origem: 'desenvolvimento' };
  return { caminho: `whisper-cli${exe}`, origem: 'path' };
}

export const pastaModelos = () =>
  process.env.OUVER_WHISPER_PASTA_MODELOS || join(app.getPath('userData'), 'modelos', 'whisper');
const baseModelos = () => process.env.OUVER_WHISPER_MODELOS || URL_MODELOS_WHISPER;

/** O binário responde? (o do PATH pode não existir) */
function whisperResponde(caminho: string): Promise<boolean> {
  return new Promise((ok) => {
    try {
      const p = spawn(caminho, ['-h']);
      const t = setTimeout(() => (p.kill(), ok(false)), 8000);
      p.on('error', () => (clearTimeout(t), ok(false)));
      p.on('close', () => (clearTimeout(t), ok(true)));
    } catch {
      ok(false);
    }
  });
}

export async function estadoWhisper() {
  const { caminho, origem } = resolverWhisper();
  const disponivel = await whisperResponde(caminho);
  const modelos = MODELOS_WHISPER.filter((m) => !m.teste || process.env.OUVER_WHISPER_TESTES).map((m) => {
    const arq = join(pastaModelos(), m.arquivo);
    return { id: m.id, baixado: existsSync(arq) && statSync(arq).size === m.bytes };
  });
  return { disponivel, origem, modelos };
}

/** Baixa e confere um modelo. Grava em .parcial e só renomeia se o SHA-256 bater. */
export async function baixarModelo(id: string, aoProgredir: (f: number) => void, sinal?: AbortSignal): Promise<void> {
  const m = modeloWhisper(id);
  if (!m) throw new Error('Modelo desconhecido.');
  const destino = join(pastaModelos(), m.arquivo);
  if (existsSync(destino) && statSync(destino).size === m.bytes) return;
  mkdirSync(pastaModelos(), { recursive: true });
  const parcial = `${destino}.parcial`;
  const r = await net.fetch(`${baseModelos()}/${m.arquivo}`, { signal: sinal });
  if (!r.ok || !r.body) throw new Error(`Download do modelo falhou (HTTP ${r.status}).`);
  const hash = createHash('sha256');
  let recebidos = 0;
  let ultimo = 0;
  const corpo = Readable.fromWeb(r.body as import('node:stream/web').ReadableStream);
  corpo.on('data', (c: Buffer) => {
    hash.update(c);
    recebidos += c.length;
    const f = recebidos / m.bytes;
    if (f - ultimo > 0.005) {
      ultimo = f;
      aoProgredir(Math.min(1, f));
    }
  });
  try {
    await pipeline(corpo, createWriteStream(parcial), { signal: sinal });
  } catch (e) {
    rmSync(parcial, { force: true });
    throw e;
  }
  const soma = hash.digest('hex');
  if (soma !== m.sha256 || recebidos !== m.bytes) {
    rmSync(parcial, { force: true });
    throw new Error('O modelo baixado não confere (SHA-256 diferente). Nada foi instalado; tente de novo.');
  }
  renameSync(parcial, destino);
  aoProgredir(1);
}

/**
 * Transcreve a mídia e devolve o JSON completo do whisper.cpp (-ojf), que a
 * interface converte em palavras e legendas (src/transcricao).
 */
export async function transcrever(
  caminho: string,
  modeloId: string,
  idioma: string,
  aoProgredir: (f: number, etapa: string) => void,
  sinal?: AbortSignal,
): Promise<unknown> {
  const m = modeloWhisper(modeloId);
  if (!m) throw new Error('Modelo desconhecido.');
  const arqModelo = join(pastaModelos(), m.arquivo);
  if (!existsSync(arqModelo)) throw new Error('O modelo ainda não foi baixado.');
  const { caminho: bin } = resolverWhisper();
  const dir = mkdtempSync(join(tmpdir(), 'ouver-whisper-'));
  try {
    // 1) áudio em 16 kHz mono (o que o Whisper espera); ~5% do tempo total
    const wav = join(dir, 'audio.wav');
    const { duracaoMs } = await sondar(caminho).catch(() => ({ duracaoMs: 0 }));
    const r = await executarComProgresso(
      ['-y', '-i', caminho, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav],
      duracaoMs,
      (f) => aoProgredir(f * 0.05, 'Extraindo o áudio'),
      sinal,
    );
    if (sinal?.aborted) throw new Error('Transcrição cancelada.');
    if (r.codigo !== 0) throw new Error(`ffmpeg: ${r.stderr.trim().split('\n').pop()}`);
    // até o primeiro "progress = N%", o whisper-cli carrega o modelo e lê a primeira janela de 30 s
    aoProgredir(0.05, 'Carregando o modelo');

    // 2) whisper-cli: JSON completo (tempos por token), sem tokens de não fala
    const base = join(dir, 'transcricao');
    const threads = String(Math.max(1, Math.min(8, cpus().length - 1)));
    await new Promise<void>((ok, falha) => {
      const p = spawn(bin, [
        '-m',
        arqModelo,
        '-f',
        wav,
        '-l',
        idioma,
        '-ojf',
        '-of',
        base,
        '-pp',
        '-sns',
        '-t',
        threads,
      ]);
      sinal?.addEventListener('abort', () => p.kill('SIGKILL'), { once: true });
      let erro = '';
      p.stdout.on('data', () => {}); // segmentos impressos: só drenar
      p.stderr.on('data', (d: Buffer) => {
        const txt = d.toString();
        erro = (erro + txt).slice(-8000);
        const ms = [...txt.matchAll(/progress\s*=\s*(\d+)%/g)];
        if (ms.length) aoProgredir(0.05 + (Number(ms[ms.length - 1][1]) / 100) * 0.95, 'Transcrevendo');
      });
      p.on('error', (e) => falha(new Error(`Não foi possível executar o Whisper (${bin}): ${e.message}`)));
      p.on('close', (c) => {
        if (sinal?.aborted) return falha(new Error('Transcrição cancelada.'));
        if (c !== 0)
          return falha(new Error(`Whisper terminou com erro: ${erro.trim().split('\n').slice(-2).join(' ')}`));
        ok();
      });
    });
    aoProgredir(1, 'Concluído');
    return JSON.parse(readFileSync(`${base}.json`, 'utf-8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
