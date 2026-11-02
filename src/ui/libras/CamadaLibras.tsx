import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JanelaLibras } from '../../libras/tipos';
import { recorteNaFonte, retanguloJanela, type Retangulo } from '../../libras/geometria';
import { processarQuadro } from '../../libras/tratamento';
import { AREA_SEGURA } from '../../libras/enquadramento';
import { CanalInterprete } from '../../ad/previa';
import type { LibrasUi } from '../../state/store';

/**
 * Prévia da janela de Libras sobre o monitor: o clipe do intérprete,
 * sincronizado ao vídeo da obra (início e velocidade), enquadrado e tratado
 * pela mesma cadeia que a entrega aplica com o ffmpeg (src/libras/tratamento.ts;
 * fidelidade medida em teste: 99,99% do alfa, ~3 níveis de cor).
 *
 * O processamento é em CPU, numa resolução reduzida (até ALTURA_PREVIA): os
 * raios de erosão e desfoque são convertidos proporcionalmente.
 */

/** Altura máxima processada na prévia. */
const ALTURA_PREVIA = 480;

/** Área onde o vídeo principal é de fato exibido (object-contain) dentro do contêiner. */
export function areaExibida(cw: number, ch: number, vw: number, vh: number): Retangulo {
  if (!vw || !vh) return { x: 0, y: 0, w: cw, h: ch };
  const e = Math.min(cw / vw, ch / vh);
  const w = vw * e;
  const h = vh * e;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

const hexDe = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

export function CamadaLibras({
  principal,
  janela: j,
  tempoMs,
  tocando,
  guia,
  ui,
  aoPegarCor,
}: {
  principal: HTMLVideoElement | null;
  janela: JanelaLibras;
  tempoMs: number;
  tocando: boolean;
  /** contorno, rótulo e guias (página de Libras) */
  guia: boolean;
  ui: LibrasUi;
  aoPegarCor?: (hex: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clipe = useRef<HTMLVideoElement>(null);
  const bruto = useRef<{ dados: ImageData; rc: Retangulo } | null>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [, forcar] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const custo = useRef<number | null>(null);
  const quadros = useRef(0);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setTam({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!principal) return;
    const f = () => forcar((n) => n + 1);
    principal.addEventListener('loadedmetadata', f);
    return () => principal.removeEventListener('loadedmetadata', f);
  }, [principal]);

  const area = areaExibida(tam.w, tam.h, principal?.videoWidth ?? 16, principal?.videoHeight ?? 9);
  const r = retanguloJanela(j, area.w, area.h);
  const janelaTela = { x: area.x + r.x, y: area.y + r.y, w: r.w, h: r.h };
  const v = j.velocidade > 0 ? j.velocidade : 1;
  // tObra = início + tClipe × v
  const tClipe = (tempoMs - j.inicioNaObraMs) / 1000 / v;
  const dentro = !!j.clipe && tClipe >= 0 && tClipe * 1000 <= j.clipe.duracaoMs;

  // sincronia do clipe com o relógio da obra
  useEffect(() => {
    const c = clipe.current;
    if (!c || !j.clipe) return;
    if (!dentro) {
      if (!c.paused) c.pause();
      return;
    }
    c.playbackRate = (principal?.playbackRate ?? 1) / v;
    if (Math.abs(c.currentTime - tClipe) > (tocando ? 0.2 : 0.04)) c.currentTime = tClipe;
    if (tocando && c.paused) void c.play().catch(() => {});
    if (!tocando && !c.paused) c.pause();
  }, [tClipe, tocando, dentro, j.clipe, v, principal]);

  // som-guia do intérprete na conferência de ouvido
  const [canal, setCanal] = useState<CanalInterprete | null>(null);
  useEffect(() => {
    const c = clipe.current;
    if (!c || !j.clipe) return;
    const k = new CanalInterprete(c);
    setCanal(k);
    return () => {
      k.descartar();
      setCanal(null);
    };
  }, [j.clipe?.url]);
  useEffect(() => canal?.definirEscuta(ui.escuta), [canal, ui.escuta]);

  // laço de desenho
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    // redimensionar apaga o canvas: só quando o tamanho muda de fato (assim o
    // último quadro bom continua visível enquanto o clipe busca a nova posição)
    const cw = Math.max(1, Math.round(tam.w * dpr));
    const chh = Math.max(1, Math.round(tam.h * dpr));
    if (c.width !== cw) c.width = cw;
    if (c.height !== chh) c.height = chh;
    const ctx = c.getContext('2d');
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!ctx || !tctx) return;
    let raf = 0;
    const desenhar = () => {
      raf = requestAnimationFrame(desenhar);
      const vid = clipe.current;
      // durante a busca o quadro pode vir vazio (preto e opaco): mantém o último bom
      if (dentro && vid && vid.seeking) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      if (!dentro || !vid || vid.readyState < 2 || !vid.videoWidth) return;
      const px = { x: janelaTela.x * dpr, y: janelaTela.y * dpr, w: janelaTela.w * dpr, h: janelaTela.h * dpr };
      const rc = recorteNaFonte(
        { w: janelaTela.w, h: janelaTela.h },
        { w: vid.videoWidth, h: vid.videoHeight },
        j.zoom,
        j.deslocY,
        j.deslocX,
      );
      // processa na resolução do recorte, limitada a ALTURA_PREVIA
      const red = Math.min(1, ALTURA_PREVIA / rc.h);
      const tw = Math.max(2, Math.round(rc.w * red));
      const th = Math.max(2, Math.round(rc.h * red));
      if (tmp.width !== tw || tmp.height !== th) {
        tmp.width = tw;
        tmp.height = th;
      }
      tctx.clearRect(0, 0, tw, th);
      tctx.drawImage(vid, rc.x, rc.y, rc.w, rc.h, 0, 0, tw, th);
      const img = tctx.getImageData(0, 0, tw, th);
      bruto.current = { dados: new ImageData(new Uint8ClampedArray(img.data), tw, th), rc };
      const t0 = performance.now();
      processarQuadro(img.data, tw, th, { chroma: j.chroma, cor: j.cor }, red);
      if (ui.visual === 'matte') {
        for (let i = 0; i < img.data.length; i += 4) {
          const a = img.data[i + 3];
          img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
          img.data[i + 3] = 255;
        }
      }
      tctx.putImageData(img, 0, 0);
      // custo por quadro, exibido no rótulo; atualizado ~2×/s para não re-renderizar a cada quadro
      custo.current =
        custo.current === null ? performance.now() - t0 : custo.current * 0.9 + (performance.now() - t0) * 0.1;
      if (++quadros.current % 30 === 0) setMs(custo.current);
      if (ui.visual === 'cinza') {
        ctx.fillStyle = '#808080';
        ctx.fillRect(px.x, px.y, px.w, px.h);
      } else if (ui.visual === 'composicao' && j.chroma.ativo && j.fundo === 'solido') {
        ctx.fillStyle = j.corFundo;
        ctx.fillRect(px.x, px.y, px.w, px.h);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, px.x, px.y, px.w, px.h);
    };
    desenhar();
    return () => cancelAnimationFrame(raf);
  }, [tam, dentro, janelaTela.x, janelaTela.y, janelaTela.w, janelaTela.h, j, ui.visual]);

  // conta-gotas: clique dentro da janela → cor do pixel no quadro original (antes do tratamento)
  function pegar(e: React.PointerEvent<HTMLDivElement>) {
    const b = bruto.current;
    if (!b || !aoPegarCor) return;
    const ret = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - ret.left) / ret.width;
    const fy = (e.clientY - ret.top) / ret.height;
    const x = Math.min(b.dados.width - 1, Math.max(0, Math.floor(fx * b.dados.width)));
    const y = Math.min(b.dados.height - 1, Math.max(0, Math.floor(fy * b.dados.height)));
    // média 5×5, para não pegar um pixel de ruído
    let sr = 0,
      sg = 0,
      sb = 0,
      n = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = Math.min(b.dados.width - 1, Math.max(0, x + dx));
        const yy = Math.min(b.dados.height - 1, Math.max(0, y + dy));
        const i = 4 * (yy * b.dados.width + xx);
        sr += b.dados.data[i];
        sg += b.dados.data[i + 1];
        sb += b.dados.data[i + 2];
        n++;
      }
    }
    aoPegarCor(hexDe(Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)));
  }

  return (
    <div ref={caixa} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {j.clipe ? (
        // fora da tela, mas não `display:none`: o Chromium pode deixar de decodificar quadros de vídeos ocultos
        <video
          ref={clipe}
          src={j.clipe.url}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
          onLoadedData={(e) => {
            e.currentTarget.currentTime = Math.max(0, tClipe);
          }}
        />
      ) : null}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {guia && ui.areaSegura ? (
        <div
          className="absolute border border-dashed border-cabine-suave/70"
          style={{
            left: area.x + area.w * AREA_SEGURA,
            top: area.y + area.h * AREA_SEGURA,
            width: area.w * (1 - 2 * AREA_SEGURA),
            height: area.h * (1 - 2 * AREA_SEGURA),
          }}
        >
          <span className="absolute right-0 top-0 bg-preto/80 px-1 text-2xs text-cabine-suave">área segura (5%)</span>
        </div>
      ) : null}
      {guia ? (
        <div
          className={`absolute border-2 border-dashed border-terra ${ui.contaGotas ? 'pointer-events-auto cursor-crosshair' : ''}`}
          style={{ left: janelaTela.x, top: janelaTela.y, width: janelaTela.w, height: janelaTela.h }}
          onPointerDown={ui.contaGotas ? pegar : undefined}
        >
          <span className="absolute left-0 top-0 border-l-2 border-terra bg-preto/85 px-1 text-2xs font-semibold text-cabine-texto">
            Libras {Math.round(j.altura * 100)}% × {Math.round(j.largura * 100)}%
            {ui.visual !== 'composicao' ? ` · ${ui.visual === 'matte' ? 'matte' : 'sobre cinza'}` : ''}
            {ui.contaGotas ? ' · clique no fundo para pegar a cor' : ''}
            {j.clipe && !dentro ? ' · fora do clipe' : ''}
            {ms !== null && dentro ? ` · ${Math.round(ms)} ms/quadro` : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
