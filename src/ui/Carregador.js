import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useId, useRef, useState } from 'react';
import { decodeBuffer } from '../parser/encoding';
import { parseSubtitle } from '../parser/srt';
import { useDespachar } from '../state/store';
/** Tela inicial: carregamento do arquivo. Nada sai do navegador. */
export function Carregador() {
    const despachar = useDespachar();
    const inputId = useId();
    const [arrastando, setArrastando] = useState(false);
    const [erro, setErro] = useState(null);
    const input = useRef(null);
    const processar = useCallback(async (arquivo) => {
        setErro(null);
        if (!/\.(srt|vtt|txt)$/i.test(arquivo.name)) {
            setErro('Formato não reconhecido. Envie um arquivo .srt ou .vtt.');
            return;
        }
        try {
            const buffer = await arquivo.arrayBuffer();
            const { texto, encoding, avisos } = decodeBuffer(buffer);
            const r = parseSubtitle(texto);
            despachar({
                tipo: 'carregar',
                nome: arquivo.name,
                encoding,
                cues: r.cues,
                erros: r.erros,
                avisos: [...avisos, ...r.avisos],
            });
        }
        catch (e) {
            setErro(`Não foi possível ler o arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
        }
    }, [despachar]);
    return (_jsxs("section", { "aria-labelledby": "titulo-carregar", className: "p-4", children: [_jsx("h2", { id: "titulo-carregar", className: "text-base font-semibold", children: "Carregar legenda" }), _jsxs("p", { className: "mt-2 text-navy-700", children: ["O arquivo \u00E9 lido e analisado ", _jsx("strong", { children: "dentro do seu navegador" }), ". Nada \u00E9 enviado a nenhum servidor \u2014 nem o texto, nem os tempos, nem o nome do arquivo."] }), _jsxs("div", { className: `mt-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${arrastando ? 'border-terra bg-paper-200' : 'border-navy-500 bg-paper-200'}`, onDragOver: (e) => {
                    e.preventDefault();
                    setArrastando(true);
                }, onDragLeave: () => setArrastando(false), onDrop: (e) => {
                    e.preventDefault();
                    setArrastando(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f)
                        void processar(f);
                }, children: [_jsx("p", { className: "text-navy-700", children: "Arraste o arquivo aqui ou use o seletor abaixo." }), _jsxs("div", { className: "mt-4 flex flex-col items-center gap-2", children: [_jsx("label", { className: "rotulo", htmlFor: inputId, children: "Arquivo de legenda (.srt ou .vtt)" }), _jsx("input", { ref: input, id: inputId, type: "file", accept: ".srt,.vtt,text/plain", className: "campo max-w-md file:mr-3 file:rounded file:border-0 file:bg-paper-200 file:px-3 file:py-1 file:text-navy", onChange: (e) => {
                                    const f = e.target.files?.[0];
                                    if (f)
                                        void processar(f);
                                } })] })] }), erro ? (_jsxs("p", { role: "alert", className: "mt-4 rounded border border-bad bg-bad-100 px-3 py-2 text-bad", children: [_jsx("span", { "aria-hidden": "true", children: "\u2715 " }), erro] })) : null, _jsxs("div", { className: "mt-8 cartao", children: [_jsx("h3", { className: "font-semibold", children: "O que este checador faz" }), _jsxs("p", { className: "mt-2 text-sm text-navy-700", children: ["Confere a legenda contra os par\u00E2metros de Legendagem para Surdos e Ensurdecidos do", ' ', _jsx("em", { children: "Guia para Produ\u00E7\u00F5es Audiovisuais Acess\u00EDveis" }), " (MinC/SAv, 2016) e apresenta cada n\u00E3o-conformidade como uma sugest\u00E3o que voc\u00EA aprova, rejeita ou edita. O arquivo final cont\u00E9m ", _jsx("strong", { children: "apenas" }), " o que voc\u00EA aprovou."] }), _jsx("p", { className: "mt-2 text-sm text-navy-700", children: "Cada apontamento declara como foi obtido: verifica\u00E7\u00E3o determin\u00EDstica, infer\u00EAncia assistida (com grau de confian\u00E7a) ou pend\u00EAncia que s\u00F3 a revis\u00E3o humana resolve." })] })] }));
}
