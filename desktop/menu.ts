import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { verificarAtualizacao } from './atualizacao';
import { REPO } from './versoes';
import type { EstadoMenu } from '../src/desktop/ponte';

/**
 * Menu nativo, em português. Os comandos do app vão para a interface pelo canal
 * 'menu:acao' (ver src/ui/acoesMenu.ts); a interface devolve o que o menu
 * precisa refletir (projeto aberto, página, painéis, tema, ajudas) por
 * 'menu:estado', e o menu é remontado.
 */

export type { EstadoMenu };

let estado: EstadoMenu = {
  projetoAberto: false,
  temVideo: false,
  pagina: 'projetos',
  paineis: { esq: true, linha: true, dir: true },
  tema: 'escuro',
  ajudas: false,
};

let principal: () => BrowserWindow | null = () => null;

function acao(nome: string) {
  return () => principal()?.webContents.send('menu:acao', nome);
}

async function verificarDoMenu() {
  const w = principal();
  const r = await verificarAtualizacao();
  const caixa = (message: string, detail?: string) =>
    w ? void dialog.showMessageBox(w, { type: 'info', title: 'Atualizações', message, detail }) : undefined;
  if (r.estado === 'atual') caixa(`Você está na versão mais recente (${app.getVersion()}).`);
  else if (r.estado === 'erro') caixa('Não foi possível verificar as atualizações.', r.mensagem);
  else if (r.estado === 'desativada')
    caixa('A verificação de atualizações está desativada nesta instalação.', r.motivo);
  // "disponível", "baixando" e "pronta" aparecem no aviso da própria janela
}

function sobre() {
  const w = principal();
  const opcoes = {
    type: 'info' as const,
    title: 'Sobre o Ouver Estúdio',
    message: `Ouver Estúdio ${app.getVersion()}`,
    detail:
      'Legendagem para surdos e ensurdecidos (LSE), audiodescrição e janela de Libras numa mesma linha do tempo.\n\n' +
      'Software livre, sob a GNU GPL versão 3 ou posterior.\n' +
      `Código-fonte: github.com/${REPO}`,
  };
  void (w ? dialog.showMessageBox(w, opcoes) : dialog.showMessageBox(opcoes));
}

export function montarMenu(): Menu {
  const e = estado;
  const comProjeto = e.projetoAberto;
  const mac = process.platform === 'darwin';
  const pagina = (
    rotulo: string,
    id: EstadoMenu['pagina'],
    tecla: string,
    nome: string,
  ): MenuItemConstructorOptions => ({
    label: rotulo,
    type: 'radio',
    checked: e.pagina === id,
    accelerator: tecla,
    enabled: id === 'projetos' || comProjeto,
    click: acao(nome),
  });

  const modelo: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: 'Ouver Estúdio',
            submenu: [
              { label: 'Sobre o Ouver Estúdio', click: sobre },
              { label: 'Verificar atualizações…', click: () => void verificarDoMenu() },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar o Ouver Estúdio' },
              { role: 'hideOthers', label: 'Ocultar os outros' },
              { role: 'unhide', label: 'Mostrar tudo' },
              { type: 'separator' },
              { role: 'quit', label: 'Encerrar o Ouver Estúdio' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '&Arquivo',
      submenu: [
        { label: 'Novo projeto…', accelerator: 'CmdOrCtrl+N', click: acao('novoProjeto') },
        { label: 'Abrir projeto…', accelerator: 'CmdOrCtrl+O', click: acao('abrirProjeto') },
        { label: 'Projetos recentes', accelerator: 'CmdOrCtrl+Shift+O', click: acao('irProjetos') },
        { type: 'separator' },
        { label: 'Salvar', accelerator: 'CmdOrCtrl+S', enabled: comProjeto, click: acao('salvar') },
        { label: 'Salvar como…', accelerator: 'CmdOrCtrl+Shift+S', enabled: comProjeto, click: acao('salvarComo') },
        { type: 'separator' },
        { label: 'Abrir vídeo da obra…', enabled: comProjeto, click: acao('abrirVideo') },
        { label: 'Importar legenda (.srt, .vtt)…', enabled: comProjeto, click: acao('importarLegenda') },
        {
          label: 'Importar vídeo da intérprete de Libras…',
          enabled: comProjeto && e.temVideo,
          click: acao('importarInterprete'),
        },
        { type: 'separator' },
        { label: 'Entrega e exportação', enabled: comProjeto, click: acao('irEntrega') },
        ...(mac
          ? []
          : [{ type: 'separator' } as const, { role: 'quit', label: 'Sair', accelerator: 'Alt+F4' } as const]),
      ],
    },
    {
      label: '&Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: '&Exibir',
      submenu: [
        pagina('Projetos', 'projetos', 'CmdOrCtrl+0', 'irProjetos'),
        pagina('Legendas (LSE)', 'lse', 'CmdOrCtrl+1', 'irLse'),
        pagina('Audiodescrição', 'ad', 'CmdOrCtrl+2', 'irAd'),
        pagina('Libras', 'libras', 'CmdOrCtrl+3', 'irLibras'),
        pagina('Entrega', 'entrega', 'CmdOrCtrl+4', 'irEntrega'),
        { type: 'separator' },
        {
          label: 'Painel esquerdo',
          type: 'checkbox',
          checked: e.paineis.esq,
          enabled: comProjeto,
          click: acao('painelEsq'),
        },
        {
          label: 'Linha do tempo',
          type: 'checkbox',
          checked: e.paineis.linha,
          enabled: comProjeto,
          click: acao('painelLinha'),
        },
        { label: 'Inspetor', type: 'checkbox', checked: e.paineis.dir, enabled: comProjeto, click: acao('painelDir') },
        {
          label: 'Layout',
          enabled: comProjeto,
          submenu: [
            { label: 'Padrão', click: acao('layoutPadrao') },
            { label: 'Foco no monitor', click: acao('layoutFoco') },
          ],
        },
        { type: 'separator' },
        { label: 'Tema escuro', type: 'radio', checked: e.tema === 'escuro', click: acao('temaEscuro') },
        { label: 'Tema claro', type: 'radio', checked: e.tema === 'claro', click: acao('temaClaro') },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Aumentar a interface' },
        { role: 'zoomOut', label: 'Diminuir a interface' },
        { role: 'resetZoom', label: 'Tamanho original da interface' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        ...(app.isPackaged
          ? []
          : [
              { type: 'separator' } as const,
              { role: 'toggleDevTools', label: 'Ferramentas de desenvolvimento' } as const,
            ]),
      ],
    },
    {
      label: '&Reprodução',
      submenu: [
        // o espaço é tratado pela interface (não toma o espaço de quem digita); aqui só aparece o atalho
        {
          label: 'Reproduzir / pausar',
          accelerator: 'Space',
          registerAccelerator: false,
          enabled: e.temVideo,
          click: acao('reproduzir'),
        },
        { label: 'Ir ao início', enabled: e.temVideo, click: acao('inicio') },
        { label: 'Ir ao fim', enabled: e.temVideo, click: acao('fim') },
      ],
    },
    {
      label: 'Aj&uda',
      submenu: [
        {
          label: 'Mostrar ajudas na tela',
          type: 'checkbox',
          checked: e.ajudas,
          accelerator: 'F1',
          registerAccelerator: false,
          click: acao('ajudas'),
        },
        { label: 'Metodologia e créditos', click: acao('metodologia') },
        { type: 'separator' },
        ...(mac ? [] : [{ label: 'Verificar atualizações…', click: () => void verificarDoMenu() }]),
        {
          label: 'Página do projeto (código-fonte)',
          click: () => void shell.openExternal(`https://github.com/${REPO}`),
        },
        ...(mac ? [] : [{ type: 'separator' } as const, { label: 'Sobre o Ouver Estúdio', click: sobre }]),
      ],
    },
  ];
  return Menu.buildFromTemplate(modelo);
}

/** Instala o menu e o mantém em dia com o estado que a interface informa. */
export function instalarMenu(janelaPrincipal: () => BrowserWindow | null) {
  principal = janelaPrincipal;
  Menu.setApplicationMenu(montarMenu());
}

export function atualizarEstadoMenu(novo: Partial<EstadoMenu>) {
  const antes = JSON.stringify(estado);
  estado = { ...estado, ...novo, paineis: { ...estado.paineis, ...(novo.paineis ?? {}) } };
  if (JSON.stringify(estado) !== antes) Menu.setApplicationMenu(montarMenu());
}
