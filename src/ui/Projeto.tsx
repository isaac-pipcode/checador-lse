import { useCallback } from 'react';
import { useDespachar, useEstado } from '../state/store';
import { ponte, type ArquivoTake, type ProjetoArquivo } from '../desktop/ponte';
import { bytesDoTake, registrarTake } from '../ad/audio';
import { serializarSrt } from '../export/serializar';
import { parseSubtitle } from '../parser/srt';
import { carregarMidia } from './carregarMidia';
import { JANELA_MS } from '../mapa/midia';
import { normalizarJanela, type JanelaLibras } from '../libras/tipos';

/**
 * Ações de projeto (desktop): um .estudio.json com legenda, roteiro de AD,
 * parâmetros, janela de Libras e caminhos das mídias, mais a pasta `takes/`.
 * Limite: as decisões de revisão da LSE ainda não são salvas no projeto.
 */
export function useAcoesProjeto() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const desktop = ponte();

  const salvar = useCallback(
    async (como = false): Promise<boolean> => {
      if (!desktop) return false;
      const takes: ArquivoTake[] = [];
      const arquivos: Record<string, string> = {};
      for (const b of estado.ad.blocos) {
        for (const t of b.takes) {
          const arquivo = t.arquivo ?? `${t.id}.webm`;
          arquivos[t.id] = arquivo;
          if (t.arquivo) continue; // já está no disco
          const bytes = await bytesDoTake(t.id);
          if (bytes) takes.push({ arquivo, bytes });
        }
      }
      const { clipe, ...janela } = estado.libras;
      const projeto: ProjetoArquivo = {
        formato: 'estudio-acessibilidade',
        versao: 1,
        salvoEm: new Date().toISOString(),
        video: estado.video
          ? {
              nome: estado.video.nome,
              caminho: estado.video.caminho,
              proxy: estado.video.proxy?.caminho ?? null,
              usarProxy: estado.video.usarProxy,
            }
          : null,
        legenda: estado.cues.length ? { nome: estado.arquivoNome ?? 'legenda.srt', conteudo: serializarSrt(estado.cues) } : null,
        ad: {
          parametros: estado.ad.parametros,
          blocos: estado.ad.blocos.map((b) => ({ ...b, takes: b.takes.map((t) => ({ ...t, arquivo: arquivos[t.id] })) })),
        },
        libras: {
          ...janela,
          clipe: clipe
            ? { nome: clipe.nome, caminho: clipe.caminho, duracaoMs: clipe.duracaoMs, proxy: clipe.proxy?.caminho ?? null }
            : null,
        },
      };
      const r = await desktop.salvarProjeto({ caminho: como ? null : estado.projeto.caminho, projeto, takes });
      if (r) despachar({ tipo: 'projetoSalvo', caminho: r.caminho, arquivosTakes: arquivos });
      return !!r;
    },
    [desktop, estado, despachar],
  );

  const carregar = useCallback(
    async (r: { caminho: string; projeto: ProjetoArquivo; takes: ArquivoTake[] } | null) => {
      if (!desktop || !r) return;
      const porArquivo = new Map(r.takes.map((t) => [t.arquivo, t.bytes]));
      for (const b of r.projeto.ad.blocos) {
        for (const t of b.takes) {
          const bytes = t.arquivo ? porArquivo.get(t.arquivo) : undefined;
          if (bytes) await registrarTake(t.id, new Blob([bytes as BlobPart], { type: 'audio/webm' }));
        }
      }
      despachar({ tipo: 'projetoNovo', caminho: r.caminho, nome: '' });
      if (r.projeto.legenda) {
        const p = parseSubtitle(r.projeto.legenda.conteudo);
        despachar({ tipo: 'carregar', nome: r.projeto.legenda.nome, encoding: 'utf-8', cues: p.cues, erros: p.erros, avisos: p.avisos });
      }
      // Libras: o clipe precisa de uma URL servível, pedida ao processo desktop
      const lib = r.projeto.libras;
      let libras: JanelaLibras | undefined = lib ? normalizarJanela({ ...lib, clipe: null }) : undefined;
      if (lib?.clipe?.caminho) {
        try {
          const urlOriginal = await desktop.urlDeMidia(lib.clipe.caminho);
          // o proxy do clipe, se ainda existir, volta a ser o que a prévia toca
          let proxy: { caminho: string; url: string } | null = null;
          if (lib.clipe.proxy) proxy = await desktop.urlDeMidia(lib.clipe.proxy).then((url) => ({ caminho: lib.clipe!.proxy!, url }), () => null);
          libras = normalizarJanela({
            ...lib,
            clipe: { nome: lib.clipe.nome, caminho: lib.clipe.caminho, duracaoMs: lib.clipe.duracaoMs, urlOriginal, proxy, url: proxy?.url ?? urlOriginal },
          });
        } catch {
          /* clipe movido ou apagado: a janela abre sem clipe (J3 aponta) */
        }
      }
      despachar({ tipo: 'projetoCarregado', caminho: r.caminho, ad: r.projeto.ad, libras });
      despachar({ tipo: 'navegar', pagina: 'lse' });
      const v = r.projeto.video;
      if (v?.caminho) {
        const url = await desktop.urlDeMidia(v.caminho);
        const caminho = v.caminho;
        const info = await desktop.sondarMidia(caminho).catch(() => null);
        const analise = carregarMidia(despachar, { url, nome: v.nome, caminho, info }, () => desktop.analisarAudio(caminho, JANELA_MS, () => {}));
        if (v.proxy) {
          const proxy = v.proxy;
          const purl = await desktop.urlDeMidia(proxy).catch(() => null);
          if (purl) despachar({ tipo: 'videoProxy', proxy: { caminho: proxy, url: purl }, usar: v.usarProxy ?? true, restaurando: true });
        }
        await analise;
      }
    },
    [desktop, despachar],
  );

  return {
    disponivel: !!desktop,
    salvar,
    abrir: async () => desktop && carregar(await desktop.abrirProjeto()),
    abrirEm: async (caminho: string) => desktop && carregar(await desktop.abrirProjetoEm(caminho)),
    novo: async (nome: string): Promise<boolean> => {
      if (!desktop) {
        despachar({ tipo: 'projetoNovo', caminho: null, nome });
        return true;
      }
      const caminho = await desktop.novoProjeto(nome);
      if (!caminho) return false;
      despachar({ tipo: 'projetoNovo', caminho, nome });
      return true;
    },
  };
}
