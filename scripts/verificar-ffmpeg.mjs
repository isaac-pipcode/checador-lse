// Executa o ffmpeg EMBUTIDO num app empacotado e confere, codificando de
// verdade, cada formato que o Ouver Estúdio usa. Roda no CI, em cada sistema,
// depois do electron-builder.
//
// Uso: node scripts/verificar-ffmpeg.mjs <pasta-resources/ffmpeg> [--opcional]
//   --opcional: se o binário não puder rodar nesta máquina (ex.: x64 num Mac
//   Apple Silicon sem Rosetta), avisa em vez de falhar.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = process.argv[2];
const opcional = process.argv.includes('--opcional');
const exe = process.platform === 'win32' ? '.exe' : '';
const ffmpeg = join(pasta, `ffmpeg${exe}`);
const ffprobe = join(pasta, `ffprobe${exe}`);
for (const f of [ffmpeg, ffprobe, join(pasta, 'LICENSE-GPL-3.0.txt'), join(pasta, 'LEIA-ME.txt')]) {
  if (!existsSync(f)) throw new Error(`falta no pacote: ${f}`);
}

const v = spawnSync(ffmpeg, ['-hide_banner', '-version'], { encoding: 'utf8' });
if (v.error || v.status !== 0) {
  const msg = `não foi possível executar ${ffmpeg}: ${v.error?.message ?? v.stderr}`;
  if (opcional) {
    console.warn(`AVISO: ${msg}`);
    process.exit(0);
  }
  throw new Error(msg);
}
console.log(v.stdout.split('\n')[0]);

const d = mkdtempSync(join(tmpdir(), 'ffv-'));
const ff = (...a) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const video = ['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=24:d=1'];
const audio = ['-f', 'lavfi', '-i', 'sine=f=440:d=1'];
const srt = join(d, 'l.srt');
execFileSync(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(srt)}, '1\\n00:00:00,000 --> 00:00:00,900\\nteste\\n')`]);

// o que o app gera: pacote MP4 (H.264 + AAC + legenda mov_text), Libras em ProRes 4444 com alfa,
// mixagem WAV 24 bits, prévias WebM (VP8/VP9 + Opus)
ff(...video, ...audio, '-i', srt, '-map', '0', '-map', '1', '-map', '2', '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-c:s', 'mov_text', join(d, 'pacote.mp4'));
ff(...video, '-vf', 'format=yuva444p10le', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', join(d, 'libras.mov'));
ff(...audio, '-c:a', 'pcm_s24le', join(d, 'mix.wav'));
ff(...video, ...audio, '-c:v', 'libvpx', '-c:a', 'libopus', join(d, 'previa.webm'));
// filtros da cadeia de Libras
ff(...video, '-vf', 'chromakey=0x00FF00:0.2:0.05,erosion,gblur=sigma=1,despill=type=green', '-frames:v', '1', join(d, 'quadro.png'));

const probe = (arq) =>
  execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', join(d, arq)], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .join(',');
const esperado = { 'pacote.mp4': 'h264,aac,mov_text', 'libras.mov': 'prores', 'mix.wav': 'pcm_s24le', 'previa.webm': 'vp8,opus' };
for (const [arq, codecs] of Object.entries(esperado)) {
  const obtido = probe(arq);
  if (obtido !== codecs) throw new Error(`${arq}: esperado ${codecs}, obtido ${obtido}`);
  console.log(`ok ${arq}: ${obtido}`);
}
console.log('ffmpeg embutido verificado');
