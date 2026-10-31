import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ComandoGravacao, EstadoPrompter } from '../../ad/prompter';
import { comandoDaTecla } from '../../ad/prompter';

/** A redução automática não passa disto: abaixo, a leitura a distância piora mais do que ajuda. */
const REDUCAO_MINIMA = 0.6;

export const COR_LEGENDA = { branco: '#FAF8F3', amarelo: '#FFE14D' } as const;

const seg = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')} s`;

/**
 * Teleprompter do locutor. A imagem ocupa a tela; o roteiro aparece sobre ela,
 * na parte de baixo, como uma legenda. Uma faixa fina no topo diz a fase e o
 * tempo; uma faixa fina embaixo, o próximo bloco e as teclas.
 *
 * Puramente de exibição: recebe o estado da janela principal e devolve
 * comandos de teclado. A fase é sinalizada por texto e cor, nunca só por cor.
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
  const restanteCaptura = b ? b.fimCapturaMs - e.tempoMs : 0;
  const fracaoRestante = b ? Math.max(0, Math.min(1, restante / Math.max(1, b.fimMs - b.inicioMs))) : 0;

  const faixa: Record<EstadoPrompter['fase'], { rotulo: string; classe: string }> = {
    ocioso: { rotulo: 'Aguardando', classe: 'bg-navy-700 text-paper' },
    preroll: { rotulo: `Prepare-se · entra em ${seg(faltaParaEntrar)}`, classe: 'bg-warn-100 text-warn' },
    agora: { rotulo: `● GRAVANDO — LEIA · restam ${seg(restante)}`, classe: 'bg-bad text-paper' },
    posroll: { rotulo: `● Gravando a pós-rolagem · encerra em ${seg(restanteCaptura)}`, classe: 'bg-navy-500 text-paper' },
    processando: { rotulo: 'Processando a gravação…', classe: 'bg-navy-500 text-paper' },
    revisao: { rotulo: 'Take gravado', classe: 'bg-paper-200 text-navy' },
  };
  const f = faixa[e.fase];

  // Contagem regressiva grande na pré-rolagem: 3, 2, 1.
  const contagem = e.fase === 'preroll' && faltaParaEntrar > 0 ? Math.ceil(faltaParaEntrar / 1000) : null;

  // ---- Caixa do roteiro: altura limitada, letra reduzida até caber ----------
  const area = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLParagraphElement>(null);
  const [alturaArea, setAlturaArea] = useState(0);
  const [reducao, setReducao] = useState(1);
  const [naoCabe, setNaoCabe] = useState(false);
  const { cor, escala, alturaMaxima } = e.legenda;
  const maxPx = Math.round(alturaArea * alturaMaxima);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAlturaArea(el.clientHeight));
    ro.observe(el);
    setAlturaArea(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Mede de forma síncrona (antes da pintura): reduz em passos de 8% até caber.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || maxPx <= 0) return;
    let r = 1;
    el.style.setProperty('--reducao', '1');
    while (el.scrollHeight > maxPx + 1 && r > REDUCAO_MINIMA) {
      r = Math.max(REDUCAO_MINIMA, r * 0.92);
      el.style.setProperty('--reducao', String(r));
    }
    setReducao(r);
    setNaoCabe(el.scrollHeight > maxPx + 1);
  }, [b?.texto, escala, maxPx, compacto]);

  const estiloCaixa = {
    '--base': compacto ? '0.875rem' : 'clamp(1.5rem, 3.2vw, 3.6rem)',
    '--escala': String(escala),
    '--reducao': String(reducao),
    fontSize: 'calc(var(--base) * var(--escala) * var(--reducao))',
    color: COR_LEGENDA[cor],
    maxHeight: maxPx > 0 ? `${maxPx}px` : undefined,
  } as CSSProperties;
  const tamFaixa = compacto ? 'text-xs' : 'text-xl';

  return (
    <div
      className={`flex flex-col overflow-hidden bg-black text-paper ${compacto ? 'rounded border border-navy-500' : 'h-screen'}`}
    >
      {/* Faixa de fase */}
      <div role="status" aria-live="assertive" className={`flex items-center px-4 py-1.5 font-semibold ${tamFaixa} ${f.classe}`}>
        <span>{f.rotulo}</span>
        {b ? (
          <span className="ml-auto font-normal opacity-90">{e.sequencia ? `Bloco ${b.n} de ${b.total}` : 'Bloco avulso'}</span>
        ) : null}
      </div>
      <div className="h-1.5 bg-navy-700" aria-hidden="true">
        {e.fase === 'agora' ? <div className="h-1.5 bg-paper" style={{ width: `${fracaoRestante * 100}%` }} /> : null}
      </div>

      {/* Imagem, ocupando o espaço disponível, com o roteiro sobreposto */}
      <div ref={area} className={`relative min-h-0 ${compacto ? 'aspect-video' : 'flex-1'}`}>
        {e.videoUrl && !compacto ? (
          <video
            ref={video}
            src={e.videoUrl}
            muted
            playsInline
            crossOrigin="anonymous"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 bg-navy" aria-hidden="true" />
        )}

        {contagem !== null ? (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span
              className={`rounded-full bg-black/55 font-bold tabular-nums text-paper ${compacto ? 'px-4 text-4xl' : 'px-10 text-[clamp(5rem,14vw,12rem)]'}`}
            >
              {contagem}
            </span>
          </div>
        ) : null}

        <div className={`absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 ${compacto ? 'p-2' : 'px-[5%] pb-[4%]'}`}>
          {b ? (
            <>
              {naoCabe ? (
                <p className={`rounded bg-bad px-2 font-semibold text-paper ${compacto ? 'text-[10px]' : 'text-base'}`}>
                  <span aria-hidden="true">✂ </span>O texto não cabe na caixa nem com a letra reduzida
                </p>
              ) : null}
              <p
                ref={caixa}
                style={estiloCaixa}
                className={`max-w-[92%] overflow-hidden whitespace-pre-wrap rounded bg-black/75 px-[0.6em] py-[0.25em] text-center font-sans font-medium leading-tight ${e.fase === 'preroll' ? 'opacity-80' : ''} ${e.fase === 'agora' ? 'ring-2 ring-bad' : ''}`}
              >
                {b.texto}
              </p>
              {b.nota.trim() ? (
                <p className={`rounded bg-black/60 px-2 italic text-navy-300 ${compacto ? 'text-[10px]' : 'text-lg'}`}>
                  Nota: {b.nota}
                </p>
              ) : null}
            </>
          ) : (
            <p className={`rounded bg-black/70 px-3 py-1 text-navy-300 ${compacto ? 'text-xs' : 'text-2xl'}`}>
              {e.aviso ?? 'Nenhuma gravação em curso.'}
            </p>
          )}
        </div>
      </div>

      {/* Faixa inferior: resultado do take, próximo bloco, teclas */}
      <div className={`space-y-0.5 bg-navy px-4 py-1.5 text-navy-300 ${compacto ? 'text-[10px]' : 'text-base'}`}>
        {e.fase === 'revisao' && e.take ? (
          <p className="text-paper">
            Duração útil {seg(e.take.duracaoMs)} ·{' '}
            {e.take.cabe ? <span className="text-ok-100">✓ cabe na janela</span> : <strong className="text-bad-100">✕ sai da janela</strong>}
            {' — '}
            <Kbd>Enter</Kbd> manter{e.sequencia ? ' e seguir' : ''} · <Kbd>R</Kbd> regravar · <Kbd>Espaço</Kbd> ouvir ·{' '}
            <Kbd>Backspace</Kbd> descartar · <Kbd>Esc</Kbd> encerrar
          </p>
        ) : e.fase === 'preroll' || e.fase === 'agora' || e.fase === 'posroll' ? (
          <p>
            <Kbd>Enter</Kbd> ou <Kbd>Espaço</Kbd> encerra o take · <Kbd>Esc</Kbd> encerra a sessão ·{' '}
            <Kbd>+</Kbd>/<Kbd>−</Kbd> tamanho da letra
          </p>
        ) : null}
        {b && reducao < 0.995 ? (
          <p>
            Letra reduzida a {Math.round(reducao * 100)}% para caber na caixa
            {naoCabe ? '' : ' — aumentar a letra não terá efeito; aumente a altura máxima da caixa ou encurte o roteiro'}.
          </p>
        ) : null}
        {e.proximo ? (
          <p className="truncate">
            <span className="font-semibold">A seguir:</span> {e.proximo.texto}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-navy-300 px-1.5 font-mono text-[0.85em]">{children}</kbd>;
}
