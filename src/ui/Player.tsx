import { useEffect, useRef, useState } from 'react';
import type { Cue } from '../model/types';
import { formatarTimecode } from '../core/texto';

/**
 * Pré-visualização opcional (nice-to-have): toca um arquivo de vídeo local e
 * mostra a legenda correspondente ao tempo corrente. Estritamente local — o
 * vídeo nunca sai do navegador — e nada no checador depende dele.
 */
export function Player({ cues }: { cues: Cue[] }) {
  const [url, setUrl] = useState<string | null>(null);
  const [tempoMs, setTempoMs] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const atual = cues.find((c) => tempoMs >= c.startMs && tempoMs <= c.endMs);

  return (
    <div className="border-b border-paper-400 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="rotulo" htmlFor="video-local">
            Vídeo local (opcional)
          </label>
          <input
            id="video-local"
            type="file"
            accept="video/*"
            className="campo max-w-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (url) URL.revokeObjectURL(url);
              setUrl(URL.createObjectURL(f));
            }}
          />
        </div>
        {url ? (
          <p className="pb-2 text-xs text-navy-500">
            O vídeo é lido do seu disco e não sai do navegador.
          </p>
        ) : null}
      </div>

      {url ? (
        <div className="mt-3 flex flex-wrap gap-4">
          <video
            ref={video}
            src={url}
            controls
            className="max-h-64 rounded border border-paper-400 bg-navy"
            onTimeUpdate={(e) => setTempoMs(Math.round(e.currentTarget.currentTime * 1000))}
          />
          <div className="min-w-64 flex-1">
            <p className="font-mono text-xs text-navy-700">{formatarTimecode(tempoMs)}</p>
            <div className="mt-1 rounded border border-paper-400 bg-navy px-3 py-3">
              <div className="mx-auto max-w-[38ch] text-center font-mono text-sm text-paper">
                {atual ? (
                  atual.lines.map((l, i) => <div key={i}>{l.replace(/<\/?[^>]+>/g, '')}</div>)
                ) : (
                  <span className="text-navy-300">— sem legenda neste instante —</span>
                )}
              </div>
            </div>
            {atual ? (
              <button
                type="button"
                className="btn-fantasma mt-2"
                onClick={() => {
                  document.getElementById(`cue-${atual.index}`)?.scrollIntoView({ block: 'center' });
                }}
              >
                Ir para a legenda {atual.index} na lista
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
