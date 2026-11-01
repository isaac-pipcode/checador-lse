import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { PedidoIntercambio, RelatorioIntercambio } from '../src/desktop/ponte';
import { executarComProgresso, sondar, sondarVideo } from './ffmpeg';
import { filtroLibras } from './entrega';

/**
 * Exportação da sincronia para editores (Premiere, Resolve):
 *
 * – o intérprete JÁ TRATADO (recorte, despill, cor, enquadramento, posição,
 *   início e velocidade), em quadro inteiro, ProRes 4444 com alfa, alinhado ao
 *   quadro 0 da obra — o editor só o coloca acima do filme, sem refazer efeito;
 * – uma sequência em XML do Final Cut 7 (xmeml v5: Premiere e Resolve) e em
 *   FCPXML 1.8 (Resolve, Final Cut Pro), com a obra na V1, a Libras tratada na
 *   V2 e, desativado, o clipe bruto sincronizado na V3.
 *
 * FCPXML na versão 1.8 (mídia em `src` no asset), e não 1.9 (`media-rep`):
 * importada por mais versões do Resolve e do Final Cut, e lida pelo
 * OpenTimelineIO, que valida os arquivos nos testes.
 *
 * Os efeitos (chroma, posição) não vão como parâmetros no XML de propósito:
 * cada editor os traduz de um jeito, e o keyer não tem equivalente entre eles.
 */

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

export interface Cadencia {
  /** quadros por segundo exatos, como fração */
  num: number;
  den: number;
  /** base inteira do xmeml (24, 30, 60…) e se é NTSC (×1000/1001) */
  timebase: number;
  ntsc: boolean;
}

/** Fração exata da cadência: 23,976 → 24000/1001; 25 → 25/1. */
export function cadenciaDe(fps: number): Cadencia {
  for (const base of [24, 30, 48, 60, 120]) {
    if (Math.abs(fps - (base * 1000) / 1001) < 0.005) return { num: base * 1000, den: 1001, timebase: base, ntsc: true };
  }
  const r = Math.round(fps);
  if (Math.abs(fps - r) < 0.005) return { num: r, den: 1, timebase: r, ntsc: false };
  // cadência fora do padrão: aproxima em milésimos (raro em finalização)
  return { num: Math.round(fps * 1000), den: 1000, timebase: Math.round(fps), ntsc: false };
}

export const quadros = (ms: number, c: Cadencia) => Math.round((ms / 1000) * (c.num / c.den));
/** Tempo racional do FCPXML, múltiplo exato da duração do quadro: "N×den/num s". */
export const tempoFcpx = (q: number, c: Cadencia) => (q === 0 ? '0s' : `${q * c.den}/${c.num}s`);

/** URL de arquivo aceita pelos dois formatos (inclusive caminhos do Windows). */
export function urlArquivo(caminho: string, comLocalhost: boolean): string {
  let p = caminho.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(p)) p = `/${p}`;
  const cod = p
    .split('/')
    .map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ':'))
    .join('/');
  return comLocalhost ? `file://localhost${cod}` : `file://${cod}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Modelo comum aos dois formatos
// ---------------------------------------------------------------------------

export interface MidiaXml {
  caminho: string;
  nome: string;
  duracaoMs: number;
  largura: number;
  altura: number;
  temAudio: boolean;
  canais: number;
}

export interface SequenciaXml {
  nome: string;
  cadencia: Cadencia;
  largura: number;
  altura: number;
  duracaoMs: number;
  obra: MidiaXml;
  /** a Libras tratada, com alfa, alinhada ao quadro 0 */
  libras: MidiaXml;
  /** clipe bruto, sincronizado (só com velocidade 1; ver relatório) */
  bruto: (MidiaXml & { inicioNaObraMs: number }) | null;
}

/** Posição do clipe bruto na sequência: onde começa, de onde lê, quanto dura (em quadros). */
export function trechoBruto(s: SequenciaXml): { inicio: number; entrada: number; duracao: number } | null {
  if (!s.bruto) return null;
  const c = s.cadencia;
  const total = quadros(s.duracaoMs, c);
  const off = quadros(s.bruto.inicioNaObraMs, c);
  const inicio = Math.max(0, off);
  const entrada = Math.max(0, -off);
  const duracao = Math.min(quadros(s.bruto.duracaoMs, c) - entrada, total - inicio);
  return duracao > 0 ? { inicio, entrada, duracao } : null;
}

// ---------------------------------------------------------------------------
// XML do Final Cut 7 (xmeml v5) — Premiere Pro e DaVinci Resolve
// ---------------------------------------------------------------------------

export function gerarXmeml(s: SequenciaXml): string {
  const c = s.cadencia;
  const rate = `<rate><timebase>${c.timebase}</timebase><ntsc>${c.ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
  const total = quadros(s.duracaoMs, c);
  const amostra = (w: number, h: number) =>
    `<samplecharacteristics>${rate}<width>${w}</width><height>${h}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics>`;

  const arquivo = (id: string, m: MidiaXml, completo: boolean) =>
    completo
      ? `<file id="${id}"><name>${esc(m.nome)}</name><pathurl>${esc(urlArquivo(m.caminho, true))}</pathurl>${rate}<duration>${quadros(m.duracaoMs, c)}</duration>` +
        `<media><video>${amostra(m.largura, m.altura)}</video>` +
        (m.temAudio
          ? `<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>${m.canais}</channelcount></audio>`
          : '') +
        `</media></file>`
      : `<file id="${id}"/>`;

  const clipe = (a: {
    id: string;
    nome: string;
    arquivo: string;
    inicio: number;
    entrada: number;
    duracao: number;
    duracaoMidia: number;
    ativo?: boolean;
    trilhaAudio?: number;
  }) =>
    `<clipitem id="${a.id}"><name>${esc(a.nome)}</name><enabled>${a.ativo === false ? 'FALSE' : 'TRUE'}</enabled>` +
    `<duration>${a.duracaoMidia}</duration>${rate}<start>${a.inicio}</start><end>${a.inicio + a.duracao}</end>` +
    `<in>${a.entrada}</in><out>${a.entrada + a.duracao}</out>${a.arquivo}` +
    (a.trilhaAudio ? `<sourcetrack><mediatype>audio</mediatype><trackindex>${a.trilhaAudio}</trackindex></sourcetrack>` : '') +
    `</clipitem>`;

  const durObra = quadros(s.obra.duracaoMs, c);
  const v1 = clipe({ id: 'obra-v', nome: s.obra.nome, arquivo: arquivo('arq-obra', s.obra, true), inicio: 0, entrada: 0, duracao: Math.min(total, durObra), duracaoMidia: durObra });
  const v2 = clipe({
    id: 'libras-v',
    nome: `Libras — ${s.libras.nome}`,
    arquivo: arquivo('arq-libras', s.libras, true),
    inicio: 0,
    entrada: 0,
    duracao: Math.min(total, quadros(s.libras.duracaoMs, c)),
    duracaoMidia: quadros(s.libras.duracaoMs, c),
  });
  const tb = trechoBruto(s);
  const v3 =
    tb && s.bruto
      ? clipe({
          id: 'bruto-v',
          nome: `Libras bruto (sincronizado) — ${s.bruto.nome}`,
          arquivo: arquivo('arq-bruto', s.bruto, true),
          inicio: tb.inicio,
          entrada: tb.entrada,
          duracao: tb.duracao,
          duracaoMidia: quadros(s.bruto.duracaoMs, c),
          ativo: false,
        })
      : null;

  const audios = s.obra.temAudio
    ? Array.from({ length: Math.min(2, Math.max(1, s.obra.canais)) }, (_, k) =>
        `<track>${clipe({ id: `obra-a${k + 1}`, nome: s.obra.nome, arquivo: arquivo('arq-obra', s.obra, false), inicio: 0, entrada: 0, duracao: Math.min(total, durObra), duracaoMidia: durObra, trilhaAudio: k + 1 })}</track>`,
      ).join('')
    : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5">\n` +
    `<sequence id="seq-estudio"><name>${esc(s.nome)}</name><duration>${total}</duration>${rate}` +
    `<timecode>${rate}<string>${c.ntsc ? '00:00:00;00' : '00:00:00:00'}</string><frame>0</frame><displayformat>${c.ntsc ? 'DF' : 'NDF'}</displayformat></timecode>` +
    `<media><video><format>${amostra(s.largura, s.altura)}</format>` +
    `<track>${v1}</track><track>${v2}</track>${v3 ? `<track>${v3}</track>` : ''}</video>` +
    `<audio>${audios}</audio></media></sequence>\n</xmeml>\n`
  );
}

// ---------------------------------------------------------------------------
// FCPXML 1.8 — DaVinci Resolve e Final Cut Pro
// ---------------------------------------------------------------------------

export function gerarFcpxml(s: SequenciaXml): string {
  const c = s.cadencia;
  const t = (q: number) => tempoFcpx(q, c);
  const total = quadros(s.duracaoMs, c);
  const ativo = (id: string, m: MidiaXml) =>
    `<asset id="${id}" name="${esc(m.nome)}" src="${esc(urlArquivo(m.caminho, false))}" start="0s" duration="${t(quadros(m.duracaoMs, c))}" hasVideo="1" format="r1"` +
    (m.temAudio ? ` hasAudio="1" audioSources="1" audioChannels="${m.canais}" audioRate="48000"` : ' hasAudio="0"') +
    `/>`;
  const tb = trechoBruto(s);
  const durObra = Math.min(total, quadros(s.obra.duracaoMs, c));

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.8">\n<resources>` +
    `<format id="r1" frameDuration="${c.den}/${c.num}s" width="${s.largura}" height="${s.altura}" colorSpace="1-1-1 (Rec. 709)"/>` +
    ativo('r2', s.obra) +
    ativo('r3', s.libras) +
    (tb && s.bruto ? ativo('r4', s.bruto) : '') +
    `</resources>\n<library><event name="Estúdio de Acessibilidade"><project name="${esc(s.nome)}">` +
    `<sequence format="r1" duration="${t(total)}" tcStart="0s" tcFormat="${c.ntsc ? 'DF' : 'NDF'}" audioLayout="stereo" audioRate="48k"><spine>` +
    `<asset-clip ref="r2" offset="0s" name="${esc(s.obra.nome)}" start="0s" duration="${t(durObra)}" tcFormat="NDF">` +
    `<asset-clip ref="r3" lane="1" offset="0s" name="${esc(`Libras — ${s.libras.nome}`)}" start="0s" duration="${t(Math.min(total, quadros(s.libras.duracaoMs, c)))}"/>` +
    (tb && s.bruto
      ? `<asset-clip ref="r4" lane="2" offset="${t(tb.inicio)}" name="${esc(`Libras bruto (sincronizado) — ${s.bruto.nome}`)}" start="${t(tb.entrada)}" duration="${t(tb.duracao)}" enabled="0"/>`
      : '') +
    `</asset-clip></spine></sequence></project></event></library>\n</fcpxml>\n`
  );
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

function leiaMe(nome: string, arquivos: { alfa: string; xml?: string; fcpxml?: string }, avisos: string[]): string {
  return [
    `EXPORTAÇÃO DA SINCRONIA — ${nome}`,
    '',
    `${basename(arquivos.alfa)}`,
    '  Intérprete de Libras já tratado (fundo removido, cor, enquadramento, posição) e sincronizado',
    '  ao quadro 0 da obra. ProRes 4444 com canal alfa, mesma resolução e cadência da obra.',
    '  Basta colocá-lo numa trilha acima do filme, a partir do início.',
    '',
    arquivos.xml
      ? `${basename(arquivos.xml)}  (XML do Final Cut 7)\n  Premiere Pro: Arquivo › Importar… › escolha o .xml.\n  DaVinci Resolve: Arquivo › Importar › Linha do tempo… (também aceita este formato).\n`
      : '',
    arquivos.fcpxml
      ? `${basename(arquivos.fcpxml)}  (FCPXML 1.8)\n  DaVinci Resolve: Arquivo › Importar › Linha do tempo… › escolha o .fcpxml.\n  Final Cut Pro: Arquivo › Importar › XML…\n`
      : '',
    'Na sequência: V1 = obra, V2 = Libras tratada (com alfa), V3 = clipe bruto do intérprete,',
    'sincronizado e DESATIVADO, para quem quiser refazer o recorte no próprio editor.',
    'Os arquivos são referenciados pelo caminho absoluto: se mudarem de lugar, reconecte a mídia.',
    '',
    ...(avisos.length ? ['Avisos:', ...avisos.map((a) => `  - ${a}`), ''] : []),
    'Gerado pelo Estúdio de Acessibilidade. Validado com o OpenTimelineIO; a importação em cada',
    'versão de Premiere e Resolve deve ser conferida na primeira vez.',
    '',
  ].join('\r\n');
}

export async function exportarSincronia(
  pedido: PedidoIntercambio,
  pasta: string,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<RelatorioIntercambio> {
  const avisos: string[] = [];
  const obra = await sondar(pedido.videoCaminho);
  const infoObra = await sondarVideo(pedido.videoCaminho);
  const clipe = await sondar(pedido.libras.caminho);
  const infoClipe = await sondarVideo(pedido.libras.caminho);
  if (!obra.largura || !clipe.largura) throw new Error('Não foi possível ler as dimensões dos vídeos.');
  const c = cadenciaDe(infoObra.fps ?? 24);
  const duracaoMs = obra.duracaoMs || pedido.duracaoMs;
  const dur = (quadros(duracaoMs, c) * c.den) / c.num;

  // 1. Libras tratada com alfa, em quadro inteiro
  const alfa = join(pasta, `${pedido.nomeBase}-libras-alfa.mov`);
  aoProgredir(0, 'Renderizando a Libras com alfa');
  const { filtro, rotuloSaida } = filtroLibras({
    quadro: { w: obra.largura, h: obra.altura },
    fonte: { w: clipe.largura, h: clipe.altura },
    janela: pedido.libras.janela,
    inicioNaObraMs: pedido.libras.inicioNaObraMs,
    entrada: 1,
    alfa: true,
  });
  const r = await executarComProgresso(
    [
      '-y',
      '-f', 'lavfi', '-i', `color=c=black@0.0:s=${obra.largura}x${obra.altura}:r=${c.num}/${c.den}:d=${dur.toFixed(6)},format=yuva444p`,
      '-i', pedido.libras.caminho,
      '-filter_complex', filtro, '-map', rotuloSaida, '-an',
      '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0',
      alfa,
    ],
    duracaoMs,
    (f) => aoProgredir(f * 0.95, 'Renderizando a Libras com alfa'),
  );
  if (r.codigo !== 0) throw new Error(`ffmpeg: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  const infoAlfa = await sondar(alfa);

  // 2. Sequência
  const velocidade = pedido.libras.janela.velocidade ?? 1;
  const midia = (caminho: string, i: { duracaoMs: number; largura: number; altura: number; temAudio: boolean }, canais: number | null): MidiaXml => ({
    caminho,
    nome: basename(caminho),
    duracaoMs: i.duracaoMs,
    largura: i.largura,
    altura: i.altura,
    temAudio: i.temAudio,
    canais: Math.max(1, Math.min(2, canais ?? 2)),
  });
  let bruto: SequenciaXml['bruto'] = null;
  if (pedido.incluirBruto) {
    if (Math.abs(velocidade - 1) > 1e-6) {
      avisos.push(
        `O clipe bruto não foi incluído: a sincronia usa velocidade ×${velocidade.toFixed(5)} (deriva/cadência), e a mudança de velocidade não se transfere de forma confiável entre editores. A Libras tratada (V2) já está conformada.`,
      );
    } else {
      bruto = { ...midia(pedido.libras.caminho, clipe, infoClipe.canaisAudio), inicioNaObraMs: pedido.libras.inicioNaObraMs };
    }
  }
  if ((infoObra.canaisAudio ?? 0) > 2) {
    avisos.push(`A obra tem ${infoObra.canaisAudio} canais de áudio; a sequência referencia só os dois primeiros.`);
  }
  const seq: SequenciaXml = {
    nome: `${pedido.nomeBase} — acessível`,
    cadencia: c,
    largura: obra.largura,
    altura: obra.altura,
    duracaoMs,
    obra: midia(pedido.videoCaminho, obra, infoObra.canaisAudio),
    libras: midia(alfa, { ...infoAlfa, temAudio: false }, null),
    bruto,
  };

  const arquivos: string[] = [alfa];
  const nomes: { alfa: string; xml?: string; fcpxml?: string } = { alfa };
  if (pedido.formatos.xmeml) {
    nomes.xml = join(pasta, `${pedido.nomeBase}-premiere.xml`);
    writeFileSync(nomes.xml, gerarXmeml(seq), 'utf-8');
    arquivos.push(nomes.xml);
  }
  if (pedido.formatos.fcpxml) {
    nomes.fcpxml = join(pasta, `${pedido.nomeBase}-resolve.fcpxml`);
    writeFileSync(nomes.fcpxml, gerarFcpxml(seq), 'utf-8');
    arquivos.push(nomes.fcpxml);
  }
  const leia = join(pasta, 'LEIA-ME.txt');
  writeFileSync(leia, leiaMe(pedido.nomeBase, nomes, avisos), 'utf-8');
  arquivos.push(leia);
  aoProgredir(1, 'Concluído');
  return { pasta, arquivos, cadencia: `${c.num}/${c.den}`, avisos };
}
