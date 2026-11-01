import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import { Painel, PainelAbas } from "../comum";
import { useDespachar, useEstado } from "../../state/store";
import { Carregador } from "../Carregador";
import { Resumo } from "../Resumo";
import { AcoesLote, Filtros } from "../Filtros";
import { ApontamentosObra, ListaLegendas, useContagemObra, } from "../ListaLegendas";
import { PainelConfig } from "../PainelConfig";
import { ConfigLlm } from "../ConfigLlm";
import { Secao, baixar, useLacunas } from "../comum";
import { useVideo } from "../contextoVideo";
import { detectarCortes } from "../../mapa/midia";
import { lacunasCsv } from "../../mapa/lacunas";
import { formatarTimecode } from "../../core/texto";
/**
 * Painel esquerdo da página de Legendas. Abas: a lista revisável (com filtros
 * compactos), os apontamentos da obra inteira e o lote com as métricas. O
 * resumo fica numa faixa fixa, visível em qualquer aba.
 */
export function LseEsquerda() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const [previa, setPrevia] = useState(false);
    const obra = useContagemObra();
    const pendentes = Object.values(estado.review).filter((r) => r.decision === "pendente" && r.suggestion.cueIndex !== -1).length;
    const carregado = estado.cues.length > 0;
    if (!carregado) {
        return (_jsxs(Painel, { titulo: "Legendas", rotulo: "Legendas", children: [_jsx(Carregador, {}), estado.errosParse.length > 0 ? _jsx(ErrosParse, {}) : null] }));
    }
    return (_jsx(PainelAbas, { memoria: "lse-esquerda", rotulo: "Legendas", titulo: _jsxs(_Fragment, { children: ["Legendas", " ", _jsxs("span", { className: "font-normal normal-case tracking-normal text-navy-500", children: [estado.arquivoNome, " \u00B7 ", estado.cues.length] })] }), acoes: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "segmento", "aria-pressed": previa, onClick: () => setPrevia((v) => !v), title: "Mostrar o texto com as decis\u00F5es aplicadas", children: "Pr\u00E9via" }), _jsx("button", { type: "button", className: "btn-fantasma h-6 px-2 text-2xs", onClick: () => despachar({ tipo: "limpar" }), children: "Trocar arquivo" })] }), faixa: _jsx(Resumo, { variante: "chips" }), abas: [
            {
                id: "lista",
                rotulo: "Legendas",
                marca: pendentes || null,
                tom: "aviso",
                conteudo: (rolagem) => (_jsxs(_Fragment, { children: [estado.errosParse.length > 0 || estado.avisosParse.length > 0 ? (_jsx(ErrosParse, {})) : null, _jsx(Filtros, {}), _jsx(ListaLegendas, { mostrarPrevia: previa, rolagem: rolagem })] })),
            },
            {
                id: "obra",
                rotulo: "Obra inteira",
                marca: obra.pendentes || null,
                tom: "aviso",
                conteudo: _jsx(ApontamentosObra, {}),
            },
            {
                id: "lote",
                rotulo: "Lote e métricas",
                conteudo: (_jsxs(_Fragment, { children: [_jsx(Secao, { titulo: "Aprovar em lote", dica: "O lote s\u00F3 alcan\u00E7a auto-corre\u00E7\u00F5es determin\u00EDsticas ainda pendentes. Sugest\u00F5es assistidas (NLP, LLM, sinal) e pend\u00EAncias manuais exigem decis\u00E3o uma a uma.", children: _jsx(AcoesLote, {}) }), _jsx(Secao, { titulo: "M\u00E9tricas da obra", children: _jsx(Resumo, { variante: "metricas" }) }), _jsx(Secao, { titulo: "Atalhos da revis\u00E3o", children: _jsxs("p", { className: "text-2xs text-navy-700", children: ["Com um apontamento em foco: ", _jsx("kbd", { children: "A" }), " aprovar \u00B7", " ", _jsx("kbd", { children: "R" }), " rejeitar \u00B7 ", _jsx("kbd", { children: "E" }), " editar \u00B7 ", _jsx("kbd", { children: "J" }), "/", _jsx("kbd", { children: "K" }), " navegar."] }) })] })),
            },
        ] }));
}
function ErrosParse() {
    const { estado } = useEstado();
    return (_jsxs("section", { "aria-label": "Problemas na leitura do arquivo", className: "m-3 rounded border border-warn bg-warn-100 px-3 py-2", children: [_jsxs("h3", { className: "text-sm font-semibold text-warn", children: [_jsx("span", { "aria-hidden": "true", children: "! " }), "Problemas na leitura do arquivo"] }), _jsxs("ul", { className: "mt-1 space-y-1 text-sm text-warn", children: [estado.errosParse.map((e, i) => (_jsxs("li", { children: [_jsxs("strong", { children: ["Linha ", e.linha, ":"] }), " ", e.mensagem, e.trecho ? (_jsxs("code", { className: "ml-1 font-mono text-xs", children: ["\u00AB", e.trecho, "\u00BB"] })) : null] }, i))), estado.avisosParse.map((a, i) => (_jsx("li", { children: a }, `a${i}`)))] })] }));
}
/** Inspetor da página de Legendas, em abas: vídeo, regras, assistente. */
export function LseDireita() {
    return (_jsx(PainelAbas, { memoria: "lse-direita", rotulo: "Inspetor de legendas", titulo: "Inspetor", abas: [
            {
                id: "video",
                rotulo: "Vídeo",
                conteudo: (_jsx("div", { className: "p-3", children: _jsx(AnaliseVideo, {}) })),
            },
            {
                id: "regras",
                rotulo: "Regras",
                conteudo: (_jsx("div", { className: "p-3", children: _jsx(PainelConfig, { embutido: true }) })),
            },
            {
                id: "assistente",
                rotulo: "Assistente",
                conteudo: (_jsx("div", { className: "p-3", children: _jsx(ConfigLlm, {}) })),
            },
        ] }));
}
/** Sensibilidade da detecção de som, cortes de plano e lacunas — o mapa temporal. */
function AnaliseVideo() {
    const id = useId();
    const { estado } = useEstado();
    const despachar = useDespachar();
    const { duracaoMs } = useVideo();
    const { mapa, video, config } = estado;
    const [passo, setPasso] = useState(500);
    const abortar = useRef(null);
    const { lacunas, fonte } = useLacunas();
    useEffect(() => () => abortar.current?.abort(), []);
    if (!video)
        return (_jsx("p", { className: "text-xs text-navy-500", children: "Abra o v\u00EDdeo no monitor para analisar som, cortes e lacunas." }));
    if (!mapa)
        return _jsx("p", { className: "text-xs text-navy-500", children: "Analisando o \u00E1udio\u2026" });
    const sc = mapa.statusCortes;
    async function cortes() {
        if (!video || !mapa)
            return;
        const ctrl = new AbortController();
        abortar.current = ctrl;
        despachar({
            tipo: "cortes",
            status: { tipo: "em_andamento", progresso: 0 },
        });
        try {
            const r = await detectarCortes(video.url, duracaoMs, passo, config.fps, (f) => despachar({
                tipo: "cortes",
                status: { tipo: "em_andamento", progresso: f },
            }), ctrl.signal);
            despachar({
                tipo: "cortes",
                status: { tipo: "concluido", passoMs: passo },
                cortes: r,
            });
        }
        catch (e) {
            const cancelado = e instanceof DOMException && e.name === "AbortError";
            despachar({
                tipo: "cortes",
                status: cancelado
                    ? { tipo: "cancelado" }
                    : { tipo: "erro", mensagem: String(e) },
                cortes: [],
            });
        }
    }
    return (_jsxs("div", { className: "space-y-3 text-xs", children: [mapa.audio ? (_jsxs("div", { children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("label", { className: "rotulo", htmlFor: `${id}-lim`, children: "Sensibilidade do som" }), _jsxs("span", { className: "font-mono", children: [mapa.parametros.limiarDb, " dB"] })] }), _jsx("input", { id: `${id}-lim`, type: "range", min: 3, max: 30, value: mapa.parametros.limiarDb, onChange: (e) => despachar({
                            tipo: "atividade",
                            parametros: {
                                ...mapa.parametros,
                                limiarDb: Number(e.target.value),
                            },
                        }), className: "w-full accent-[rgb(var(--c-terra))]" }), _jsxs("p", { className: "text-2xs text-navy-500", children: [mapa.atividade.length, " segmentos com som \u00B7 piso", " ", mapa.pisoDb.toFixed(0), " dBFS. Energia na banda de voz, n\u00E3o reconhecimento de fala."] })] })) : (_jsxs("p", { className: "text-warn", children: [mapa.erroAudio ?? "Áudio não analisado", ": M1 e M3 n\u00E3o s\u00E3o verificadas."] })), _jsxs("div", { children: [_jsx("p", { className: "rotulo", children: "Cortes de plano" }), _jsxs("div", { className: "mt-1 flex items-center gap-1.5", children: [_jsxs("select", { className: "campo w-auto", "aria-label": "Amostragem", value: passo, onChange: (e) => setPasso(Number(e.target.value)), disabled: sc.tipo === "em_andamento", children: [_jsx("option", { value: 250, children: "a cada 250 ms" }), _jsx("option", { value: 500, children: "a cada 500 ms" }), _jsx("option", { value: 1000, children: "a cada 1 s" })] }), sc.tipo === "em_andamento" ? (_jsxs("button", { type: "button", className: "btn-secundario h-7", onClick: () => abortar.current?.abort(), children: ["Cancelar ", Math.round(sc.progresso * 100), "%"] })) : (_jsx("button", { type: "button", className: "btn-secundario h-7", onClick: () => void cortes(), children: sc.tipo === "concluido" ? "Detectar de novo" : "Detectar" }))] }), sc.tipo === "em_andamento" ? (_jsx("progress", { max: 1, value: sc.progresso, className: "mt-1 w-full", "aria-label": "Progresso" })) : null, _jsx("p", { className: "mt-1 text-2xs text-navy-500", children: sc.tipo === "concluido"
                            ? `${mapa.cortes.length} cortes, a ~1 quadro. Cortes a menos de ${sc.passoMs} ms e fusões lentas podem escapar.`
                            : "Sem isso, M2 (corte de plano) não é verificada." })] }), _jsxs("div", { children: [_jsx("p", { className: "rotulo", children: "Lacunas para audiodescri\u00E7\u00E3o" }), _jsxs("p", { className: "mt-0.5", children: [_jsx("strong", { children: lacunas.length }), " lacunas \u2265", " ", (config.lacunaMinimaAdMs / 1000).toLocaleString("pt-BR"), " s, somando", " ", (lacunas.reduce((a, l) => a + l.fimMs - l.inicioMs, 0) / 1000).toFixed(0), " ", "s", fonte === "silencio"
                                ? " (dos silêncios: sem legenda carregada)"
                                : "", "."] }), lacunas.length > 0 ? (_jsx("button", { type: "button", className: "btn-fantasma mt-1 h-7 px-2", onClick: () => baixar(`${(estado.arquivoNome ?? video.nome).replace(/\.[^.]+$/, "")}-lacunas-ad.csv`, lacunasCsv(lacunas, (ms) => formatarTimecode(ms)), "text/csv"), children: "Exportar CSV" })) : null] })] }));
}
