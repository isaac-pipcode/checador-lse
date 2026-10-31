import { useId, useMemo, useState } from 'react';
import { useEstado, useResultadoFinal } from '../../state/store';
import { ponte, type RelatorioRender } from '../../desktop/ponte';
import { clipesDosBlocos, curvaDeDucking } from '../../ad/mixagem';
import { bytesDoTake } from '../../ad/audio';
import { roteiroCsv, roteiroTexto, roteiroVtt } from '../../ad/roteiro';
import { verificarBloco, nivelDoBloco } from '../../ad/verificacoes';
import { baixar } from '../comum';

/**
 * Saídas da AD: roteiro (texto para o locutor, VTT de descrições, CSV) e, no
 * desktop, a renderização: mixagem WAV 24 bits/48 kHz, trilha de AD isolada e
 * vídeo com faixa extra, com medição de loudness (EBU R128).
 */
export function SaidasAD() {
  const id = useId();
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const { blocos, parametros } = estado.ad;
  const desktop = ponte();
  const [saidas, setSaidas] = useState({ mixagem: true, trilhaAd: true, video: true });
  const [progresso, setProgresso] = useState<{ f: number; etapa: string } | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioRender | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const nome = (estado.video?.nome ?? estado.arquivoNome ?? 'obra').replace(/\.[^.]+$/, '');
  const comErro = useMemo(
    () => blocos.filter((b) => nivelDoBloco(verificarBloco(b, final.cues, parametros)) === 'erro').length,
    [blocos, final.cues, parametros],
  );
  const gravados = blocos.filter((b) => b.takeAtivoId).length;

  async function renderizar() {
    if (!desktop || !estado.video?.caminho) return;
    setErro(null);
    setRelatorio(null);
    const clipes = clipesDosBlocos(blocos, parametros);
    const takes: Array<{ id: string; bytes: Uint8Array }> = [];
    for (const c of clipes) {
      const bytes = await bytesDoTake(c.takeId);
      if (bytes) takes.push({ id: c.takeId, bytes });
    }
    setProgresso({ f: 0, etapa: 'Preparando' });
    try {
      const r = await desktop.renderizar(
        {
          videoCaminho: estado.video.caminho,
          nomeBase: nome,
          duracaoMs: estado.mapa?.duracaoMs ?? 0,
          clipes,
          curva: curvaDeDucking(clipes, parametros),
          takes,
          saidas,
        },
        (f, etapa) => setProgresso({ f, etapa }),
      );
      setRelatorio(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso(null);
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="px-3 py-3">
      <h2 id={`${id}-t`} className="secao-titulo">
        Saídas da audiodescrição
      </h2>

      <div className="grid gap-3">
        <div className="cartao">
          <h3 className="text-sm font-semibold">Roteiro</h3>
          <p className="mt-1 text-xs text-navy-500">
            Só blocos com texto. O VTT usa a posição das gravações, quando houver, e serve a players que leem
            descrições por síntese de voz.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secundario" onClick={() => baixar(`${nome}-roteiro-ad.txt`, roteiroTexto(blocos, nome), 'text/plain')}>
              Texto para o locutor
            </button>
            <button type="button" className="btn-secundario" onClick={() => baixar(`${nome}-descricoes.vtt`, roteiroVtt(blocos), 'text/vtt')}>
              WebVTT de descrições
            </button>
            <button type="button" className="btn-secundario" onClick={() => baixar(`${nome}-roteiro-ad.csv`, roteiroCsv(blocos), 'text/csv')}>
              CSV
            </button>
          </div>
        </div>

        <div className="cartao">
          <h3 className="text-sm font-semibold">Mixagem</h3>
          {!desktop ? (
            <p className="mt-1 text-sm text-navy-700">
              A renderização usa o ffmpeg do aplicativo desktop. No navegador, a prévia de mixagem funciona; o arquivo
              final, não.
            </p>
          ) : !estado.video?.caminho ? (
            <p className="mt-1 text-sm text-navy-700">Abra o vídeo pelo botão <em>Abrir vídeo…</em> para renderizar.</p>
          ) : (
            <>
              <fieldset className="mt-1">
                <legend className="sr-only">Arquivos a gerar</legend>
                {(
                  [
                    ['mixagem', 'Mixagem completa (WAV 24 bits, 48 kHz, estéreo)'],
                    ['trilhaAd', 'Trilha de AD isolada (WAV, para finalizar em outro programa)'],
                    ['video', 'Vídeo com faixa de áudio extra “Audiodescrição” (MKV)'],
                  ] as const
                ).map(([k, rotulo]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saidas[k]} onChange={(e) => setSaidas({ ...saidas, [k]: e.target.checked })} />
                    {rotulo}
                  </label>
                ))}
              </fieldset>
              <p className="mt-2 text-xs text-navy-700">
                {gravados} de {blocos.length} blocos gravados entram na mixagem.
                {comErro > 0 ? (
                  <strong className="text-bad"> {comErro} bloco(s) com erro — revise antes de entregar.</strong>
                ) : null}
              </p>
              <button
                type="button"
                className="btn-primario mt-2"
                disabled={progresso !== null || gravados === 0 || !(saidas.mixagem || saidas.trilhaAd || saidas.video)}
                onClick={() => void renderizar()}
              >
                Renderizar…
              </button>
              {progresso ? (
                <div className="mt-2 flex items-center gap-2 text-xs" role="status">
                  <progress max={1} value={progresso.f} className="w-40" aria-label="Progresso da renderização" />
                  {progresso.etapa} · {Math.round(progresso.f * 100)}%
                </div>
              ) : null}
            </>
          )}
          {erro ? <p className="mt-2 text-sm text-bad">Erro: {erro}</p> : null}
          {relatorio ? (
            <div className="mt-3 rounded border border-ok bg-ok-100 p-2 text-sm text-ok" role="status">
              <p className="font-medium">
                <span aria-hidden="true">✓ </span>Renderizado em {relatorio.pasta}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-navy">
                {relatorio.arquivos.map((a) => (
                  <li key={a}>{a.split(/[\\/]/).pop()}</li>
                ))}
              </ul>
              {relatorio.loudness ? (
                <p className="mt-1 text-xs text-navy">
                  Loudness integrada da mixagem:{' '}
                  <strong>{relatorio.loudness.integradoLufs?.toFixed(1).replace('.', ',') ?? '—'} LUFS</strong> · pico
                  verdadeiro {relatorio.loudness.picoVerdadeiroDbtp?.toFixed(1).replace('.', ',') ?? '—'} dBTP. Medida
                  apenas, sem normalização: confira com a especificação de entrega.
                </p>
              ) : null}
              {relatorio.avisos.length > 0 ? (
                <ul className="mt-1 text-xs text-warn">
                  {relatorio.avisos.map((a) => (
                    <li key={a}>! {a}</li>
                  ))}
                </ul>
              ) : null}
              {desktop && relatorio.arquivos[0] ? (
                <button type="button" className="btn-fantasma mt-1 text-xs" onClick={() => void desktop.mostrarNaPasta(relatorio.arquivos[0])}>
                  Mostrar na pasta
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
