import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useMemo, useState } from 'react';
/**
 * Gráficos de conferência da sincronia (procedimento da skill dataviz):
 * – duas séries, cores categóricas validadas (serie-1/serie-2, nos dois temas),
 *   legenda + rótulos diretos, texto sempre em tinta, nunca na cor da série;
 * – um eixo só; cursor em tinta neutra (o acento fica para o cursor da obra);
 * – dica ao passar o mouse; tabela de dados para o gráfico de resíduos.
 */
const fmtS = (ms) => `${ms >= 0 ? '+' : '−'}${(Math.abs(ms) / 1000).toFixed(2).replace('.', ',')} s`;
/** Envelope (dB) → amplitude 0–1 para desenho, com piso em −60 dB. */
const amp = (db) => Math.max(0, Math.min(1, (db + 60) / 60));
/**
 * Conferência: o som da obra (acima) e o som-guia do clipe (abaixo, espelhado),
 * na escala de tempo da obra, numa janela de ±4 s ao redor do cursor. Picos
 * alinhados na vertical = sincronia.
 */
export function ConferenciaOndas({ envObra, envClipe, janelaMs, tempoMs, inicioNaObraMs, velocidade, }) {
    const id = useId();
    const [hover, setHover] = useState(null);
    const W = 300;
    const H = 96;
    const meio = H / 2;
    const raio = 4000;
    const n = 150; // colunas
    const { obra, clipe, corr } = useMemo(() => {
        const obra = [];
        const clipe = [];
        for (let i = 0; i < n; i++) {
            const t = tempoMs - raio + (i / (n - 1)) * 2 * raio;
            const io = Math.round(t / janelaMs);
            const tc = (t - inicioNaObraMs) / velocidade;
            const ic = Math.round(tc / janelaMs);
            obra.push(io >= 0 && io < envObra.length ? amp(envObra[io]) : 0);
            clipe.push(ic >= 0 && ic < envClipe.length ? amp(envClipe[ic]) : 0);
        }
        // correlação de Pearson do trecho visível: o equivalente textual do gráfico
        const m1 = obra.reduce((a, b) => a + b, 0) / n;
        const m2 = clipe.reduce((a, b) => a + b, 0) / n;
        let s = 0, s1 = 0, s2 = 0;
        for (let i = 0; i < n; i++) {
            s += (obra[i] - m1) * (clipe[i] - m2);
            s1 += (obra[i] - m1) ** 2;
            s2 += (clipe[i] - m2) ** 2;
        }
        return { obra, clipe, corr: s1 > 0 && s2 > 0 ? s / Math.sqrt(s1 * s2) : null };
    }, [envObra, envClipe, janelaMs, tempoMs, inicioNaObraMs, velocidade]);
    const x = (i) => (i / (n - 1)) * W;
    const area = (v, sinal) => `M0,${meio} ` +
        v.map((a, i) => `L${x(i).toFixed(1)},${(meio - sinal * a * (meio - 6)).toFixed(1)}`).join(' ') +
        ` L${W},${meio} Z`;
    return (_jsxs("figure", { className: "m-0", children: [_jsxs("figcaption", { id: `${id}-t`, className: "flex items-baseline gap-2 text-2xs text-navy-700", children: [_jsx("span", { className: "font-medium", children: "Confer\u00EAncia no cursor (\u00B14 s)" }), _jsxs("span", { className: "ml-auto flex items-center gap-2", "aria-label": "Legenda", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { "aria-hidden": "true", className: "inline-block h-2 w-3 rounded-sm bg-serie-1" }), "Filme"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { "aria-hidden": "true", className: "inline-block h-2 w-3 rounded-sm bg-serie-2" }), "Som-guia"] })] })] }), _jsxs("div", { className: "relative mt-1", children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "block h-24 w-full rounded bg-fundo", role: "img", "aria-labelledby": `${id}-t ${id}-d`, onPointerMove: (e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
                        }, onPointerLeave: () => setHover(null), children: [_jsx("path", { d: area(obra, 1), className: "fill-serie-1/70" }), _jsx("path", { d: area(clipe, -1), className: "fill-serie-2/70" }), _jsx("line", { x1: "0", x2: W, y1: meio, y2: meio, className: "stroke-paper", strokeWidth: "2" }), _jsx("line", { x1: W / 2, x2: W / 2, y1: "0", y2: H, className: "stroke-navy", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("text", { x: "4", y: "11", className: "fill-navy-700 text-[9px]", children: "filme" }), _jsx("text", { x: "4", y: H - 4, className: "fill-navy-700 text-[9px]", children: "som-guia" }), hover !== null ? (_jsx("line", { x1: x(hover), x2: x(hover), y1: "0", y2: H, className: "stroke-navy-500", strokeWidth: "1" })) : null] }), hover !== null ? (_jsxs("div", { className: "pointer-events-none absolute -top-1 rounded bg-paper-200 px-1.5 py-0.5 text-2xs text-navy shadow", style: { left: `${(hover / (n - 1)) * 100}%`, transform: 'translate(-50%,-100%)' }, children: [fmtS(-raio + (hover / (n - 1)) * 2 * raio), " \u00B7 filme ", Math.round(obra[hover] * 100), "% \u00B7 guia", ' ', Math.round(clipe[hover] * 100), "%"] })) : null] }), _jsx("p", { id: `${id}-d`, className: "mt-1 text-2xs text-navy-500", children: corr === null
                    ? 'Sem som neste trecho para comparar.'
                    : `Correlação neste trecho: ${corr.toFixed(2).replace('.', ',')} — picos alinhados na vertical indicam sincronia.` })] }));
}
/**
 * Resíduo por janela de análise ao longo do clipe (ms), depois da correção.
 * Faixa neutra = ±½ quadro: pontos dentro dela estão sincronizados ao quadro.
 */
export function ResiduoSincronia({ relatorio, fps }) {
    const id = useId();
    const [hover, setHover] = useState(null);
    const pts = relatorio.pontos;
    if (pts.length === 0)
        return null;
    const W = 300;
    const H = 90;
    const pad = { l: 30, r: 6, t: 6, b: 16 };
    const meioQuadro = 500 / fps;
    const lim = Math.max(meioQuadro * 2, ...pts.map((p) => Math.abs(p.residuoMs))) * 1.15;
    const tMax = Math.max(...pts.map((p) => p.tClipeMs), 1);
    const X = (t) => pad.l + (t / tMax) * (W - pad.l - pad.r);
    const Y = (r) => pad.t + ((lim - r) / (2 * lim)) * (H - pad.t - pad.b);
    const fmtMin = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
    const p = hover !== null ? pts[hover] : null;
    return (_jsxs("figure", { className: "m-0", children: [_jsx("figcaption", { id: `${id}-t`, className: "text-2xs font-medium text-navy-700", children: "Res\u00EDduo da sincronia por trecho do clipe (ms)" }), _jsxs("div", { className: "relative mt-1", children: [_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "block h-24 w-full rounded bg-fundo", role: "img", "aria-labelledby": `${id}-t ${id}-d`, children: [_jsx("rect", { x: pad.l, width: W - pad.l - pad.r, y: Y(meioQuadro), height: Y(-meioQuadro) - Y(meioQuadro), className: "fill-paper-400/50" }), _jsx("line", { x1: pad.l, x2: W - pad.r, y1: Y(0), y2: Y(0), className: "stroke-navy-500", strokeWidth: "1" }), _jsxs("text", { x: pad.l - 3, y: Y(meioQuadro) + 3, textAnchor: "end", className: "fill-navy-500 text-[8px]", children: ["+", Math.round(meioQuadro)] }), _jsxs("text", { x: pad.l - 3, y: Y(-meioQuadro) + 3, textAnchor: "end", className: "fill-navy-500 text-[8px]", children: ["\u2212", Math.round(meioQuadro)] }), _jsx("text", { x: pad.l, y: H - 3, className: "fill-navy-500 text-[8px]", children: "0:00" }), _jsx("text", { x: W - pad.r, y: H - 3, textAnchor: "end", className: "fill-navy-500 text-[8px]", children: fmtMin(tMax) }), pts.map((q, i) => (_jsxs("g", { onPointerEnter: () => setHover(i), onPointerLeave: () => setHover(null), children: [_jsx("circle", { cx: X(q.tClipeMs), cy: Y(q.residuoMs), r: "7", className: "fill-transparent" }), _jsx("circle", { cx: X(q.tClipeMs), cy: Y(q.residuoMs), r: hover === i ? 4.5 : 3.5, className: "fill-serie-1 stroke-paper", strokeWidth: "1.5" })] }, i)))] }), p ? (_jsxs("div", { className: "pointer-events-none absolute -top-1 rounded bg-paper-200 px-1.5 py-0.5 text-2xs text-navy shadow", style: { left: `${(X(p.tClipeMs) / W) * 100}%`, transform: 'translate(-50%,-100%)' }, children: [fmtMin(p.tClipeMs), " \u00B7 ", p.residuoMs >= 0 ? '+' : '', p.residuoMs, " ms \u00B7 corr. ", p.corr.toFixed(2).replace('.', ',')] })) : null] }), _jsxs("p", { id: `${id}-d`, className: "mt-1 text-2xs text-navy-500", children: ["Faixa cinza: \u00B1\u00BD quadro (", Math.round(meioQuadro), " ms). ", relatorio.janelasValidas, " de ", relatorio.janelasTotais, ' ', "trechos com som-guia reconhec\u00EDvel; desvio residual ", relatorio.desvioMs, " ms."] }), _jsxs("details", { className: "mt-1", children: [_jsx("summary", { className: "cursor-pointer text-2xs text-navy-500", children: "Ver tabela" }), _jsxs("table", { className: "mt-1 w-full text-2xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-navy-500", children: [_jsx("th", { scope: "col", className: "font-medium", children: "Trecho" }), _jsx("th", { scope: "col", className: "font-medium", children: "Res\u00EDduo" }), _jsx("th", { scope: "col", className: "font-medium", children: "Correla\u00E7\u00E3o" })] }) }), _jsx("tbody", { children: pts.map((q, i) => (_jsxs("tr", { className: "tabular-nums", children: [_jsx("td", { children: fmtMin(q.tClipeMs) }), _jsxs("td", { children: [q.residuoMs, " ms"] }), _jsx("td", { children: q.corr.toFixed(2).replace('.', ',') })] }, i))) })] })] })] }));
}
