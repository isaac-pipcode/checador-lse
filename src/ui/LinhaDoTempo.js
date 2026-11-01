import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useLayoutEffect, useRef, useState, } from "react";
import { formatarTimecode } from "../core/texto";
import { ICONE_SEVERIDADE, ROTULO_SEVERIDADE } from "./primitivos";
import { BotaoDica } from "./comum";
/**
 * Linha do tempo com quatro trilhas: régua, som (envelope + atividade + cortes),
 * legendas e lacunas para audiodescrição. O envelope é desenhado em canvas
 * (decorativo, aria-hidden); legendas e lacunas são botões reais, operáveis por
 * teclado e nomeados para leitor de tela. Só o trecho visível é renderizado.
 */
/** Cores do canvas lidas dos tokens (variáveis CSS): acompanham o tema. */
function coresDoTema() {
    const css = getComputedStyle(document.documentElement);
    const c = (n) => `rgb(${css.getPropertyValue(`--c-${n}`).trim() || "128 128 128"})`;
    return {
        navy: c("navy"),
        navy500: c("navy-500"),
        navy300: c("navy-300"),
        paper: c("fundo"),
        paper200: c("paper-200"),
        paper400: c("paper-400"),
        terra: c("terra"),
        ok: c("ok"),
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
const CLASSE_SEV = {
    erro: "border-bad bg-bad-100 text-bad",
    aviso: "border-warn bg-warn-100 text-warn",
    revisao_manual: "border-navy-500 bg-paper-200 text-navy-700",
    ok: "border-navy-300 bg-paper text-navy-700",
};
function rotuloTempo(s, passo) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    const ss = passo < 1
        ? seg.toFixed(1).padStart(4, "0")
        : String(Math.floor(seg)).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function passoDaRegua(pxPorSegundo) {
    for (const p of [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]) {
        if (p * pxPorSegundo >= 80)
            return p;
    }
    return 3600;
}
const CLASSE_NIVEL = {
    ok: "border-ok bg-ok-100 text-ok",
    aviso: "border-warn bg-warn-100 text-warn",
    erro: "border-bad bg-bad-100 text-bad",
    pendente: "border-navy-300 bg-paper text-navy-700",
};
const ICONE_NIVEL = {
    ok: "✓",
    aviso: "!",
    erro: "✕",
    pendente: "…",
};
const ROTULO_NIVEL = {
    ok: "pronto",
    aviso: "com aviso",
    erro: "com erro",
    pendente: "pendente",
};
export function LinhaDoTempo(p) {
    const id = useId();
    const [zoom, setZoom] = useState(4); // índice em ZOOMS
    const pxs = ZOOMS[zoom];
    const [acompanhar, setAcompanhar] = useState(true);
    const [legenda, setLegenda] = useState(false);
    const vp = useRef(null);
    const canvas = useRef(null);
    const [scroll, setScroll] = useState(0);
    const [largura, setLargura] = useState(800);
    const total = Math.max(1, (p.duracaoMs / 1000) * pxs);
    const hAd = p.trilhaAd ? H_AD : 0;
    const hLib = p.trilhaLibras !== undefined ? H_LIBRAS : 0;
    const H_TOTAL = H_CANVAS + H_LEGENDAS + hAd + hLib + H_LACUNAS;
    const x = (ms) => (ms / 1000) * pxs;
    const t0 = (scroll / pxs) * 1000;
    const t1 = ((scroll + largura) / pxs) * 1000;
    useLayoutEffect(() => {
        const el = vp.current;
        if (!el)
            return;
        const ro = new ResizeObserver(() => setLargura(el.clientWidth));
        ro.observe(el);
        setLargura(el.clientWidth);
        return () => ro.disconnect();
    }, []);
    // Acompanha a reprodução: reposiciona quando o cursor sai da área visível.
    useEffect(() => {
        const el = vp.current;
        if (!acompanhar || !el)
            return;
        const cx = x(p.tempoMs);
        if (cx < el.scrollLeft || cx > el.scrollLeft + el.clientWidth - 40) {
            el.scrollLeft = Math.max(0, cx - el.clientWidth * 0.2);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [p.tempoMs, pxs, acompanhar]);
    function mudarZoom(novo) {
        const i = Math.max(0, Math.min(ZOOMS.length - 1, novo));
        setZoom(i);
        // mantém o cursor de reprodução no mesmo ponto relativo da tela
        requestAnimationFrame(() => {
            const el = vp.current;
            if (el)
                el.scrollLeft = Math.max(0, (p.tempoMs / 1000) * ZOOMS[i] - el.clientWidth / 2);
        });
    }
    // Desenho do canvas: régua + envelope + atividade + limiar.
    useEffect(() => {
        const c = canvas.current;
        if (!c)
            return;
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(largura * dpr);
        c.height = Math.round(H_CANVAS * dpr);
        const g = c.getContext("2d");
        if (!g)
            return;
        const COR = coresDoTema();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, largura, H_CANVAS);
        // Régua
        g.fillStyle = COR.paper200;
        g.fillRect(0, 0, largura, H_REGUA);
        const passo = passoDaRegua(pxs);
        g.strokeStyle = COR.navy300;
        g.fillStyle = COR.navy;
        g.font = "11px ui-monospace, Menlo, monospace";
        g.textBaseline = "middle";
        const inicio = Math.floor(t0 / 1000 / passo) * passo;
        for (let s = inicio; s * 1000 <= t1; s += passo) {
            const px = s * pxs - scroll;
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
            const escala = (db) => Math.max(0, Math.min(1, (db - piso) / (0 - piso)));
            const meio = y0 + H_SOM / 2;
            g.fillStyle = COR.navy300;
            for (let px = 0; px < largura; px++) {
                const a = Math.floor((((scroll + px) / pxs) * 1000) / mapa.janelaMs);
                const b = Math.max(a + 1, Math.floor((((scroll + px + 1) / pxs) * 1000) / mapa.janelaMs));
                if (a >= env.length)
                    break;
                let max = -Infinity;
                for (let k = a; k < Math.min(b, env.length); k++)
                    if (env[k] > max)
                        max = env[k];
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
                if (s.fimMs < t0 || s.inicioMs > t1)
                    continue;
                g.fillRect(x(s.inicioMs) - scroll, y0 + H_SOM - 5, Math.max(1, x(s.fimMs - s.inicioMs)), 4);
            }
            // som sem legenda (M3): moldura tracejada
            g.strokeStyle = COR.terra;
            g.setLineDash([2, 2]);
            for (const s of p.alertasSom) {
                if (s.fimMs < t0 || s.inicioMs > t1)
                    continue;
                g.strokeRect(x(s.inicioMs) - scroll + 0.5, y0 + 2.5, Math.max(1, x(s.fimMs - s.inicioMs)) - 1, H_SOM - 9);
            }
            g.setLineDash([]);
            // curva de ducking da AD: 0 dB no topo do traço, atenuação para baixo
            if (p.curvaGanho && p.curvaGanho.length > 1) {
                g.strokeStyle = COR.ok;
                g.lineWidth = 1.5;
                g.beginPath();
                const yG = (ganho) => y0 + 4 + (1 - ganho) * (H_SOM - 14);
                for (let px = 0; px <= largura; px += 2) {
                    const ms = ((scroll + px) / pxs) * 1000;
                    let k = 0;
                    while (k + 1 < p.curvaGanho.length && p.curvaGanho[k + 1].ms <= ms)
                        k++;
                    const a = p.curvaGanho[k];
                    const b = p.curvaGanho[k + 1];
                    const ganho = !b || b.ms === a.ms
                        ? a.ganho
                        : a.ganho + ((b.ganho - a.ganho) * (ms - a.ms)) / (b.ms - a.ms);
                    if (px === 0)
                        g.moveTo(px, yG(ganho));
                    else
                        g.lineTo(px, yG(ganho));
                }
                g.stroke();
                g.lineWidth = 1;
            }
        }
        else {
            g.fillStyle = COR.navy500;
            g.font = "12px system-ui, sans-serif";
            g.fillText(mapa && !mapa.audio ? "Áudio não decodificado" : "Sem análise de áudio", 8, y0 + H_SOM / 2);
        }
    }, [scroll, largura, pxs, p.mapa, p.alertasSom, p.curvaGanho, t0, t1]);
    function teclado(e) {
        if (e.target !== e.currentTarget)
            return;
        const passoMs = e.shiftKey ? 5000 : 1000;
        if (e.key === "ArrowRight")
            p.aoBuscar(Math.min(p.duracaoMs, p.tempoMs + passoMs));
        else if (e.key === "ArrowLeft")
            p.aoBuscar(Math.max(0, p.tempoMs - passoMs));
        else if (e.key === "+" || e.key === "=")
            mudarZoom(zoom + 1);
        else if (e.key === "-")
            mudarZoom(zoom - 1);
        else
            return;
        e.preventDefault();
    }
    const visiveis = p.cues.filter((c) => c.endMs >= t0 && c.startMs <= t1);
    const lacunasVisiveis = p.lacunas.filter((l) => l.fimMs >= t0 && l.inicioMs <= t1);
    const cortesVisiveis = (p.mapa?.cortes ?? []).filter((c) => c.ms >= t0 && c.ms <= t1);
    const atual = p.cues.find((c) => p.tempoMs >= c.startMs && p.tempoMs < c.endMs);
    return (_jsxs("section", { "aria-labelledby": `${id}-t`, className: "painel", children: [_jsxs("div", { className: "painel-cabeca", children: [_jsx("h2", { id: `${id}-t`, children: "Linha do tempo" }), _jsx(BotaoDica, { titulo: "legenda da linha do tempo", aberta: legenda, alvo: `${id}-leg`, aoAlternar: () => setLegenda(!legenda) }), _jsxs("div", { className: "flex items-center gap-0.5 normal-case tracking-normal", role: "group", "aria-label": "Zoom", children: [_jsx("button", { type: "button", className: "btn-icone h-6 w-6", "aria-label": "Afastar", onClick: () => mudarZoom(zoom - 1), disabled: zoom === 0, children: _jsx("span", { "aria-hidden": "true", children: "\u2212" }) }), _jsxs("span", { className: "w-16 text-center font-mono text-2xs font-normal text-navy-500", children: [pxs, " px/s"] }), _jsx("button", { type: "button", className: "btn-icone h-6 w-6", "aria-label": "Aproximar", onClick: () => mudarZoom(zoom + 1), disabled: zoom === ZOOMS.length - 1, children: _jsx("span", { "aria-hidden": "true", children: "+" }) })] }), _jsxs("label", { className: "flex items-center gap-1.5 font-normal normal-case tracking-normal", children: [_jsx("input", { type: "checkbox", checked: acompanhar, onChange: (e) => setAcompanhar(e.target.checked) }), "Acompanhar"] }), _jsxs("p", { className: "ml-auto truncate font-normal normal-case tracking-normal text-navy-500", children: ["Em foco: ", _jsx("kbd", { children: "\u2190" }), "/", _jsx("kbd", { children: "\u2192" }), " 1 s (", _jsx("kbd", { children: "Shift" }), " 5 s) \u00B7", " ", _jsx("kbd", { children: "+" }), "/", _jsx("kbd", { children: "\u2212" }), " zoom"] })] }), _jsxs("div", { className: "flex", children: [_jsxs("div", { "aria-hidden": "true", className: "w-28 shrink-0 border-r border-paper-400 bg-paper-200 text-2xs font-medium uppercase tracking-wide text-navy-500", children: [_jsx("div", { style: { height: H_REGUA } }), _jsx("div", { style: { height: H_SOM }, className: "flex items-center px-2", children: "Som" }), _jsx("div", { style: { height: H_LEGENDAS }, className: "flex items-center border-t border-paper-400 px-2", children: "Legendas" }), p.trilhaAd ? (_jsx("div", { style: { height: H_AD }, className: "flex items-center border-t border-paper-400 px-2 font-medium", children: "Audiodescri\u00E7\u00E3o" })) : null, hLib ? (_jsx("div", { style: { height: H_LIBRAS }, className: "flex items-center border-t border-paper-400 px-2", children: "Libras" })) : null, _jsx("div", { style: { height: H_LACUNAS }, className: "flex items-center border-t border-paper-400 px-2", children: "Lacunas (AD)" })] }), _jsx("div", { ref: vp, tabIndex: 0, role: "group", "aria-label": `Linha do tempo, posição ${formatarTimecode(p.tempoMs)}`, onKeyDown: teclado, onScroll: (e) => setScroll(e.currentTarget.scrollLeft), className: "relative min-w-0 flex-1 overflow-x-auto", children: _jsxs("div", { className: "relative", style: { width: total, height: H_TOTAL }, children: [_jsx("canvas", { ref: canvas, "aria-hidden": "true", className: "absolute top-0 cursor-pointer", style: { left: scroll, width: largura, height: H_CANVAS }, onClick: (e) => p.aoBuscar(((scroll + e.nativeEvent.offsetX) / pxs) * 1000) }), cortesVisiveis.map((c) => (_jsx("div", { "aria-hidden": "true", title: `Corte em ${formatarTimecode(c.ms)} (±${c.precisaoMs} ms)`, className: "pointer-events-none absolute border-l border-navy", style: {
                                        left: x(c.ms),
                                        top: H_REGUA,
                                        height: H_SOM + H_LEGENDAS + hAd + hLib,
                                    } }, c.ms))), _jsx("div", { className: "absolute left-0 border-t border-paper-400", style: { top: H_CANVAS, width: total, height: H_LEGENDAS }, children: visiveis.map((c) => {
                                        const sev = p.severidades.get(c.index);
                                        const w = Math.max(3, x(c.endMs - c.startMs));
                                        const texto = c.lines.join(" ").replace(/<\/?[^>]+>/g, "");
                                        return (_jsx("button", { type: "button", onClick: () => {
                                                p.aoBuscar(c.startMs);
                                                p.aoSelecionarLegenda(c.index);
                                            }, "aria-label": `Legenda ${c.index}, ${formatarTimecode(c.startMs)} a ${formatarTimecode(c.endMs)}${sev ? `, ${ROTULO_SEVERIDADE[sev].toLowerCase()} pendente` : ""}: ${texto}`, title: texto, className: `absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border px-1 text-left text-[11px] leading-[34px] ${CLASSE_SEV[sev ?? "ok"]} ${atual?.index === c.index ? "ring-2 ring-terra" : ""}`, style: {
                                                left: x(c.startMs),
                                                width: w,
                                                height: H_LEGENDAS - 8,
                                            }, children: w > 14 ? (_jsxs("span", { "aria-hidden": "true", className: "font-semibold", children: [sev ? `${ICONE_SEVERIDADE[sev]} ` : "", w > 28 ? texto : ""] })) : null }, c.index));
                                    }) }), p.trilhaAd ? (_jsx("div", { className: "absolute left-0 border-t border-paper-400", style: {
                                        top: H_CANVAS + H_LEGENDAS,
                                        width: total,
                                        height: H_AD,
                                    }, children: p.trilhaAd
                                        .filter((b) => b.fimMs >= t0 && b.inicioMs <= t1)
                                        .map((b) => {
                                        const w = Math.max(3, x(b.fimMs - b.inicioMs));
                                        return (_jsxs("button", { type: "button", onClick: () => {
                                                p.aoBuscar(b.take?.inicioMs ?? b.inicioMs);
                                                p.aoSelecionarBloco?.(b.id);
                                            }, "aria-label": `Bloco de audiodescrição de ${formatarTimecode(b.inicioMs)} a ${formatarTimecode(b.fimMs)}, ${ROTULO_NIVEL[b.nivel]}${b.take ? ", gravado" : ""}: ${b.texto || "sem roteiro"}`, title: b.texto, className: `absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border border-dashed text-left text-[11px] ${CLASSE_NIVEL[b.nivel]}`, style: {
                                                left: x(b.inicioMs),
                                                width: w,
                                                height: H_AD - 8,
                                            }, children: [b.take ? (_jsx("span", { "aria-hidden": "true", className: "absolute bottom-0.5 top-0.5 rounded-sm bg-navy/25", style: {
                                                        left: x(b.take.inicioMs - b.inicioMs),
                                                        width: Math.max(2, x(b.take.fimMs - b.take.inicioMs)),
                                                    } })) : null, w > 14 ? (_jsxs("span", { "aria-hidden": "true", className: "relative px-1 font-semibold leading-[30px]", children: [ICONE_NIVEL[b.nivel], " ", w > 40 ? b.texto : ""] })) : null] }, b.id));
                                    }) })) : null, hLib ? (_jsx("div", { className: "absolute left-0 border-t border-paper-400", style: {
                                        top: H_CANVAS + H_LEGENDAS + hAd,
                                        width: total,
                                        height: H_LIBRAS,
                                    }, children: p.trilhaLibras ? (_jsx("button", { type: "button", onClick: () => p.aoBuscar(Math.max(0, p.trilhaLibras.inicioMs)), "aria-label": `Clipe de Libras ${p.trilhaLibras.rotulo}, de ${formatarTimecode(Math.max(0, p.trilhaLibras.inicioMs))} a ${formatarTimecode(p.trilhaLibras.fimMs)}`, className: "absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border border-terra bg-terra/20 px-1 text-left text-[11px] leading-[16px] text-terra-700", style: {
                                            left: Math.max(0, x(p.trilhaLibras.inicioMs)),
                                            width: Math.max(3, x(p.trilhaLibras.fimMs -
                                                Math.max(0, p.trilhaLibras.inicioMs))),
                                            height: H_LIBRAS - 8,
                                        }, children: _jsxs("span", { "aria-hidden": "true", children: ["\uD83E\uDD1F ", p.trilhaLibras.rotulo] }) })) : null })) : null, _jsx("div", { className: "absolute left-0 border-t border-paper-400", style: {
                                        top: H_CANVAS + H_LEGENDAS + hAd + hLib,
                                        width: total,
                                        height: H_LACUNAS,
                                    }, children: lacunasVisiveis.map((l) => {
                                        const w = Math.max(3, x(l.fimMs - l.inicioMs));
                                        const dur = ((l.fimMs - l.inicioMs) / 1000)
                                            .toFixed(1)
                                            .replace(".", ",");
                                        const som = l.fracaoComSom !== null && l.fracaoComSom > 0.5;
                                        return (_jsx("button", { type: "button", onClick: () => p.aoBuscar(l.inicioMs), "aria-label": `${dur} s: lacuna para audiodescrição a partir de ${formatarTimecode(l.inicioMs)}${som ? ", com som na maior parte" : ""}`, className: "absolute top-1 overflow-hidden whitespace-nowrap rounded-sm border border-dashed border-ok bg-ok-100 px-1 text-left text-[11px] leading-[20px] text-ok", style: {
                                                left: x(l.inicioMs),
                                                width: w,
                                                height: H_LACUNAS - 8,
                                            }, children: w > 36 ? (_jsxs("span", { "aria-hidden": "true", children: [som ? "♪ " : "", dur, " s"] })) : null }, l.inicioMs));
                                    }) }), _jsx("div", { "aria-hidden": "true", className: "pointer-events-none absolute top-0 w-0.5 bg-terra", style: { left: x(p.tempoMs), height: H_TOTAL } })] }) })] }), legenda ? (_jsxs("p", { id: `${id}-leg`, className: "border-t border-paper-400 px-3 py-1 text-2xs text-navy-700", children: ["Forma de onda na banda de voz (150\u20134000 Hz); linha tracejada: limiar de atividade; faixa escura: som detectado; moldura tracejada: som sem legenda (M3); tra\u00E7o vertical: corte de plano", p.curvaGanho
                        ? "; linha verde: ganho do som original sob a audiodescrição (ducking)"
                        : "", "."] })) : null] }));
}
