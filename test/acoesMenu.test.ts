import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitirAcao, inscrever, limparAcoesParaTeste } from '../src/ui/acoesMenu';

const microtarefas = () => new Promise<void>((r) => queueMicrotask(r));

describe('ações do menu', () => {
  beforeEach(() => limparAcoesParaTeste());

  it('entrega a quem está inscrito', () => {
    const f = vi.fn();
    inscrever('salvar', f);
    emitirAcao('salvar');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('pedido sem ouvinte fica pendente e é entregue uma vez a quem montar depois (navegação)', async () => {
    emitirAcao('importarInterprete');
    const f = vi.fn();
    inscrever('importarInterprete', f);
    await microtarefas();
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn();
    inscrever('importarInterprete', g);
    await microtarefas();
    expect(g).not.toHaveBeenCalled();
  });

  it('cancelada a inscrição, o pedido volta a ficar pendente', async () => {
    const f = vi.fn();
    const sair = inscrever('abrirVideo', f);
    sair();
    emitirAcao('abrirVideo');
    expect(f).not.toHaveBeenCalled();
    const g = vi.fn();
    inscrever('abrirVideo', g);
    await microtarefas();
    expect(g).toHaveBeenCalledTimes(1);
  });
});
