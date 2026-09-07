import { describe, expect, it } from 'vitest';
import { razaoDeContraste, AA_TEXTO, AA_COMPONENTE } from '../src/core/contraste';

const T = {
  navy: '#1B2230',
  navy700: '#2C3547',
  navy500: '#4A566E',
  paper: '#FAF8F3',
  paper200: '#F2EEE4',
  paper400: '#E3DDCD',
  terra: '#B85F3E',
  terra700: '#8E4227',
  ok: '#1F6B4A',
  ok100: '#E4F1EA',
  warn: '#8A5B00',
  warn100: '#FBF0DA',
  bad: '#A3242B',
  bad100: '#FBE6E7',
};

describe('contraste dos tokens de marca (WCAG 2.2 AA)', () => {
  it('texto de corpo sobre fundo claro passa em 4,5:1', () => {
    expect(razaoDeContraste(T.navy, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.navy700, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.navy500, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.navy700, T.paper200)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('texto claro sobre fundo escuro passa em 4,5:1', () => {
    expect(razaoDeContraste(T.paper, T.navy)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('cores de severidade passam em 4,5:1 sobre seus fundos', () => {
    expect(razaoDeContraste(T.ok, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.ok, T.ok100)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.warn, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.warn, T.warn100)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.bad, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(razaoDeContraste(T.bad, T.bad100)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('Terra reprova como texto de corpo — por isso não é usada nesse papel', () => {
    // Verificação da suspeita registrada na especificação: o acento da marca
    // não atinge 4,5:1 sobre o fundo Paper.
    expect(razaoDeContraste(T.terra, T.paper)).toBeLessThan(AA_TEXTO);
    // Serve, porém, como cor de componente/borda (≥ 3:1)…
    expect(razaoDeContraste(T.terra, T.paper)).toBeGreaterThanOrEqual(AA_COMPONENTE);
    // …e a variação escura resolve o texto quando o acento é necessário.
    expect(razaoDeContraste(T.terra700, T.paper)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('bordas e separadores atingem 3:1', () => {
    expect(razaoDeContraste(T.paper400, T.paper)).toBeLessThan(AA_COMPONENTE); // decorativa
    expect(razaoDeContraste(T.navy500, T.paper)).toBeGreaterThanOrEqual(AA_COMPONENTE);
  });
});
