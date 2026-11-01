import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Cue, Severity } from '../model/types';
import type { Intervalo, MapaTemporal } from '../mapa/tipos';
import type { Lacuna } from '../mapa/lacunas';
import type { PontoGanho } from '../ad/mixagem';
import type { NivelAD } from '../ad/verificacoes';
import { formatarTimecode } from '../core/texto';
import { ICONE_SEVERIDADE, ROTULO_SEVERIDADE } from './primitivos';
import { BotaoDica, tcSmpte } from './comum';
import { useAjudaAberta } from './ajudas';

/**
 * Linha do tempo com quatro trilhas: régua, som (envelope + atividade + cortes),
 * legendas e lacunas para audiodescrição. O envelope é desenhado em canvas
 * (decorativo, aria-hidden); legendas e lacunas são botões reais, operáveis por
 * teclado e nomeados para leitor de tela. Só o trecho visível é renderizado.
 */

/** Cores do canvas lidas dos tokens (variáveis CSS): acompanham o tema. */
function coresDoTema() {
  const css = getComputedStyle(document.documentElement);
  const c = (n: string) => `rgb(${css.getPropertyValue(`--c-${n}`).trim() || '128 128 128'})`;
  return {
    navy: c('navy'),
    navy500: c('navy-500'),
    navy300: c('navy-300'),
    paper: c('fundo'),
    paper200: c('paper-200'),
    paper400: c('paper-400'),
    terra: c('terra'),
    ok: c('ok'),
  };
}

const H_REGUA = 22;
const H_SOM = 64;
const H_LEGENDAS = 44;
const H_LACUNAS = 30;
const H_AD = 40;
const H_LIBRAS = 26;
const H_CANVAS = H_REGUA + H_SOM;

const ZOOMS = [2, 5, 10, 20, 40, 80, 160, 320];

const CLASSE_SEV: Record<Severity | 'ok', string> = {
  erro: 'border-bad bg-bad-100 text-bad',
  aviso: 'border-warn bg-warn-100 text-warn',
  revisao_manual: 'border-navy-500 bg-paper-200 text-navy-700',
  ok: 'border-navy-300 bg-paper text-navy-700',
};

function rotuloTempo(s: number, passo: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const ss = passo < 1 ? seg.toFixed(1).padStart(4, '0') : String(Math.floor(seg)).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function passoDaRegua(pxPorSegundo: number): number {
  for (const p of [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]) {
    if (p * pxPorSegundo >= 80) return p;
  }
  return 3600;
}

export interface BlocoNaLinha {
  id: string;
  inicioMs: number;
  fimMs: number;
  texto: string;
  take: { inicioMs: number; fimMs: number } | null;
  nivel: NivelAD;
}

const CLASSE_NIVEL: Record<NivelAD, string> = {
  ok: 'border-ok bg-ok-100 text-ok',
  aviso: 'border-warn bg-warn-100 text-warn',
  erro: 'border-bad bg-bad-100 text-bad',
  pendente: 'border-navy-300 bg-paper text-navy-700',
};
const ICONE_NIVEL: Record<NivelAD, string> = { ok: '✓', aviso: '!', erro: '✕', pendente: '…' };
const ROTULO_NIVEL: Record<NivelAD, string> = { ok: 'pronto', aviso: 'com aviso', erro: 'com erro', pendente: 'pendente' };

export interface PropsLinhaDoTempo {
  duracaoMs: number;
  /** cadência da obra, para o timecode do cabeçalho */
  fps: number;
  mapa: MapaTemporal | null;
  cues: Cue[];
  severidades: Map<number, Severity>;
  lacunas: Lacuna[];
  alertasSom: Intervalo[];
  tempoMs: number;
  aoBuscar: (ms: number) => void;
  aoSelecionarLegenda: (index: number) => void;
  /** trilha de audiodescrição (módulo de AD) */
  trilhaAd?: BlocoNaLinha[];
  aoSelecionarBloco?: (id: string) => void;
  /** curva de ganho do original, desenhada sobre a forma de onda */
  curvaGanho?: PontoGanho[];
  /** trecho coberto pelo clipe do intérprete */
  trilhaLibras?: { inicioMs: number; fimMs: number; rotulo: string } | null;
}

export function LinhaDoTempo(p: PropsLinhaDoTempo) {
  const id = useId();
  const [zoom, setZoom] = useState(4); // índice em ZOOMS
  const pxs = ZOOMS[zoom];
  const [acompanhar, setAcompanhar] = useState(true);
  const [legenda, alternarLegenda] = useAjudaAberta();
  const vp = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scroll, setScroll] = useState(0);
  const [largura, setLargura] = useState(800);

  const total = Math.max(1, (p.duracaoMs / 1000) * pxs);
  const hAd = p.trilhaAd ? H_AD : 0;
  const hLib = p.trilhaLibras !== undefined ? H_LIBRAS : 0;
  const H_TOTAL = H_CANVAS + H_LEGENDAS + hAd + hLib + H_LACUNAS;
  const x = (ms: number) => (ms / 1000) * pxs;
  const t0 = (scroll / pxs) * 1000;
  const t1 = ((scroll + largura) / pxs) * 1000;

  useLayoutEffect(() => {
    const el = vp.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    setLargura(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Acompanha a reprodução: reposiciona quando o cursor sai da área visível.
  useEffect(() => {
    const el = vp.current;
    if (!acompanhar || !el) return;
    const cx = x(p.tempoMs);
    if (cx < el.scrollLeft || cx > el.scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = Math.max(0, cx - el.clientWidth * 0.2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tempoMs, pxs, acompanhar]);

  function mudarZoom(novo: number) {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, novo));
    setZoom(i);
    // mantém o cursor de reprodução no mesmo ponto relativo da tela
    requestAnimationFrame(() => {
      const el = vp.current;
      if (el) el.scrollLeft = Math.max(0, (p.tempoMs / 1000) * ZOOMS[i] - el.clientWidth / 2);
    });
  }

  // Desenho do canvas: régua + envelope + atividade + limiar.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(largura * dpr);
    c.height = Math.round(H_CANVAS * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    const COR = coresDoTema();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, largura, H_CANVAS);

    // Régua
    g.fillStyle = COR.paper200;
    g.fillRect(0, 0, largura, H_REGUA);
    const passo = passoDaRegua(pxs);
    g.strokeStyle = COR.navy300;
    g.fillStyle = COR.navy;
    g.font = '11px ui-monospace, Menlo, monospace';
    g.textBaseline = 'middle';
    const inicio = Math.floor(t0 / 1000 / passo) * passo;
    for (let s = inicio; s * 1000 <= t1; s += passo) {
      const px = (s * pxs) - scroll;
      g.beginPath();
      g.moveTo(px + 0.5, H_REGUA - 8);
      g.lineTo(px + 0.5, H_REGUA);
      g.stroke();
      g.fillText(rotuloTempo(Math.round(s * 10) / 10, passo), px + 3, H_REGUA / 2 - 1);
    }

    // além do fim da obra: hachurado discreto
    const fimPx = (p.duracaoMs / 1000) * pxs - scroll;
    if (fimPx < largura) {
      g.fillStyle = COR.paper400;
      g.globalAlpha = 0.35;
      g.fillRect(Math.max(0, fimPx), 0, largura - Math.max(0, fimPx), H_CANVAS);
      g.globalAlpha = 1;
    }

    // Som
    const y0 = H_REGUA;
    g.fillStyle = COR.paper;
    g.fillRect(0, y0, largura, H_SOM);
    const mapa = p.mapa;
    if (mapa && mapa.audio && mapa.envelopeDb.length > 0) {
      const env = mapa.envelopeDb;
      const piso = mapa.pisoDb - 6;
      const escala = (db: number) => Math.max(0, Math.min(1, (db - piso) / (0 - piso)));
      const meio = y0 + H_SOM / 2;
      g.fillStyle = COR.navy300;
      for (let px = 0; px < largura; px++) {
        const a = Math.floor((((scroll + px) / pxs) * 1000) / mapa.janelaMs);
        const b = Math.max(a + 1, Math.floor((((scroll + px + 1) / pxs) * 1000) / mapa.janelaMs));
        if (a >= env.length) break;
        let max = -Infinity;
        for (let k = a; k < Math.min(b, env.length); k++) if (env[k] > max) max = env[k];
        const h = escala(max) * (H_SOM / 2 - 6);
        g.fillRect(px, meio - h, 1, h * 2);
      }
      // limiar de atividade
      const lim = escala(mapa.pisoDb + mapa.parametros.limiarDb) * (H_SOM / 2 - 6);
      g.strokeStyle = COR.terra;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(0, meio - lim + 0.5);
      g.lineTo(largura, meio - lim + 0.5);
      g.stroke();
      g.setLineDash([]);
      // faixa de atividade
      g.fillStyle = COR.navy500;
      for (const s of mapa.atividade) {
        if (s.fimMs < t0 || s.inicioMs > t1) continue;
        g.fillRect(x(s.inicioMs) - scroll, y0 + H_SOM - 5, Math.max(1, x(s.fimMs - s.inicioMs)), 4);
      }
      // som sem legenda (M3): moldura tracejada
      g.strokeStyle = COR.terra;
      g.setLineDash([2, 2]);
      for (const s of p.alertasSom) {
        if (s.fimMs < t0 || s.inicioMs > t1) continue;
        g.strokeRect(x(s.inicioMs) - scroll + 0.5, y0 + 2.5, Math.max(1, x(s.fimMs - s.inicioMs)) - 1, H_SOM - 9);
      }
      g.setLineDash([]);
      // curva de ducking da AD: 0 dB no topo do traço, atenuação para baixo
      if (p.curvaGanho && p.curvaGanho.length > 1) {
        g.strokeStyle = COR.ok;
        g.lineWidth = 1.5;
        g.beginPath();
        const yG = (ganho: number) => y0 + 4 + (1 - ganho) * (H_SOM - 14);
        for (let px = 0; px <= largura; px += 2) {
          const ms = ((scroll + px) / pxs) * 1000;
          let k = 0;
          while (k + 1 < p.curvaGanho.length && p.curvaGanho[k + 1].ms <= ms) k++;
          const a = p.curvaGanho[k];
          const b = p.curvaGanho[k + 1];
          const ganho = !b || b.ms === a.ms ? a.ganho : a.ganho + ((b.ganho - a.ganho) * (ms - a.ms)) / (b.ms - a.ms);
          if (px === 0) g.moveTo(px, yG(ganho));
          else g.lineTo(px, yG(ganho));
        }
        g.stroke();
        g.lineWidth = 1;
      }
    } else {
      g.fillStyle = COR.navy500;
      g.font = '12px system-ui, sans-serif';
      g.fillText(mapa && !mapa.audio ? 'Áudio não decodificado' : 'Sem análise de áudio', 8, y0 + H_SOM / 2);
    }
  }, [scroll, largura, pxs, p.mapa, p.alertasSom, p.curvaGanho, t0, t1]);

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const passoMs = e.shiftKey ? 5000 : 1000;
    if (e.key === 'ArrowRight') p.aoBuscar(Math.min(p.duracaoMs, p.tempoMs + passoMs));
    else if (e.key === 'ArrowLeft') p.aoBuscar(Math.max(0, p.tempoMs - passoMs));
    else if (e.key === '+' || e.key === '=') mudarZoom(zoom + 1);
    else if (e.key === '-') mudarZoom(zoom - 1);
    else return;
    e.preventDefault();
  }

  const visiveis = p.cues.filter((c) => c.endMs >= t0 && c.startMs <= t1);
  const lacunasVisiveis = p.lacunas.filter((l) => l.fimMs >= t0 && l.inicioMs <= t1);
  const cortesVisiveis = (p.mapa?.cortes ?? []).filter((c) => c.ms >= t0 && c.ms <= t1);
  const atual = p.cues.find((c) => p.tempoMs >= c.startMs && p.tempoMs < c.endMs);

  return (
    <section aria-labelledby={`${id}-t`} className="painel">
      <div className="painel-cabeca">
        <span aria-hidden="true" className="w-28 font-mono text-[15px] font-medium tabular-nums text-terra-700">
          {tcSmpte(p.tempoMs, p.fps)}
        </span>
        <h2 id={`${id}-t`}>Linha do tempo</h2>
        <BotaoDica titulo="legenda da linha do tempo" aberta={legenda} alvo={`${id}-leg`} aoAlternar={alternarLegenda} />
        <div className="ml-auto flex items-center gap-1 font-normal">
          <button type="button" className="segmento" aria-pressed={acompanhar} onClick={() => setAcompanhar(!acompanhar)} title="Rolar junto com a reprodução">
            Acompanhar
          </button>
          <div className="ml-2 flex items-center gap-1" role="group" aria-label="Zoom">
            <button type="button" className="btn-icone h-6 w-6" aria-label="Afastar" onClick={() => mudarZoom(zoom - 1)} disabled={zoom === 0}>
              <span aria-hidden="true">−</span>
            </button>
            <input
              type="range"
              className="w-24"
              aria-label="Zoom da linha do tempo"
              aria-valuetext={`${pxs} pixels por segundo`}
              min={0}
              max={ZOOMS.length - 1}
              step={1}
              value={zoom}
              onChange={(e) => mudarZoom(Number(e.target.value))}
            />
            <button type="button" className="btn-icone h-6 w-6" aria-label="Aproximar" onClick={() => mudarZoom(zoom + 1)} disabled={zoom === ZOOMS.length - 1}>
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        <div aria-hidden="true" className="w-36 shrink-0 border-r border-fundo bg-paper text-2xs">
          <div style={{ height: H_REGUA }} className="border-b border-fundo bg-paper-200" />
          <CabecaTrilha altura={H_SOM} codigo="A1" nome="Som da obra" cor="bg-navy-500" />
          <CabecaTrilha altura={H_LEGENDAS} codigo="ST" nome="Legendas" cor="bg-warn" />
          {p.trilhaAd ? <CabecaTrilha altura={H_AD} codigo="A2" nome="Audiodescrição" cor="bg-ok" /> : null}
          {hLib ? <CabecaTrilha altura={H_LIBRAS} codigo="V2" nome="Libras" cor="bg-serie-1" /> : null}
          <CabecaTrilha altura={H_LACUNAS} codigo="—" nome="Lacunas (AD)" cor="bg-paper-400" />
        </div>

        <div
          ref={vp}
          tabIndex={0}
          role="group"
          aria-label={`Linha do tempo, posição ${formatarTimecode(p.tempoMs)}`}
          onKeyDown={teclado}
          onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
          className="relative min-w-0 flex-1 overflow-x-auto bg-fundo"
        >
          <div className="relative" style={{ width: total, height: H_TOTAL }}>
            <canvas
              ref={canvas}
              aria-hidden="true"
              className="absolute top-0 cursor-pointer"
              style={{ left: scroll, width: largura, height: H_CANVAS }}
              onClick={(e) => p.aoBuscar(((scroll + e.nativeEvent.offsetX) / pxs) * 1000)}
            />

            {cortesVisiveis.map((c) => (
              <div
                key={c.ms}
                aria-hidden="true"
                title={`Corte em ${formatarTimecode(c.ms)} (±${c.precisaoMs} ms)`}
                className="pointer-events-none absolute border-l border-navy"
                style={{ left: x(c.ms), top: H_REGUA, height: H_SOM + H_LEGENDAS + hAd + hLib }}
              />
            ))}

            <div className="absolute left-0 border-t border-paper-200" style={{ top: H_CANVAS, width: total, height: H_LEGENDAS }}>
              {visiveis.map((c) => {
                const sev = p.severidades.get(c.index);
                const w = Math.max(3, x(c.endMs - c.startMs));
                const texto = c.lines.join(' ').replace(/<\/?[^>]+>/g, '');
                return (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => {
                      p.aoBuscar(c.startMs);
                      p.aoSelecionarLegenda(c.index);
                    }}
                    aria-label={`Legenda ${c.index}, ${formatarTimecode(c.startMs)} a ${formatarTimecode(c.endMs)}${sev ? `, ${ROTULO_SEVERIDADE[sev].toLowerCase()} pendente` : ''}: ${texto}`}
                    title={texto}
                    className={`absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border px-1 text-left text-[11px] leading-[34px] ${CLASSE_SEV[sev ?? 'ok']} ${atual?.index === c.index ? 'ring-2 ring-terra' : ''}`}
                    style={{ left: x(c.startMs), width: w, height: H_LEGENDAS - 8 }}
                  >
                    {w > 14 ? (
                      <span aria-hidden="true" className="font-semibold">
                        {sev ? `${ICONE_SEVERIDADE[sev]} ` : ''}
                        {w > 28 ? texto : ''}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {p.trilhaAd ? (
              <div className="absolute left-0 border-t border-paper-200" style={{ top: H_CANVAS + H_LEGENDAS, width: total, height: H_AD }}>
                {p.trilhaAd
                  .filter((b) => b.fimMs >= t0 && b.inicioMs <= t1)
                  .map((b) => {
                    const w = Math.max(3, x(b.fimMs - b.inicioMs));
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          p.aoBuscar(b.take?.inicioMs ?? b.inicioMs);
                          p.aoSelecionarBloco?.(b.id);
                        }}
                        aria-label={`Bloco de audiodescrição de ${formatarTimecode(b.inicioMs)} a ${formatarTimecode(b.fimMs)}, ${ROTULO_NIVEL[b.nivel]}${b.take ? ', gravado' : ''}: ${b.texto || 'sem roteiro'}`}
                        title={b.texto}
                        className={`absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border text-left text-[11px] ${CLASSE_NIVEL[b.nivel]}`}
                        style={{ left: x(b.inicioMs), width: w, height: H_AD - 8 }}
                      >
                        {b.take ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0.5 top-0.5 rounded-sm bg-navy/25"
                            style={{ left: x(b.take.inicioMs - b.inicioMs), width: Math.max(2, x(b.take.fimMs - b.take.inicioMs)) }}
                          />
                        ) : null}
                        {w > 14 ? (
                          <span aria-hidden="true" className="relative px-1 font-semibold leading-[30px]">
                            {ICONE_NIVEL[b.nivel]} {w > 40 ? b.texto : ''}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
              </div>
            ) : null}

            {hLib ? (
              <div className="absolute left-0 border-t border-paper-200" style={{ top: H_CANVAS + H_LEGENDAS + hAd, width: total, height: H_LIBRAS }}>
                {p.trilhaLibras ? (
                  <button
                    type="button"
                    onClick={() => p.aoBuscar(Math.max(0, p.trilhaLibras!.inicioMs))}
                    aria-label={`Clipe de Libras ${p.trilhaLibras.rotulo}, de ${formatarTimecode(Math.max(0, p.trilhaLibras.inicioMs))} a ${formatarTimecode(p.trilhaLibras.fimMs)}`}
                    className="absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border border-serie-1 bg-serie-1/30 px-1 text-left text-[11px] leading-[16px] text-navy"
                    style={{ left: Math.max(0, x(p.trilhaLibras.inicioMs)), width: Math.max(3, x(p.trilhaLibras.fimMs - Math.max(0, p.trilhaLibras.inicioMs))), height: H_LIBRAS - 8 }}
                  >
                    <span aria-hidden="true">🤟 {p.trilhaLibras.rotulo}</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            <div
              className="absolute left-0 border-t border-paper-200"
              style={{ top: H_CANVAS + H_LEGENDAS + hAd + hLib, width: total, height: H_LACUNAS }}
            >
              {lacunasVisiveis.map((l) => {
                const w = Math.max(3, x(l.fimMs - l.inicioMs));
                const dur = ((l.fimMs - l.inicioMs) / 1000).toFixed(1).replace('.', ',');
                const som = l.fracaoComSom !== null && l.fracaoComSom > 0.5;
                return (
                  <button
                    key={l.inicioMs}
                    type="button"
                    onClick={() => p.aoBuscar(l.inicioMs)}
                    aria-label={`${dur} s: lacuna para audiodescrição a partir de ${formatarTimecode(l.inicioMs)}${som ? ', com som na maior parte' : ''}`}
                    className="absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border border-dashed border-ok bg-ok-100 px-1 text-left text-[11px] leading-[20px] text-ok"
                    style={{ left: x(l.inicioMs), width: w, height: H_LACUNAS - 8 }}
                  >
                    {w > 36 ? (
                      <span aria-hidden="true">
                        {som ? '♪ ' : ''}
                        {dur} s
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 w-px bg-terra"
              style={{ left: x(p.tempoMs), height: H_TOTAL }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-3 w-[11px] bg-terra"
              style={{ left: x(p.tempoMs) - 5, clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)' }}
            />
          </div>
        </div>
      </div>
      {legenda ? (
        <p id={`${id}-leg`} className="border-t border-fundo px-3 py-1 text-2xs text-navy-700">
          Forma de onda na banda de voz (150–4000 Hz); linha tracejada: limiar de atividade; faixa escura: som
          detectado; moldura tracejada: som sem legenda (M3); traço vertical: corte de plano
          {p.curvaGanho ? '; linha verde: ganho do som original sob a audiodescrição (ducking)' : ''}. Com a linha
          em foco: <kbd>←</kbd>/<kbd>→</kbd> 1 s (<kbd>Shift</kbd> 5 s), <kbd>+</kbd>/<kbd>−</kbd> zoom.
        </p>
      ) : null}
    </section>
  );
}

/** Cabeçalho de trilha, como no Resolve: faixa de cor, código e nome. */
function CabecaTrilha({ altura, codigo, nome, cor }: { altura: number; codigo: string; nome: string; cor: string }) {
  return (
    <div style={{ height: altura }} className="flex items-center gap-2 border-b border-fundo pr-2">
      <span className={`h-full w-[3px] shrink-0 ${cor}`} />
      <span className="w-5 font-mono font-semibold text-navy">{codigo}</span>
      <span className="truncate text-navy-700">{nome}</span>
    </div>
  );
}
