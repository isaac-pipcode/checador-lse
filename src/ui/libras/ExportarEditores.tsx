import { useState } from 'react';
import { useEstado } from '../../state/store';
import { ponte, type RelatorioIntercambio } from '../../desktop/ponte';
import { useVideo } from '../contextoVideo';

/**
 * Exportação da sincronia para Premiere e Resolve: a Libras tratada com alfa
 * (ProRes 4444, quadro inteiro, alinhada ao quadro 0) e a sequência em XML.
 */
export function ExportarEditores() {
  const { estado } = useEstado();
  const { duracaoMs } = useVideo();
  const desktop = ponte();
  const [formatos, setFormatos] = useState({ xmeml: true, fcpxml: true });
  const [incluirBruto, setIncluirBruto] = useState(true);
  const [progresso, setProgresso] = useState<{ f: number; etapa: string } | null>(null);
  const [rel, setRel] = useState<RelatorioIntercambio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const j = estado.libras;
  const pronto = !!desktop && !!estado.video?.caminho && !!j.clipe?.caminho;
  const comDeriva = Math.abs(j.velocidade - 1) > 1e-6;

  async function exportar() {
    if (!desktop || !estado.video?.caminho || !j.clipe?.caminho) return;
    setErro(null);
    setRel(null);
    setProgresso({ f: 0, etapa: 'Preparando' });
    try {
      const { clipe, inicioNaObraMs, ...janela } = j;
      const r = await desktop.exportarParaEditores(
        {
          videoCaminho: estado.video.caminho,
          nomeBase: (estado.projeto.nome || estado.video.nome).replace(/\.[^.]+$/, ''),
          duracaoMs,
          libras: { caminho: clipe!.caminho!, inicioNaObraMs, janela },
          formatos,
          incluirBruto,
        },
        (f, etapa) => setProgresso({ f, etapa }),
      );
      setRel(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso(null);
    }
  }

  return (
    <div className="text-xs">
      <p className="text-navy-700">
        Gera o intérprete já tratado e sincronizado, com fundo transparente (ProRes 4444 com alfa, quadro inteiro), e uma
        sequência com a obra na V1 e a Libras na V2, para finalizar no editor.
      </p>
      <fieldset className="mt-2">
        <legend className="rotulo">Sequência</legend>
        <label className="mt-1 flex items-center gap-2">
          <input type="checkbox" checked={formatos.xmeml} onChange={(e) => setFormatos({ ...formatos, xmeml: e.target.checked })} />
          Premiere Pro (XML do Final Cut 7; o Resolve também importa)
        </label>
        <label className="mt-1 flex items-center gap-2">
          <input type="checkbox" checked={formatos.fcpxml} onChange={(e) => setFormatos({ ...formatos, fcpxml: e.target.checked })} />
          DaVinci Resolve (FCPXML 1.8; o Final Cut Pro também importa)
        </label>
        <label className="mt-1 flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={incluirBruto} onChange={(e) => setIncluirBruto(e.target.checked)} />
          <span>
            Incluir o clipe bruto, sincronizado e desativado (V3)
            {comDeriva ? (
              <span className="block text-2xs text-warn">
                Com deriva corrigida (×{j.velocidade.toFixed(5).replace('.', ',')}), o bruto fica de fora: a mudança de
                velocidade não se transfere de forma confiável entre editores. A V2 já vem conformada.
              </span>
            ) : null}
          </span>
        </label>
      </fieldset>
      <button
        type="button"
        className="btn-secundario mt-2 w-full justify-center"
        disabled={!pronto || progresso !== null || !(formatos.xmeml || formatos.fcpxml)}
        onClick={() => void exportar()}
      >
        Exportar para editores…
      </button>
      {!desktop ? <p className="mt-1 text-2xs text-navy-500">Disponível no aplicativo desktop.</p> : null}
      {desktop && !pronto ? <p className="mt-1 text-2xs text-navy-500">Abra o vídeo da obra e importe o clipe do intérprete.</p> : null}
      {progresso ? (
        <div className="mt-2 text-2xs" role="status">
          <progress max={1} value={progresso.f} className="w-full" aria-label="Progresso da exportação" />
          {progresso.etapa} · {Math.round(progresso.f * 100)}%
        </div>
      ) : null}
      {erro ? <p className="mt-2 text-bad">Erro: {erro}</p> : null}
      {rel ? (
        <div className="mt-2 rounded border border-ok bg-ok-100 p-2 text-ok" role="status">
          <p className="font-semibold">
            <span aria-hidden="true">✓ </span>Exportado ({rel.cadencia.replace('/1', '')} qd/s)
          </p>
          <ul className="mt-1 space-y-0.5 text-navy">
            {rel.arquivos.map((a) => (
              <li key={a} className="truncate" title={a}>
                {a.split(/[\\/]/).pop()}
              </li>
            ))}
          </ul>
          {rel.avisos.map((a) => (
            <p key={a} className="mt-1 text-warn">
              ! {a}
            </p>
          ))}
          <button type="button" className="btn-fantasma mt-1 h-6 px-2 text-2xs" onClick={() => void desktop?.mostrarNaPasta(rel.arquivos[0])}>
            Mostrar na pasta
          </button>
        </div>
      ) : null}
    </div>
  );
}
