import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { serializarSrt, serializarVtt } from '../export/serializar';
import { montarRelatorio, relatorioMarkdown, nomeArquivoSaida } from '../export/relatorio';
function baixar(nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
export function Exportar() {
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const [feito, setFeito] = useState(null);
    const nome = estado.arquivoNome ?? 'legenda.srt';
    const pendenciasManuais = useMemo(() => Object.values(estado.review).filter((i) => i.suggestion.verifiability === 'manual' && i.decision === 'pendente').length, [estado.review]);
    const remanescentes = final.remanescentes.filter((s) => s.severity !== 'revisao_manual');
    const errosRemanescentes = remanescentes.filter((s) => s.severity === 'erro').length;
    const relatorio = useMemo(() => montarRelatorio({
        arquivo: nome,
        config: estado.config,
        cuesOriginais: estado.cues,
        cuesFinais: final.cues,
        sugestoes: estado.sugestoes,
        review: estado.review,
        sugestoesRemanescentes: final.remanescentes,
        conflitos: final.conflitos,
        mapa: estado.mapa,
    }), [nome, estado.config, estado.cues, estado.sugestoes, estado.review, final, estado.mapa]);
    function gerar(formatos) {
        if (formatos.srt)
            baixar(nomeArquivoSaida(nome, '-revisado', 'srt'), serializarSrt(final.cues), 'text/plain');
        if (formatos.vtt)
            baixar(nomeArquivoSaida(nome, '-revisado', 'vtt'), serializarVtt(final.cues), 'text/vtt');
        if (formatos.md)
            baixar(nomeArquivoSaida(nome, '-relatorio-qa', 'md'), relatorioMarkdown(relatorio), 'text/markdown');
        if (formatos.json)
            baixar(nomeArquivoSaida(nome, '-relatorio-qa', 'json'), JSON.stringify(relatorio, null, 2), 'application/json');
        setFeito(new Date().toLocaleTimeString('pt-BR'));
    }
    const [vtt, setVtt] = useState(false);
    return (_jsxs("section", { "aria-labelledby": "titulo-exportar", className: "p-3", children: [_jsx("h2", { id: "titulo-exportar", className: "secao-titulo", children: "Gerar legenda final" }), _jsxs("p", { className: "mt-2 text-sm text-navy-700", children: ["Ser\u00E3o aplicadas ", _jsx("strong", { children: final.aplicadas.length }), " altera\u00E7\u00E3o(\u00F5es) \u2014 apenas as aprovadas ou editadas por voc\u00EA. O arquivo de entrada permanece intacto; o download acontece no seu navegador, sem upload."] }), _jsxs("ul", { className: "mt-3 space-y-1 text-sm", children: [_jsxs("li", { className: errosRemanescentes > 0 ? 'text-bad' : 'text-ok', children: [_jsx("span", { "aria-hidden": "true", children: errosRemanescentes > 0 ? '✕ ' : '✓ ' }), errosRemanescentes, " erro(s) permanecem no arquivo gerado", remanescentes.length - errosRemanescentes > 0
                                ? `, além de ${remanescentes.length - errosRemanescentes} aviso(s)`
                                : '', "."] }), _jsxs("li", { className: pendenciasManuais > 0 ? 'text-warn' : 'text-ok', children: [_jsx("span", { "aria-hidden": "true", children: pendenciasManuais > 0 ? '! ' : '✓ ' }), pendenciasManuais, " pend\u00EAncia(s) de revis\u00E3o manual n\u00E3o confirmada(s)."] }), final.conflitos.length > 0 ? (_jsxs("li", { className: "text-warn", children: [_jsx("span", { "aria-hidden": "true", children: "! " }), final.conflitos.length, " sugest\u00E3o(\u00F5es) aprovadas incidiram sobre a mesma legenda; o relat\u00F3rio registra qual prevaleceu."] })) : null] }), _jsxs("label", { className: "mt-3 flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: vtt, onChange: (e) => setVtt(e.target.checked) }), "Gerar tamb\u00E9m WebVTT"] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: "btn-primario", onClick: () => gerar({ srt: true, vtt, md: true, json: true }), children: "Gerar legenda final e relat\u00F3rio de QA" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => gerar({ srt: true, vtt: false, md: false, json: false }), children: "Somente o .srt" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => gerar({ srt: false, vtt: false, md: true, json: true }), children: "Somente o relat\u00F3rio" })] }), feito ? (_jsxs("p", { role: "status", className: "mt-2 text-sm text-ok", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713 " }), "Arquivos gerados \u00E0s ", feito, "."] })) : null] }));
}
