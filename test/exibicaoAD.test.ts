import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBloco, alternarBloco, definirModoBlocos, reiniciarExibicaoParaTeste } from '../src/ui/ad/exibicaoAD';
import * as m from '../src/ui/ad/exibicaoAD';

describe('blocos de AD retráteis', () => {
  beforeEach(() => reiniciarExibicaoParaTeste());
  it('navegar abre um e recolhe o anterior; alternar acumula', () => {
    abrirBloco('a');
    expect(m.blocoAberto('a')).toBe(true);
    abrirBloco('b');
    expect(m.blocoAberto('a')).toBe(false);
    expect(m.blocoAberto('b')).toBe(true);
    alternarBloco('a');
    expect(m.blocoAberto('a') && m.blocoAberto('b')).toBe(true);
    alternarBloco('b');
    expect(m.blocoAberto('b')).toBe(false);
  });
  it('modo "todos" abre tudo; voltar ao compacto recolhe', () => {
    abrirBloco('a');
    definirModoBlocos('todos');
    expect(m.blocoAberto('z')).toBe(true);
    definirModoBlocos('compacto');
    expect(m.blocoAberto('a')).toBe(false);
  });
});
