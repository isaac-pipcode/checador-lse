import { app, BrowserWindow, net, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { EstadoAtualizacao } from '../src/desktop/ponte';
import { maisNova, modoDeAtualizacao, paginaDaVersao, REPO, urlPermitida } from './versoes';

/**
 * Atualização do aplicativo.
 *
 * - Windows (.exe) e Linux (AppImage): automática. O electron-updater lê o
 *   latest*.yml da release no GitHub, baixa em segundo plano (com verificação
 *   SHA-512) e instala ao fechar; "Reiniciar agora" instala na hora.
 * - macOS e Linux (.deb): só aviso com link para a página da release. O macOS
 *   recusa atualização automática de app não assinado; o .deb é do gerenciador
 *   de pacotes.
 *
 * Testes: OUVER_ATUALIZACAO_URL aponta o electron-updater para um servidor
 * genérico (latest*.yml + instaladores); OUVER_ATUALIZACAO_API substitui a URL
 * da API de releases no modo aviso.
 */

const API = process.env.OUVER_ATUALIZACAO_API || `https://api.github.com/repos/${REPO}/releases/latest`;
const FEED_TESTE = process.env.OUVER_ATUALIZACAO_URL;

export type { EstadoAtualizacao };

let estado: EstadoAtualizacao = { estado: 'desativada', motivo: 'ainda não verificado' };
let preparado = false;

function enviar(novo: EstadoAtualizacao) {
  estado = novo;
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('atualizacao:evento', novo);
}

function prepararAutomatica() {
  if (preparado) return;
  preparado = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  if (FEED_TESTE) autoUpdater.setFeedURL({ provider: 'generic', url: FEED_TESTE });
  autoUpdater.on('update-available', (i) => enviar({ estado: 'baixando', versao: i.version, fracao: 0 }));
  autoUpdater.on('download-progress', (p) => {
    if (estado.estado === 'baixando') enviar({ ...estado, fracao: Math.min(1, p.percent / 100) });
  });
  autoUpdater.on('update-downloaded', (i) => enviar({ estado: 'pronta', versao: i.version }));
  autoUpdater.on('update-not-available', () => enviar({ estado: 'atual', versao: app.getVersion() }));
  autoUpdater.on('error', (e) => enviar({ estado: 'erro', mensagem: e?.message ?? String(e) }));
}

async function verificarAviso(): Promise<EstadoAtualizacao> {
  const r = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Ouver-Estudio' } });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
  const dados = (await r.json()) as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
  const versao = (dados.tag_name ?? '').replace(/^v/, '');
  if (!versao || dados.draft || dados.prerelease || !maisNova(versao, app.getVersion()))
    return { estado: 'atual', versao: app.getVersion() };
  const url = dados.html_url && urlPermitida(dados.html_url) ? dados.html_url : paginaDaVersao(versao);
  return { estado: 'disponivel', versao, automatica: false, url };
}

/** Verifica (e, no modo automático, baixa). Devolve o estado no fim da verificação. */
export async function verificarAtualizacao(): Promise<EstadoAtualizacao> {
  if (!app.isPackaged && !FEED_TESTE && !process.env.OUVER_ATUALIZACAO_API)
    return (estado = { estado: 'desativada', motivo: 'em desenvolvimento' });
  if (estado.estado === 'baixando' || estado.estado === 'pronta') return estado;
  enviar({ estado: 'verificando' });
  try {
    if (modoDeAtualizacao(process.platform, process.env) === 'automatica') {
      prepararAutomatica();
      const r = await autoUpdater.checkForUpdates();
      // os eventos acima já informam o progresso; aqui só o estado imediato
      if (r && maisNova(r.updateInfo.version, app.getVersion()) && estado.estado === 'verificando')
        enviar({ estado: 'baixando', versao: r.updateInfo.version, fracao: 0 });
      else if (estado.estado === 'verificando') enviar({ estado: 'atual', versao: app.getVersion() });
    } else {
      enviar(await verificarAviso());
    }
  } catch (e) {
    enviar({ estado: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
  }
  return estado;
}

export function estadoAtualizacao(): EstadoAtualizacao {
  return estado;
}

export function reiniciarParaAtualizar() {
  if (estado.estado === 'pronta') autoUpdater.quitAndInstall(false, true);
}

export function abrirPaginaDaRelease(url: string) {
  if (urlPermitida(url)) void shell.openExternal(url);
}
