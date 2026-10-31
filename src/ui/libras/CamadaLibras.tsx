import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JanelaLibras } from '../../libras/tipos';
import { recorteNaFonte, retanguloJanela, type Retangulo } from '../../libras/geometria';
import { alfaChroma, uvDaCor } from '../../libras/chroma';

/**
 * Prévia da janela de Libras sobre o monitor: o clipe do intérprete, sincronizado
 * ao vídeo principal, recortado e com chroma key em WebGL.
 *
 * O shader usa a mesma fórmula do filtro `chromakey` do ffmpeg (distância em
 * U/V, normalizada, com similaridade e mistura). O ffmpeg ainda tira a média
 * de uma vizinhança 3×3: a prévia é pixel a pixel, portanto uma aproximação.
 */

const VERT = `
attribute vec2 pos; attribute vec2 uv0; varying vec2 uv;
void main() { uv = uv0; gl_Position = vec4(pos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D tex; uniform vec2 chave; uniform float sim; uniform float mistura; uniform bool ativo;
varying vec2 uv;
vec2 paraUV(vec3 c) {
  return vec2(-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5, 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5);
}
void main() {
  vec4 c = texture2D(tex, uv);
  float a = 1.0;
  if (ativo) {
    vec2 d = paraUV(c.rgb) - chave;
    float dif = sqrt((d.x * d.x + d.y * d.y) / 2.0);
    a = mistura > 0.0001 ? clamp((dif - sim) / mistura, 0.0, 1.0) : (dif > sim ? 1.0 : 0.0);
  }
  gl_FragColor = vec4(c.rgb * a, a);
}`;

function hexParaRgb(h: string): [number, number, number] {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
}


/** Altura máxima do quadro processado em CPU: acima disso a prévia perde fluidez. */
const ALTURA_CPU = 360;

interface Gl {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  buf: WebGLBuffer;
  tex: WebGLTexture;
}

function iniciarGl(canvas: HTMLCanvasElement): Gl | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
  if (!gl) return null;
  const sh = (tipo: number, src: string) => {
    const s = gl.createShader(tipo)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const buf = gl.createBuffer()!;
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return { gl, prog, buf, tex };
}

/** Área onde o vídeo principal é de fato exibido (object-contain) dentro do contêiner. */
export function areaExibida(cw: number, ch: number, vw: number, vh: number): Retangulo {
  if (!vw || !vh) return { x: 0, y: 0, w: cw, h: ch };
  const e = Math.min(cw / vw, ch / vh);
  const w = vw * e;
  const h = vh * e;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

export function CamadaLibras({
  principal,
  janela: j,
  tempoMs,
  tocando,
  guia,
}: {
  principal: HTMLVideoElement | null;
  janela: JanelaLibras;
  tempoMs: number;
  tocando: boolean;
  /** contorno e rótulo da janela (página de Libras) */
  guia: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clipe = useRef<HTMLVideoElement>(null);
  const glRef = useRef<Gl | null>(null);
  const cpuRef = useRef<{ ctx: CanvasRenderingContext2D; tmp: HTMLCanvasElement; tctx: CanvasRenderingContext2D } | null>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [semWebGl, setSemWebGl] = useState(false);
  const [, forcar] = useState(0);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setTam({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // o tamanho intrínseco do vídeo principal só chega com os metadados
  useEffect(() => {
    if (!principal) return;
    const f = () => forcar((n) => n + 1);
    principal.addEventListener('loadedmetadata', f);
    return () => principal.removeEventListener('loadedmetadata', f);
  }, [principal]);

  const area = areaExibida(tam.w, tam.h, principal?.videoWidth ?? 16, principal?.videoHeight ?? 9);
  const r = retanguloJanela(j, area.w, area.h);
  const janelaTela = { x: area.x + r.x, y: area.y + r.y, w: r.w, h: r.h };
  const tClipe = (tempoMs - j.inicioNaObraMs) / 1000;
  const dentro = !!j.clipe && tClipe >= 0 && tClipe * 1000 <= j.clipe.duracaoMs;

  // sincronia do clipe com o relógio da obra
  useEffect(() => {
    const v = clipe.current;
    if (!v || !j.clipe) return;
    if (!dentro) {
      if (!v.paused) v.pause();
      return;
    }
    if (Math.abs(v.currentTime - tClipe) > (tocando ? 0.2 : 0.04)) v.currentTime = tClipe;
    if (tocando && v.paused) void v.play().catch(() => {});
    if (!tocando && !v.paused) v.pause();
  }, [tClipe, tocando, dentro, j.clipe]);

  // laço de desenho
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(tam.w * dpr));
    c.height = Math.max(1, Math.round(tam.h * dpr));
    if (!glRef.current && !cpuRef.current) {
      glRef.current = iniciarGl(c);
      if (!glRef.current) {
        // Sem WebGL (máquina sem GPU, Chromium sem rasterização por software):
        // mesma fórmula em CPU, numa resolução reduzida.
        const ctx = c.getContext('2d');
        const tmp = document.createElement('canvas');
        const tctx = tmp.getContext('2d', { willReadFrequently: true });
        if (ctx && tctx) cpuRef.current = { ctx, tmp, tctx };
        setSemWebGl(true);
      }
    }
    if (cpuRef.current) {
      const { ctx, tmp, tctx } = cpuRef.current;
      let raf2 = 0;
      const desenharCpu = () => {
        raf2 = requestAnimationFrame(desenharCpu);
        const v = clipe.current;
        // durante a busca o quadro pode vir vazio (preto e opaco): mantém o último bom
        if (dentro && v && v.seeking) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        if (!dentro || !v || v.readyState < 2 || !v.videoWidth) return;
        const px = { x: janelaTela.x * dpr, y: janelaTela.y * dpr, w: janelaTela.w * dpr, h: janelaTela.h * dpr };
        const red = Math.min(1, ALTURA_CPU / px.h);
        const tw = Math.max(2, Math.round(px.w * red));
        const th = Math.max(2, Math.round(px.h * red));
        if (tmp.width !== tw || tmp.height !== th) {
          tmp.width = tw;
          tmp.height = th;
        }
        const rc = recorteNaFonte({ w: janelaTela.w, h: janelaTela.h }, { w: v.videoWidth, h: v.videoHeight }, j.zoom, j.deslocY);
        tctx.clearRect(0, 0, tw, th);
        tctx.drawImage(v, rc.x, rc.y, rc.w, rc.h, 0, 0, tw, th);
        if (j.chroma.ativo) {
          const img = tctx.getImageData(0, 0, tw, th);
          const d = img.data;
          const chave = uvDaCor(j.chroma.cor);
          const sim = Math.max(0.01, j.chroma.similaridade);
          for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.round(255 * alfaChroma(d[i], d[i + 1], d[i + 2], chave, sim, j.chroma.suavidade));
          tctx.putImageData(img, 0, 0);
          if (j.fundo === 'solido') {
            ctx.fillStyle = j.corFundo;
            ctx.fillRect(px.x, px.y, px.w, px.h);
          }
        }
        ctx.drawImage(tmp, px.x, px.y, px.w, px.h);
      };
      desenharCpu();
      return () => cancelAnimationFrame(raf2);
    }
    const g = glRef.current;
    if (!g) return;
    const { gl, prog, buf, tex } = g;
    let raf = 0;
    const desenhar = () => {
      raf = requestAnimationFrame(desenhar);
      if (dentro && clipe.current?.seeking) return; // mantém o último quadro bom
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const v = clipe.current;
      if (!dentro || !v || v.readyState < 2 || !v.videoWidth) return;

      const px = { x: janelaTela.x * dpr, y: janelaTela.y * dpr, w: janelaTela.w * dpr, h: janelaTela.h * dpr };
      if (j.chroma.ativo && j.fundo === 'solido') {
        const [rr, gg, bb] = hexParaRgb(j.corFundo);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(px.x, c.height - px.y - px.h, px.w, px.h);
        gl.clearColor(rr, gg, bb, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      }

      const rc = recorteNaFonte({ w: janelaTela.w, h: janelaTela.h }, { w: v.videoWidth, h: v.videoHeight }, j.zoom, j.deslocY);
      const u0 = rc.x / v.videoWidth;
      const u1 = (rc.x + rc.w) / v.videoWidth;
      const v0 = rc.y / v.videoHeight;
      const v1 = (rc.y + rc.h) / v.videoHeight;
      const X = (x: number) => (x / c.width) * 2 - 1;
      const Y = (y: number) => 1 - (y / c.height) * 2;
      const x0 = X(px.x), x1 = X(px.x + px.w), y0 = Y(px.y), y1 = Y(px.y + px.h);
      // dois triângulos: pos.x, pos.y, u, v
      const dados = new Float32Array([x0, y0, u0, v0, x1, y0, u1, v0, x0, y1, u0, v1, x1, y1, u1, v1]);

      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, dados, gl.DYNAMIC_DRAW);
      const aPos = gl.getAttribLocation(prog, 'pos');
      const aUv = gl.getAttribLocation(prog, 'uv0');
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      } catch {
        return; // origem sem CORS: nada a desenhar
      }
      const [ku, kv] = uvDaCor(j.chroma.cor);
      gl.uniform2f(gl.getUniformLocation(prog, 'chave'), ku, kv);
      gl.uniform1f(gl.getUniformLocation(prog, 'sim'), Math.max(0.01, j.chroma.similaridade));
      gl.uniform1f(gl.getUniformLocation(prog, 'mistura'), j.chroma.suavidade);
      gl.uniform1i(gl.getUniformLocation(prog, 'ativo'), j.chroma.ativo ? 1 : 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    desenhar();
    return () => cancelAnimationFrame(raf);
  }, [tam, dentro, janelaTela.x, janelaTela.y, janelaTela.w, janelaTela.h, j]);

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
            // força o primeiro quadro na posição certa (sem isso, o quadro inicial pode vir vazio)
            e.currentTarget.currentTime = Math.max(0, (tempoMs - j.inicioNaObraMs) / 1000);
          }}
        />
      ) : null}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {guia ? (
        <div
          className="absolute border-2 border-dashed border-terra"
          style={{ left: janelaTela.x, top: janelaTela.y, width: janelaTela.w, height: janelaTela.h }}
        >
          <span className="absolute left-0 top-0 border-l-2 border-terra bg-preto/85 px-1 text-2xs font-semibold text-cabine-texto">
            Libras {Math.round(j.altura * 100)}% × {Math.round(j.largura * 100)}%
            {j.clipe && !dentro ? ' · fora do clipe' : ''}
            {semWebGl ? ' · prévia em CPU' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
