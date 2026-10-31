import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { PedidoEntrega, RelatorioEntrega } from '../src/desktop/ponte';
import { recorteNaFonte, retanguloJanela } from '../src/libras/geometria';
import { executarComProgresso, medirLoudness, sondar } from './ffmpeg';
import { renderizar as renderizarAd } from './render';

/** Nome e idioma da faixa. MKV lê `title`; MP4 guarda o nome em `handler_name`. */
const rotular = (tipo: 'a' | 's', i: number, nome: string) => [
  `-metadata:s:${tipo}:${i}`, `title=${nome}`,
  `-metadata:s:${tipo}:${i}`, `handler_name=${nome}`,
  `-metadata:s:${tipo}:${i}`, 'language=por',
];

const hex = (c: string) => `0x${c.replace('#', '').toUpperCase()}`;
const num = (n: number, casas = 3) => n.toFixed(casas);

/**
 * Monta o filtro da janela de Libras (puro, testável): recorte "cobrir" no
 * clipe, escala para a janela, chroma key opcional, fundo sólido opcional e
 * sobreposição no canto, deslocada no tempo.
 */
export function filtroLibras(args: {
  quadro: { w: number; h: number };
  fonte: { w: number; h: number };
  janela: NonNullable<PedidoEntrega['libras']>['janela'];
  inicioNaObraMs: number;
  entrada: number;
}): { filtro: string; rotuloSaida: string } {
  const { quadro, fonte, janela: j, inicioNaObraMs, entrada } = args;
  const r = retanguloJanela(j, quadro.w, quadro.h);
  const c = recorteNaFonte({ w: r.w, h: r.h }, fonte, j.zoom, j.deslocY);
  const par = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const partes: string[] = [];
  let tempo: string;
  if (inicioNaObraMs >= 0) tempo = `setpts=PTS-STARTPTS+${num(inicioNaObraMs / 1000)}/TB`;
  else tempo = `trim=start=${num(-inicioNaObraMs / 1000)},setpts=PTS-STARTPTS`;
  let cadeia = `[${entrada}:v]${tempo},crop=${par(c.w)}:${par(c.h)}:${Math.round(c.x)}:${Math.round(c.y)},scale=${r.w}:${r.h},setsar=1`;
  if (j.chroma.ativo) {
    cadeia += `,chromakey=${hex(j.chroma.cor)}:${num(Math.max(0.01, j.chroma.similaridade))}:${num(j.chroma.suavidade)}`;
  }
  if (j.chroma.ativo && j.fundo === 'solido') {
    partes.push(`${cadeia}[libk]`);
    partes.push(`color=c=${hex(j.corFundo)}:s=${r.w}x${r.h}[libf]`);
    partes.push(`[libf][libk]overlay=0:0:shortest=1[lib]`);
  } else {
    partes.push(`${cadeia}[lib]`);
  }
  partes.push(`[0:v][lib]overlay=${r.x}:${r.y}:eof_action=pass[vout]`);
  return { filtro: partes.join(';'), rotuloSaida: '[vout]' };
}

/**
 * Pacote de entrega: um arquivo com tudo o que estiver pronto —
 * vídeo (com a janela de Libras queimada, se houver), faixa de áudio
 * original, faixa com audiodescrição e a LSE como legenda selecionável.
 *
 * Com Libras: MP4 (H.264 recodificado, AAC). Sem Libras: MKV com o vídeo
 * copiado, sem recompressão.
 */
export async function renderizarEntrega(
  pedido: PedidoEntrega,
  pasta: string,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<RelatorioEntrega> {
  const avisos: string[] = [];
  const tmp = mkdtempSync(join(tmpdir(), 'estudio-entrega-'));
  try {
    const obra = await sondar(pedido.videoCaminho);
    const duracaoMs = obra.duracaoMs || pedido.duracaoMs;

    // 1. Mixagem de AD (reaproveita a renderização do passo 2)
    let mixAd: string | null = null;
    if (pedido.ad && pedido.ad.clipes.length > 0) {
      const r = await renderizarAd(
        { ...pedido.ad, videoCaminho: pedido.videoCaminho, nomeBase: 'ad', duracaoMs, saidas: { mixagem: true, trilhaAd: false, video: false } },
        tmp,
        (f, etapa) => aoProgredir(f * 0.35, `Audiodescrição: ${etapa}`),
      );
      mixAd = r.arquivos[0] ?? null;
      avisos.push(...r.avisos.map((a) => `AD: ${a}`));
    }

    // 2. Montagem
    const args: string[] = ['-y', '-i', pedido.videoCaminho];
    let idx = 1;
    let idxLibras = -1;
    if (pedido.libras) {
      args.push('-i', pedido.libras.caminho);
      idxLibras = idx++;
    }
    let idxAd = -1;
    if (mixAd) {
      args.push('-i', mixAd);
      idxAd = idx++;
    }
    let idxLeg = -1;
    if (pedido.legendaSrt) {
      const srt = join(tmp, 'lse.srt');
      writeFileSync(srt, pedido.legendaSrt, 'utf-8');
      args.push('-i', srt);
      idxLeg = idx++;
    }

    const comLibras = idxLibras >= 0;
    const ext = comLibras ? 'mp4' : 'mkv';
    if (comLibras) {
      const clipe = await sondar(pedido.libras!.caminho);
      if (!obra.largura || !clipe.largura) throw new Error('Não foi possível ler as dimensões dos vídeos.');
      const { filtro, rotuloSaida } = filtroLibras({
        quadro: { w: obra.largura, h: obra.altura },
        fonte: { w: clipe.largura, h: clipe.altura },
        janela: pedido.libras!.janela,
        inicioNaObraMs: pedido.libras!.inicioNaObraMs,
        entrada: idxLibras,
      });
      args.push('-filter_complex', filtro, '-map', rotuloSaida);
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p');
    } else {
      args.push('-map', '0:v:0', '-c:v', 'copy');
    }

    let nAudio = 0;
    if (obra.temAudio) {
      args.push('-map', '0:a:0');
      args.push(...rotular('a', nAudio, 'Original'));
      nAudio++;
    }
    if (idxAd >= 0) {
      args.push('-map', `${idxAd}:a:0`);
      args.push(...rotular('a', nAudio, 'Audiodescrição'));
      nAudio++;
    }
    if (nAudio > 0) args.push('-c:a', 'aac', '-b:a', '192k');
    if (idxLeg >= 0) {
      args.push('-map', `${idxLeg}:s:0`, '-c:s', comLibras ? 'mov_text' : 'srt');
      args.push(...rotular('s', 0, 'LSE'));
    }
    const saida = join(pasta, `${pedido.nomeBase}-acessivel.${ext}`);
    args.push(saida);

    const etapa = comLibras ? 'Compondo a janela de Libras e codificando' : 'Montando o arquivo';
    const r = await executarComProgresso(args, duracaoMs, (f) => aoProgredir(0.35 + f * 0.6, etapa));
    if (r.codigo !== 0) throw new Error(`ffmpeg: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);

    aoProgredir(0.97, 'Medindo');
    const loudness = idxAd >= 0 && mixAd ? await medirLoudness(mixAd) : null;
    const final = await sondar(saida);
    aoProgredir(1, 'Concluído');
    return {
      arquivo: saida,
      duracaoMs: final.duracaoMs,
      faixas: {
        video: comLibras ? 'H.264 com janela de Libras' : `${obra.codecVideo ?? 'vídeo'} (copiado)`,
        audios: [obra.temAudio ? 'Original' : null, idxAd >= 0 ? 'Audiodescrição' : null].filter((x): x is string => !!x),
        legenda: idxLeg >= 0 ? 'LSE (selecionável)' : null,
      },
      loudnessAd: loudness,
      avisos,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
