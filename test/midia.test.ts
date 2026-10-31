import { describe, expect, it } from 'vitest';
import { avaliarMidia, fpsDeFracao, type InfoVideo } from '../src/midia/avaliacao';

const base: InfoVideo = {
  codec: 'h264', perfil: 'High', pixFmt: 'yuv420p', largura: 1920, altura: 1080,
  fps: 24, bitrate: 12e6, duracaoMs: 60000, temAudio: true, canaisAudio: 2,
};

describe('avaliação de mídia para proxy', () => {
  it('H.264 8 bits em 1080p: proxy dispensável', () => {
    const a = avaliarMidia(base);
    expect(a.necessidade).toBe('dispensavel');
    expect(a.descricao).toBe('H.264 · 1920×1080 · 24 qd/s');
  });

  it('ProRes e DNxHR: obrigatório (o motor não reproduz)', () => {
    expect(avaliarMidia({ ...base, codec: 'prores', perfil: 'HQ', pixFmt: 'yuv422p10le' }).necessidade).toBe('obrigatorio');
    expect(avaliarMidia({ ...base, codec: 'dnxhd' }).reproduzivel).toBe('nao');
  });

  it('H.264 de 10 bits: obrigatório', () => {
    const a = avaliarMidia({ ...base, pixFmt: 'yuv420p10le', perfil: 'High 10' });
    expect(a.necessidade).toBe('obrigatorio');
    expect(a.descricao).toMatch(/^H\.264 10 bits/);
  });

  it('HEVC: recomendado (depende de hardware)', () => {
    expect(avaliarMidia({ ...base, codec: 'hevc' })).toMatchObject({ reproduzivel: 'incerto', necessidade: 'recomendado' });
  });

  it('4K, alta taxa ou alta cadência: recomendado, com os motivos', () => {
    const a = avaliarMidia({ ...base, largura: 3840, altura: 2160, bitrate: 120e6, fps: 59.94 });
    expect(a.necessidade).toBe('recomendado');
    expect(a.motivos).toHaveLength(3);
    expect(a.descricao).toBe('H.264 · 3840×2160 · 59,940 qd/s');
  });

  it('fps a partir da fração do ffprobe', () => {
    expect(fpsDeFracao('24000/1001')).toBeCloseTo(23.976, 3);
    expect(fpsDeFracao('25/1')).toBe(25);
    expect(fpsDeFracao('0/0')).toBeNull();
  });
});
