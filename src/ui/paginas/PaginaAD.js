import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, } from "react";
import { useDespachar, useEstado, useResultadoFinal } from "../../state/store";
import { useVideo } from "../contextoVideo";
import { formatarTimecode } from "../../core/texto";
import { duracaoUtil, takeAtivo } from "../../ad/tipos";
import { calibrarPpm } from "../../ad/estimativa";
import { verificarBloco, nivelDoBloco, } from "../../ad/verificacoes";
import { blocosGravaveis, GRAVANDO } from "../../ad/prompter";
import { ponte } from "../../desktop/ponte";
import { useSessaoGravacao, } from "../ad/useSessaoGravacao";
import { Teleprompter } from "../ad/Teleprompter";
import { AjustesLegenda, CartaoBloco, CLASSE_NIVEL, ICONE, Numero, ROTULO_NIVEL, seg, } from "../ad/componentes";
import { PainelAbas, Secao, useLacunas } from "../comum";
const CtxAD = createContext(null);
const useAD = () => {
    const c = useContext(CtxAD);
    if (!c)
        throw new Error("fora de ProvedorPaginaAD");
    return c;
};
/**
 * A sessão de gravação vive acima das páginas: trocar de página no meio de uma
 * sessão não a interrompe, e o teleprompter continua recebendo o estado.
 */
export function ProvedorPaginaAD({ children }) {
    const sessao = useSessaoGravacao();
    const [modo, setModo] = useState("roteiro");
    const [repetir, setRepetir] = useState(true);
    const [foco, setFoco] = useState(null);
    useEffect(() => {
        if (sessao.ativa)
            setModo("gravacao");
    }, [sessao.ativa]);
    return (_jsx(CtxAD.Provider, { value: { sessao, modo, setModo, repetir, setRepetir, foco, setFoco }, children: children }));
}
function SeletorModo() {
    const { modo, setModo, sessao } = useAD();
    return (_jsxs("div", { className: "ml-auto flex rounded bg-fundo p-0.5 normal-case tracking-normal", role: "group", "aria-label": "Modo de trabalho", children: [_jsx("button", { type: "button", className: "segmento", "aria-pressed": modo === "roteiro", disabled: sessao.ativa, onClick: () => setModo("roteiro"), children: "Roteiro" }), _jsx("button", { type: "button", className: "segmento", "aria-pressed": modo === "gravacao", onClick: () => setModo("gravacao"), children: "Grava\u00E7\u00E3o" })] }));
}
// ===========================================================================
// Painel esquerdo
// ===========================================================================
export function AdEsquerda() {
    const { modo } = useAD();
    return (_jsxs("section", { className: "painel", "aria-label": "Blocos de audiodescri\u00E7\u00E3o", children: [_jsxs("header", { className: "painel-cabeca", children: [_jsx("h2", { children: "Audiodescri\u00E7\u00E3o" }), _jsx(SeletorModo, {})] }), _jsx("div", { className: "painel-corpo", children: modo === "roteiro" ? _jsx(RoteiroLista, {}) : _jsx(GravacaoLista, {}) })] }));
}
function RoteiroLista() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const { video, tempoMs, buscar } = useVideo();
    const final = useResultadoFinal();
    const { sessao, repetir, foco, setFoco } = useAD();
    const { blocos, parametros } = estado.ad;
    const focoRef = useRef(foco);
    focoRef.current = foco;
    const pendenteFoco = useRef(null);
    // "Escrever assistindo": com um bloco em foco e o vídeo tocando, o trecho repete.
    useEffect(() => {
        if (!repetir || !video || !foco)
            return;
        const b = blocos.find((x) => x.id === foco);
        if (b && !video.paused && tempoMs > b.fimMs + 700)
            buscar(Math.max(0, b.inicioMs - 1500));
    }, [tempoMs, repetir, foco, blocos, video, buscar]);
    function irPara(b) {
        buscar(Math.max(0, b.inicioMs - 1500));
        const el = document.getElementById(`texto-${b.id}`);
        el?.scrollIntoView({ block: "center" });
        el?.focus({ preventScroll: true });
    }
    // Atalhos da editora (Ctrl ou ⌘), valem também com o cursor na caixa de texto.
    useEffect(() => {
        const tecla = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey)
                return;
            const atual = blocos.findIndex((b) => b.id === focoRef.current);
            let feito = true;
            if (e.key === " ") {
                if (video)
                    void (video.paused ? video.play() : video.pause());
            }
            else if (e.key === "b" || e.key === "B") {
                despachar({
                    tipo: "adAdicionar",
                    inicioMs: tempoMs,
                    fimMs: tempoMs + 3000,
                });
                pendenteFoco.current = tempoMs;
            }
            else if (e.key === "ArrowLeft")
                buscar(Math.max(0, tempoMs - 2000));
            else if (e.key === "ArrowRight")
                buscar(tempoMs + 2000);
            else if (e.key === "ArrowDown" && atual < blocos.length - 1)
                irPara(blocos[atual + 1]);
            else if (e.key === "ArrowUp" && atual > 0)
                irPara(blocos[atual - 1]);
            else if (e.key === "Enter" && atual >= 0) {
                const b = blocos[atual];
                if (b.texto.trim())
                    despachar({ tipo: "adAprovar", id: b.id, aprovado: true });
                if (atual < blocos.length - 1)
                    irPara(blocos[atual + 1]);
            }
            else
                feito = false;
            if (feito)
                e.preventDefault();
        };
        window.addEventListener("keydown", tecla);
        return () => window.removeEventListener("keydown", tecla);
    });
    useEffect(() => {
        if (pendenteFoco.current === null)
            return;
        const b = blocos.find((x) => x.inicioMs === pendenteFoco.current);
        if (b) {
            pendenteFoco.current = null;
            document.getElementById(`texto-${b.id}`)?.focus();
        }
    }, [blocos]);
    if (blocos.length === 0) {
        return (_jsxs("div", { className: "p-6 text-center text-sm text-navy-700", children: [_jsx("p", { children: "Nenhum bloco ainda." }), _jsxs("p", { className: "mt-1 text-xs text-navy-500", children: ["Crie blocos nas lacunas pelo inspetor, ou use ", _jsx("kbd", { children: "Ctrl+B" }), " na posi\u00E7\u00E3o do v\u00EDdeo."] })] }));
    }
    return (_jsx("ol", { className: "space-y-2 p-2", children: blocos.map((b, i) => (_jsx("li", { children: _jsx(CartaoBloco, { n: i + 1, bloco: b, apontamentos: verificarBloco(b, final.cues, parametros), ppm: parametros.palavrasPorMinuto, aoFocar: () => setFoco(b.id), podeGravar: !!video && !sessao.ativa, aoGravar: () => sessao.gravarAvulso(b.id), aoOuvir: () => {
                    buscar(Math.max(0, b.inicioMs - 2000));
                    void video?.play();
                } }) }, b.id))) }));
}
function GravacaoLista() {
    const { estado } = useEstado();
    const { video, buscar } = useVideo();
    const final = useResultadoFinal();
    const desktop = ponte();
    const { sessao } = useAD();
    const { blocos, parametros } = estado.ad;
    const [somenteSemTake, setSomenteSemTake] = useState(true);
    const [telaCheia, setTelaCheia] = useState(false);
    const fila = blocosGravaveis(blocos, somenteSemTake);
    const aprovados = blocosGravaveis(blocos, false);
    const naoAprovados = blocos.filter((b) => !b.aprovado && b.texto.trim()).length;
    useEffect(() => {
        if (!telaCheia || sessao.ativa)
            return;
        const t = (e) => e.key === "Escape" && setTelaCheia(false);
        window.addEventListener("keydown", t);
        return () => window.removeEventListener("keydown", t);
    }, [telaCheia, sessao.ativa]);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "secao", role: "group", "aria-label": "Sess\u00E3o", children: [_jsx("h3", { className: "secao-titulo", children: "Sess\u00E3o" }), sessao.ativa ? (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [GRAVANDO.has(sessao.fase) ? (_jsx("button", { type: "button", className: "btn-primario", onClick: () => sessao.comando("parar"), children: "Encerrar take (Enter)" })) : null, sessao.fase === "revisao" ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-primario", onClick: () => sessao.comando("manter"), children: "Manter (Enter)" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => sessao.comando("regravar"), children: "Regravar (R)" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => sessao.comando("ouvir"), children: "Ouvir (Espa\u00E7o)" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => sessao.comando("descartar"), children: "Descartar (\u232B)" })] })) : null, _jsx("button", { type: "button", className: "btn-fantasma text-bad", onClick: () => sessao.comando("encerrar"), children: "Encerrar sess\u00E3o (Esc)" })] })) : (_jsxs(_Fragment, { children: [_jsxs("label", { className: "flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: somenteSemTake, onChange: (e) => setSomenteSemTake(e.target.checked) }), "S\u00F3 blocos ainda sem grava\u00E7\u00E3o"] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5", children: [_jsxs("button", { type: "button", className: "btn-primario", disabled: !video || fila.length === 0, onClick: () => sessao.gravarSequencia(fila.map((b) => b.id)), children: [_jsx("span", { "aria-hidden": "true", children: "\u25CF" }), " Gravar em sequ\u00EAncia (", fila.length, ")"] }), !desktop ? (_jsx("button", { type: "button", className: "btn-secundario", onClick: () => setTelaCheia(true), children: "Teleprompter em tela cheia" })) : null] }), sessao.aviso ? (_jsx("p", { className: "mt-2 text-xs text-navy-700", role: "status", children: sessao.aviso })) : null, naoAprovados > 0 ? (_jsxs("p", { className: "mt-2 text-2xs text-warn", children: [_jsx("span", { "aria-hidden": "true", children: "! " }), naoAprovados, " bloco(s) em rascunho n\u00E3o entram na grava\u00E7\u00E3o. Aprove-os no modo Roteiro."] })) : null] }))] }), _jsxs("h3", { className: "secao-titulo px-3 pt-3", children: ["Blocos aprovados (", aprovados.length, ")"] }), aprovados.length === 0 ? (_jsx("p", { className: "px-3 text-xs text-navy-500", children: "Nenhum bloco aprovado. A aprova\u00E7\u00E3o \u00E9 feita no modo Roteiro." })) : (_jsx("ol", { className: "divide-y divide-paper-400", children: aprovados.map((b, i) => {
                    const t = takeAtivo(b);
                    const nivel = nivelDoBloco(verificarBloco(b, final.cues, parametros));
                    const atual = sessao.blocoId === b.id;
                    return (_jsxs("li", { className: `grid grid-cols-[auto_1fr_auto] items-center gap-x-2 px-3 py-2 text-xs ${atual ? "bg-bad-100" : ""}`, children: [_jsxs("span", { className: "font-mono text-2xs text-navy-500", children: [String(i + 1).padStart(2, "0"), _jsx("br", {}), formatarTimecode(b.inicioMs).slice(3, 8)] }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block truncate text-navy", title: b.texto, children: b.texto }), _jsxs("span", { className: "mt-0.5 flex items-center gap-1.5 text-2xs text-navy-500", children: [_jsxs("span", { className: `chip ${CLASSE_NIVEL[nivel]}`, children: [_jsx("span", { "aria-hidden": "true", children: ICONE[nivel] }), ROTULO_NIVEL[nivel]] }), t
                                                ? `${b.takes.length} take(s) · ${seg(duracaoUtil(t))}`
                                                : "sem gravação"] })] }), _jsxs("span", { className: "flex gap-1", children: [_jsx("button", { type: "button", className: "btn-icone h-7 w-7", "aria-label": `Ir ao bloco ${i + 1}`, onClick: () => buscar(Math.max(0, b.inicioMs - 2000)), children: _jsx("span", { "aria-hidden": "true", children: "\u21A6" }) }), _jsxs("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", disabled: !video || sessao.ativa, onClick: () => sessao.gravarAvulso(b.id), children: [_jsx("span", { "aria-hidden": "true", children: "\u25CF" }), " Gravar"] })] })] }, b.id));
                }) })), telaCheia ? (_jsxs("div", { className: "fixed inset-0 z-50", children: [_jsx(Teleprompter, { estado: sessao.estadoPrompter }), !sessao.ativa ? (_jsx("button", { type: "button", className: "btn-secundario fixed right-4 top-14", onClick: () => setTelaCheia(false), children: "Fechar (Esc)" })) : null] })) : null] }));
}
// ===========================================================================
// Inspetor
// ===========================================================================
export function AdDireita() {
    const { modo, sessao } = useAD();
    const titulo = (_jsxs(_Fragment, { children: ["Inspetor", " ", _jsx("span", { className: "font-normal normal-case tracking-normal text-navy-500", children: modo === "roteiro" ? "roteiro" : "gravação" })] }));
    if (modo === "roteiro") {
        return (_jsx(PainelAbas, { memoria: "ad-direita-roteiro", rotulo: "Inspetor de audiodescri\u00E7\u00E3o", titulo: titulo, abas: [
                {
                    id: "blocos",
                    rotulo: "Blocos",
                    conteudo: _jsx(RoteiroInspetor, { secao: "blocos" }),
                },
                {
                    id: "leitura",
                    rotulo: "Leitura e mixagem",
                    conteudo: _jsx(RoteiroInspetor, { secao: "leitura" }),
                },
                {
                    id: "atalhos",
                    rotulo: "Atalhos",
                    conteudo: _jsx(RoteiroInspetor, { secao: "atalhos" }),
                },
            ] }, "roteiro"));
    }
    return (_jsx(PainelAbas, { memoria: "ad-direita-gravacao", rotulo: "Inspetor de audiodescri\u00E7\u00E3o", titulo: titulo, abas: [
            {
                id: "teleprompter",
                rotulo: "Teleprompter",
                marca: sessao.prompterAberto ? "●" : null,
                conteudo: _jsx(GravacaoInspetor, { secao: "teleprompter" }),
            },
            {
                id: "legenda",
                rotulo: "Legenda",
                conteudo: _jsx(GravacaoInspetor, { secao: "legenda" }),
            },
            {
                id: "microfone",
                rotulo: "Microfone",
                marca: sessao.micAberto ? "●" : null,
                conteudo: _jsx(GravacaoInspetor, { secao: "microfone" }),
            },
        ] }, "gravacao"));
}
function RoteiroInspetor({ secao, }) {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const { video, tempoMs } = useVideo();
    const final = useResultadoFinal();
    const { repetir, setRepetir } = useAD();
    const { lacunas, fonte } = useLacunas();
    const { blocos, parametros: p } = estado.ad;
    const calibracao = useMemo(() => calibrarPpm(blocos), [blocos]);
    const resumo = useMemo(() => {
        const n = {
            ok: 0,
            aviso: 0,
            erro: 0,
            pendente: 0,
        };
        for (const b of blocos)
            n[nivelDoBloco(verificarBloco(b, final.cues, p))]++;
        return n;
    }, [blocos, final.cues, p]);
    const aprovaveis = blocos.filter((b) => !b.aprovado && b.texto.trim());
    const mudar = (mudanca) => despachar({ tipo: "adParametros", mudanca });
    if (secao === "blocos")
        return (_jsxs(Secao, { titulo: "Blocos", children: [_jsxs("p", { className: "text-xs", children: [blocos.length, " blocos \u00B7 ", blocos.filter((b) => b.aprovado).length, " ", "aprovados"] }), _jsx("ul", { className: "mt-1.5 flex flex-wrap gap-1", children: ["ok", "aviso", "erro", "pendente"].map((n) => (_jsxs("li", { className: `chip ${CLASSE_NIVEL[n]}`, children: [_jsx("span", { "aria-hidden": "true", children: ICONE[n] }), resumo[n], " ", ROTULO_NIVEL[n].toLowerCase()] }, n))) }), _jsxs("div", { className: "mt-2 grid gap-1.5", children: [_jsxs("button", { type: "button", className: "btn-secundario justify-center", disabled: lacunas.length === 0, onClick: () => despachar({ tipo: "adCriarDasLacunas", lacunas }), children: ["Criar blocos nas ", lacunas.length, " lacunas"] }), _jsxs("button", { type: "button", className: "btn-fantasma justify-center", disabled: !video, onClick: () => despachar({
                                tipo: "adAdicionar",
                                inicioMs: tempoMs,
                                fimMs: tempoMs + 3000,
                            }), children: ["+ Bloco em ", formatarTimecode(tempoMs)] }), aprovaveis.length > 0 ? (_jsxs("button", { type: "button", className: "btn-fantasma justify-center", onClick: () => {
                                if (window.confirm(`Aprovar para gravação os ${aprovaveis.length} blocos com texto ainda em rascunho?`)) {
                                    aprovaveis.forEach((b) => despachar({ tipo: "adAprovar", id: b.id, aprovado: true }));
                                }
                            }, children: ["Aprovar todos com texto (", aprovaveis.length, ")"] })) : null] }), fonte === "silencio" ? (_jsx("p", { className: "mt-2 text-2xs text-warn", children: "Sem LSE carregada: lacunas tiradas dos sil\u00EAncios do \u00E1udio, menos confi\u00E1veis." })) : null] }));
    if (secao === "atalhos")
        return (_jsxs(Secao, { titulo: "Atalhos (Ctrl ou \u2318)", children: [_jsxs("ul", { className: "grid gap-0.5 text-2xs text-navy-700", children: [_jsxs("li", { children: [_jsx("kbd", { children: "Espa\u00E7o" }), " tocar/pausar"] }), _jsxs("li", { children: [_jsx("kbd", { children: "\u2190" }), "/", _jsx("kbd", { children: "\u2192" }), " voltar/avan\u00E7ar 2 s"] }), _jsxs("li", { children: [_jsx("kbd", { children: "B" }), " novo bloco na posi\u00E7\u00E3o"] }), _jsxs("li", { children: [_jsx("kbd", { children: "\u2191" }), "/", _jsx("kbd", { children: "\u2193" }), " bloco anterior/seguinte"] }), _jsxs("li", { children: [_jsx("kbd", { children: "Enter" }), " aprovar e ir ao seguinte"] })] }), _jsxs("label", { className: "mt-2 flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: repetir, onChange: (e) => setRepetir(e.target.checked) }), "Repetir o trecho do bloco em foco"] })] }));
    return (_jsxs(Secao, { titulo: "Leitura e mixagem", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Numero, { rotulo: "Velocidade (ppm)", valor: p.palavrasPorMinuto, passo: 5, aoMudar: (v) => mudar({ palavrasPorMinuto: v }) }), _jsx(Numero, { rotulo: "Ducking (dB)", valor: p.duckingDb, passo: 1, min: -40, max: 0, aoMudar: (v) => mudar({ duckingDb: v }) }), _jsx(Numero, { rotulo: "Ataque (ms)", valor: p.ataqueMs, passo: 50, aoMudar: (v) => mudar({ ataqueMs: v }) }), _jsx(Numero, { rotulo: "Libera\u00E7\u00E3o (ms)", valor: p.liberacaoMs, passo: 50, aoMudar: (v) => mudar({ liberacaoMs: v }) })] }), _jsx("p", { className: "mt-2 text-2xs text-navy-500", children: calibracao ? (_jsxs(_Fragment, { children: ["Medido nas grava\u00E7\u00F5es:", " ", _jsxs("strong", { className: "text-navy", children: [calibracao.ppm, " ppm"] }), " (", calibracao.amostras, " takes).", " ", calibracao.ppm !== p.palavrasPorMinuto ? (_jsx("button", { type: "button", className: "underline", onClick: () => mudar({ palavrasPorMinuto: calibracao.ppm }), children: "Usar na estimativa" })) : null] })) : ("Estimativa até haver três gravações; depois, o estúdio mede a velocidade do locutor.") })] }));
}
function GravacaoInspetor({ secao, }) {
    const id = useId();
    const { estado } = useEstado();
    const despachar = useDespachar();
    const desktop = ponte();
    const { sessao } = useAD();
    const p = estado.ad.parametros;
    const nivelPct = Number.isFinite(sessao.nivel)
        ? Math.max(0, Math.min(100, ((sessao.nivel + 60) / 60) * 100))
        : 0;
    if (secao === "teleprompter")
        return (_jsxs(Secao, { titulo: "O que o locutor v\u00EA", children: [_jsx(Teleprompter, { estado: sessao.estadoPrompter, compacto: true }), desktop ? (sessao.prompterAberto ? (_jsxs("div", { className: "mt-2 flex items-center gap-2 text-2xs", children: [_jsxs("span", { className: "chip border-ok bg-ok-100 text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713" }), " ", sessao.prompterAberto] }), _jsx("button", { type: "button", className: "btn-fantasma h-6 px-2 text-2xs", onClick: sessao.fecharPrompter, children: "Fechar" })] })) : (_jsx("button", { type: "button", className: "btn-secundario mt-2 w-full justify-center", onClick: () => void sessao.abrirPrompter(), children: "Abrir no monitor do locutor" }))) : null] }));
    if (secao === "legenda")
        return (_jsx(Secao, { titulo: "Legenda do teleprompter", children: _jsx(AjustesLegenda, {}) }));
    return (_jsxs(Secao, { titulo: "Microfone", dica: "Fones para o locutor. Eco, ru\u00EDdo e ganho autom\u00E1ticos ficam desligados.", children: [sessao.micAberto ? (_jsxs(_Fragment, { children: [_jsx("label", { className: "rotulo", htmlFor: `${id}-mic`, children: "Entrada" }), _jsxs("select", { id: `${id}-mic`, className: "campo", value: sessao.micId, onChange: (e) => sessao.setMicId(e.target.value), children: [_jsx("option", { value: "", children: "Padr\u00E3o do sistema" }), sessao.microfones.map((m) => (_jsx("option", { value: m.deviceId, children: m.label || `Microfone ${m.deviceId.slice(0, 6)}` }, m.deviceId)))] }), _jsx("div", { className: "mt-2 h-1.5 w-full rounded bg-fundo", "aria-hidden": "true", children: _jsx("div", { className: `h-1.5 rounded ${sessao.nivel > -3 ? "bg-bad" : sessao.nivel > -12 ? "bg-warn" : "bg-ok"}`, style: { width: `${nivelPct}%` } }) }), _jsxs("p", { className: "mt-1 text-2xs text-navy-500", children: ["Pico:", " ", Number.isFinite(sessao.nivel)
                                ? `${sessao.nivel.toFixed(0)} dBFS`
                                : "—"] })] })) : (_jsx("button", { type: "button", className: "btn-secundario w-full justify-center", onClick: () => void sessao.abrirMic(), children: "Abrir microfone" })), sessao.erroMic ? (_jsx("p", { className: "mt-2 text-xs text-bad", children: sessao.erroMic })) : null, _jsxs("div", { className: "mt-2 grid grid-cols-3 gap-1.5", children: [_jsx(Numero, { rotulo: "Pr\u00E9 (ms)", valor: p.prerollMs, passo: 500, aoMudar: (v) => despachar({ tipo: "adParametros", mudanca: { prerollMs: v } }) }), _jsx(Numero, { rotulo: "P\u00F3s (ms)", valor: p.posrollMs, passo: 500, aoMudar: (v) => despachar({ tipo: "adParametros", mudanca: { posrollMs: v } }) }), _jsx(Numero, { rotulo: "Lat\u00EAncia", valor: p.latenciaMs, passo: 10, min: -500, aoMudar: (v) => despachar({ tipo: "adParametros", mudanca: { latenciaMs: v } }) })] })] }));
}
