import { useMemo, useState } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { serializarSrt, serializarVtt } from '../export/serializar';
import { montarRelatorio, relatorioMarkdown, nomeArquivoSaida } from '../export/relatorio';

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Exportar() {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const [feito, setFeito] = useState<string | null>(null);
  const nome = estado.arquivoNome ?? 'legenda.srt';

  const pendenciasManuais = useMemo(
    () =>
      Object.values(estado.review).filter(
        (i) => i.suggestion.verifiability === 'manual' && i.decision === 'pendente',
      ).length,
    [estado.review],
  );

  const remanescentes = final.remanescentes.filter((s) => s.severity !== 'revisao_manual');
  const errosRemanescentes = remanescentes.filter((s) => s.severity === 'erro').length;

  const relatorio = useMemo(
    () =>
      montarRelatorio({
        arquivo: nome,
        config: estado.config,
        cuesOriginais: estado.cues,
        cuesFinais: final.cues,
        sugestoes: estado.sugestoes,
        review: estado.review,
        sugestoesRemanescentes: final.remanescentes,
        conflitos: final.conflitos,
      }),
    [nome, estado.config, estado.cues, estado.sugestoes, estado.review, final],
  );

  function gerar(formatos: { srt: boolean; vtt: boolean; md: boolean; json: boolean }) {
    if (formatos.srt) baixar(nomeArquivoSaida(nome, '-revisado', 'srt'), serializarSrt(final.cues), 'text/plain');
    if (formatos.vtt) baixar(nomeArquivoSaida(nome, '-revisado', 'vtt'), serializarVtt(final.cues), 'text/vtt');
    if (formatos.md)
      baixar(nomeArquivoSaida(nome, '-relatorio-qa', 'md'), relatorioMarkdown(relatorio), 'text/markdown');
    if (formatos.json)
      baixar(
        nomeArquivoSaida(nome, '-relatorio-qa', 'json'),
        JSON.stringify(relatorio, null, 2),
        'application/json',
      );
    setFeito(new Date().toLocaleTimeString('pt-BR'));
  }

  const [vtt, setVtt] = useState(false);

  return (
    <section aria-labelledby="titulo-exportar" className="cartao mx-4 my-4">
      <h2 id="titulo-exportar" className="text-lg font-semibold">
        Gerar legenda final
      </h2>

      <p className="mt-2 text-sm text-navy-700">
        Serão aplicadas <strong>{final.aplicadas.length}</strong> alteração(ões) — apenas as
        aprovadas ou editadas por você. O arquivo de entrada permanece intacto; o download acontece
        no seu navegador, sem upload.
      </p>

      <ul className="mt-3 space-y-1 text-sm">
        <li className={errosRemanescentes > 0 ? 'text-bad' : 'text-ok'}>
          <span aria-hidden="true">{errosRemanescentes > 0 ? '✕ ' : '✓ '}</span>
          {errosRemanescentes} erro(s) permanecem no arquivo gerado
          {remanescentes.length - errosRemanescentes > 0
            ? `, além de ${remanescentes.length - errosRemanescentes} aviso(s)`
            : ''}
          .
        </li>
        <li className={pendenciasManuais > 0 ? 'text-warn' : 'text-ok'}>
          <span aria-hidden="true">{pendenciasManuais > 0 ? '! ' : '✓ '}</span>
          {pendenciasManuais} pendência(s) de revisão manual não confirmada(s).
        </li>
        {final.conflitos.length > 0 ? (
          <li className="text-warn">
            <span aria-hidden="true">! </span>
            {final.conflitos.length} sugestão(ões) aprovadas incidiram sobre a mesma legenda; o
            relatório registra qual prevaleceu.
          </li>
        ) : null}
      </ul>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={vtt} onChange={(e) => setVtt(e.target.checked)} />
        Gerar também WebVTT
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primario"
          onClick={() => gerar({ srt: true, vtt, md: true, json: true })}
        >
          Gerar legenda final e relatório de QA
        </button>
        <button
          type="button"
          className="btn-secundario"
          onClick={() => gerar({ srt: true, vtt: false, md: false, json: false })}
        >
          Somente o .srt
        </button>
        <button
          type="button"
          className="btn-secundario"
          onClick={() => gerar({ srt: false, vtt: false, md: true, json: true })}
        >
          Somente o relatório
        </button>
      </div>

      {feito ? (
        <p role="status" className="mt-2 text-sm text-ok">
          <span aria-hidden="true">✓ </span>
          Arquivos gerados às {feito}.
        </p>
      ) : null}
    </section>
  );
}
