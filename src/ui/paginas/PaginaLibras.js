import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useState } from "react";
import { useDespachar, useEstado, useResultadoFinal, } from "../../state/store";
import { useVideo } from "../contextoVideo";
import { ponte } from "../../desktop/ponte";
import { Deslizante, PainelAbas, Secao, tcSmpte } from "../comum";
import { retanguloJanela, verificarJanela } from "../../libras/geometria";
import { analisarSincronia } from "../../libras/sincronia";
import { JANELA_PADRAO, NBR_15290, } from "../../libras/tipos";
import { aplicarProporcao, dentroDaAreaSegura, margemParaAreaSegura, propostas, } from "../../libras/enquadramento";
import { JANELA_MS } from "../../mapa/midia";
import { avaliarMidia } from "../../midia/avaliacao";
import { invasaoDosNeutros, toleranciaSugerida } from "../../libras/chroma";
import { gerarProxyDe } from "../proxy";
import { amostrarQuadros, corChaveDosQuadros, enquadramentoAutomatico, envelopesDoClipe, } from "../libras/analiseClipe";
import { ConferenciaOndas, ResiduoSincronia, } from "../libras/GraficosSincronia";
import { DICA_EXPORTAR, ExportarEditores } from "../libras/ExportarEditores";
const pct = (v) => `${Math.round(v * 100)}%`;
const dec = (v, c = 2) => v.toFixed(c).replace(".", ",");
function useJanela() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    return {
        j: estado.libras,
        ui: estado.librasUi,
        mudar: (mudanca) => despachar({ tipo: "libras", mudanca }),
        mudarUi: (mudanca) => despachar({ tipo: "librasUi", mudanca }),
    };
}
/** Quadro da obra (master), para medidas em pixels e proporções. */
function useQuadro() {
    const { estado } = useEstado();
    const { video } = useVideo();
    const i = estado.video?.info;
    if (i?.largura && i.altura)
        return { w: i.largura, h: i.altura };
    if (video?.videoWidth)
        return { w: video.videoWidth, h: video.videoHeight };
    return { w: 1920, h: 1080 };
}
function Segmentos({ opcoes, valor, aoMudar, rotulo, }) {
    return (_jsx("div", { className: "flex rounded bg-fundo p-0.5", role: "group", "aria-label": rotulo, children: opcoes.map(([v, r]) => (_jsx("button", { type: "button", className: "segmento h-7 flex-1 justify-center px-2", "aria-pressed": valor === v, onClick: () => aoMudar(v), children: r }, v))) }));
}
// ===========================================================================
// Painel esquerdo: clipe, sincronização, conferência, verificações
// ===========================================================================
export function LibrasEsquerda() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const final = useResultadoFinal();
    const { j, ui, mudar, mudarUi } = useJanela();
    const { buscar, tempoMs, duracaoMs } = useVideo();
    const desktop = ponte();
    const quadro = useQuadro();
    const [sinc, setSinc] = useState(null);
    const [msg, setMsg] = useState(null);
    const [razao, setRazao] = useState(null);
    const fps = estado.config.fps;
    const ap = verificarJanela(j, NBR_15290, duracaoMs, final.cues, quadro);
    const [infoClipe, setInfoClipe] = useState(null);
    useEffect(() => {
        if (!j.clipe)
            setInfoClipe(null);
        if (!j.clipe?.caminho || infoClipe || !desktop)
            return;
        void desktop.sondarMidia(j.clipe.caminho).then(setInfoClipe, () => { });
    }, [j.clipe, j.clipe?.caminho, infoClipe, desktop]);
    const avalClipe = infoClipe ? avaliarMidia(infoClipe) : null;
    const trabalhoClipe = j.clipe?.caminho
        ? estado.proxies[j.clipe.caminho]
        : undefined;
    const envClipe = j.clipe?.caminho
        ? envelopesDoClipe.get(j.clipe.caminho)
        : undefined;
    const erros = ap.filter((a) => a.nivel === "erro").length;
    async function escolher() {
        if (!desktop)
            return;
        const c = await desktop.escolherClipeLibras();
        if (!c)
            return;
        const clipe = {
            nome: c.nome,
            caminho: c.caminho,
            url: c.url,
            urlOriginal: c.url,
            duracaoMs: c.duracaoMs,
            proxy: null,
        };
        mudar({
            clipe,
            inicioNaObraMs: 0,
            velocidade: 1,
            sincronia: { metodo: "nenhuma", confianca: null, relatorio: null },
        });
        setInfoClipe(c.info ?? null);
        setMsg(null);
        if (c.info && avaliarMidia(c.info).necessidade === "obrigatorio")
            await proxyDoClipe(clipe);
    }
    async function proxyDoClipe(clipe) {
        if (!clipe.caminho)
            return;
        const px = await gerarProxyDe(despachar, clipe.caminho, estado.projeto.caminho);
        if (px)
            mudar({ clipe: { ...clipe, proxy: px, url: px.url } });
    }
    async function sincronizar() {
        if (!desktop || !j.clipe?.caminho || !estado.mapa?.audio)
            return;
        setMsg(null);
        setSinc({ progresso: 0, etapa: "Lendo o som-guia" });
        try {
            const env = await desktop.analisarAudio(j.clipe.caminho, JANELA_MS, (f) => setSinc({ progresso: f, etapa: "Lendo o som-guia" }));
            envelopesDoClipe.set(j.clipe.caminho, env.envelopeDb);
            setSinc({ progresso: 1, etapa: "Comparando com a trilha do filme" });
            await new Promise((r) => setTimeout(r, 30)); // deixa a interface pintar antes do cálculo
            const r = analisarSincronia(estado.mapa.envelopeDb, env.envelopeDb, JANELA_MS, { fps });
            setRazao(r.razaoCadencia.razao !== 1 ? r.razaoCadencia.rotulo : null);
            mudar({
                inicioNaObraMs: r.inicioNaObraMs,
                velocidade: r.velocidade,
                sincronia: {
                    metodo: "audio",
                    confianca: r.confianca,
                    relatorio: r.relatorio,
                },
            });
            setMsg(r.confianca >= 0.5
                ? "Sincronizado pelo som-guia. Confira no gráfico e de ouvido."
                : `Confiança baixa (${pct(r.confianca)}): o clipe pode não ter som-guia, ou ele difere muito da trilha. Ajuste à mão.`);
        }
        catch (e) {
            setMsg(`Não foi possível analisar o áudio do clipe: ${e instanceof Error ? e.message : String(e)}`);
        }
        finally {
            setSinc(null);
        }
    }
    const deslocar = (delta) => mudar({
        inicioNaObraMs: Math.round(j.inicioNaObraMs + delta),
        sincronia: { ...j.sincronia, metodo: "manual" },
    });
    const rel = j.sincronia.relatorio;
    const sincronia = (_jsxs(_Fragment, { children: [_jsx(Secao, { titulo: "Clipe do int\u00E9rprete", dica: "Gravado com fundo verde e com a trilha do filme como som-guia: \u00E9 por ela que o est\u00FAdio sincroniza.", children: j.clipe ? (_jsxs("div", { className: "text-xs", children: [_jsx("p", { className: "truncate font-medium text-navy", title: j.clipe.caminho ?? "", children: j.clipe.nome }), _jsxs("p", { className: "text-navy-500", children: [tcSmpte(j.clipe.duracaoMs, fps), avalClipe ? ` · ${avalClipe.descricao}` : ""] }), _jsxs("p", { className: "mt-1 text-2xs", role: "status", children: [trabalhoClipe && !trabalhoClipe.erro ? (_jsxs("span", { className: "text-navy-700", children: ["Gerando proxy da pr\u00E9via\u2026", " ", Math.round(trabalhoClipe.progresso * 100), "%"] })) : j.clipe.proxy ? (_jsxs("span", { className: "text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713 " }), "Pr\u00E9via no proxy; a entrega usa o original."] })) : avalClipe && avalClipe.necessidade !== "dispensavel" ? (_jsx("button", { type: "button", className: "btn-fantasma h-6 px-1.5 text-2xs", onClick: () => j.clipe && void proxyDoClipe(j.clipe), children: "Gerar proxy para a pr\u00E9via" })) : null, trabalhoClipe?.erro ? (_jsx("span", { className: "text-bad", children: trabalhoClipe.erro })) : null] }), _jsxs("div", { className: "mt-2 flex gap-1.5", children: [_jsx("button", { type: "button", className: "btn-secundario h-7", onClick: () => void escolher(), disabled: !desktop, children: "Trocar\u2026" }), _jsx("button", { type: "button", className: "btn-fantasma h-7", onClick: () => mudar({
                                        clipe: null,
                                        sincronia: { metodo: "nenhuma", confianca: null },
                                    }), children: "Remover" })] })] })) : desktop ? (_jsx(_Fragment, { children: _jsx("button", { type: "button", className: "btn-primario w-full justify-center", onClick: () => void escolher(), children: "Importar v\u00EDdeo do int\u00E9rprete\u2026" }) })) : (_jsx("p", { className: "text-xs text-navy-500", children: "A importa\u00E7\u00E3o do clipe usa o aplicativo desktop." })) }), j.clipe ? (_jsxs(Secao, { titulo: "Sincroniza\u00E7\u00E3o pelo som-guia", children: [_jsx("button", { type: "button", className: "btn-secundario w-full justify-center", disabled: !!sinc || !estado.mapa?.audio || !j.clipe.caminho, onClick: () => void sincronizar(), children: sinc
                            ? `${sinc.etapa}… ${sinc.etapa.startsWith("Lendo") ? pct(sinc.progresso) : ""}`
                            : rel
                                ? "Sincronizar de novo"
                                : "Sincronizar pelo som-guia" }), !estado.mapa?.audio ? (_jsx("p", { className: "mt-1 text-2xs text-warn", children: "\u00C9 preciso o \u00E1udio da obra analisado." })) : null, msg ? (_jsx("p", { className: "mt-2 text-2xs text-navy-700", role: "status", children: msg })) : null, _jsxs("dl", { className: "mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs", children: [_jsx("dt", { className: "text-navy-500", children: "In\u00EDcio na obra" }), _jsxs("dd", { className: "font-mono text-terra-700", children: [j.inicioNaObraMs < 0 ? "−" : "", tcSmpte(Math.abs(j.inicioNaObraMs), fps)] }), _jsx("dt", { className: "text-navy-500", children: "Deriva" }), _jsx("dd", { children: rel
                                    ? rel.corrigida
                                        ? `${rel.derivaMsPorHora > 0 ? "+" : ""}${rel.derivaMsPorHora} ms/h — corrigida (velocidade ×${dec(j.velocidade, 5)})`
                                        : "desprezível (< ½ quadro no clipe)"
                                    : j.velocidade !== 1
                                        ? `velocidade ×${dec(j.velocidade, 5)}`
                                        : "—" }), razao ? (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-navy-500", children: "Cad\u00EAncia" }), _jsxs("dd", { children: ["convers\u00E3o ", razao] })] })) : null, _jsx("dt", { className: "text-navy-500", children: "M\u00E9todo" }), _jsx("dd", { children: j.sincronia.metodo === "audio"
                                    ? `som-guia · confiança ${pct(j.sincronia.confianca ?? 0)}`
                                    : j.sincronia.metodo === "manual"
                                        ? "ajustado à mão"
                                        : "não sincronizado" })] }), envClipe && estado.mapa?.audio ? (_jsx("div", { className: "mt-3", children: _jsx(ConferenciaOndas, { envObra: estado.mapa.envelopeDb, envClipe: envClipe, janelaMs: JANELA_MS, tempoMs: tempoMs, inicioNaObraMs: j.inicioNaObraMs, velocidade: j.velocidade }) })) : null, rel && rel.pontos.length > 0 ? (_jsx("div", { className: "mt-3", children: _jsx(ResiduoSincronia, { relatorio: rel, fps: fps }) })) : null] })) : null, j.clipe ? (_jsxs(Secao, { titulo: "Ajuste fino", children: [_jsxs("div", { className: "flex flex-wrap gap-1", role: "group", "aria-label": "Deslocar o clipe", children: [[
                                [-1000, "−1 s"],
                                [-1000 / fps, "−1 qd"],
                                [1000 / fps, "+1 qd"],
                                [1000, "+1 s"],
                            ].map(([d, r]) => (_jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", onClick: () => deslocar(d), children: r }, r))), _jsx("button", { type: "button", className: "btn-fantasma h-7 px-2 text-2xs", onClick: () => mudar({
                                    inicioNaObraMs: tempoMs,
                                    sincronia: { ...j.sincronia, metodo: "manual" },
                                }), title: "O clipe come\u00E7a na posi\u00E7\u00E3o atual do v\u00EDdeo", children: "Come\u00E7ar aqui" })] }), _jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs", children: [_jsx("label", { htmlFor: "libras-vel", className: "text-navy-700", children: "Velocidade" }), _jsx("input", { id: "libras-vel", className: "campo w-28 font-mono", type: "number", step: 0.0001, min: 0.9, max: 1.1, value: Number(j.velocidade.toFixed(5)), onChange: (e) => {
                                    const v = Number(e.target.value);
                                    if (v > 0.5 && v < 1.5)
                                        mudar({
                                            velocidade: v,
                                            sincronia: { ...j.sincronia, metodo: "manual" },
                                        });
                                } }), j.velocidade !== 1 ? (_jsx("button", { type: "button", className: "btn-fantasma h-6 px-1.5 text-2xs", onClick: () => mudar({ velocidade: 1 }), children: "1,0" })) : null] }), _jsx("button", { type: "button", className: "btn-fantasma mt-1 h-7 px-2 text-2xs", onClick: () => buscar(Math.max(0, j.inicioNaObraMs)), children: "Ir ao in\u00EDcio do clipe" })] })) : null, j.clipe ? (_jsx(Secao, { titulo: "Conferir de ouvido", dica: "Em \u201CAmbos\u201D, com fones: filme \u00E0 esquerda, som-guia \u00E0 direita. Em sincronia, soam juntos; defasados, como eco.", children: _jsx(Segmentos, { rotulo: "O que ouvir", valor: ui.escuta, aoMudar: (v) => mudarUi({ escuta: v }), opcoes: [
                        ["filme", "Filme"],
                        ["ambos", "Ambos (E/D)"],
                        ["interprete", "Som-guia"],
                    ] }) })) : null, j.clipe ? (_jsx(Secao, { titulo: "Exportar para editores", dica: DICA_EXPORTAR, children: _jsx(ExportarEditores, {}) })) : null] }));
    return (_jsx(PainelAbas, { memoria: "libras-esquerda", rotulo: "Int\u00E9rprete de Libras", titulo: "Int\u00E9rprete", abas: [
            { id: "sincronia", rotulo: "Clipe e sincronia", conteudo: sincronia },
            {
                id: "verificacoes",
                rotulo: "Verificações",
                marca: ap.filter((a) => a.nivel !== "pendente").length || null,
                tom: erros ? "erro" : "aviso",
                conteudo: (_jsxs(Secao, { titulo: "Verifica\u00E7\u00F5es", children: [ap.length === 0 ? (_jsxs("p", { className: "text-xs text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713 " }), "Sem apontamentos."] })) : (_jsx("ul", { className: "space-y-1.5 text-xs", children: ap.map((a) => (_jsxs("li", { className: a.nivel === "erro"
                                    ? "text-bad"
                                    : a.nivel === "aviso"
                                        ? "text-warn"
                                        : "text-navy-700", children: [_jsx("span", { "aria-hidden": "true", children: a.nivel === "erro"
                                            ? "✕ "
                                            : a.nivel === "aviso"
                                                ? "! "
                                                : "… " }), _jsx("span", { className: "font-mono text-2xs", children: a.codigo }), " ", a.mensagem] }, a.codigo))) })), _jsxs("p", { className: "mt-2 text-2xs text-navy-500", children: ["Refer\u00EAncia: ", NBR_15290.fonte, "."] })] })),
            },
        ] }));
}
// ===========================================================================
// Inspetor: janela, enquadramento, recorte, cor
// ===========================================================================
const CANTOS = [
    ["sup-esq", "Superior esquerdo"],
    ["sup-dir", "Superior direito"],
    ["inf-esq", "Inferior esquerdo"],
    ["inf-dir", "Inferior direito"],
];
/** classes literais (o Tailwind não gera nomes montados em tempo de execução) */
const ALINHAMENTO = {
    "sup-esq": "items-start justify-start",
    "sup-dir": "items-start justify-end",
    "inf-esq": "items-end justify-start",
    "inf-dir": "items-end justify-end",
};
export function LibrasDireita() {
    const id = useId();
    const { j, ui, mudar, mudarUi } = useJanela();
    const quadro = useQuadro();
    const [auto, setAuto] = useState(null);
    const [detectando, setDetectando] = useState(false);
    const mudarChroma = (m) => mudar({ chroma: { ...j.chroma, ...m } });
    const mudarCor = (m) => mudar({ cor: { ...j.cor, ...m } });
    const r = retanguloJanela(j, quadro.w, quadro.h);
    const aspecto = r.w / r.h;
    const props = propostas(quadro, NBR_15290);
    const ativa = props.find((p) => p.aspecto !== null && Math.abs(p.aspecto - aspecto) < 0.02)?.id ?? "livre";
    const seguro = dentroDaAreaSegura(j, quadro);
    async function enquadrar() {
        if (!j.clipe)
            return;
        setAuto({ estado: "analisando", texto: "Analisando 16 quadros do clipe…" });
        try {
            const amostra = await amostrarQuadros(j.clipe.url, 16);
            const r2 = enquadramentoAutomatico(j, amostra, { w: r.w, h: r.h });
            if (!r2) {
                setAuto({
                    estado: "erro",
                    texto: "O intérprete não foi encontrado: confira a cor-chave do recorte.",
                });
                return;
            }
            mudar({ zoom: r2.zoom, deslocX: r2.deslocX, deslocY: r2.deslocY });
            setAuto({
                estado: "ok",
                texto: `Espaço de sinalização: ${pct(r2.caixaFracao.w)} × ${pct(r2.caixaFracao.h)} do quadro do clipe, com folga.` +
                    (r2.ignorados
                        ? ` ${r2.ignorados} objeto(s) separado(s) do intérprete (tripé, refletor, borda do pano) ficaram de fora — se aparecerem na janela, use “Recortar bordas do quadro”.`
                        : ""),
            });
        }
        catch (e) {
            setAuto({
                estado: "erro",
                texto: e instanceof Error ? e.message : String(e),
            });
        }
    }
    async function detectarCor() {
        if (!j.clipe)
            return;
        setDetectando(true);
        try {
            const amostra = await amostrarQuadros(j.clipe.url, 6, 160);
            const cor = corChaveDosQuadros(amostra.quadros);
            if (cor)
                mudarChroma({ cor, ativo: true, ...toleranciaSugerida(cor) });
        }
        finally {
            setDetectando(false);
        }
    }
    const janela = (_jsxs(_Fragment, { children: [_jsxs(Secao, { titulo: "Propor\u00E7\u00E3o", children: [_jsx("div", { className: "flex flex-wrap gap-1", role: "group", "aria-label": "Propor\u00E7\u00E3o da janela", children: props.map((p) => (_jsx("button", { type: "button", className: "segmento h-7 border border-paper-400 px-2", "aria-pressed": ativa === p.id, title: p.descricao, onClick: () => p.aspecto !== null &&
                                mudar(aplicarProporcao(j.altura, p.aspecto, quadro, NBR_15290)), children: p.rotulo }, p.id))) }), _jsxs("p", { className: "mt-1.5 text-2xs text-navy-500", children: [r.w, "\u00D7", r.h, " px num quadro de ", quadro.w, "\u00D7", quadro.h, "."] })] }), _jsxs(Secao, { titulo: "Tamanho", dica: "Com uma propor\u00E7\u00E3o escolhida, a altura arrasta a largura junto.", children: [_jsx(Deslizante, { id: `${id}-h`, rotulo: "Altura", valor: j.altura, min: 0.3, max: 0.9, passo: 0.01, formatar: (v) => `${pct(v)} da tela`, aoMudar: (v) => ativa !== "livre"
                            ? mudar(aplicarProporcao(v, aspecto, quadro, {
                                ...NBR_15290,
                                alturaMin: 0,
                            }))
                            : mudar({ altura: v }), marca: {
                            valor: NBR_15290.alturaMin,
                            rotulo: `mínimo ${pct(NBR_15290.alturaMin)} (NBR 15290)`,
                        } }), _jsx(Deslizante, { id: `${id}-w`, rotulo: "Largura", valor: j.largura, min: 0.15, max: 0.5, passo: 0.01, formatar: (v) => `${pct(v)} da tela`, aoMudar: (v) => mudar({ largura: v }), marca: {
                            valor: NBR_15290.larguraMin,
                            rotulo: `mínimo ${pct(NBR_15290.larguraMin)} (NBR 15290)`,
                        } })] }), _jsxs(Secao, { titulo: "Posi\u00E7\u00E3o e espa\u00E7o", children: [_jsx("div", { className: "grid w-40 grid-cols-2 gap-1 rounded border border-paper-400 bg-fundo p-1", role: "radiogroup", "aria-label": "Canto da tela", children: CANTOS.map(([c, rot]) => (_jsx("button", { type: "button", role: "radio", "aria-checked": j.canto === c, "aria-label": rot, onClick: () => mudar({ canto: c }), className: `flex h-10 rounded p-1 ${ALINHAMENTO[c]} ${j.canto === c ? "bg-paper-200" : "hover:bg-paper"}`, children: _jsx("span", { "aria-hidden": "true", className: `block h-5 w-3 rounded-sm ${j.canto === c ? "bg-terra" : "bg-navy-500/50"}` }) }, c))) }), _jsx("div", { className: "mt-2", children: _jsx(Deslizante, { id: `${id}-m`, rotulo: "Margem", valor: j.margem, min: 0, max: 0.12, passo: 0.005, formatar: pct, aoMudar: (v) => mudar({ margem: v }) }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [_jsxs("span", { className: seguro ? "text-ok" : "text-warn", children: [_jsx("span", { "aria-hidden": "true", children: seguro ? "✓ " : "! " }), seguro ? "Dentro da área segura" : "Fora da área segura de 5%"] }), !seguro ? (_jsx("button", { type: "button", className: "btn-fantasma h-6 px-1.5 text-2xs", onClick: () => mudar({ margem: margemParaAreaSegura(quadro) }), children: "Encaixar" })) : null, _jsxs("label", { className: "ml-auto flex items-center gap-1.5 text-2xs", children: [_jsx("input", { type: "checkbox", checked: ui.areaSegura, onChange: (e) => mudarUi({ areaSegura: e.target.checked }) }), "Mostrar no monitor"] })] })] })] }));
    const enquadramento = (_jsxs(_Fragment, { children: [_jsxs(Secao, { titulo: "Enquadramento autom\u00E1tico", children: [_jsx("button", { type: "button", className: "btn-secundario w-full justify-center", disabled: !j.clipe || auto?.estado === "analisando", onClick: () => void enquadrar(), children: auto?.estado === "analisando"
                            ? "Analisando…"
                            : "Enquadrar o intérprete" }), _jsx("p", { className: `mt-1.5 text-2xs ${auto?.estado === "erro" ? "text-bad" : "text-navy-500"}`, role: "status", children: auto?.texto ??
                            "Mede, em 16 quadros espalhados pelo clipe, o espaço que o intérprete ocupa com as mãos em movimento, e ajusta zoom e posição para caber na janela com folga." })] }), _jsxs(Secao, { titulo: "Ajuste manual", dica: "O clipe preenche a janela; o excedente \u00E9 cortado. M\u00E3os e rosto precisam caber inteiros.", children: [_jsx(Deslizante, { id: `${id}-z`, rotulo: "Zoom", valor: j.zoom, min: 1, max: 3, passo: 0.01, formatar: (v) => `${dec(v)}×`, aoMudar: (v) => mudar({ zoom: v }) }), _jsx(Deslizante, { id: `${id}-x`, rotulo: "Horizontal", valor: j.deslocX, min: -1, max: 1, passo: 0.01, formatar: (v) => v < -0.02 ? "à esquerda" : v > 0.02 ? "à direita" : "centro", aoMudar: (v) => mudar({ deslocX: v }) }), _jsx(Deslizante, { id: `${id}-y`, rotulo: "Vertical", valor: j.deslocY, min: -1, max: 1, passo: 0.01, formatar: (v) => v < -0.02 ? "acima" : v > 0.02 ? "abaixo" : "centro", aoMudar: (v) => mudar({ deslocY: v }) })] })] }));
    const ch = j.chroma;
    const recorte = (_jsxs(_Fragment, { children: [_jsxs(Secao, { titulo: "Fundo verde (chroma key)", children: [_jsxs("label", { className: "flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: ch.ativo, onChange: (e) => mudarChroma({ ativo: e.target.checked }) }), "Remover o fundo"] }), ch.ativo ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsx("label", { className: "rotulo", htmlFor: `${id}-cor`, children: "Cor-chave" }), _jsx("input", { id: `${id}-cor`, type: "color", value: ch.cor, onChange: (e) => mudarChroma({ cor: e.target.value.toUpperCase() }), className: "h-7 w-10 cursor-pointer rounded border border-paper-400 bg-transparent" }), _jsx("span", { className: "font-mono text-2xs text-navy-500", children: ch.cor })] }), _jsxs("div", { className: "mt-1.5 flex flex-wrap gap-1", children: [_jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", disabled: !j.clipe || detectando, onClick: () => void detectarCor(), children: detectando ? "Detectando…" : "Detectar" }), _jsx("button", { type: "button", className: "btn-secundario h-7 px-2 text-2xs", "aria-pressed": ui.contaGotas, disabled: !j.clipe, onClick: () => mudarUi({ contaGotas: !ui.contaGotas }), children: ui.contaGotas ? "Clique no fundo, no monitor…" : "Conta-gotas" }), _jsx("button", { type: "button", className: "btn-fantasma h-7 px-1.5 text-2xs", onClick: () => mudarChroma({ cor: "#00B140" }), children: "verde" }), _jsx("button", { type: "button", className: "btn-fantasma h-7 px-1.5 text-2xs", onClick: () => mudarChroma({ cor: "#0047BB" }), children: "azul" })] }), _jsxs("div", { className: "mt-2", children: [_jsx(Deslizante, { id: `${id}-sim`, rotulo: "Toler\u00E2ncia", valor: ch.similaridade, min: 0.01, max: 0.5, passo: 0.01, formatar: (v) => dec(v), aoMudar: (v) => mudarChroma({ similaridade: v }) }), _jsx(Deslizante, { id: `${id}-suav`, rotulo: "Transi\u00E7\u00E3o", valor: ch.suavidade, min: 0, max: 0.3, passo: 0.01, formatar: (v) => dec(v), aoMudar: (v) => mudarChroma({ suavidade: v }) })] }), (() => {
                                const inv = invasaoDosNeutros(ch.cor, ch.similaridade, ch.suavidade);
                                return (_jsxs("p", { className: `text-2xs ${inv > 1 ? "text-bad" : inv > 0.9 ? "text-warn" : "text-navy-500"}`, children: [_jsx("span", { "aria-hidden": "true", children: inv > 1 ? "✕ " : inv > 0.9 ? "! " : "✓ " }), inv > 1
                                            ? "Tons neutros (roupa preta, cabelo) ficam translúcidos com esta tolerância."
                                            : inv > 0.9
                                                ? "Perto dos tons neutros: confira a roupa no Matte."
                                                : `Folga para tons neutros: ${Math.round((1 - inv) * 100)}%.`, " ", inv > 0.75 ? (_jsx("button", { type: "button", className: "underline", onClick: () => mudarChroma(toleranciaSugerida(ch.cor)), children: "Ajustar \u00E0 cor-chave" })) : null] }));
                            })()] })) : null] }), ch.ativo ? (_jsxs(Secao, { titulo: "Borda do recorte", dica: "Encolher tira a franja verde que sobra em volta do corpo; suavizar evita o contorno serrilhado.", children: [_jsx(Deslizante, { id: `${id}-enc`, rotulo: "Encolher", valor: ch.encolher, min: 0, max: 6, passo: 1, formatar: (v) => `${v} px`, aoMudar: (v) => mudarChroma({ encolher: v }) }), _jsx(Deslizante, { id: `${id}-sb`, rotulo: "Suavizar", valor: ch.suavizarBorda, min: 0, max: 6, passo: 0.1, formatar: (v) => `${dec(v, 1)} px`, aoMudar: (v) => mudarChroma({ suavizarBorda: v }) })] })) : null, ch.ativo ? (_jsx(Secao, { titulo: "Recortar bordas do quadro", dica: "Para cortar o que o verde n\u00E3o cobre: refletores, trip\u00E9, a borda do pano.", children: _jsx("div", { className: "grid grid-cols-2 gap-x-3", children: [
                        ["esq", "Esquerda"],
                        ["dir", "Direita"],
                        ["topo", "Topo"],
                        ["base", "Base"],
                    ].map(([k, rot]) => (_jsx(Deslizante, { id: `${id}-b-${k}`, rotulo: rot, valor: ch.bordas[k], min: 0, max: 0.4, passo: 0.005, formatar: pct, aoMudar: (v) => mudarChroma({ bordas: { ...ch.bordas, [k]: v } }) }, k))) }) })) : null, _jsx(Secao, { titulo: "Ver no monitor", dica: "Matte: branco = int\u00E9rprete, preto = removido; buracos no corpo ou verde sobrando aparecem aqui. Sobre cinza: revela franjas.", children: _jsx(Segmentos, { rotulo: "Visualiza\u00E7\u00E3o da janela", valor: ui.visual, aoMudar: (v) => mudarUi({ visual: v }), opcoes: [
                        ["composicao", "Composição"],
                        ["matte", "Matte"],
                        ["cinza", "Sobre cinza"],
                    ] }) })] }));
    const cor = (_jsxs(_Fragment, { children: [_jsxs(Secao, { titulo: "Reflexo verde (despill)", children: [_jsxs("label", { className: "flex items-center gap-2 text-xs", children: [_jsx("input", { type: "checkbox", checked: ch.despill.ativo, disabled: !ch.ativo, onChange: (e) => mudarChroma({
                                    despill: { ...ch.despill, ativo: e.target.checked },
                                }) }), "Neutralizar o verde refletido na pele e na roupa"] }), ch.ativo && ch.despill.ativo ? (_jsxs("div", { className: "mt-2", children: [_jsx(Deslizante, { id: `${id}-dm`, rotulo: "Mistura", valor: ch.despill.mistura, min: 0, max: 1, passo: 0.05, formatar: (v) => dec(v), aoMudar: (v) => mudarChroma({ despill: { ...ch.despill, mistura: v } }) }), _jsx(Deslizante, { id: `${id}-de`, rotulo: "Expans\u00E3o", valor: ch.despill.expandir, min: 0, max: 1, passo: 0.05, formatar: (v) => dec(v), aoMudar: (v) => mudarChroma({ despill: { ...ch.despill, expandir: v } }) })] })) : null] }), _jsxs(Secao, { titulo: "Corre\u00E7\u00E3o do int\u00E9rprete", dica: "Aplicada depois do recorte: n\u00E3o muda a chave.", children: [_jsx(Deslizante, { id: `${id}-br`, rotulo: "Brilho", valor: j.cor.brilho, min: -0.3, max: 0.3, passo: 0.01, formatar: (v) => (v > 0 ? "+" : "") + dec(v), aoMudar: (v) => mudarCor({ brilho: v }) }), _jsx(Deslizante, { id: `${id}-ct`, rotulo: "Contraste", valor: j.cor.contraste, min: 0.5, max: 1.5, passo: 0.01, formatar: (v) => `${dec(v)}×`, aoMudar: (v) => mudarCor({ contraste: v }) }), _jsx(Deslizante, { id: `${id}-st`, rotulo: "Satura\u00E7\u00E3o", valor: j.cor.saturacao, min: 0, max: 2, passo: 0.01, formatar: (v) => `${dec(v)}×`, aoMudar: (v) => mudarCor({ saturacao: v }) }), _jsx("button", { type: "button", className: "btn-fantasma h-7 px-2 text-2xs", onClick: () => mudar({ cor: JANELA_PADRAO.cor }), children: "Restaurar cor" })] }), _jsx(Secao, { titulo: "Atr\u00E1s do int\u00E9rprete", dica: "A pr\u00E9via aplica a mesma cadeia da entrega (ffmpeg). Medido: 99,99% do alfa id\u00EAntico, diferen\u00E7a m\u00E9dia de cor de ~3 n\u00EDveis em 255.", children: _jsxs("div", { className: "flex items-center gap-3 text-xs", children: [_jsxs("label", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "radio", name: `${id}-fundo`, checked: j.fundo === "transparente", onChange: () => mudar({ fundo: "transparente" }) }), "a pr\u00F3pria imagem"] }), _jsxs("label", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "radio", name: `${id}-fundo`, checked: j.fundo === "solido", onChange: () => mudar({ fundo: "solido" }) }), "cor s\u00F3lida"] }), j.fundo === "solido" ? (_jsx("input", { type: "color", "aria-label": "Cor de fundo da janela", value: j.corFundo, onChange: (e) => mudar({ corFundo: e.target.value.toUpperCase() }), className: "h-6 w-8 rounded border border-paper-400 bg-transparent" })) : null] }) })] }));
    return (_jsx(PainelAbas, { memoria: "libras-direita", rotulo: "Inspetor da janela de Libras", titulo: "Inspetor", acoes: _jsx("button", { type: "button", className: "btn-fantasma h-6 px-2 text-2xs", onClick: () => mudar({
                ...JANELA_PADRAO,
                clipe: j.clipe,
                inicioNaObraMs: j.inicioNaObraMs,
                velocidade: j.velocidade,
                sincronia: j.sincronia,
            }), children: "Restaurar padr\u00E3o" }), abas: [
            {
                id: "janela",
                rotulo: "Janela",
                marca: seguro ? null : "!",
                tom: "aviso",
                conteudo: janela,
            },
            {
                id: "enquadramento",
                rotulo: "Enquadramento",
                conteudo: enquadramento,
            },
            {
                id: "recorte",
                rotulo: "Recorte",
                marca: ch.ativo ? null : "off",
                conteudo: recorte,
            },
            { id: "cor", rotulo: "Cor", conteudo: cor },
        ] }));
}
