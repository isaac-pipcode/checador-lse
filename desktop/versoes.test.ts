import { describe, expect, it } from 'vitest';
import { maisNova, modoDeAtualizacao, paginaDaVersao, urlPermitida } from './versoes';

describe('atualização', () => {
  it('compara versões semânticas', () => {
    expect(maisNova('0.1.3', '0.1.2')).toBe(true);
    expect(maisNova('v0.2.0', '0.1.9')).toBe(true);
    expect(maisNova('0.1.10', '0.1.9')).toBe(true); // numérico, não texto
    expect(maisNova('0.1.2', '0.1.2')).toBe(false);
    expect(maisNova('0.1.1', '0.1.2')).toBe(false);
    expect(maisNova('0.2.0-beta', '0.2.0')).toBe(false); // pré-lançamento vale menos
    expect(maisNova('0.2.0', '0.2.0-beta')).toBe(true);
  });
  it('automática no Windows e no AppImage; aviso no macOS e no .deb', () => {
    expect(modoDeAtualizacao('win32', {})).toBe('automatica');
    expect(modoDeAtualizacao('linux', { APPIMAGE: '/x/Ouver.AppImage' })).toBe('automatica');
    expect(modoDeAtualizacao('linux', {})).toBe('aviso');
    expect(modoDeAtualizacao('darwin', {})).toBe('aviso');
  });
  it('só abre páginas de release do próprio repositório', () => {
    expect(urlPermitida(paginaDaVersao('0.1.3'))).toBe(true);
    expect(paginaDaVersao('v0.1.3')).toBe('https://github.com/isaac-pipcode/ouver-estudio/releases/tag/v0.1.3');
    expect(urlPermitida('https://github.com/outro/repo/releases')).toBe(false);
    expect(urlPermitida('https://exemplo.com/github.com/isaac-pipcode/ouver-estudio/releases')).toBe(false);
  });
});
