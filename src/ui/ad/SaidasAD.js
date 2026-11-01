import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useMemo, useState } from 'react';
import { useEstado, useResultadoFinal } from '../../state/store';
import { ponte } from '../../desktop/ponte';
import { clipesDosBlocos, curvaDeDucking } from '../../ad/mixagem';
import { bytesDoTake } from '../../ad/audio';
import { roteiroCsv, roteiroTexto, roteiroVtt } from '../../ad/roteiro';
import { verificarBloco, nivelDoBloco } from '../../ad/verificacoes';
import { baixar } from '../comum';
/**
 * Saídas da AD: roteiro (texto para o locutor, VTT de descrições, CSV) e, no
 * desktop, a renderização: mixagem WAV 24 bits/48 kHz, trilha de AD isolada e
 * vídeo com faixa extra, com medição de loudness (EBU R128).
 */
export function SaidasAD() {
    const id = useId();
    const { estado } = useEstado();
    const final = useResultadoFinal();
    const { blocos, parametros } = estado.ad;
    const desktop = ponte();
    const [saidas, setSaidas] = useState({ mixagem: true, trilhaAd: true, video: true });
    const [progresso, setProgresso] = useState(null);
    const [relatorio, setRelatorio] = useState(null);
    const [erro, setErro] = useState(null);
    const nome = (estado.video?.nome ?? estado.arquivoNome ?? 'obra').replace(/\.[^.]+$/, '');
    const comErro = useMemo(() => blocos.filter((b) => nivelDoBloco(verificarBloco(b, final.cues, parametros)) === 'erro').length, [blocos, final.cues, parametros]);
    const gravados = blocos.filter((b) => b.takeAtivoId).length;
    async function renderizar() {
        if (!desktop || !estado.video?.caminho)
            return;
        setErro(null);
        setRelatorio(null);
        const clipes = clipesDosBlocos(blocos, parametros);
        const takes = [];
        for (const c of clipes) {
            const bytes = await bytesDoTake(c.takeId);
            if (bytes)
                takes.push({ id: c.takeId, bytes });
        }
        setProgresso({ f: 0, etapa: 'Preparando' });
        try {
            const r = await desktop.renderizar({
                videoCaminho: estado.video.caminho,
                nomeBase: nome,
                duracaoMs: estado.mapa?.duracaoMs ?? 0,
                clipes,
                curva: curvaDeDucking(clipes, parametros),
                takes,
                saidas,
            }, (f, etapa) => setProgresso({ f, etapa }));
            setRelatorio(r);
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : String(e));
        }
        finally {
            setProgresso(null);
        }
    }
    return (_jsxs("section", { "aria-labelledby": `${id}-t`, className: "px-3 py-3", children: [_jsx("h2", { id: `${id}-t`, className: "secao-titulo", children: "Sa\u00EDdas da audiodescri\u00E7\u00E3o" }), _jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "cartao", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Roteiro" }), _jsx("p", { className: "mt-1 text-xs text-navy-500", children: "S\u00F3 blocos com texto. O VTT usa a posi\u00E7\u00E3o das grava\u00E7\u00F5es, quando houver, e serve a players que leem descri\u00E7\u00F5es por s\u00EDntese de voz." }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", className: "btn-secundario", onClick: () => baixar(`${nome}-roteiro-ad.txt`, roteiroTexto(blocos, nome), 'text/plain'), children: "Texto para o locutor" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => baixar(`${nome}-descricoes.vtt`, roteiroVtt(blocos), 'text/vtt'), children: "WebVTT de descri\u00E7\u00F5es" }), _jsx("button", { type: "button", className: "btn-secundario", onClick: () => baixar(`${nome}-roteiro-ad.csv`, roteiroCsv(blocos), 'text/csv'), children: "CSV" })] })] }), _jsxs("div", { className: "cartao", children: [_jsx("h3", { className: "text-sm font-semibold", children: "Mixagem" }), !desktop ? (_jsx("p", { className: "mt-1 text-sm text-navy-700", children: "A renderiza\u00E7\u00E3o usa o ffmpeg do aplicativo desktop. No navegador, a pr\u00E9via de mixagem funciona; o arquivo final, n\u00E3o." })) : !estado.video?.caminho ? (_jsxs("p", { className: "mt-1 text-sm text-navy-700", children: ["Abra o v\u00EDdeo pelo bot\u00E3o ", _jsx("em", { children: "Abrir v\u00EDdeo\u2026" }), " para renderizar."] })) : (_jsxs(_Fragment, { children: [_jsxs("fieldset", { className: "mt-1", children: [_jsx("legend", { className: "sr-only", children: "Arquivos a gerar" }), [
                                                ['mixagem', 'Mixagem completa (WAV 24 bits, 48 kHz, estéreo)'],
                                                ['trilhaAd', 'Trilha de AD isolada (WAV, para finalizar em outro programa)'],
                                                ['video', 'Vídeo com faixa de áudio extra “Audiodescrição” (MKV)'],
                                            ].map(([k, rotulo]) => (_jsxs("label", { className: "flex items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: saidas[k], onChange: (e) => setSaidas({ ...saidas, [k]: e.target.checked }) }), rotulo] }, k)))] }), _jsxs("p", { className: "mt-2 text-xs text-navy-700", children: [gravados, " de ", blocos.length, " blocos gravados entram na mixagem.", comErro > 0 ? (_jsxs("strong", { className: "text-bad", children: [" ", comErro, " bloco(s) com erro \u2014 revise antes de entregar."] })) : null] }), _jsx("button", { type: "button", className: "btn-primario mt-2", disabled: progresso !== null || gravados === 0 || !(saidas.mixagem || saidas.trilhaAd || saidas.video), onClick: () => void renderizar(), children: "Renderizar\u2026" }), progresso ? (_jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs", role: "status", children: [_jsx("progress", { max: 1, value: progresso.f, className: "w-40", "aria-label": "Progresso da renderiza\u00E7\u00E3o" }), progresso.etapa, " \u00B7 ", Math.round(progresso.f * 100), "%"] })) : null] })), erro ? _jsxs("p", { className: "mt-2 text-sm text-bad", children: ["Erro: ", erro] }) : null, relatorio ? (_jsxs("div", { className: "mt-3 rounded border border-ok bg-ok-100 p-2 text-sm text-ok", role: "status", children: [_jsxs("p", { className: "font-medium", children: [_jsx("span", { "aria-hidden": "true", children: "\u2713 " }), "Renderizado em ", relatorio.pasta] }), _jsx("ul", { className: "mt-1 list-disc pl-5 text-xs text-navy", children: relatorio.arquivos.map((a) => (_jsx("li", { children: a.split(/[\\/]/).pop() }, a))) }), relatorio.loudness ? (_jsxs("p", { className: "mt-1 text-xs text-navy", children: ["Loudness integrada da mixagem:", ' ', _jsxs("strong", { children: [relatorio.loudness.integradoLufs?.toFixed(1).replace('.', ',') ?? '—', " LUFS"] }), " \u00B7 pico verdadeiro ", relatorio.loudness.picoVerdadeiroDbtp?.toFixed(1).replace('.', ',') ?? '—', " dBTP. Medida apenas, sem normaliza\u00E7\u00E3o: confira com a especifica\u00E7\u00E3o de entrega."] })) : null, relatorio.avisos.length > 0 ? (_jsx("ul", { className: "mt-1 text-xs text-warn", children: relatorio.avisos.map((a) => (_jsxs("li", { children: ["! ", a] }, a))) })) : null, desktop && relatorio.arquivos[0] ? (_jsx("button", { type: "button", className: "btn-fantasma mt-1 text-xs", onClick: () => void desktop.mostrarNaPasta(relatorio.arquivos[0]), children: "Mostrar na pasta" })) : null] })) : null] })] })] }));
}
