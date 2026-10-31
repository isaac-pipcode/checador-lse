import { contextBridge, ipcRenderer } from 'electron';
import type { PonteDesktop } from '../src/desktop/ponte';

let seq = 0;
const novoId = () => `${Date.now().toString(36)}-${seq++}`;

/** Invoca com canal de progresso próprio, removido ao terminar. */
function comProgresso<T>(canal: string, dados: object, cb: (fracao: number, etapa: string) => void): Promise<T> {
  const id = novoId();
  const ouvinte = (_e: unknown, p: { id: string; fracao: number; etapa: string }) => {
    if (p.id === id) cb(p.fracao, p.etapa);
  };
  ipcRenderer.on('estudio:progresso', ouvinte);
  return (ipcRenderer.invoke(canal, { id, ...dados }) as Promise<T>).finally(() =>
    ipcRenderer.removeListener('estudio:progresso', ouvinte),
  );
}

const ponte: PonteDesktop = {
  plataforma: process.platform,
  ffmpeg: () => ipcRenderer.invoke('ffmpeg'),
  escolherVideo: () => ipcRenderer.invoke('video:escolher'),
  urlDeMidia: (caminho) => ipcRenderer.invoke('midia:url', caminho),
  analisarAudio: (caminho, janelaMs, aoProgredir) =>
    comProgresso('audio:envelope', { caminho, janelaMs }, (f) => aoProgredir(f)),
  salvarProjeto: (pedido) => ipcRenderer.invoke('projeto:salvar', pedido),
  abrirProjeto: () => ipcRenderer.invoke('projeto:abrir'),
  renderizar: (pedido, aoProgredir) => comProgresso('ad:renderizar', { pedido }, aoProgredir),
  salvarTexto: (nome, conteudo) => ipcRenderer.invoke('texto:salvar', { nome, conteudo }),
  mostrarNaPasta: (caminho) => ipcRenderer.invoke('pasta:mostrar', caminho),
};

contextBridge.exposeInMainWorld('estudio', ponte);
