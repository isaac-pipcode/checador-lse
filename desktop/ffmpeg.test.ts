import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolverFfmpeg } from './ffmpeg';

describe('onde procurar o ffmpeg', () => {
  const nenhum = () => false;

  it('variável OUVER_FFMPEG manda; ffprobe ao lado', () => {
    const r = resolverFfmpeg({ OUVER_FFMPEG: '/opt/ff/ffmpeg' }, 'linux', nenhum);
    expect(r).toEqual({ ffmpeg: '/opt/ff/ffmpeg', ffprobe: join('/opt/ff', 'ffprobe') });
  });

  it('nome antigo (CHECADOR_FFMPEG) continua valendo', () => {
    expect(resolverFfmpeg({ CHECADOR_FFMPEG: '/x/ffmpeg' }, 'linux', nenhum).ffmpeg).toBe('/x/ffmpeg');
  });

  it('macOS: acha o ffmpeg do Homebrew mesmo sem PATH (app aberto pelo Finder)', () => {
    const r = resolverFfmpeg({}, 'darwin', (c) => c === '/opt/homebrew/bin/ffmpeg');
    expect(r.ffmpeg).toBe('/opt/homebrew/bin/ffmpeg');
    expect(r.ffprobe).toBe('/opt/homebrew/bin/ffprobe');
  });

  it('Windows: usa .exe e cai no PATH quando não acha nos locais usuais', () => {
    expect(resolverFfmpeg({}, 'win32', nenhum)).toEqual({ ffmpeg: 'ffmpeg.exe', ffprobe: 'ffprobe.exe' });
  });

  it('sem nada instalado em local conhecido: PATH', () => {
    expect(resolverFfmpeg({}, 'linux', nenhum)).toEqual({ ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' });
  });
});
