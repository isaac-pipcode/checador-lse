import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icone } from '../src/ui/icones';

/** Mãos de Libras: desenho próprio com máscara. */
describe('ícone de Libras', () => {
  const html = renderToStaticMarkup(createElement(Icone, { nome: 'libras' }));

  it('é decorativo e segue a cor do texto', () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
  });

  it('aplica a máscara num grupo sem transformação (senão ela vale no espaço espelhado da mão de trás)', () => {
    const comMascara = html.match(/<g[^>]*mask="[^"]*"[^>]*>/g) ?? [];
    expect(comMascara).toHaveLength(1);
    expect(comMascara[0]).not.toContain('transform');
  });

  it('cada instância tem a sua máscara (ids distintos na mesma página)', () => {
    const duas = renderToStaticMarkup(
      createElement(Fragment, null, createElement(Icone, { nome: 'libras' }), createElement(Icone, { nome: 'libras' })),
    );
    const ids = [...duas.matchAll(/<mask id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) expect(duas).toContain(`url(#${id})`);
  });

  it('o traço compensa a escala de cada mão (espessura igual à dos outros ícones)', () => {
    const tracos = [...html.matchAll(/<g stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(tracos.map((t) => t.toFixed(2)).sort()).toEqual([(1.75 / 0.62).toFixed(2), (1.75 / 0.72).toFixed(2)].sort());
  });
});
