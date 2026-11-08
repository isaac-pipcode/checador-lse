import { describe, expect, it } from 'vitest';
import { lerTempo } from '../src/core/tempo';

describe('lerTempo', () => {
  it('formatos de legenda (vírgula ou ponto)', () => {
    expect(lerTempo('00:01:02,500')).toBe(62500);
    expect(lerTempo('00:01:02.5')).toBe(62500);
    expect(lerTempo('01:00:00,000')).toBe(3600000);
  });
  it('timecode SMPTE com quadros, na cadência da obra', () => {
    expect(lerTempo('00:00:01:12', 24)).toBe(1500);
    expect(lerTempo('00:00:01:12', 25)).toBe(1480);
    expect(lerTempo('00:00:01:24', 24)).toBeNull(); // quadro inexistente a 24 qd/s
  });
  it('formas curtas', () => {
    expect(lerTempo('1:02,5')).toBe(62500);
    expect(lerTempo('62,5')).toBe(62500);
    expect(lerTempo(' 62 ')).toBe(62000);
  });
  it('recusa o que não é tempo', () => {
    for (const t of ['', 'abc', '1:61', '00:60:00,000', '1:2:3:4:5', '-3', '1,2,3']) expect(lerTempo(t)).toBeNull();
  });
});

describe('editar o tempo de uma legenda', () => {
  const SRT = `1
00:00:01,000 --> 00:00:03,000
Primeira legenda.

2
00:00:04,000 --> 00:00:06,000
Segunda legenda.
`;
  it('muda entrada e saída, reanalisa e mantém a decisão dos apontamentos que não mudaram', async () => {
    const { redutorParaTeste, estadoInicial } = await import('../src/state/store');
    const { parseSubtitle } = await import('../src/parser/srt');
    let e = redutorParaTeste(estadoInicial, { tipo: 'carregar', nome: 'x.srt', encoding: 'utf-8', cues: parseSubtitle(SRT).cues, erros: [], avisos: [] });
    const outros = Object.values(e.review).filter((r) => r.suggestion.cueIndex !== 2);
    for (const r of outros) e = redutorParaTeste(e, { tipo: 'decidir', id: r.suggestion.id, decisao: 'aprovada' });
    e = redutorParaTeste(e, { tipo: 'cueTempo', index: 2, startMs: 4500, endMs: 7000 });
    expect(e.cues[1]).toMatchObject({ startMs: 4500, endMs: 7000 });
    expect(e.projeto.sujo).toBe(true);
    for (const r of outros) if (e.review[r.suggestion.id]) expect(e.review[r.suggestion.id].decision).toBe('aprovada');
  });
  it('recusa saída antes da entrada', async () => {
    const { redutorParaTeste, estadoInicial } = await import('../src/state/store');
    const { parseSubtitle } = await import('../src/parser/srt');
    const e = redutorParaTeste(estadoInicial, { tipo: 'carregar', nome: 'x.srt', encoding: 'utf-8', cues: parseSubtitle(SRT).cues, erros: [], avisos: [] });
    expect(redutorParaTeste(e, { tipo: 'cueTempo', index: 1, startMs: 3000, endMs: 2000 })).toBe(e);
  });
});
