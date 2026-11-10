// Compila o whisper-cli que vai embutido nos instaladores, a partir do código
// oficial do whisper.cpp (MIT) na tag de desktop/whisper-embutido.json, e o
// coloca em vendor/whisper/<plataforma>-<arquitetura>/, de onde o
// electron-builder o copia para os recursos do aplicativo.
//
// Uso: node scripts/compilar-whisper.mjs [darwin-arm64 darwin-x64 linux-x64 win32-x64]
// Sem argumentos: as arquiteturas que o instalador desta plataforma gera.
//
// Decisões de compilação (o binário tem de rodar em qualquer máquina da equipe):
// - estático (BUILD_SHARED_LIBS=OFF) e sem OpenMP (o ggml usa o próprio pool de
//   threads): nada de libgomp/vcomp140 para instalar à parte;
// - x64 com AVX2/FMA/F16C (todo processador desde ~2013), sem -march=native;
// - Windows com o runtime do MSVC embutido (/MT): dispensa o VC++ Redistributable;
// - Linux com libstdc++/libgcc estáticas: roda em distribuições mais antigas;
// - macOS com Metal e a biblioteca de shaders embutida (Apple Silicon e Intel).
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(raiz, 'desktop/whisper-embutido.json'), 'utf8'));
const PADRAO = { darwin: ['darwin-arm64', 'darwin-x64'], win32: ['win32-x64'], linux: ['linux-x64'] };
const alvos = process.argv.slice(2).length ? process.argv.slice(2) : PADRAO[process.platform];
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

// ---- código-fonte, conferido pelo commit -----------------------------------
const fonte = join(raiz, 'vendor/cache', `whisper.cpp-${cfg.versao}`);
if (!existsSync(join(fonte, 'CMakeLists.txt'))) {
  mkdirSync(dirname(fonte), { recursive: true });
  run('git', ['clone', '--depth', '1', '--branch', cfg.versao, cfg.repositorio, fonte]);
}
const commit = execFileSync('git', ['-C', fonte, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`whisper.cpp ${cfg.versao} @ ${commit}`);
if (cfg.commit && cfg.commit !== commit)
  throw new Error(
    `commit da tag ${cfg.versao} mudou: esperado ${cfg.commit}, veio ${commit}. Confira antes de embutir.`,
  );
if (!cfg.commit) console.log(`AVISO: fixe "commit": "${commit}" em desktop/whisper-embutido.json`);

const AVX = ['-DGGML_AVX=ON', '-DGGML_AVX2=ON', '-DGGML_FMA=ON', '-DGGML_F16C=ON'];
for (const alvo of alvos) {
  const [plat, arq] = alvo.split('-');
  const build = join(fonte, `build-${alvo}`);
  const args = [
    '-S',
    fonte,
    '-B',
    build,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DBUILD_SHARED_LIBS=OFF',
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_SERVER=OFF',
    '-DWHISPER_BUILD_EXAMPLES=ON',
    '-DWHISPER_SDL2=OFF',
    '-DWHISPER_CURL=OFF',
    '-DGGML_NATIVE=OFF',
    '-DGGML_OPENMP=OFF',
  ];
  if (plat === 'darwin') {
    args.push(`-DCMAKE_OSX_ARCHITECTURES=${arq === 'x64' ? 'x86_64' : 'arm64'}`, '-DCMAKE_OSX_DEPLOYMENT_TARGET=11.0');
    args.push('-DGGML_METAL=ON', '-DGGML_METAL_EMBED_LIBRARY=ON');
    if (arq === 'x64') args.push(...AVX);
  } else if (plat === 'win32') {
    args.push('-A', 'x64', '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW', '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded', ...AVX);
  } else {
    args.push(...AVX, '-DCMAKE_EXE_LINKER_FLAGS=-static-libgcc -static-libstdc++');
  }
  run('cmake', args);
  run('cmake', ['--build', build, '--config', 'Release', '--target', 'whisper-cli', '-j', '4']);

  const exe = plat === 'win32' ? '.exe' : '';
  const candidatos = [join(build, 'bin', `whisper-cli${exe}`), join(build, 'bin', 'Release', `whisper-cli${exe}`)];
  const bin = candidatos.find((c) => existsSync(c));
  if (!bin) throw new Error(`whisper-cli não encontrado em ${candidatos.join(' ou ')}`);
  const saida = join(raiz, 'vendor/whisper', alvo);
  mkdirSync(saida, { recursive: true });
  copyFileSync(bin, join(saida, `whisper-cli${exe}`));
  if (exe === '') chmodSync(join(saida, 'whisper-cli'), 0o755);
  copyFileSync(join(fonte, 'LICENSE'), join(saida, 'LICENSE-MIT.txt'));
  writeFileSync(
    join(saida, 'LEIA-ME.txt'),
    `whisper-cli do whisper.cpp ${cfg.versao} (commit ${commit}), compilado pelo CI do Ouver Estúdio\n` +
      `a partir de ${cfg.repositorio}, sob a licença MIT (LICENSE-MIT.txt).\n` +
      `Os modelos não vão no instalador: são baixados sob demanda e conferidos por SHA-256.\n`,
  );
  console.log(`whisper-cli pronto em vendor/whisper/${alvo}`);
}
