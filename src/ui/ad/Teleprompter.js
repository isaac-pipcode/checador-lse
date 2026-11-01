import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { comandoDaTecla } from '../../ad/prompter';
/** A redução automática não passa disto: abaixo, a leitura a distância piora mais do que ajuda. */
const REDUCAO_MINIMA = 0.6;
export const COR_LEGENDA = { branco: '#FAF8F3', amarelo: '#FFE14D' };
const seg = (ms) => `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')} s`;
/**
 * Teleprompter do locutor. A imagem ocupa a tela; o roteiro aparece sobre ela,
 * na parte de baixo, como uma legenda. Uma faixa fina no topo diz a fase e o
 * tempo; uma faixa fina embaixo, o próximo bloco e as teclas.
 *
 * Puramente de exibição: recebe o estado da janela principal e devolve
 * comandos de teclado. A fase é sinalizada por texto e cor, nunca só por cor.
 */
export function Teleprompter({ estado: e, aoComando, compacto = false, }) {
    const video = useRef(null);
    // Vídeo mudo, seguindo o relógio da janela principal (o som vem dos fones).
    useEffect(() => {
        const v = video.current;
        if (!v || !e.videoUrl)
            return;
        const alvo = e.tempoMs / 1000;
        const deriva = Math.abs(v.currentTime - alvo);
        if (deriva > (e.tocando ? 0.25 : 0.04))
            v.currentTime = alvo;
        if (e.tocando && v.paused)
            void v.play().catch(() => { });
        if (!e.tocando && !v.paused)
            v.pause();
    }, [e.tempoMs, e.tocando, e.videoUrl]);
    useEffect(() => {
        if (!aoComando)
            return;
        const tecla = (ev) => {
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
    const faixa = {
        ocioso: { rotulo: 'Aguardando', classe: 'bg-cabine-faixa text-cabine-texto' },
        preroll: { rotulo: `Prepare-se · entra em ${seg(faltaParaEntrar)}`, classe: 'bg-cabine-preparo text-cabine-preparo-texto' },
        agora: { rotulo: `● GRAVANDO — LEIA · restam ${seg(restante)}`, classe: 'bg-cabine-gravando text-cabine-texto' },
        posroll: { rotulo: `● Gravando a pós-rolagem · encerra em ${seg(restanteCaptura)}`, classe: 'bg-cabine-faixa text-cabine-texto' },
        processando: { rotulo: 'Processando a gravação…', classe: 'bg-cabine-faixa text-cabine-texto' },
        revisao: { rotulo: 'Take gravado', classe: 'bg-cabine-texto text-cabine' },
    };
    const f = faixa[e.fase];
    // Contagem regressiva grande na pré-rolagem: 3, 2, 1.
    const contagem = e.fase === 'preroll' && faltaParaEntrar > 0 ? Math.ceil(faltaParaEntrar / 1000) : null;
    // ---- Caixa do roteiro: altura limitada, letra reduzida até caber ----------
    const area = useRef(null);
    const caixa = useRef(null);
    const [alturaArea, setAlturaArea] = useState(0);
    const [reducao, setReducao] = useState(1);
    const [naoCabe, setNaoCabe] = useState(false);
    const { cor, escala, alturaMaxima } = e.legenda;
    const maxPx = Math.round(alturaArea * alturaMaxima);
    useLayoutEffect(() => {
        const el = area.current;
        if (!el)
            return;
        const ro = new ResizeObserver(() => setAlturaArea(el.clientHeight));
        ro.observe(el);
        setAlturaArea(el.clientHeight);
        return () => ro.disconnect();
    }, []);
    // Mede de forma síncrona (antes da pintura): reduz em passos de 8% até caber.
    useLayoutEffect(() => {
        const el = caixa.current;
        if (!el || maxPx <= 0)
            return;
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
    };
    const tamFaixa = compacto ? 'text-xs' : 'text-xl';
    return (_jsxs("div", { className: `flex flex-col overflow-hidden bg-preto text-cabine-texto ${compacto ? 'rounded border border-paper-400' : 'h-screen'}`, children: [_jsxs("div", { role: "status", "aria-live": "assertive", className: `flex items-center px-4 py-1.5 font-semibold ${tamFaixa} ${f.classe}`, children: [_jsx("span", { children: f.rotulo }), b ? (_jsx("span", { className: "ml-auto font-normal opacity-90", children: e.sequencia ? `Bloco ${b.n} de ${b.total}` : 'Bloco avulso' })) : null] }), _jsx("div", { className: "h-1.5 bg-cabine-faixa", "aria-hidden": "true", children: e.fase === 'agora' ? _jsx("div", { className: "h-1.5 bg-cabine-texto", style: { width: `${fracaoRestante * 100}%` } }) : null }), _jsxs("div", { ref: area, className: `relative min-h-0 ${compacto ? 'aspect-video' : 'flex-1'}`, children: [e.videoUrl && !compacto ? (_jsx("video", { ref: video, src: e.videoUrl, muted: true, playsInline: true, crossOrigin: "anonymous", className: "absolute inset-0 h-full w-full object-contain" })) : (_jsx("div", { className: "absolute inset-0 bg-cabine", "aria-hidden": "true" })), contagem !== null ? (_jsx("div", { "aria-hidden": "true", className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: `rounded-full bg-preto/55 font-bold tabular-nums text-cabine-texto ${compacto ? 'px-4 text-4xl' : 'px-10 text-[clamp(5rem,14vw,12rem)]'}`, children: contagem }) })) : null, _jsx("div", { className: `absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 ${compacto ? 'p-2' : 'px-[5%] pb-[4%]'}`, children: b ? (_jsxs(_Fragment, { children: [naoCabe ? (_jsxs("p", { className: `rounded bg-cabine-gravando px-2 font-semibold text-cabine-texto ${compacto ? 'text-[10px]' : 'text-base'}`, children: [_jsx("span", { "aria-hidden": "true", children: "\u2702 " }), "O texto n\u00E3o cabe na caixa nem com a letra reduzida"] })) : null, _jsx("p", { ref: caixa, style: estiloCaixa, className: `max-w-[92%] overflow-hidden whitespace-pre-wrap rounded bg-preto/75 px-[0.6em] py-[0.25em] text-center font-sans font-medium leading-tight ${e.fase === 'preroll' ? 'opacity-80' : ''} ${e.fase === 'agora' ? 'ring-2 ring-cabine-gravando' : ''}`, children: b.texto }), b.nota.trim() ? (_jsxs("p", { className: `rounded bg-preto/60 px-2 italic text-cabine-suave ${compacto ? 'text-[10px]' : 'text-lg'}`, children: ["Nota: ", b.nota] })) : null] })) : (_jsx("p", { className: `rounded bg-preto/70 px-3 py-1 text-cabine-suave ${compacto ? 'text-xs' : 'text-2xl'}`, children: e.aviso ?? 'Nenhuma gravação em curso.' })) })] }), _jsxs("div", { className: `space-y-0.5 bg-cabine px-4 py-1.5 text-cabine-suave ${compacto ? 'text-[10px]' : 'text-base'}`, children: [e.fase === 'revisao' && e.take ? (_jsxs("p", { className: "text-cabine-texto", children: ["Dura\u00E7\u00E3o \u00FAtil ", seg(e.take.duracaoMs), " \u00B7", ' ', e.take.cabe ? _jsx("span", { className: "text-cabine-ok", children: "\u2713 cabe na janela" }) : _jsx("strong", { className: "text-cabine-erro", children: "\u2715 sai da janela" }), ' — ', _jsx(Kbd, { children: "Enter" }), " manter", e.sequencia ? ' e seguir' : '', " \u00B7 ", _jsx(Kbd, { children: "R" }), " regravar \u00B7 ", _jsx(Kbd, { children: "Espa\u00E7o" }), " ouvir \u00B7", ' ', _jsx(Kbd, { children: "Backspace" }), " descartar \u00B7 ", _jsx(Kbd, { children: "Esc" }), " encerrar"] })) : e.fase === 'preroll' || e.fase === 'agora' || e.fase === 'posroll' ? (_jsxs("p", { children: [_jsx(Kbd, { children: "Enter" }), " ou ", _jsx(Kbd, { children: "Espa\u00E7o" }), " encerra o take \u00B7 ", _jsx(Kbd, { children: "Esc" }), " encerra a sess\u00E3o \u00B7", ' ', _jsx(Kbd, { children: "+" }), "/", _jsx(Kbd, { children: "\u2212" }), " tamanho da letra"] })) : null, b && reducao < 0.995 ? (_jsxs("p", { children: ["Letra reduzida a ", Math.round(reducao * 100), "% para caber na caixa", naoCabe ? '' : ' — aumentar a letra não terá efeito; aumente a altura máxima da caixa ou encurte o roteiro', "."] })) : null, e.proximo ? (_jsxs("p", { className: "truncate", children: [_jsx("span", { className: "font-semibold", children: "A seguir:" }), " ", e.proximo.texto] })) : null] })] }));
}
function Kbd({ children }) {
    return _jsx("kbd", { className: "rounded border border-cabine-suave bg-transparent px-1.5 font-mono text-[0.85em] text-cabine-texto", children: children });
}
