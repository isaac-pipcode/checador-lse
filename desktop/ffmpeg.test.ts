import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolverFfmpeg } from './ffmpeg';

describe('onde procurar o ffmpeg', () => {
  const nenhum = () => false;

  it('variável OUVER_FFMPEG manda; ffprobe ao lado', () => {
    const r = resolverFfmpeg({ OUVER_FFMPEG: '/opt/ff/ffmpeg' }, 'linux', nenhum, null);
    expect(r).toEqual({ ffmpeg: '/opt/ff/ffmpeg', ffprobe: join('/opt/ff', 'ffprobe'), origem: 'variavel' });
  });

  it('nome antigo (CHECADOR_FFMPEG) continua valendo', () => {
    expect(resolverFfmpeg({ CHECADOR_FFMPEG: '/x/ffmpeg' }, 'linux', nenhum, null).ffmpeg).toBe('/x/ffmpeg');
  });

  it('macOS: acha o ffmpeg do Homebrew mesmo sem PATH (app aberto pelo Finder)', () => {
    const r = resolverFfmpeg({}, 'darwin', (c) => c === '/opt/homebrew/bin/ffmpeg', null);
    expect(r.ffmpeg).toBe('/opt/homebrew/bin/ffmpeg');
    expect(r.ffprobe).toBe('/opt/homebrew/bin/ffprobe');
  });

  it('Windows: usa .exe e cai no PATH quando não acha nos locais usuais', () => {
    expect(resolverFfmpeg({}, 'win32', nenhum, null)).toEqual({ ffmpeg: 'ffmpeg.exe', ffprobe: 'ffprobe.exe', origem: 'path' });
  });

  it('sem nada instalado em local conhecido: PATH', () => {
    expect(resolverFfmpeg({}, 'linux', nenhum, null)).toEqual({ ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', origem: 'path' });
  });

  it('instalador: usa o ffmpeg embutido antes do sistema, mas a variável ainda manda', () => {
    const rec = join('/app', 'resources', 'ffmpeg');
    const tem = (c: string) => c.startsWith(rec) || c === '/opt/homebrew/bin/ffmpeg';
    expect(resolverFfmpeg({}, 'darwin', tem, rec)).toEqual({
      ffmpeg: join(rec, 'ffmpeg'),
      ffprobe: join(rec, 'ffprobe'),
      origem: 'embutido',
    });
    expect(resolverFfmpeg({}, 'win32', tem, rec).ffmpeg).toBe(join(rec, 'ffmpeg.exe'));
    expect(resolverFfmpeg({ OUVER_FFMPEG: '/meu/ffmpeg' }, 'darwin', tem, rec).origem).toBe('variavel');
  });

  it('pasta embutida vazia (ex.: em desenvolvimento): segue a busca normal', () => {
    expect(resolverFfmpeg({}, 'linux', (c) => c === '/usr/bin/ffmpeg', '/app/resources/ffmpeg').origem).toBe('sistema');
  });
});
