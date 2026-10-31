import { useEffect, useRef } from 'react';
import type { ComandoGravacao, EstadoPrompter } from '../../ad/prompter';
import { comandoDaTecla } from '../../ad/prompter';

const seg = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')} s`;

/**
 * Teleprompter do locutor. Puramente de exibição: recebe o estado da janela
 * principal e devolve comandos de teclado. Fundo escuro e texto grande, para
 * leitura a distância em cabine; fase sinalizada por texto e cor, nunca só cor.
 */
export function Teleprompter({
  estado: e,
  aoComando,
  compacto = false,
}: {
  estado: EstadoPrompter;
  aoComando?: (c: ComandoGravacao) => void;
  compacto?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);

  // Vídeo mudo, seguindo o relógio da janela principal (o som vem dos fones).
  useEffect(() => {
    const v = video.current;
    if (!v || !e.videoUrl) return;
    const alvo = e.tempoMs / 1000;
    const deriva = Math.abs(v.currentTime - alvo);
    if (deriva > (e.tocando ? 0.25 : 0.04)) v.currentTime = alvo;
    if (e.tocando && v.paused) void v.play().catch(() => {});
    if (!e.tocando && !v.paused) v.pause();
  }, [e.tempoMs, e.tocando, e.videoUrl]);

  useEffect(() => {
    if (!aoComando) return;
    const tecla = (ev: KeyboardEvent) => {
      const c = comandoDaTecla(ev.key, e.fase);
      if (c) {
        ev.preventDefault();
        aoComando(c);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoComando, e.fase]);

  const b = e.bloco;
  const faltaParaEntrar = b ? b.inicioMs - e.tempoMs : 0;
  const restante = b ? b.fimMs - e.tempoMs : 0;
  const fracaoRestante = b ? Math.max(0, Math.min(1, restante / Math.max(1, b.fimMs - b.inicioMs))) : 0;

  const faixa: Record<EstadoPrompter['fase'], { rotulo: string; classe: string }> = {
    ocioso: { rotulo: 'Aguardando', classe: 'bg-navy-700 text-paper' },
    preroll: { rotulo: `Prepare-se · entra em ${seg(faltaParaEntrar)}`, classe: 'bg-warn-100 text-warn' },
    agora: { rotulo: `● GRAVANDO — LEIA · restam ${seg(restante)}`, classe: 'bg-bad text-paper' },
    processando: { rotulo: 'Processando a gravação…', classe: 'bg-navy-500 text-paper' },
    revisao: { rotulo: 'Take gravado', classe: 'bg-paper-200 text-navy' },
  };
  const f = faixa[e.fase];
  const tamTexto = compacto ? 'text-lg leading-snug' : 'text-[clamp(1.75rem,3.8vw,4.25rem)] leading-tight';

  return (
    <div className={`flex flex-col bg-navy text-paper ${compacto ? 'rounded border border-navy-500' : 'h-screen'}`}>
      <div role="status" aria-live="assertive" className={`px-4 py-2 font-semibold ${compacto ? 'text-sm' : 'text-2xl'} ${f.classe}`}>
        {f.rotulo}
        {b ? (
          <span className="float-right font-normal opacity-90">
            {e.sequencia ? `Bloco ${b.n} de ${b.total}` : 'Bloco avulso'}
          </span>
        ) : null}
      </div>
      {e.fase === 'agora' ? (
        <div className="h-2 bg-navy-700" aria-hidden="true">
          <div className="h-2 bg-paper" style={{ width: `${fracaoRestante * 100}%` }} />
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col gap-4 ${compacto ? 'p-3' : 'p-8'}`}>
        {e.videoUrl && !compacto ? (
          <video
            ref={video}
            src={e.videoUrl}
            muted
            playsInline
            crossOrigin="anonymous"
            className="mx-auto max-h-[38vh] rounded bg-black"
          />
        ) : null}

        {b ? (
          <>
            <p className={`whitespace-pre-wrap font-sans font-medium ${tamTexto} ${e.fase === 'preroll' ? 'opacity-70' : ''}`}>
              {b.texto}
            </p>
            {b.nota.trim() ? (
              <p className={`${compacto ? 'text-xs' : 'text-xl'} italic text-navy-300`}>Nota: {b.nota}</p>
            ) : null}
          </>
        ) : (
          <p className={`${compacto ? 'text-sm' : 'text-3xl'} text-navy-300`}>
            {e.aviso ?? 'Nenhuma gravação em curso.'}
          </p>
        )}

        {e.fase === 'revisao' && e.take ? (
          <div className={`rounded border border-navy-500 p-3 ${compacto ? 'text-xs' : 'text-xl'}`}>
            <p>
              Duração útil {seg(e.take.duracaoMs)} ·{' '}
              {e.take.cabe ? (
                <span className="text-ok-100">✓ cabe na janela</span>
              ) : (
                <strong className="text-bad-100">✕ sai da janela</strong>
              )}
            </p>
            <p className="mt-2 text-navy-300">
              <Kbd>Enter</Kbd> manter{e.sequencia ? ' e seguir' : ''} · <Kbd>R</Kbd> regravar · <Kbd>Espaço</Kbd> ouvir ·{' '}
              <Kbd>Backspace</Kbd> descartar{e.sequencia ? ' e seguir' : ''} · <Kbd>Esc</Kbd> encerrar
            </p>
          </div>
        ) : null}
        {e.fase === 'preroll' || e.fase === 'agora' ? (
          <p className={`${compacto ? 'text-xs' : 'text-lg'} text-navy-300`}>
            <Kbd>Enter</Kbd> ou <Kbd>Espaço</Kbd> encerra o take · <Kbd>Esc</Kbd> encerra a sessão
          </p>
        ) : null}

        {e.proximo ? (
          <div className={`mt-auto border-t border-navy-500 pt-2 text-navy-300 ${compacto ? 'text-xs' : 'text-xl'}`}>
            <span className="font-semibold">A seguir:</span> {e.proximo.texto}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-navy-300 px-1.5 font-mono text-[0.85em]">{children}</kbd>;
}
