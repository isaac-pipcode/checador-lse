import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cadenciaDe, exportarSincronia, gerarFcpxml, gerarXmeml, tempoFcpx, trechoBruto, urlArquivo, type SequenciaXml } from './intercambio';
import { JANELA_PADRAO } from '../src/libras/tipos';

const temOtio = spawnSync('python3', ['-c', 'import opentimelineio as o; o.adapters.from_name("fcp_xml"); o.adapters.from_name("fcpx_xml")']).status === 0;
const temFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

interface Resumo {
  nome: string;
  trilhas: Array<{
    tipo: string;
    clipes: Array<{
      nome: string; inicio: number; duracao: number; entrada: number | null; taxa: number; ativo: boolean; url: string | null;
      inicio_s: number; duracao_s: number; entrada_s: number | null;
    }>;
  }>;
}
function lerComOtio(arquivo: string, adaptador: 'fcp_xml' | 'fcpx_xml'): Resumo {
  return JSON.parse(execFileSync('python3', [join(__dirname, 'validar_otio.py'), arquivo, adaptador]).toString());
}

const midia = (caminho: string, duracaoMs: number, extra: Partial<SequenciaXml['obra']> = {}) => ({
  caminho, nome: caminho.split('/').pop()!, duracaoMs, largura: 1920, altura: 1080, temAudio: true, canais: 2, ...extra,
});

function sequencia(inicioBruto: number): SequenciaXml {
  return {
    nome: 'Curta & teste <acessível>',
    cadencia: cadenciaDe(24000 / 1001),
    largura: 1920,
    altura: 1080,
    duracaoMs: 60_000,
    obra: midia('/projetos/A Entrega/obra final.mov', 60_000),
    libras: midia('/projetos/A Entrega/obra final-libras-alfa.mov', 60_000, { temAudio: false }),
    bruto: { ...midia('/gravações/intérprete 01.mp4', 50_000), inicioNaObraMs: inicioBruto },
  };
}

describe('tempo e caminhos', () => {
  it('cadências exatas: 23,976 = 24000/1001 (NTSC), 25 = 25/1', () => {
    expect(cadenciaDe(23.976)).toEqual({ num: 24000, den: 1001, timebase: 24, ntsc: true });
    expect(cadenciaDe(29.97)).toMatchObject({ num: 30000, den: 1001, ntsc: true });
    expect(cadenciaDe(25)).toEqual({ num: 25, den: 1, timebase: 25, ntsc: false });
    // FCPXML: tempos como múltiplos exatos da duração do quadro
    expect(tempoFcpx(48, cadenciaDe(23.976))).toBe('48048/24000s');
    expect(tempoFcpx(0, cadenciaDe(25))).toBe('0s');
  });

  it('URLs de arquivo com espaços, acentos e caminhos do Windows', () => {
    expect(urlArquivo('/gravações/intérprete 01.mp4', true)).toBe('file://localhost/grava%C3%A7%C3%B5es/int%C3%A9rprete%2001.mp4');
    expect(urlArquivo('C:\\Filmes\\obra.mov', false)).toBe('file:///C:/Filmes/obra.mov');
  });

  it('clipe bruto: começa depois (deslocado) ou antes da obra (com ponto de entrada)', () => {
    expect(trechoBruto(sequencia(2000))).toEqual({ inicio: 48, entrada: 0, duracao: 1199 });
    expect(trechoBruto(sequencia(-1500))).toEqual({ inicio: 0, entrada: 36, duracao: 1163 });
  });

  it('nomes com &, < e > são escapados', () => {
    expect(gerarXmeml(sequencia(0))).toContain('Curta &amp; teste &lt;acessível&gt;');
    expect(gerarFcpxml(sequencia(0))).toContain('name="Curta &amp; teste &lt;acessível&gt;"');
  });
});

describe.skipIf(!temOtio)('validação independente com o OpenTimelineIO', () => {
  const d = mkdtempSync(join(tmpdir(), 'otio-'));

  it('XML do Final Cut 7 (Premiere): V1 obra, V2 Libras em 0, V3 bruto desativado e deslocado; A1/A2', () => {
    const arq = join(d, 'p.xml');
    writeFileSync(arq, gerarXmeml(sequencia(2000)));
    const r = lerComOtio(arq, 'fcp_xml');
    const video = r.trilhas.filter((t) => t.tipo === 'Video');
    const audio = r.trilhas.filter((t) => t.tipo === 'Audio');
    expect(video).toHaveLength(3);
    expect(audio).toHaveLength(2);
    expect(video[0].clipes[0]).toMatchObject({ inicio: 0, duracao: 1439, taxa: 23.976023976023978 });
    expect(video[1].clipes[0]).toMatchObject({ inicio: 0, duracao: 1439 });
    expect(video[1].clipes[0].url).toContain('obra%20final-libras-alfa.mov');
    expect(video[2].clipes[0]).toMatchObject({ inicio: 48, entrada: 0, duracao: 1199 });
    // o adaptador do OTIO não lê <enabled>; o atributo é conferido no próprio XML
    expect(readFileSync(arq, 'utf-8')).toMatch(/<clipitem id="bruto-v"><name>[^<]*<\/name><enabled>FALSE<\/enabled>/);
  });

  it('FCPXML (Resolve): mesmas posições, com o bruto começando antes da obra', () => {
    const arq = join(d, 'r.fcpxml');
    writeFileSync(arq, gerarFcpxml(sequencia(-1500)));
    const r = lerComOtio(arq, 'fcpx_xml');
    const video = r.trilhas.filter((t) => t.tipo === 'Video');
    const clipes = video.flatMap((t) => t.clipes);
    const libras = clipes.find((c) => c.nome.startsWith('Libras —'))!;
    const bruto = clipes.find((c) => c.nome.startsWith('Libras bruto'))!;
    const obra = clipes.find((c) => c.nome === 'obra final.mov')!;
    // O adaptador de FCPXML do OTIO trunca a cadência NTSC (int(23,976) = 23) ao converter:
    // o tempo que ele informa é o correto arredondado para baixo a 1/23 s. Compara-se em
    // segundos com tolerância de um quadro dele.
    const seg = (q: number) => (q * 1001) / 24000;
    const perto = (a: number | null, q: number) => expect(Math.abs((a ?? NaN) - seg(q))).toBeLessThan(1 / 23 + 1e-3);
    perto(obra.inicio_s, 0);
    perto(obra.duracao_s, 1439);
    perto(libras.inicio_s, 0);
    perto(libras.duracao_s, 1439);
    perto(bruto.inicio_s, 0);
    perto(bruto.entrada_s, 36);
    perto(bruto.duracao_s, 1163);
    expect(libras.url).toBe('file:///projetos/A%20Entrega/obra%20final-libras-alfa.mov');
    expect(readFileSync(arq, 'utf-8')).toMatch(/<asset-clip ref="r4" lane="2"[^>]*enabled="0"\/>/);
  });
});

describe.skipIf(!temFfmpeg || !temOtio)('exportação completa (ffmpeg + OpenTimelineIO)', () => {
  it('Libras com alfa em quadro inteiro, alinhada ao quadro 0, e os dois XMLs coerentes com ela', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'nle-'));
    const obra = join(process.cwd(), 'exemplos/exemplo-estudio.webm');
    const clipe = join(process.cwd(), 'exemplos/exemplo-interprete.webm');
    const rel = await exportarSincronia(
      {
        videoCaminho: obra,
        nomeBase: 'exemplo',
        duracaoMs: 30_000,
        libras: { caminho: clipe, inicioNaObraMs: 2000, janela: { ...JANELA_PADRAO } },
        formatos: { xmeml: true, fcpxml: true },
        incluirBruto: true,
      },
      pasta,
      () => {},
    );
    expect(readdirSync(pasta).sort()).toEqual(['LEIA-ME.txt', 'exemplo-libras-alfa.mov', 'exemplo-premiere.xml', 'exemplo-resolve.fcpxml']);
    expect(rel.cadencia).toBe('24/1');

    const alfa = join(pasta, 'exemplo-libras-alfa.mov');
    const p = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,r_frame_rate,pix_fmt:format=duration', '-of', 'json', alfa]).toString();
    const j = JSON.parse(p);
    expect(j.streams[0]).toMatchObject({ codec_name: 'prores', profile: '4444', width: 320, height: 180, r_frame_rate: '24/1' });
    expect(j.streams[0].pix_fmt).toMatch(/^yuva444p1[02]le$/);
    expect(Math.abs(Number(j.format.duration) - 30)).toBeLessThan(0.1);

    // alfa: transparente antes do clipe e fora da janela; opaco no intérprete
    const alfaEm = (t: number, x: number, y: number) =>
      execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(t), '-i', alfa, '-frames:v', '1', '-vf', `crop=2:2:${x}:${y},format=rgba`, '-f', 'rawvideo', '-'])[3];
    const r = { x: 320 - 80 - 16, y: 180 - 90 - 16 }; // janela padrão: 80×90 com margem de 9% de 180
    expect(alfaEm(1, r.x + 40, r.y + 60)).toBe(0); // antes de 2 s
    expect(alfaEm(10, 10, 10)).toBe(0); // fora da janela
    expect(alfaEm(10, r.x + 40, r.y + 70)).toBeGreaterThan(200); // corpo do intérprete

    const xml = lerComOtio(join(pasta, 'exemplo-premiere.xml'), 'fcp_xml');
    const v = xml.trilhas.filter((t) => t.tipo === 'Video');
    expect(v[1].clipes[0]).toMatchObject({ inicio: 0, duracao: 720 });
    expect(v[2].clipes[0]).toMatchObject({ inicio: 48 });
    const fcpx = lerComOtio(join(pasta, 'exemplo-resolve.fcpxml'), 'fcpx_xml');
    // a 24 qd/s inteiros o adaptador não trunca: segundos exatos
    expect(fcpx.trilhas.flatMap((t) => t.clipes).map((c) => c.inicio_s).sort((a, b) => a - b)).toEqual([0, 0, 2]);
    expect(fcpx.trilhas.flatMap((t) => t.clipes).every((c) => c.url?.startsWith('file:///'))).toBe(true);
    expect(readFileSync(join(pasta, 'LEIA-ME.txt'), 'utf-8')).toContain('Premiere Pro: Arquivo › Importar');
  }, 120_000);

  it('com deriva (velocidade ≠ 1), o bruto fica de fora e o aviso explica', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'nle-v-'));
    const rel = await exportarSincronia(
      {
        videoCaminho: join(process.cwd(), 'exemplos/exemplo-estudio.webm'),
        nomeBase: 'x',
        duracaoMs: 30_000,
        libras: { caminho: join(process.cwd(), 'exemplos/exemplo-interprete.webm'), inicioNaObraMs: 0, janela: { ...JANELA_PADRAO, velocidade: 1.0001 } },
        formatos: { xmeml: true, fcpxml: false },
        incluirBruto: true,
      },
      pasta,
      () => {},
    );
    expect(rel.avisos[0]).toMatch(/clipe bruto não foi incluído/);
    const v = lerComOtio(join(pasta, 'x-premiere.xml'), 'fcp_xml').trilhas.filter((t) => t.tipo === 'Video');
    expect(v).toHaveLength(2);
  }, 120_000);
});
