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

  escolherClipeLibras: () => ipcRenderer.invoke('libras:escolher'),
  sondarMidia: (caminho) => ipcRenderer.invoke('midia:sondar', caminho),
  gerarProxy: (caminho, projetoCaminho, aoProgredir) => comProgresso('proxy:gerar', { caminho, projetoCaminho }, (f) => aoProgredir(f)),
  cancelarProxy: (caminho) => ipcRenderer.invoke('proxy:cancelar', caminho),
  renderizarEntrega: (pedido, aoProgredir) => comProgresso('entrega:renderizar', { pedido }, aoProgredir),
  exportarParaEditores: (pedido, aoProgredir) => comProgresso('libras:exportarNle', { pedido }, aoProgredir),
  projetosRecentes: () => ipcRenderer.invoke('projetos:recentes'),
  novoProjeto: (nome) => ipcRenderer.invoke('projetos:novo', nome),
  abrirProjetoEm: (caminho) => ipcRenderer.invoke('projetos:abrirEm', caminho),
  esquecerProjeto: (caminho) => ipcRenderer.invoke('projetos:esquecer', caminho),

  prompterAbrir: () => ipcRenderer.invoke('prompter:abrir'),
  prompterFechar: () => ipcRenderer.invoke('prompter:fechar'),
  prompterEnviar: (estado) => ipcRenderer.send('prompter:estado', estado),
  aoComandoDoPrompter: (cb) => ouvir('prompter:comando', cb),
  atualizacao: {
    versao: () => ipcRenderer.invoke('atualizacao:versao'),
    estado: () => ipcRenderer.invoke('atualizacao:estado'),
    verificar: () => ipcRenderer.invoke('atualizacao:verificar'),
    reiniciar: () => ipcRenderer.send('atualizacao:reiniciar'),
    abrirPagina: (url) => ipcRenderer.send('atualizacao:abrir', url),
    aoMudar: (cb) => ouvir('atualizacao:evento', cb),
  },
  menu: {
    aoAcao: (cb) => ouvir('menu:acao', cb),
    estado: (e) => ipcRenderer.send('menu:estado', e),
  },
  escolherLegenda: () => ipcRenderer.invoke('legenda:escolher'),
  quantasTelas: () => ipcRenderer.invoke('telas:quantas'),
  aoFecharPrompter: (cb) => ouvir('prompter:fechado', () => cb()),
  aoEstadoDoPrompter: (cb) => ouvir('prompter:estado', cb),
  enviarComando: (c) => ipcRenderer.send('prompter:comando', c),
};

function ouvir<T>(canal: string, cb: (dado: T) => void): () => void {
  const f = (_e: unknown, dado: T) => cb(dado);
  ipcRenderer.on(canal, f);
  return () => ipcRenderer.removeListener(canal, f);
}

contextBridge.exposeInMainWorld('estudio', ponte);
