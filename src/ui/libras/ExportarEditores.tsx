import { useId, useState } from 'react';
import { useEstado } from '../../state/store';
import { ponte, type RelatorioIntercambio } from '../../desktop/ponte';
import { useVideo } from '../contextoVideo';
import { FonteDasMidias, useFontesExportacao } from '../fontesExportacao';
import { BarraProgresso } from '../BarraProgresso';
import { Icone } from '../icones';

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
  const [progresso, setProgresso] = useState<{
    f: number;
    etapa: string;
  } | null>(null);
  const [rel, setRel] = useState<RelatorioIntercambio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const j = estado.libras;
  const fontes = useFontesExportacao();
  const pronto = !!desktop && !!estado.video?.caminho && !!j.clipe?.caminho;
  const comDeriva = Math.abs(j.velocidade - 1) > 1e-6;
  const idFalta = useId();

  async function exportar() {
    if (!desktop || !fontes.video || !fontes.libras) return;
    setErro(null);
    setRel(null);
    setProgresso({ f: 0, etapa: 'Preparando' });
    try {
      const { clipe, inicioNaObraMs, ...janela } = j;
      const r = await desktop.exportarParaEditores(
        {
          videoCaminho: fontes.video.caminho,
          pastaPadrao: fontes.pastaPadrao,
          nomeBase: (estado.projeto.nome || estado.video!.nome).replace(/\.[^.]+$/, '') + fontes.sufixo,
          duracaoMs,
          libras: { caminho: fontes.libras.caminho, inicioNaObraMs, janela },
          formatos,
          incluirBruto: incluirBruto && !comDeriva,
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

  const falta = !desktop
    ? 'Só no aplicativo desktop.'
    : !estado.video?.caminho
      ? 'Falta o vídeo da obra.'
      : !j.clipe?.caminho
        ? 'Falta o clipe do intérprete.'
        : !(formatos.xmeml || formatos.fcpxml)
          ? 'Escolha um formato.'
          : null;
  const nomeArq = (a: string) => a.split(/[\\/]/).pop() ?? a;

  return (
    <div className="text-xs">
      <fieldset>
        <legend className="sr-only">Formatos da sequência</legend>
        <Opcao
          marcado={formatos.xmeml}
          aoMudar={(v) => setFormatos({ ...formatos, xmeml: v })}
          rotulo="Premiere Pro"
          formato="XML"
        />
        <Opcao
          marcado={formatos.fcpxml}
          aoMudar={(v) => setFormatos({ ...formatos, fcpxml: v })}
          rotulo="DaVinci Resolve"
          formato="FCPXML"
        />
        <Opcao
          marcado={incluirBruto && !comDeriva}
          desabilitado={comDeriva}
          aoMudar={setIncluirBruto}
          rotulo="Clipe bruto na V3"
          formato={comDeriva ? 'fora: velocidade ≠ 1' : 'referência'}
          titulo={
            comDeriva
              ? `Com velocidade corrigida (×${j.velocidade.toFixed(5).replace('.', ',')}) o bruto não vai: a mudança de velocidade não se transfere com segurança entre editores. A V2 já sai conformada.`
              : 'Trilha desligada, no ponto sincronizado: referência para refazer o chroma no editor.'
          }
        />
      </fieldset>
      <button
        type="button"
        className="btn-secundario mt-2 w-full justify-center"
        disabled={!pronto || progresso !== null || !(formatos.xmeml || formatos.fcpxml)}
        aria-describedby={falta ? `${idFalta}` : undefined}
        onClick={() => void exportar()}
      >
        Exportar…
      </button>
      <FonteDasMidias compacto />
      {falta && !rel ? (
        <p id={idFalta} className="mt-1 text-2xs text-navy-500">
          {falta}
        </p>
      ) : null}
      {progresso ? (
        <BarraProgresso
          className="mt-2"
          fracao={progresso.f > 0 ? progresso.f : null}
          rotulo="Progresso da exportação"
          etapa={progresso.etapa}
        />
      ) : null}
      {erro ? <p className="mt-2 text-bad">Erro: {erro}</p> : null}
      {rel ? (
        <div className="mt-2" role="status">
          <div className="flex items-center gap-2">
            <span className="chip border-ok bg-ok-100 text-ok">
              <Icone nome="ok" tamanho={14} /> {rel.arquivos.length} arquivos · {rel.cadencia.replace('/1', '')} qd/s
            </span>
            <button
              type="button"
              className="btn-fantasma ml-auto h-6 px-2 text-2xs"
              onClick={() => void desktop?.mostrarNaPasta(rel.arquivos[0])}
            >
              Mostrar na pasta
            </button>
          </div>
          {rel.avisos.map((a) => (
            <p key={a} className="mt-1 text-2xs text-warn">
              <Icone nome="aviso" tamanho={14} />
              {a}
            </p>
          ))}
          <details className="mt-1 text-2xs">
            <summary className="cursor-pointer text-navy-500">Arquivos</summary>
            <ul className="mt-1 space-y-0.5 text-navy-700">
              {rel.arquivos.map((a) => (
                <li key={a} className="truncate" title={a}>
                  {nomeArq(a)}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function Opcao({
  marcado,
  desabilitado,
  aoMudar,
  rotulo,
  formato,
  titulo,
}: {
  marcado: boolean;
  desabilitado?: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  formato: string;
  titulo?: string;
}) {
  return (
    <label className={`flex h-7 items-center gap-2 ${desabilitado ? 'opacity-60' : ''}`} title={titulo}>
      <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} />
      <span className="text-navy">{rotulo}</span>
      <span className="ml-auto font-mono text-2xs text-navy-500">{formato}</span>
    </label>
  );
}

/** Explicação da seção, mostrada sob demanda no "?" do cabeçalho. */
export const DICA_EXPORTAR = (
  <>
    Gera a Libras já tratada e sincronizada, com fundo transparente (ProRes 4444), e uma sequência com a obra na V1 e a
    Libras na V2. XML: Premiere e Resolve. FCPXML: Resolve e Final Cut.
  </>
);
