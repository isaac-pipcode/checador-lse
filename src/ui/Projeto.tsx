import { useState } from 'react';
import { useDespachar, useEstado } from '../state/store';
import { ponte, type ArquivoTake, type ProjetoArquivo } from '../desktop/ponte';
import { bytesDoTake, registrarTake } from '../ad/audio';
import { serializarSrt } from '../export/serializar';
import { parseSubtitle } from '../parser/srt';
import { carregarMidia } from './carregarMidia';
import { JANELA_MS } from '../mapa/midia';

/**
 * Abrir e salvar projeto (desktop): um .estudio.json com o roteiro de AD, os
 * parâmetros, a legenda e o caminho do vídeo, mais a pasta `takes/` ao lado.
 * Limite: as decisões de revisão da LSE ainda não são salvas no projeto.
 */
export function BarraProjeto() {
  const desktop = ponte();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const [erro, setErro] = useState<string | null>(null);
  if (!desktop) return null;

  async function salvar(como: boolean) {
    if (!desktop) return;
    setErro(null);
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
    const projeto: ProjetoArquivo = {
      formato: 'estudio-acessibilidade',
      versao: 1,
      salvoEm: new Date().toISOString(),
      video: estado.video ? { nome: estado.video.nome, caminho: estado.video.caminho } : null,
      legenda: estado.cues.length ? { nome: estado.arquivoNome ?? 'legenda.srt', conteudo: serializarSrt(estado.cues) } : null,
      ad: {
        parametros: estado.ad.parametros,
        blocos: estado.ad.blocos.map((b) => ({ ...b, takes: b.takes.map((t) => ({ ...t, arquivo: arquivos[t.id] })) })),
      },
    };
    try {
      const r = await desktop.salvarProjeto({ caminho: como ? null : estado.projeto.caminho, projeto, takes });
      if (r) despachar({ tipo: 'projetoSalvo', caminho: r.caminho, arquivosTakes: arquivos });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function abrir() {
    if (!desktop) return;
    if (estado.projeto.sujo && !window.confirm('Há mudanças não salvas. Abrir outro projeto mesmo assim?')) return;
    setErro(null);
    try {
      const r = await desktop.abrirProjeto();
      if (!r) return;
      const porArquivo = new Map(r.takes.map((t) => [t.arquivo, t.bytes]));
      for (const b of r.projeto.ad.blocos) {
        for (const t of b.takes) {
          const bytes = t.arquivo ? porArquivo.get(t.arquivo) : undefined;
          if (bytes) await registrarTake(t.id, new Blob([bytes as BlobPart], { type: 'audio/webm' }));
        }
      }
      if (r.projeto.legenda) {
        const p = parseSubtitle(r.projeto.legenda.conteudo);
        despachar({ tipo: 'carregar', nome: r.projeto.legenda.nome, encoding: 'utf-8', cues: p.cues, erros: p.erros, avisos: p.avisos });
      }
      despachar({ tipo: 'projetoCarregado', caminho: r.caminho, ad: r.projeto.ad });
      const v = r.projeto.video;
      if (v?.caminho) {
        try {
          const url = await desktop.urlDeMidia(v.caminho);
          const caminho = v.caminho;
          await carregarMidia(despachar, { url, nome: v.nome, caminho }, () => desktop.analisarAudio(caminho, JANELA_MS, () => {}));
        } catch {
          setErro(`Vídeo não encontrado em ${v.caminho}. Abra-o de novo pelo estúdio.`);
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const nome = estado.projeto.caminho?.split(/[\\/]/).pop();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button type="button" className="btn-fantasma" onClick={() => void abrir()}>
        Abrir projeto…
      </button>
      <button type="button" className="btn-secundario" onClick={() => void salvar(false)}>
        Salvar projeto{estado.projeto.sujo ? ' •' : ''}
      </button>
      {nome ? (
        <button type="button" className="btn-fantasma" onClick={() => void salvar(true)}>
          Salvar como…
        </button>
      ) : null}
      <span className="text-xs text-navy-500">
        {nome ?? 'Projeto não salvo'}
        {estado.projeto.sujo ? <span className="sr-only-focusable"> (alterações não salvas)</span> : null}
      </span>
      {erro ? <span className="text-xs text-bad">{erro}</span> : null}
    </div>
  );
}
