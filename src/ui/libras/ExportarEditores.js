import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useState } from "react";
import { useEstado } from "../../state/store";
import { ponte } from "../../desktop/ponte";
import { useVideo } from "../contextoVideo";
/**
 * Exportação da sincronia para Premiere e Resolve: a Libras tratada com alfa
 * (ProRes 4444, quadro inteiro, alinhada ao quadro 0) e a sequência em XML.
 */
export function ExportarEditores() {
    const { estado } = useEstado();
    const { duracaoMs } = useVideo();
    const desktop = ponte();
    const [formatos, setFormatos] = useState({ xmeml: true, fcpxml: true });
    const [incluirBruto, setIncluirBruto] = useState(true);
    const [progresso, setProgresso] = useState(null);
    const [rel, setRel] = useState(null);
    const [erro, setErro] = useState(null);
    const j = estado.libras;
    const pronto = !!desktop && !!estado.video?.caminho && !!j.clipe?.caminho;
    const comDeriva = Math.abs(j.velocidade - 1) > 1e-6;
    const idFalta = useId();
    async function exportar() {
        if (!desktop || !estado.video?.caminho || !j.clipe?.caminho)
            return;
        setErro(null);
        setRel(null);
        setProgresso({ f: 0, etapa: "Preparando" });
        try {
            const { clipe, inicioNaObraMs, ...janela } = j;
            const r = await desktop.exportarParaEditores({
                videoCaminho: estado.video.caminho,
                nomeBase: (estado.projeto.nome || estado.video.nome).replace(/\.[^.]+$/, ""),
                duracaoMs,
                libras: { caminho: clipe.caminho, inicioNaObraMs, janela },
                formatos,
                incluirBruto: incluirBruto && !comDeriva,
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
    const falta = !desktop
        ? "Só no aplicativo desktop."
        : !estado.video?.caminho
            ? "Falta o vídeo da obra."
            : !j.clipe?.caminho
                ? "Falta o clipe do intérprete."
                : !(formatos.xmeml || formatos.fcpxml)
                    ? "Escolha um formato."
                    : null;
    const nomeArq = (a) => a.split(/[\\/]/).pop() ?? a;
    return (_jsxs("div", { className: "text-xs", children: [_jsxs("fieldset", { children: [_jsx("legend", { className: "sr-only", children: "Formatos da sequ\u00EAncia" }), _jsx(Opcao, { marcado: formatos.xmeml, aoMudar: (v) => setFormatos({ ...formatos, xmeml: v }), rotulo: "Premiere Pro", formato: "XML" }), _jsx(Opcao, { marcado: formatos.fcpxml, aoMudar: (v) => setFormatos({ ...formatos, fcpxml: v }), rotulo: "DaVinci Resolve", formato: "FCPXML" }), _jsx(Opcao, { marcado: incluirBruto && !comDeriva, desabilitado: comDeriva, aoMudar: setIncluirBruto, rotulo: "Clipe bruto na V3", formato: comDeriva ? "fora: velocidade ≠ 1" : "desativado", titulo: comDeriva
                            ? `Com velocidade corrigida (×${j.velocidade.toFixed(5).replace(".", ",")}) o bruto não vai: a mudança de velocidade não se transfere com segurança entre editores. A V2 já sai conformada.`
                            : "Referência para refazer o chroma no editor." })] }), _jsx("button", { type: "button", className: "btn-secundario mt-2 w-full justify-center", disabled: !pronto || progresso !== null || !(formatos.xmeml || formatos.fcpxml), "aria-describedby": falta ? `${idFalta}` : undefined, onClick: () => void exportar(), children: "Exportar\u2026" }), falta && !rel ? (_jsx("p", { id: idFalta, className: "mt-1 text-2xs text-navy-500", children: falta })) : null, progresso ? (_jsxs("div", { className: "mt-2 text-2xs", role: "status", children: [_jsx("progress", { max: 1, value: progresso.f, className: "w-full", "aria-label": "Progresso da exporta\u00E7\u00E3o" }), progresso.etapa, " \u00B7 ", Math.round(progresso.f * 100), "%"] })) : null, erro ? _jsxs("p", { className: "mt-2 text-bad", children: ["Erro: ", erro] }) : null, rel ? (_jsxs("div", { className: "mt-2", role: "status", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "chip border-ok bg-ok-100 text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713" }), " ", rel.arquivos.length, " arquivos \u00B7", " ", rel.cadencia.replace("/1", ""), " qd/s"] }), _jsx("button", { type: "button", className: "btn-fantasma ml-auto h-6 px-2 text-2xs", onClick: () => void desktop?.mostrarNaPasta(rel.arquivos[0]), children: "Mostrar na pasta" })] }), rel.avisos.map((a) => (_jsxs("p", { className: "mt-1 text-2xs text-warn", children: [_jsx("span", { "aria-hidden": "true", children: "! " }), a] }, a))), _jsxs("details", { className: "mt-1 text-2xs", children: [_jsx("summary", { className: "cursor-pointer text-navy-500", children: "Arquivos" }), _jsx("ul", { className: "mt-1 space-y-0.5 text-navy-700", children: rel.arquivos.map((a) => (_jsx("li", { className: "truncate", title: a, children: nomeArq(a) }, a))) })] })] })) : null] }));
}
function Opcao({ marcado, desabilitado, aoMudar, rotulo, formato, titulo, }) {
    return (_jsxs("label", { className: `flex h-7 items-center gap-2 ${desabilitado ? "opacity-60" : ""}`, title: titulo, children: [_jsx("input", { type: "checkbox", checked: marcado, disabled: desabilitado, onChange: (e) => aoMudar(e.target.checked) }), _jsx("span", { className: "text-navy", children: rotulo }), _jsx("span", { className: "ml-auto font-mono text-2xs text-navy-500", children: formato })] }));
}
/** Explicação da seção, mostrada sob demanda no "?" do cabeçalho. */
export const DICA_EXPORTAR = (_jsx(_Fragment, { children: "Gera a Libras j\u00E1 tratada e sincronizada, com fundo transparente (ProRes 4444), e uma sequ\u00EAncia com a obra na V1 e a Libras na V2. XML: Premiere e Resolve. FCPXML: Resolve e Final Cut." }));
