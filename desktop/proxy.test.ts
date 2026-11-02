import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gerarProxy } from './proxy';
import { sondarVideo } from './ffmpeg';
import { avaliarMidia } from '../src/midia/avaliacao';

const pronto = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

describe.skipIf(!pronto)('proxy (ffmpeg)', () => {
  it('master ProRes 1080p → avaliado como obrigatório → proxy H.264 720p, mesma duração, GOP curto, reaproveitado', async () => {
    const d = mkdtempSync(join(tmpdir(), 'proxy-'));
    const master = join(d, 'master.mov');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=24000/1001:d=3',
      '-f', 'lavfi', '-i', 'sine=f=440:sample_rate=48000:d=3',
      '-c:v', 'prores_ks', '-profile:v', '0', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s24le', master,
    ]);
    const info = await sondarVideo(master);
    expect(info.codec).toBe('prores');
    expect(info.fps).toBeCloseTo(23.976, 2);
    expect(avaliarMidia(info).necessidade).toBe('obrigatorio');

    const progresso: number[] = [];
    const r = await gerarProxy(master, join(d, 'proxies'), (f) => progresso.push(f));
    expect(r.reaproveitado).toBe(false);
    const p = await sondarVideo(r.caminho);
    expect(p).toMatchObject({ codec: 'h264', largura: 1280, altura: 720, pixFmt: 'yuv420p', temAudio: true, canaisAudio: 2 });
    expect(Math.abs(p.duracaoMs - info.duracaoMs)).toBeLessThanOrEqual(50);
    expect(avaliarMidia(p).necessidade).toBe('dispensavel');
    expect(progresso.length).toBeGreaterThan(0);

    // quadros-chave a cada 12 quadros: busca rápida
    const chaves = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-skip_frame', 'nokey', '-show_entries', 'frame=pts', '-of', 'csv=p=0', r.caminho])
      .toString().trim().split('\n').length;
    expect(chaves).toBeGreaterThanOrEqual(Math.floor((3 * 24) / 12));

    // segunda chamada: reaproveita, sem arquivo .parcial esquecido
    const r2 = await gerarProxy(master, join(d, 'proxies'), () => {});
    expect(r2).toEqual({ caminho: r.caminho, reaproveitado: true });
    expect(readdirSync(join(d, 'proxies'))).toEqual([r.caminho.split('/').pop()]);
  }, 60000);

  it('cancelar interrompe e não deixa arquivo', async () => {
    const d = mkdtempSync(join(tmpdir(), 'proxy-c-'));
    const master = join(d, 'm.mov');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=24:d=20', '-c:v', 'prores_ks', '-profile:v', '0', master]);
    const ctrl = new AbortController();
    const p = gerarProxy(master, join(d, 'px'), (f) => f > 0.05 && ctrl.abort(), ctrl.signal);
    await expect(p).rejects.toThrow(/cancelado/);
    expect(readdirSync(join(d, 'px'))).toEqual([]);
  }, 60000);
});
