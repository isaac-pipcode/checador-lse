import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, net: { fetch: vi.fn() } }));
const { resolverWhisper } = await import('./whisper');

describe('onde está o whisper-cli', () => {
  const nada = () => false;
  it('variável de ambiente primeiro', () => {
    expect(resolverWhisper({ OUVER_WHISPER: '/x/whisper-cli' }, 'linux', nada, '/r/whisper')).toEqual({
      caminho: '/x/whisper-cli',
      origem: 'variavel',
    });
  });
  it('embutido no instalador, com .exe no Windows', () => {
    const existe = (c: string) => c.endsWith('whisper-cli.exe');
    expect(resolverWhisper({}, 'win32', existe, 'C:/app/resources/whisper').origem).toBe('embutido');
  });
  it('em desenvolvimento, vendor/whisper/<plataforma>-<arq>; senão, o PATH', () => {
    const existe = (c: string) => c.includes('vendor') && c.includes('darwin-arm64');
    expect(resolverWhisper({}, 'darwin', existe, null, 'arm64').origem).toBe('desenvolvimento');
    expect(resolverWhisper({}, 'linux', nada, null, 'x64')).toEqual({ caminho: 'whisper-cli', origem: 'path' });
  });
});
