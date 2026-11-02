// Baixa o ffmpeg e o ffprobe que vão embutidos nos instaladores, confere o
// SHA-256 de cada arquivo contra desktop/ffmpeg-embutido.json (aborta se não
// bater) e extrai para vendor/ffmpeg/<plataforma>-<arquitetura>/, de onde o
// electron-builder os copia para os recursos do aplicativo.
//
// Uso: node scripts/baixar-ffmpeg.mjs [darwin-arm64 darwin-x64 linux-x64 win32-x64]
// Sem argumentos: as arquiteturas que o instalador desta plataforma gera.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifesto = JSON.parse(readFileSync(join(raiz, 'desktop/ffmpeg-embutido.json'), 'utf8'));
const PADRAO = { darwin: ['darwin-arm64', 'darwin-x64'], win32: ['win32-x64'], linux: ['linux-x64'] };
const alvos = process.argv.slice(2).length ? process.argv.slice(2) : PADRAO[process.platform];
const cache = join(raiz, 'vendor/cache');
mkdirSync(cache, { recursive: true });

const sha256 = (arq) => createHash('sha256').update(readFileSync(arq)).digest('hex');

async function baixar(url, destino) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      writeFileSync(`${destino}.parcial`, Buffer.from(await r.arrayBuffer()));
      renameSync(`${destino}.parcial`, destino);
      return;
    } catch (e) {
      if (tentativa === 4) throw new Error(`falha ao baixar ${url}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** (tentativa - 1)));
    }
  }
}

/** zip: `unzip` no Linux; `tar` (bsdtar) no macOS e no Windows 10+. */
function extrair(zip, pasta) {
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  if (process.platform === 'linux') execFileSync('unzip', ['-q', '-o', zip, '-d', pasta]);
  else execFileSync('tar', ['-xf', zip, '-C', pasta]);
}

for (const alvo of alvos) {
  const p = manifesto.plataformas[alvo];
  if (!p) throw new Error(`plataforma desconhecida: ${alvo}`);
  const saida = join(raiz, 'vendor/ffmpeg', alvo);
  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });
  const conferidos = [];
  for (const a of p.arquivos) {
    const nome = `${alvo}-${basename(new URL(a.url).pathname)}`;
    const zip = join(cache, nome);
    if (!existsSync(zip) || sha256(zip) !== a.sha256) await baixar(a.url, zip);
    const h = sha256(zip);
    if (h !== a.sha256) {
      rmSync(zip, { force: true });
      throw new Error(`SHA-256 não confere para ${a.url}\n  esperado ${a.sha256}\n  obtido   ${h}`);
    }
    conferidos.push(`${a.sha256}  ${a.url}`);
    const tmp = join(cache, `x-${nome}`);
    extrair(zip, tmp);
    for (const dentro of a.extrair) {
      const destino = join(saida, basename(dentro));
      copyFileSync(join(tmp, dentro), destino);
      if (!destino.endsWith('.txt') && process.platform !== 'win32') chmodSync(destino, 0o755);
    }
    rmSync(tmp, { recursive: true, force: true });
  }
  copyFileSync(join(raiz, 'licencas/GPL-3.0.txt'), join(saida, 'LICENSE-GPL-3.0.txt'));
  writeFileSync(
    join(saida, 'LEIA-ME.txt'),
    [
      `FFmpeg ${manifesto.versao} — componente de terceiros do Ouver Estúdio`,
      '',
      'O Ouver Estúdio executa estes programas como processos separados (ffmpeg e',
      'ffprobe) para ler, analisar e gerar áudio e vídeo. Eles NÃO fazem parte do',
      'código do Ouver Estúdio e são distribuídos sob a sua própria licença:',
      `${manifesto.licenca}. Texto completo: LICENSE-GPL-3.0.txt.`,
      '',
      `Compilação: ${p.fonte}`,
      `Receitas de compilação: ${p.receitas}`,
      p.versoes ? `Bibliotecas e versões: ${p.versoes}` : 'Bibliotecas e versões: README.txt (nesta pasta)',
      `Código-fonte do FFmpeg ${manifesto.versao}: ${manifesto.codigoFonte}`,
      '(também anexado à release do Ouver Estúdio no GitHub)',
      '',
      'Arquivos de origem conferidos (SHA-256):',
      ...conferidos,
      '',
    ].join('\n'),
  );
  console.log(`ffmpeg ${manifesto.versao} pronto em vendor/ffmpeg/${alvo}`);
}
