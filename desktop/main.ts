import { app, BrowserWindow, dialog, ipcMain, protocol, screen, session, shell } from 'electron';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { FFMPEG, decodificarStream, versaoFfmpeg } from './ffmpeg';
import { renderizar } from './render';
import { AcumuladorEnvelope } from '../src/mapa/sinal';
import type { ArquivoTake, PedidoRender, ProjetoArquivo } from '../src/desktop/ponte';
import type { EstadoPrompter } from '../src/ad/prompter';

/**
 * Processo principal. Segurança: renderer isolado (contextIsolation, sandbox,
 * sem Node); só arquivos escolhidos pelo usuário em diálogos do sistema podem
 * ser servidos pelo protocolo `midia://`.
 */

protocol.registerSchemesAsPrivileged([
  { scheme: 'midia', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
]);

const autorizados = new Map<string, string>(); // token -> caminho
let contadorToken = 0;

function urlDeMidia(caminho: string): string {
  const abs = resolve(caminho);
  for (const [t, c] of autorizados) if (c === abs) return `midia://arquivo/${t}/${encodeURIComponent(basename(abs))}`;
  const token = `${Date.now().toString(36)}${(contadorToken++).toString(36)}`;
  autorizados.set(token, abs);
  return `midia://arquivo/${token}/${encodeURIComponent(basename(abs))}`;
}

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
};

/** Serve arquivo local com suporte a Range (necessário para buscar no vídeo). */
function servirMidia(req: Request): Response {
  const partes = new URL(req.url).pathname.split('/').filter(Boolean);
  const caminho = autorizados.get(partes[0] ?? '');
  if (!caminho || !existsSync(caminho)) return new Response('não autorizado', { status: 403 });
  const tamanho = statSync(caminho).size;
  const tipo = MIME[extname(caminho).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.get('range');
  const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (m) {
    const ini = m[1] ? Number(m[1]) : Math.max(0, tamanho - Number(m[2]));
    const fim = m[1] && m[2] ? Math.min(Number(m[2]), tamanho - 1) : tamanho - 1;
    const corpo = Readable.toWeb(createReadStream(caminho, { start: ini, end: fim })) as ReadableStream;
    return new Response(corpo, {
      status: 206,
      headers: {
        'Content-Type': tipo,
        'Content-Length': String(fim - ini + 1),
        'Content-Range': `bytes ${ini}-${fim}/${tamanho}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  const corpo = Readable.toWeb(createReadStream(caminho)) as ReadableStream;
  return new Response(corpo, {
    headers: {
      'Content-Type': tipo,
      'Content-Length': String(tamanho),
      'Accept-Ranges': 'bytes',
      // o renderer (file://) lê o vídeo via Web Audio e canvas: precisa de CORS
      'Access-Control-Allow-Origin': '*',
    },
  });
}

let principal: BrowserWindow | null = null;
let prompter: BrowserWindow | null = null;
let ultimoEstadoPrompter: EstadoPrompter | null = null;

function carregar(w: BrowserWindow, hash?: string) {
  // `--dev-server=URL` (ou VITE_DEV_SERVER_URL): carrega o Vite em modo dev, com recarga
  const dev =
    process.argv.find((a) => a.startsWith('--dev-server='))?.slice('--dev-server='.length) ??
    process.env.VITE_DEV_SERVER_URL;
  if (dev) void w.loadURL(hash ? `${dev}#${hash}` : dev);
  else void w.loadFile(join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined);
}

const PREFERENCIAS = {
  preload: join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

/**
 * Janela do locutor. Vai para o primeiro monitor que não é o principal, em
 * tela cheia; com um monitor só, abre como janela comum.
 */
function abrirPrompter(): { monitor: string; secundario: boolean } {
  const primario = screen.getPrimaryDisplay();
  const alvo = screen.getAllDisplays().find((d) => d.id !== primario.id) ?? null;
  const tela = alvo ?? primario;
  const descricao = `${tela.label || 'monitor'} (${tela.size.width}×${tela.size.height})`;
  if (prompter && !prompter.isDestroyed()) {
    prompter.focus();
    return { monitor: descricao, secundario: alvo !== null };
  }
  const { x, y, width, height } = tela.workArea;
  prompter = new BrowserWindow({
    x: alvo ? x : x + 60,
    y: alvo ? y : y + 60,
    width: alvo ? width : Math.min(1100, width - 120),
    height: alvo ? height : Math.min(800, height - 120),
    fullscreen: alvo !== null,
    title: 'Teleprompter — locutor',
    backgroundColor: '#1B2230',
    autoHideMenuBar: true,
    webPreferences: PREFERENCIAS,
  });
  carregar(prompter, 'prompter');
  prompter.webContents.on('did-finish-load', () => {
    if (ultimoEstadoPrompter) prompter?.webContents.send('prompter:estado', ultimoEstadoPrompter);
  });
  prompter.on('closed', () => {
    prompter = null;
    principal?.webContents.send('prompter:fechado');
  });
  return { monitor: descricao, secundario: alvo !== null };
}

function janela(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1440,
    height: 960,
    title: 'Estúdio de Acessibilidade',
    backgroundColor: '#FAF8F3',
    webPreferences: PREFERENCIAS,
  });
  carregar(w);
  principal = w;
  // fechar a janela principal fecha a do locutor
  w.on('closed', () => {
    principal = null;
    if (prompter && !prompter.isDestroyed()) prompter.close();
  });
  // links externos abrem no navegador do sistema, nunca na janela do app
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  return w;
}

const progresso = (e: Electron.IpcMainInvokeEvent, id: string, fracao: number, etapa = '') =>
  e.sender.send('estudio:progresso', { id, fracao, etapa });

function registrarIpc() {
  ipcMain.handle('ffmpeg', async () => {
    const versao = await versaoFfmpeg();
    return { disponivel: versao !== null, versao, caminho: FFMPEG };
  });

  ipcMain.handle('video:escolher', async (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(w!, {
      title: 'Abrir vídeo',
      properties: ['openFile'],
      filters: [{ name: 'Vídeo e áudio', extensions: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'wav', 'mp3', 'm4a'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const caminho = r.filePaths[0];
    return { caminho, nome: basename(caminho), url: urlDeMidia(caminho) };
  });

  // Só caminhos que vieram de um projeto aberto pelo usuário (ver projeto:abrir).
  const caminhosDeProjeto = new Set<string>();
  ipcMain.handle('midia:url', (_e, caminho: string) => {
    if (!caminhosDeProjeto.has(resolve(caminho))) throw new Error('Caminho não autorizado.');
    return urlDeMidia(caminho);
  });

  ipcMain.handle('audio:envelope', async (e, { id, caminho, janelaMs }: { id: string; caminho: string; janelaMs: number }) => {
    if (![...autorizados.values()].includes(resolve(caminho))) throw new Error('Caminho não autorizado.');
    const taxa = 16000;
    const acc = new AcumuladorEnvelope(taxa, janelaMs);
    let duracaoMs = 0;
    let lidas = 0;
    let ultimo = 0;
    await decodificarStream(
      caminho,
      1,
      taxa,
      'highpass=f=150,lowpass=f=4000',
      (a) => {
        acc.adicionar(a);
        lidas += a.length;
        const f = duracaoMs ? (lidas / taxa) * 1000 / duracaoMs : 0;
        if (f - ultimo > 0.02) {
          ultimo = f;
          progresso(e, id, Math.min(1, f));
        }
      },
      (ms) => (duracaoMs = ms),
    );
    return { envelopeDb: acc.concluir(), duracaoMs: duracaoMs || Math.round((lidas / taxa) * 1000) };
  });

  ipcMain.handle(
    'projeto:salvar',
    async (e, { caminho, projeto, takes }: { caminho: string | null; projeto: ProjetoArquivo; takes: ArquivoTake[] }) => {
      let destino = caminho;
      if (!destino) {
        const w = BrowserWindow.fromWebContents(e.sender);
        const r = await dialog.showSaveDialog(w!, {
          title: 'Salvar projeto',
          defaultPath: `${(projeto.video?.nome ?? 'projeto').replace(/\.[^.]+$/, '')}.estudio.json`,
          filters: [{ name: 'Projeto do estúdio', extensions: ['json'] }],
        });
        if (r.canceled || !r.filePath) return null;
        destino = r.filePath;
      }
      const pastaTakes = join(dirname(destino), 'takes');
      mkdirSync(pastaTakes, { recursive: true });
      for (const t of takes) {
        if (!/^[\w.-]+$/.test(t.arquivo)) throw new Error(`Nome de take inválido: ${t.arquivo}`);
        writeFileSync(join(pastaTakes, t.arquivo), t.bytes);
      }
      writeFileSync(destino, JSON.stringify(projeto, null, 2), 'utf-8');
      return { caminho: destino };
    },
  );

  ipcMain.handle('projeto:abrir', async (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(w!, {
      title: 'Abrir projeto',
      properties: ['openFile'],
      filters: [{ name: 'Projeto do estúdio', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const caminho = r.filePaths[0];
    const projeto = JSON.parse(readFileSync(caminho, 'utf-8')) as ProjetoArquivo;
    if (projeto.formato !== 'estudio-acessibilidade') throw new Error('Arquivo não é um projeto do estúdio.');
    const pastaTakes = join(dirname(caminho), 'takes');
    const takes: ArquivoTake[] = [];
    for (const b of projeto.ad.blocos) {
      for (const t of b.takes) {
        if (!t.arquivo || !/^[\w.-]+$/.test(t.arquivo)) continue;
        const arq = join(pastaTakes, t.arquivo);
        if (existsSync(arq)) takes.push({ arquivo: t.arquivo, bytes: readFileSync(arq) });
      }
    }
    if (projeto.video?.caminho) caminhosDeProjeto.add(resolve(projeto.video.caminho));
    return { caminho, projeto, takes };
  });

  ipcMain.handle('ad:renderizar', async (e, { id, pedido }: { id: string; pedido: PedidoRender }) => {
    if (![...autorizados.values()].includes(resolve(pedido.videoCaminho))) throw new Error('Caminho não autorizado.');
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(w!, {
      title: 'Pasta de saída da mixagem',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: dirname(pedido.videoCaminho),
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return renderizar(pedido, r.filePaths[0], (f, etapa) => progresso(e, id, f, etapa));
  });

  ipcMain.handle('texto:salvar', async (e, { nome, conteudo }: { nome: string; conteudo: string }) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showSaveDialog(w!, { defaultPath: nome });
    if (r.canceled || !r.filePath) return null;
    writeFileSync(r.filePath, conteudo, 'utf-8');
    return r.filePath;
  });

  ipcMain.handle('pasta:mostrar', (_e, caminho: string) => shell.showItemInFolder(caminho));

  ipcMain.handle('prompter:abrir', () => abrirPrompter());
  ipcMain.handle('prompter:fechar', () => {
    if (prompter && !prompter.isDestroyed()) prompter.close();
  });
  // Retransmissão: só a principal publica estado; só o prompter publica comandos.
  ipcMain.on('prompter:estado', (e, estado: EstadoPrompter) => {
    if (e.sender !== principal?.webContents) return;
    ultimoEstadoPrompter = estado;
    if (prompter && !prompter.isDestroyed()) prompter.webContents.send('prompter:estado', estado);
  });
  ipcMain.on('prompter:comando', (e, comando: string) => {
    if (e.sender !== prompter?.webContents) return;
    principal?.webContents.send('prompter:comando', comando);
  });
}

app.whenReady().then(() => {
  protocol.handle('midia', servirMidia);
  // microfone permitido (gravação de AD); câmera e o resto, não
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, ok, detalhes) => {
    const d = detalhes as { mediaTypes?: string[] };
    ok(permissao === 'media' && (d.mediaTypes ?? []).every((t) => t === 'audio'));
  });
  registrarIpc();
  janela();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) janela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
