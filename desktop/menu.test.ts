import { describe, expect, it, vi } from 'vitest';

type Item = {
  label?: string;
  role?: string;
  enabled?: boolean;
  checked?: boolean;
  accelerator?: string;
  submenu?: Item[];
};

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '0.0.0' },
  dialog: { showMessageBox: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: (t: Item[]) => t, setApplicationMenu: vi.fn() },
}));
vi.mock('./atualizacao', () => ({ verificarAtualizacao: vi.fn() }));

const { montarMenu, atualizarEstadoMenu } = await import('./menu');

const modelo = () => montarMenu() as unknown as Item[];
const achar = (itens: Item[], rotulo: string): Item | undefined => {
  for (const i of itens) {
    if (i.label === rotulo) return i;
    const r = i.submenu && achar(i.submenu, rotulo);
    if (r) return r;
  }
};

describe('menu nativo', () => {
  it('está todo em português (nenhum item com rótulo vazio ou em inglês)', () => {
    const rotulos: string[] = [];
    const varrer = (itens: Item[]) =>
      itens.forEach((i) => (i.label && rotulos.push(i.label), i.submenu && varrer(i.submenu)));
    varrer(modelo());
    expect(rotulos).toContain('&Arquivo');
    for (const r of rotulos) expect(r).not.toMatch(/\b(File|Edit|View|Window|Help|Save|Open)\b/);
    // todo papel nativo recebe rótulo próprio (senão o Electron usa o inglês)
    const semRotulo: string[] = [];
    const papeis = (itens: Item[]) =>
      itens.forEach((i) => (i.role && !i.label && semRotulo.push(i.role), i.submenu && papeis(i.submenu)));
    papeis(modelo());
    expect(semRotulo).toEqual([]);
  });

  it('salvar e importar só com projeto; intérprete só com vídeo', () => {
    atualizarEstadoMenu({ projetoAberto: false, temVideo: false });
    expect(achar(modelo(), 'Salvar')?.enabled).toBe(false);
    expect(achar(modelo(), 'Novo projeto…')?.enabled).not.toBe(false);
    atualizarEstadoMenu({ projetoAberto: true });
    expect(achar(modelo(), 'Salvar')?.enabled).toBe(true);
    expect(achar(modelo(), 'Importar legenda (.srt, .vtt)…')?.enabled).toBe(true);
    expect(achar(modelo(), 'Importar vídeo da intérprete de Libras…')?.enabled).toBe(false);
    atualizarEstadoMenu({ temVideo: true });
    expect(achar(modelo(), 'Importar vídeo da intérprete de Libras…')?.enabled).toBe(true);
  });

  it('reflete página, painéis, tema e ajudas', () => {
    atualizarEstadoMenu({ pagina: 'ad', paineis: { esq: false }, tema: 'claro', ajudas: true } as never);
    expect(achar(modelo(), 'Audiodescrição')?.checked).toBe(true);
    expect(achar(modelo(), 'Painel esquerdo')?.checked).toBe(false);
    expect(achar(modelo(), 'Inspetor')?.checked).toBe(true);
    expect(achar(modelo(), 'Tema claro')?.checked).toBe(true);
    expect(achar(modelo(), 'Mostrar ajudas na tela')?.checked).toBe(true);
  });
});
