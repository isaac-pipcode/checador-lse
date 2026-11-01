import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useDespachar, useEstado, useResultadoFinal, } from "../../state/store";
import { ponte } from "../../desktop/ponte";
import { Exportar } from "../Exportar";
import { SaidasAD } from "../ad/SaidasAD";
import { PainelAbas, Secao } from "../comum";
import { DICA_EXPORTAR, ExportarEditores } from "../libras/ExportarEditores";
import { clipesDosBlocos, curvaDeDucking } from "../../ad/mixagem";
import { bytesDoTake } from "../../ad/audio";
import { verificarBloco, nivelDoBloco } from "../../ad/verificacoes";
import { verificarJanela } from "../../libras/geometria";
import { NBR_15290 } from "../../libras/tipos";
import { serializarSrt } from "../../export/serializar";
import { useVideo } from "../contextoVideo";
/** Prontidão de cada etapa, em texto, com atalho para a página. */
function useProntidao() {
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const { duracaoMs } = useVideo();
    return useMemo(() => {
        const pend = Object.values(estado.review).filter((r) => r.decision === "pendente").length;
        const errosLse = final.remanescentes.filter((s) => s.severity === "erro").length;
        const blocos = estado.ad.blocos;
        const gravados = blocos.filter((b) => b.takeAtivoId).length;
        const errosAd = blocos.filter((b) => nivelDoBloco(verificarBloco(b, final.cues, estado.ad.parametros)) ===
            "erro").length;
        const lib = verificarJanela(estado.libras, NBR_15290, duracaoMs, final.cues);
        const r = [
            {
                pagina: "lse",
                titulo: "Legendas (LSE)",
                itens: estado.cues.length
                    ? [
                        {
                            ok: errosLse === 0,
                            texto: errosLse
                                ? `${errosLse} erros permanecem no arquivo final`
                                : "Sem erros remanescentes",
                        },
                        {
                            ok: pend === 0,
                            texto: pend
                                ? `${pend} apontamentos sem decisão`
                                : "Todos os apontamentos decididos",
                        },
                    ]
                    : [{ ok: null, texto: "Nenhuma legenda carregada" }],
            },
            {
                pagina: "ad",
                titulo: "Audiodescrição",
                itens: blocos.length
                    ? [
                        {
                            ok: gravados === blocos.length,
                            texto: `${gravados} de ${blocos.length} blocos gravados`,
                        },
                        {
                            ok: errosAd === 0,
                            texto: errosAd
                                ? `${errosAd} blocos com erro (sobreposição à fala, fora da janela…)`
                                : "Sem erros nos blocos",
                        },
                    ]
                    : [{ ok: null, texto: "Nenhum bloco de AD" }],
            },
            {
                pagina: "libras",
                titulo: "Janela de Libras",
                itens: estado.libras.clipe
                    ? lib.length
                        ? lib.map((a) => ({
                            ok: a.nivel === "erro"
                                ? false
                                : a.nivel === "aviso"
                                    ? false
                                    : null,
                            texto: `${a.codigo} — ${a.mensagem}`,
                        }))
                        : [{ ok: true, texto: "Dentro da norma e sincronizada" }]
                    : [{ ok: null, texto: "Nenhum clipe do intérprete" }],
            },
        ];
        return r;
    }, [estado, final, duracaoMs]);
}
export function EntregaEsquerda() {
    const despachar = useDespachar();
    const prontidao = useProntidao();
    const pendencias = prontidao
        .flatMap((m) => m.itens)
        .filter((i) => i.ok === false).length;
    return (_jsx(PainelAbas, { memoria: "entrega-esquerda", rotulo: "Prontid\u00E3o e arquivos avulsos", titulo: "Entrega", abas: [
            {
                id: "prontidao",
                rotulo: "Prontidão",
                marca: pendencias || null,
                tom: "aviso",
                conteudo: (_jsx(Secao, { titulo: "Estado por etapa", children: _jsx("ul", { className: "space-y-3", children: prontidao.map((m) => (_jsxs("li", { children: [_jsxs("div", { className: "flex items-center", children: [_jsx("h4", { className: "text-sm font-semibold", children: m.titulo }), _jsx("button", { type: "button", className: "btn-fantasma ml-auto h-6 px-2 text-2xs", onClick: () => despachar({ tipo: "navegar", pagina: m.pagina }), children: "Abrir etapa \u21A6" })] }), _jsx("ul", { className: "mt-1 space-y-0.5 text-xs", children: m.itens.map((i, k) => (_jsxs("li", { className: i.ok === null
                                            ? "text-navy-500"
                                            : i.ok
                                                ? "text-ok"
                                                : "text-warn", children: [_jsx("span", { "aria-hidden": "true", children: i.ok === null ? "○ " : i.ok ? "✓ " : "! " }), i.texto] }, k))) })] }, m.pagina))) }) })),
            },
            { id: "lse", rotulo: "Legendas", conteudo: _jsx(Exportar, {}) },
            { id: "ad", rotulo: "Audiodescrição", conteudo: _jsx(SaidasAD, {}) },
            {
                id: "editores",
                rotulo: "Editores",
                conteudo: (_jsx(Secao, { titulo: "Libras para Premiere e Resolve", dica: DICA_EXPORTAR, children: _jsx(ExportarEditores, {}) })),
            },
        ] }));
}
/** Pacote final: um arquivo com vídeo (+Libras), faixas Original e AD, e a LSE selecionável. */
export function EntregaDireita() {
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const desktop = ponte();
    const { duracaoMs } = useVideo();
    const temLibras = !!estado.libras.clipe?.caminho;
    const clipes = useMemo(() => clipesDosBlocos(estado.ad.blocos, estado.ad.parametros), [estado.ad]);
    const temAd = clipes.length > 0;
    const temLse = final.cues.length > 0;
    const [incluir, setIncluir] = useState({ libras: true, ad: true, lse: true });
    const [progresso, setProgresso] = useState(null);
    const [rel, setRel] = useState(null);
    const [erro, setErro] = useState(null);
    async function renderizar() {
        if (!desktop || !estado.video?.caminho)
            return;
        setErro(null);
        setRel(null);
        setProgresso({ f: 0, etapa: "Preparando" });
        try {
            const takes = [];
            if (incluir.ad && temAd) {
                for (const c of clipes) {
                    const b = await bytesDoTake(c.takeId);
                    if (b)
                        takes.push({ id: c.takeId, bytes: b });
                }
            }
            const { clipe, inicioNaObraMs, ...janela } = estado.libras;
            const r = await desktop.renderizarEntrega({
                videoCaminho: estado.video.caminho,
                nomeBase: (estado.projeto.nome || estado.video.nome).replace(/\.[^.]+$/, ""),
                duracaoMs,
                libras: incluir.libras && clipe?.caminho
                    ? {
                        caminho: clipe.caminho,
                        inicioNaObraMs,
                        janela,
                    }
                    : null,
                ad: incluir.ad && temAd
                    ? {
                        clipes,
                        curva: curvaDeDucking(clipes, estado.ad.parametros),
                        takes,
                    }
                    : null,
                legendaSrt: incluir.lse && temLse ? serializarSrt(final.cues) : null,
            }, (f, etapa) => setProgresso({ f, etapa }));
            setRel(r);
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : String(e));
        }
        finally {
            setProgresso(null);
        }
    }
    const opcoes = [
        [
            "libras",
            "Janela de Libras (queimada no vídeo)",
            temLibras,
            "sem clipe do intérprete",
        ],
        ["ad", "Faixa de áudio com audiodescrição", temAd, "nenhum bloco gravado"],
        ["lse", "LSE como legenda selecionável", temLse, "nenhuma legenda"],
    ];
    const algo = opcoes.some(([k, , disp]) => disp && incluir[k]);
    const formato = incluir.libras && temLibras
        ? "MP4 (H.264 recodificado)"
        : "MKV (vídeo copiado, sem recompressão)";
    return (_jsxs("section", { className: "painel", "aria-label": "Pacote acess\u00EDvel", children: [_jsx("header", { className: "painel-cabeca", children: _jsx("h2", { children: "Pacote acess\u00EDvel" }) }), _jsxs("div", { className: "painel-corpo", children: [_jsxs(Secao, { titulo: "Conte\u00FAdo", dica: "A faixa \u201COriginal\u201D \u00E9 mantida. A LSE sai com as decis\u00F5es aprovadas na revis\u00E3o.", children: [opcoes.map(([k, rotulo, disp, motivo]) => (_jsxs("label", { className: `flex items-start gap-2 py-1 text-xs ${disp ? "" : "text-navy-500"}`, children: [_jsx("input", { type: "checkbox", className: "mt-0.5", disabled: !disp, checked: disp && incluir[k], onChange: (e) => setIncluir({ ...incluir, [k]: e.target.checked }) }), _jsxs("span", { children: [rotulo, !disp ? (_jsx("span", { className: "block text-2xs", children: motivo })) : null] })] }, k))), _jsxs("p", { className: "mt-2 text-2xs text-navy-500", children: ["Formato: ", formato] })] }), _jsxs(Secao, { titulo: "Renderizar", children: [!desktop ? (_jsx("p", { className: "text-xs text-navy-500", children: "A renderiza\u00E7\u00E3o usa o ffmpeg do aplicativo desktop." })) : !estado.video?.caminho ? (_jsx("p", { className: "text-xs text-navy-500", children: "Abra o v\u00EDdeo no monitor." })) : (_jsx("button", { type: "button", className: "btn-primario w-full justify-center", disabled: !algo || progresso !== null, onClick: () => void renderizar(), children: "Renderizar pacote\u2026" })), progresso ? (_jsxs("div", { className: "mt-2 text-2xs", role: "status", children: [_jsx("progress", { max: 1, value: progresso.f, className: "w-full", "aria-label": "Progresso da renderiza\u00E7\u00E3o" }), progresso.etapa, " \u00B7 ", Math.round(progresso.f * 100), "%"] })) : null, erro ? _jsxs("p", { className: "mt-2 text-xs text-bad", children: ["Erro: ", erro] }) : null, rel ? (_jsxs("div", { className: "mt-3 rounded border border-ok bg-ok-100 p-2 text-xs text-ok", role: "status", children: [_jsxs("p", { className: "font-semibold", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713 " }), rel.arquivo.split(/[\\/]/).pop()] }), _jsxs("ul", { className: "mt-1 space-y-0.5 text-navy", children: [_jsxs("li", { children: ["V\u00EDdeo: ", rel.faixas.video] }), _jsxs("li", { children: ["\u00C1udio: ", rel.faixas.audios.join(" + ") || "—"] }), _jsxs("li", { children: ["Legenda: ", rel.faixas.legenda ?? "—"] }), rel.loudnessAd ? (_jsxs("li", { children: ["Loudness da faixa de AD:", " ", rel.loudnessAd.integradoLufs
                                                        ?.toFixed(1)
                                                        .replace(".", ",") ?? "—", " ", "LUFS \u00B7 pico", " ", rel.loudnessAd.picoVerdadeiroDbtp
                                                        ?.toFixed(1)
                                                        .replace(".", ",") ?? "—", " ", "dBTP (medida, n\u00E3o normalizada)"] })) : null] }), rel.avisos.map((a) => (_jsxs("p", { className: "mt-1 text-warn", children: ["! ", a] }, a))), desktop ? (_jsx("button", { type: "button", className: "btn-fantasma mt-1 h-6 px-2 text-2xs", onClick: () => void desktop.mostrarNaPasta(rel.arquivo), children: "Mostrar na pasta" })) : null] })) : null] })] })] }));
}
