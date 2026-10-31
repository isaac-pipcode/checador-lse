import { describe, expect, it } from 'vitest';
import { razaoDeContraste, AA_TEXTO, AA_COMPONENTE } from '../src/core/contraste';
import { FIXAS, TEMAS, type Tema } from '../src/ui/tema/tokens';

/** Os mesmos valores que geram as variáveis CSS (fonte única). */
describe.each(['escuro', 'claro'] as Tema[])('contraste dos tokens — tema %s (WCAG 2.2 AA)', (tema) => {
  const T = TEMAS[tema];

  it('toda tinta de texto passa 4,5:1 sobre painel e painel elevado', () => {
    for (const tinta of ['navy', 'navy-700', 'navy-500', 'navy-300'] as const) {
      for (const sup of ['paper', 'paper-200', 'fundo'] as const) {
        expect(razaoDeContraste(T[tinta], T[sup]), `${tinta} sobre ${sup}`).toBeGreaterThanOrEqual(AA_TEXTO);
      }
    }
  });

  it('severidades passam 4,5:1 sobre o painel e sobre o próprio fundo', () => {
    for (const s of ['ok', 'warn', 'bad'] as const) {
      expect(razaoDeContraste(T[s], T.paper), s).toBeGreaterThanOrEqual(AA_TEXTO);
      expect(razaoDeContraste(T[s], T[`${s}-100`]), `${s} sobre ${s}-100`).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  });

  it('acento: componente ≥ 3:1; como texto, a variação 700 ≥ 4,5:1', () => {
    expect(razaoDeContraste(T.terra, T.paper)).toBeGreaterThanOrEqual(AA_COMPONENTE);
    expect(razaoDeContraste(T['terra-700'], T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('bordas de controle (navy-500) ≥ 3:1; separadores (paper-400) são decorativos', () => {
    expect(razaoDeContraste(T['navy-500'], T.paper)).toBeGreaterThanOrEqual(AA_COMPONENTE);
    expect(razaoDeContraste(T['paper-400'], T.paper)).toBeLessThan(AA_COMPONENTE);
  });
});

describe('contraste — botão primário e cores fixas', () => {
  it('no escuro, texto preto sobre o acento (botão primário) passa 4,5:1', () => {
    expect(razaoDeContraste(FIXAS.preto, TEMAS.escuro.terra)).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it('no claro, texto paper sobre o navy (botão primário) passa 4,5:1', () => {
    expect(razaoDeContraste(TEMAS.claro.paper, TEMAS.claro.navy)).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it('cabine do locutor: texto e texto suave legíveis', () => {
    expect(razaoDeContraste(FIXAS['cabine-texto'], FIXAS.cabine)).toBeGreaterThanOrEqual(7);
    expect(razaoDeContraste(FIXAS['cabine-suave'], FIXAS.cabine)).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it('cabine: faixas de fase e resultado do take', () => {
    expect(razaoDeContraste(FIXAS['cabine-texto'], FIXAS['cabine-gravando'])).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(FIXAS['cabine-texto'], FIXAS['cabine-faixa'])).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(FIXAS['cabine-preparo-texto'], FIXAS['cabine-preparo'])).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(FIXAS['cabine-ok'], FIXAS.cabine)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(FIXAS['cabine-erro'], FIXAS.cabine)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(FIXAS['cabine-suave'], FIXAS['cabine-faixa'])).toBeGreaterThanOrEqual(AA_TEXTO);
  });
});
