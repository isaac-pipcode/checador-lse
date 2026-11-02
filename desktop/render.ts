import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CursorDeGanho, dbParaLinear, type Clipe } from '../src/ad/mixagem';
import type { PedidoRender, RelatorioRender } from '../src/desktop/ponte';
import { decodificarInteiro, decodificarStream, executar, medirLoudness } from './ffmpeg';
import { EscritorWav } from './wav';

export const TAXA = 48000;
const CANAIS = 2;
/** voz mono no centro, lei de pan de −3 dB */
const PAN_CENTRO = Math.SQRT1_2;

interface ClipePronto extends Clipe {
  amostras: Float32Array; // mono, TAXA
  ganho: number;
  ini: number; // em amostras da obra
  fim: number;
  offset: number; // em amostras do take
}

/**
 * Renderiza a mixagem: original (estéreo, 48 kHz) com a curva de ducking +
 * takes posicionados. Processa em streaming: memória proporcional aos takes,
 * não à obra. A mesma curva e os mesmos clipes da prévia.
 */
export async function renderizar(
  pedido: PedidoRender,
  pasta: string,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<RelatorioRender> {
  const avisos: string[] = [];
  const arquivos: string[] = [];
  const tmp = mkdtempSync(join(tmpdir(), 'estudio-ad-'));
  try {
    aoProgredir(0, 'Decodificando gravações');
    const audioPorTake = new Map<string, Float32Array>();
    for (const [i, t] of pedido.takes.entries()) {
      const arq = join(tmp, `${t.id}.bin`);
      writeFileSync(arq, t.bytes);
      audioPorTake.set(t.id, await decodificarInteiro(arq, 1, TAXA));
      aoProgredir((0.1 * (i + 1)) / Math.max(1, pedido.takes.length), 'Decodificando gravações');
    }

    const clipes: ClipePronto[] = [];
    for (const c of pedido.clipes) {
      const a = audioPorTake.get(c.takeId);
      if (!a) {
        avisos.push(`Gravação ${c.takeId} ausente; o bloco ficou fora da mixagem.`);
        continue;
      }
      const ini = Math.round((c.posicaoMs / 1000) * TAXA);
      const n = Math.round((c.duracaoMs / 1000) * TAXA);
      clipes.push({
        ...c,
        amostras: a,
        ganho: dbParaLinear(c.ganhoDb),
        ini,
        fim: ini + n,
        offset: Math.round((c.offsetMs / 1000) * TAXA),
      });
    }

    const caminhoMix = join(pasta, `${pedido.nomeBase}-mixagem-ad.wav`);
    const caminhoStem = join(pasta, `${pedido.nomeBase}-trilha-ad.wav`);
    const precisaMix = pedido.saidas.mixagem || pedido.saidas.video;
    const mix = precisaMix ? new EscritorWav(caminhoMix, CANAIS, TAXA) : null;
    const stem = pedido.saidas.trilhaAd ? new EscritorWav(caminhoStem, CANAIS, TAXA) : null;
    const cursor = new CursorDeGanho(pedido.curva);
    let quadro = 0; // índice de quadro (amostra por canal) na obra
    let duracaoMs = pedido.duracaoMs;

    const processar = (orig: Float32Array | null, quadros: number) => {
      const outMix = mix ? new Float32Array(quadros * CANAIS) : null;
      const outStem = stem ? new Float32Array(quadros * CANAIS) : null;
      const q0 = quadro;
      const q1 = quadro + quadros;
      // original com ducking
      if (outMix && orig) {
        for (let k = 0; k < quadros; k++) {
          const g = cursor.em(((q0 + k) / TAXA) * 1000);
          outMix[2 * k] = orig[2 * k] * g;
          outMix[2 * k + 1] = orig[2 * k + 1] * g;
        }
      }
      // voz
      for (const c of clipes) {
        if (c.fim <= q0 || c.ini >= q1) continue;
        const a = Math.max(c.ini, q0);
        const b = Math.min(c.fim, q1);
        for (let q = a; q < b; q++) {
          const idx = c.offset + (q - c.ini);
          if (idx < 0 || idx >= c.amostras.length) continue;
          const v = c.amostras[idx] * c.ganho * PAN_CENTRO;
          const k = q - q0;
          if (outMix) {
            outMix[2 * k] += v;
            outMix[2 * k + 1] += v;
          }
          if (outStem) {
            outStem[2 * k] += v;
            outStem[2 * k + 1] += v;
          }
        }
      }
      if (outMix && mix) mix.escrever(outMix);
      if (outStem && stem) stem.escrever(outStem);
      quadro = q1;
      if (duracaoMs > 0) aoProgredir(0.1 + 0.7 * Math.min(1, (quadro / TAXA) * 1000 / duracaoMs), 'Mixando');
    };

    aoProgredir(0.1, 'Mixando');
    const { bytes } = await decodificarStream(
      pedido.videoCaminho,
      CANAIS,
      TAXA,
      null,
      (amostras) => processar(amostras, amostras.length / CANAIS),
      (ms) => {
        if (!duracaoMs) duracaoMs = ms;
      },
    );
    const originalTemAudio = bytes > 0;
    if (!originalTemAudio) avisos.push('O vídeo não tem trilha de áudio: a mixagem contém só a audiodescrição.');

    // completa até a duração da obra e até o fim do último clipe
    const ultimoClipe = clipes.reduce((m, c) => Math.max(m, c.fim), 0);
    const alvo = Math.max(Math.round((duracaoMs / 1000) * TAXA), ultimoClipe);
    while (quadro < alvo) processar(null, Math.min(TAXA, alvo - quadro));
    if (ultimoClipe > Math.round((duracaoMs / 1000) * TAXA) && duracaoMs > 0) {
      avisos.push('A última gravação ultrapassa o fim do vídeo.');
    }

    mix?.fechar();
    stem?.fechar();
    const saturadas = (mix?.saturadas ?? 0) + (stem?.saturadas ?? 0);
    if (saturadas > 0) avisos.push(`${saturadas} amostras acima de 0 dBFS foram saturadas: reduza o ganho dos takes.`);

    let loudness: RelatorioRender['loudness'] = null;
    if (mix) {
      aoProgredir(0.82, 'Medindo loudness');
      loudness = await medirLoudness(caminhoMix);
    }

    if (pedido.saidas.video && mix) {
      aoProgredir(0.9, 'Gerando vídeo com faixa de AD');
      const caminhoVideo = join(pasta, `${pedido.nomeBase}-com-ad.mkv`);
      const iAd = originalTemAudio ? 1 : 0;
      const args = ['-y', '-i', pedido.videoCaminho, '-i', caminhoMix, '-map', '0:v:0?'];
      if (originalTemAudio) args.push('-map', '0:a:0');
      args.push('-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
      if (originalTemAudio) args.push('-c:a:0', 'copy');
      args.push(
        `-metadata:s:a:${iAd}`, 'title=Audiodescrição',
        `-metadata:s:a:${iAd}`, 'language=por',
        caminhoVideo,
      );
      const r = await executar(args);
      if (r.codigo === 0) arquivos.push(caminhoVideo);
      else avisos.push(`Falha ao gerar o vídeo: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
    }

    if (pedido.saidas.mixagem && mix) arquivos.unshift(caminhoMix);
    else if (mix) rmSync(caminhoMix, { force: true });
    if (stem) arquivos.push(caminhoStem);
    aoProgredir(1, 'Concluído');

    return {
      pasta,
      arquivos,
      duracaoMs: Math.round((quadro / TAXA) * 1000),
      originalTemAudio,
      amostrasSaturadas: saturadas,
      loudness,
      avisos,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
