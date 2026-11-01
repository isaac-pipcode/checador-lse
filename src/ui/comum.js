import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useMemo, useRef, useState, } from "react";
import { useEstado, useResultadoFinal } from "../state/store";
import { lacunasParaAd, lacunasPorSilencio, } from "../mapa/lacunas";
import { ponte } from "../desktop/ponte";
/** Salva texto: diálogo do sistema no desktop; download no navegador. */
export function baixar(nome, conteudo, mime) {
    const p = ponte();
    if (p) {
        void p.salvarTexto(nome, conteudo);
        return;
    }
    const url = URL.createObjectURL(new Blob([conteudo], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
/** Lacunas da obra: da legenda, se houver; senão, dos silêncios do áudio. */
export function useLacunas() {
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const { mapa, config } = estado;
    const cues = final.cues;
    return useMemo(() => {
        const duracaoMs = Math.max(mapa?.duracaoMs ?? 0, cues.length ? Math.max(...cues.map((c) => c.endMs)) : 0);
        if (cues.length > 0) {
            return {
                lacunas: lacunasParaAd(cues, duracaoMs, config.lacunaMinimaAdMs, mapa?.audio ? mapa : null),
                fonte: "legenda",
            };
        }
        if (mapa?.audio)
            return {
                lacunas: lacunasPorSilencio(mapa, config.lacunaMinimaAdMs),
                fonte: "silencio",
            };
        return { lacunas: [], fonte: null };
    }, [cues, mapa, config.lacunaMinimaAdMs]);
}
/** Painel de editor: cabeçalho fino + corpo rolável. */
export function Painel({ titulo, acoes, children, className = "", corpoClassName = "", rotulo, }) {
    return (_jsxs("section", { className: `painel ${className}`, "aria-label": rotulo ?? (typeof titulo === "string" ? titulo : undefined), children: [_jsxs("header", { className: "painel-cabeca", children: [_jsx("h2", { className: "min-w-0 truncate", children: titulo }), acoes ? (_jsx("div", { className: "ml-auto flex items-center gap-1 normal-case tracking-normal", children: acoes })) : null] }), _jsx("div", { className: `painel-corpo ${corpoClassName}`, children: children })] }));
}
/** Seção do inspetor. */
export function Secao({ titulo, children, id, dica, }) {
    const auto = useId();
    const idTitulo = id ?? `${auto}-t`;
    const [aberta, setAberta] = useState(false);
    return (_jsxs("section", { className: "secao", "aria-labelledby": idTitulo, children: [_jsxs("div", { className: "mb-2 flex items-center gap-1", children: [_jsx("h3", { id: idTitulo, className: "secao-titulo mb-0", children: titulo }), dica ? (_jsx(BotaoDica, { titulo: titulo, aberta: aberta, alvo: `${auto}-d`, aoAlternar: () => setAberta(!aberta) })) : null] }), dica && aberta ? (_jsx("p", { id: `${auto}-d`, className: "dica", children: dica })) : null, children] }));
}
export function BotaoDica({ titulo, aberta, alvo, aoAlternar, }) {
    return (_jsx("button", { type: "button", className: "botao-dica", "aria-expanded": aberta, "aria-controls": aberta ? alvo : undefined, "aria-label": `Ajuda: ${titulo}`, title: aberta ? "Fechar ajuda" : "Ajuda", onClick: aoAlternar, children: "?" }));
}
/** Ajuda sob demanda fora de uma Secao: botão "?" seguido do texto quando aberto. */
export function Dica({ titulo, children, }) {
    const id = useId();
    const [aberta, setAberta] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx(BotaoDica, { titulo: titulo, aberta: aberta, alvo: id, aoAlternar: () => setAberta(!aberta) }), aberta ? (_jsx("span", { id: id, className: "dica basis-full", children: children })) : null] }));
}
/** Controle deslizante com rótulo e valor, padrão do inspetor. */
export function Deslizante({ id, rotulo, valor, min, max, passo, formatar, aoMudar, marca, }) {
    return (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("label", { className: "rotulo", htmlFor: id, children: rotulo }), _jsx("span", { className: "font-mono text-xs text-navy", children: formatar(valor) })] }), _jsxs("div", { className: "relative", children: [_jsx("input", { id: id, type: "range", min: min, max: max, step: passo, value: valor, onChange: (e) => aoMudar(Number(e.target.value)), className: "w-full accent-[rgb(var(--c-terra))]" }), marca ? (_jsx("span", { "aria-hidden": "true", title: marca.rotulo, className: "pointer-events-none absolute top-0 h-2 w-0.5 bg-warn", style: { left: `${((marca.valor - min) / (max - min)) * 100}%` } })) : null] }), marca ? _jsx("p", { className: "text-2xs text-navy-500", children: marca.rotulo }) : null] }));
}
export const tcSmpte = (ms, fps) => {
    const t = Math.max(0, ms);
    const q = Math.floor(((t % 1000) / 1000) * fps);
    const s = Math.floor(t / 1000);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}:${p(q)}`;
};
/**
 * Painel com abas internas (padrão WAI-ARIA de abas): setas ←/→, Home e End
 * movem entre as abas; só a aba ativa entra na ordem de Tab. A última aba
 * escolhida é lembrada por painel (`memoria`) durante a sessão.
 */
export function PainelAbas({ titulo, acoes, faixa, abas, memoria, rotulo, className = "", }) {
    const idBase = useId();
    const chave = `estudio:aba:${memoria}`;
    const [ativa, setAtivaEstado] = useState(() => {
        try {
            const s = sessionStorage.getItem(chave);
            if (s && abas.some((a) => a.id === s))
                return s;
        }
        catch {
            /* sem armazenamento */
        }
        return abas[0]?.id ?? "";
    });
    const setAtiva = (id) => {
        setAtivaEstado(id);
        try {
            sessionStorage.setItem(chave, id);
        }
        catch {
            /* sem armazenamento */
        }
    };
    const atual = abas.find((a) => a.id === ativa) ?? abas[0];
    const rolagem = useRef(null);
    const botoes = useRef({});
    function teclado(e) {
        const i = abas.findIndex((a) => a.id === atual?.id);
        let j = -1;
        if (e.key === "ArrowRight")
            j = (i + 1) % abas.length;
        else if (e.key === "ArrowLeft")
            j = (i - 1 + abas.length) % abas.length;
        else if (e.key === "Home")
            j = 0;
        else if (e.key === "End")
            j = abas.length - 1;
        if (j < 0)
            return;
        e.preventDefault();
        setAtiva(abas[j].id);
        botoes.current[abas[j].id]?.focus();
    }
    const corMarca = {
        neutro: "bg-paper-400 text-navy",
        aviso: "bg-warn-100 text-warn",
        erro: "bg-bad-100 text-bad",
    };
    return (_jsxs("section", { className: `painel ${className}`, "aria-label": rotulo, children: [_jsxs("header", { className: "painel-cabeca", children: [_jsx("h2", { className: "min-w-0 truncate", children: titulo }), acoes ? (_jsx("div", { className: "ml-auto flex items-center gap-1 normal-case tracking-normal", children: acoes })) : null] }), _jsx("div", { role: "tablist", "aria-label": `Seções de ${rotulo}`, className: "flex shrink-0 gap-0.5 overflow-x-auto border-b border-paper-400 px-1.5", onKeyDown: teclado, children: abas.map((a) => {
                    const sel = a.id === atual?.id;
                    return (_jsxs("button", { ref: (el) => {
                            botoes.current[a.id] = el;
                        }, type: "button", role: "tab", id: `${idBase}-aba-${a.id}`, "aria-selected": sel, "aria-controls": `${idBase}-painel-${a.id}`, tabIndex: sel ? 0 : -1, onClick: () => setAtiva(a.id), className: `-mb-px inline-flex h-8 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium ${sel
                            ? "border-terra text-navy"
                            : "border-transparent text-navy-500 hover:text-navy"}`, children: [a.rotulo, a.marca !== undefined && a.marca !== null && a.marca !== "" ? (_jsx("span", { className: `rounded-full px-1.5 text-2xs leading-4 ${corMarca[a.tom ?? "neutro"]}`, children: a.marca })) : null] }, a.id));
                }) }), faixa, _jsx("div", { ref: rolagem, role: "tabpanel", id: `${idBase}-painel-${atual?.id}`, "aria-labelledby": `${idBase}-aba-${atual?.id}`, tabIndex: 0, className: "painel-corpo focus-visible:outline-offset-[-2px]", children: atual
                    ? typeof atual.conteudo === "function"
                        ? atual.conteudo(rolagem)
                        : atual.conteudo
                    : null })] }));
}
