// Executa o whisper-cli EMBUTIDO num app empacotado: confere que roda e, com
// --transcrever <wav> <modelo>, que transcreve de verdade (saída -ojf com
// tempos por token). Roda no CI depois do electron-builder.
//
// Uso: node scripts/verificar-whisper.mjs <pasta-resources/whisper> [--opcional] [--transcrever wav modelo]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = process.argv[2];
const opcional = process.argv.includes('--opcional');
const exe = process.platform === 'win32' ? '.exe' : '';
const bin = join(pasta, `whisper-cli${exe}`);
for (const f of [bin, join(pasta, 'LICENSE-MIT.txt'), join(pasta, 'LEIA-ME.txt')])
  if (!existsSync(f)) throw new Error(`falta no pacote: ${f}`);

const h = spawnSync(bin, ['-h'], { encoding: 'utf8' });
if (h.error || !/usage|options/i.test(`${h.stdout}${h.stderr}`)) {
  const msg = `não foi possível executar ${bin}: ${h.error?.message ?? h.stderr}`;
  if (opcional) {
    console.warn(`AVISO: ${msg}`);
    process.exit(0);
  }
  throw new Error(msg);
}
console.log(`ok: ${bin} executa`);

const i = process.argv.indexOf('--transcrever');
if (i > 0) {
  const [wav, modelo] = process.argv.slice(i + 1, i + 3);
  const d = mkdtempSync(join(tmpdir(), 'wv-'));
  const r = spawnSync(bin, ['-m', modelo, '-f', wav, '-l', 'pt', '-ojf', '-of', join(d, 't'), '-pp', '-sns'], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`whisper-cli falhou: ${r.stderr.slice(-2000)}`);
  if (!/progress\s*=\s*\d+%/.test(r.stderr)) throw new Error('o whisper-cli não informou progresso (-pp)');
  const j = JSON.parse(readFileSync(join(d, 't.json'), 'utf8'));
  const segs = j.transcription ?? [];
  const tokens = segs.flatMap((s) => s.tokens ?? []);
  const texto = segs
    .map((s) => s.text)
    .join('')
    .trim();
  if (!texto) throw new Error('transcrição vazia');
  if (!tokens.some((t) => typeof t.offsets?.from === 'number')) throw new Error('sem tempos por token na saída -ojf');
  console.log(`ok: transcreveu "${texto}" (${segs.length} segmentos, ${tokens.length} tokens)`);
  // guarda a saída real: o teste do leitor JSON roda sobre ela (test/whisperReal.test.ts)
  if (process.env.OUVER_WHISPER_SAIDA) writeFileSync(process.env.OUVER_WHISPER_SAIDA, JSON.stringify(j));
}
