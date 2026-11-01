import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDespachar, useEstado } from '../../state/store';
import { ponte } from '../../desktop/ponte';
import { avaliarMidia } from '../../midia/avaliacao';
import { gerarProxyDe } from '../proxy';
/**
 * Controle de proxy no cabeçalho do monitor: o que é o original, se há proxy,
 * qual está em uso, e a geração com progresso e cancelamento.
 */
export function ControleProxy() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const desktop = ponte();
    const v = estado.video;
    if (!v)
        return null;
    const aval = v.info ? avaliarMidia(v.info) : null;
    const trabalho = v.caminho ? estado.proxies[v.caminho] : undefined;
    async function gerar() {
        if (!v?.caminho)
            return;
        const px = await gerarProxyDe(despachar, v.caminho, estado.projeto.caminho);
        if (px)
            despachar({ tipo: 'videoProxy', proxy: px, usar: true });
    }
    return (_jsxs("span", { className: "flex min-w-0 items-center gap-1.5 normal-case tracking-normal", children: [aval ? (_jsx("span", { className: "hidden truncate font-mono text-2xs font-normal text-navy-500 2xl:inline", title: aval.motivos.join(' '), children: aval.descricao })) : null, v.proxy ? (_jsxs("span", { className: "flex rounded bg-fundo p-0.5", role: "group", "aria-label": "M\u00EDdia no monitor", children: [_jsx("button", { type: "button", className: "segmento h-6 px-2 text-2xs", "aria-pressed": v.usarProxy, onClick: () => despachar({ tipo: 'videoUsarProxy', usar: true }), children: "Proxy" }), _jsx("button", { type: "button", className: "segmento h-6 px-2 text-2xs", "aria-pressed": !v.usarProxy, onClick: () => despachar({ tipo: 'videoUsarProxy', usar: false }), title: aval?.reproduzivel === 'nao' ? 'O original não é reproduzível no monitor' : undefined, children: "Original" })] })) : trabalho && !trabalho.erro ? (_jsxs("span", { className: "flex items-center gap-1 text-2xs font-normal text-navy-700", role: "status", children: [_jsx("progress", { max: 1, value: trabalho.progresso, className: "w-16", "aria-label": "Progresso do proxy" }), "proxy ", Math.round(trabalho.progresso * 100), "%", _jsx("button", { type: "button", className: "btn-fantasma h-6 px-1.5 text-2xs", onClick: () => v.caminho && void desktop?.cancelarProxy(v.caminho), children: "Cancelar" })] })) : desktop && v.caminho && aval && aval.necessidade !== 'dispensavel' ? (_jsx("button", { type: "button", className: "btn-secundario h-6 px-2 text-2xs", onClick: () => void gerar(), title: aval.motivos.join(' '), children: "Gerar proxy" })) : null] }));
}
/**
 * Aviso sobre a imagem quando o monitor está no original e o original não toca
 * (formato de finalização, ou erro de decodificação do motor de vídeo).
 */
export function AvisoOriginal({ erroDeReproducao }) {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const desktop = ponte();
    const v = estado.video;
    if (!v || v.usarProxy)
        return null;
    const aval = v.info ? avaliarMidia(v.info) : null;
    if (!(aval?.reproduzivel === 'nao' || erroDeReproducao))
        return null;
    const trabalho = v.caminho ? estado.proxies[v.caminho] : undefined;
    return (_jsx("div", { className: "absolute inset-0 z-10 flex items-center justify-center bg-preto/85 p-6", role: "status", children: _jsxs("div", { className: "max-w-md text-center text-sm text-cabine-texto", children: [_jsxs("p", { className: "font-semibold", children: [aval ? aval.descricao : 'Formato não reproduzível', aval?.reproduzivel === 'nao' ? ' — não reproduzível no monitor' : ''] }), _jsxs("p", { className: "mt-1 text-xs text-cabine-suave", children: [aval?.motivos[0] ?? 'O motor de vídeo do app não conseguiu decodificar este arquivo.', " O trabalho segue num proxy leve (H.264, 720p); a entrega \u00E9 feita sempre a partir do original."] }), trabalho && !trabalho.erro ? (_jsxs("div", { className: "mt-3", children: [_jsx("progress", { max: 1, value: trabalho.progresso, className: "w-56", "aria-label": "Progresso do proxy" }), _jsxs("p", { className: "text-xs text-cabine-suave", children: ["Gerando proxy\u2026 ", Math.round(trabalho.progresso * 100), "%"] })] })) : v.proxy ? (_jsx("button", { type: "button", className: "btn-primario mt-3", onClick: () => despachar({ tipo: 'videoUsarProxy', usar: true }), children: "Usar o proxy" })) : desktop && v.caminho ? (_jsx("button", { type: "button", className: "btn-primario mt-3", onClick: async () => {
                        const px = await gerarProxyDe(despachar, v.caminho, estado.projeto.caminho);
                        if (px)
                            despachar({ tipo: 'videoProxy', proxy: px, usar: true });
                    }, children: "Gerar proxy" })) : null, trabalho?.erro ? _jsx("p", { className: "mt-2 text-xs text-cabine-erro", children: trabalho.erro }) : null] }) }));
}
