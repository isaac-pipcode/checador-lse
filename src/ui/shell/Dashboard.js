import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { ponte } from '../../desktop/ponte';
import { useAcoesProjeto } from '../Projeto';
import { Marca } from './Marca';
import { SeletorTema } from './BarraSuperior';
const quando = (iso) => {
    const d = new Date(iso);
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (dias <= 0)
        return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (dias === 1)
        return 'ontem';
    if (dias < 7)
        return `há ${dias} dias`;
    return d.toLocaleDateString('pt-BR');
};
/**
 * Dashboard de projetos: recentes (com miniatura e o estado de cada etapa),
 * novo projeto e abrir de outro lugar. No navegador, sem disco, oferece uma
 * sessão rápida.
 */
export function Dashboard() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const acoes = useAcoesProjeto();
    const desktop = ponte();
    const [recentes, setRecentes] = useState(desktop ? null : []);
    const [busca, setBusca] = useState('');
    const [criando, setCriando] = useState(false);
    const [erro, setErro] = useState(null);
    const idBusca = useId();
    // React 18 não repassa `inert`: aplica-se direto no elemento
    const fundo = useRef(null);
    useEffect(() => {
        if (fundo.current)
            fundo.current.inert = criando;
    }, [criando]);
    const recarregar = () => desktop?.projetosRecentes().then(setRecentes, () => setRecentes([]));
    useEffect(() => {
        void recarregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const filtrados = useMemo(() => (recentes ?? []).filter((p) => `${p.nome} ${p.video ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase())), [recentes, busca]);
    async function tentar(f) {
        setErro(null);
        try {
            await f();
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : String(e));
        }
    }
    const emAberto = estado.projeto.caminho || estado.video || estado.cues.length > 0;
    return (_jsxs("div", { className: "flex h-screen flex-col bg-fundo text-navy", children: [_jsxs("div", { ref: fundo, className: "flex min-h-0 flex-1 flex-col", children: [_jsxs("header", { className: "flex h-14 shrink-0 items-center gap-4 border-b border-paper-400 bg-paper px-6", children: [_jsx(Marca, { grande: true }), _jsx("span", { className: "text-xs text-navy-500", children: "LSE \u00B7 Audiodescri\u00E7\u00E3o \u00B7 Libras" }), _jsx("div", { className: "ml-auto flex items-center gap-2", children: _jsx(SeletorTema, {}) })] }), _jsx("main", { id: "conteudo", className: "min-h-0 flex-1 overflow-auto", children: _jsxs("div", { className: "mx-auto max-w-6xl px-6 py-8", children: [_jsxs("div", { className: "flex flex-wrap items-end gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Projetos" }), _jsx("p", { className: "mt-1 text-sm text-navy-500", children: "Cada projeto re\u00FAne uma obra e suas tr\u00EAs camadas de acessibilidade." })] }), _jsxs("div", { className: "ml-auto flex flex-wrap gap-2", children: [emAberto ? (_jsx("button", { type: "button", className: "btn-secundario", onClick: () => despachar({ tipo: 'navegar', pagina: 'lse' }), children: "Voltar ao projeto aberto" })) : null, desktop ? (_jsx("button", { type: "button", className: "btn-secundario", onClick: () => void tentar(acoes.abrir), children: "Abrir\u2026" })) : null, _jsx("button", { type: "button", className: "btn-primario", onClick: () => setCriando(true), children: "+ Novo projeto" })] })] }), erro ? (_jsx("p", { role: "alert", className: "mt-4 rounded border border-bad bg-bad-100 px-3 py-2 text-sm text-bad", children: erro })) : null, !desktop ? (_jsxs("div", { className: "mt-6 cartao", children: [_jsx("h2", { className: "font-semibold", children: "Modo navegador" }), _jsx("p", { className: "mt-1 text-sm text-navy-700", children: "Sem o aplicativo desktop, projetos n\u00E3o s\u00E3o salvos em disco e a renderiza\u00E7\u00E3o (mixagem, Libras, entrega) n\u00E3o est\u00E1 dispon\u00EDvel. A revis\u00E3o de LSE e a pr\u00E9via funcionam numa sess\u00E3o r\u00E1pida." }), _jsx("button", { type: "button", className: "btn-primario mt-3", onClick: () => void acoes.novo('Sessão rápida'), children: "Come\u00E7ar sess\u00E3o r\u00E1pida" })] })) : null, desktop ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mt-8 flex items-center gap-3", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-navy-500", children: "Recentes" }), _jsx("label", { htmlFor: idBusca, className: "sr-only-focusable", children: "Filtrar projetos" }), _jsx("input", { id: idBusca, className: "campo ml-auto max-w-xs", placeholder: "Filtrar por nome ou v\u00EDdeo\u2026", value: busca, onChange: (e) => setBusca(e.target.value) })] }), recentes === null ? (_jsx("p", { className: "mt-6 text-sm text-navy-500", children: "Carregando\u2026" })) : filtrados.length === 0 ? (_jsxs("div", { className: "mt-6 rounded-md border border-dashed border-paper-400 p-10 text-center", children: [_jsx("p", { className: "text-navy-700", children: busca ? 'Nenhum projeto corresponde ao filtro.' : 'Nenhum projeto ainda.' }), !busca ? (_jsx("button", { type: "button", className: "btn-primario mt-4", onClick: () => setCriando(true), children: "Criar o primeiro projeto" })) : null] })) : (_jsx("ul", { className: "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: filtrados.map((p) => (_jsx("li", { children: _jsx(CartaoProjeto, { p: p, aoAbrir: () => void tentar(() => acoes.abrirEm(p.caminho)), aoEsquecer: async () => {
                                                        await desktop.esquecerProjeto(p.caminho);
                                                        await recarregar();
                                                    } }) }, p.caminho))) }))] })) : null] }) })] }), criando ? _jsx(DialogoNovo, { aoFechar: () => setCriando(false), aoErro: setErro }) : null] }));
}
function CartaoProjeto({ p, aoAbrir, aoEsquecer }) {
    const etapas = [
        { rotulo: 'LSE', texto: p.lse ? `${p.lse.legendas} legendas` : '—', feito: p.lse ? true : null },
        {
            rotulo: 'AD',
            texto: p.ad.blocos ? `${p.ad.gravados}/${p.ad.blocos} gravados` : '—',
            feito: p.ad.blocos ? p.ad.gravados === p.ad.blocos : null,
        },
        { rotulo: 'Libras', texto: p.libras.clipe ? (p.libras.sincronizado ? 'sincronizada' : 'sem sincronia') : '—', feito: p.libras.clipe ? p.libras.sincronizado : null },
    ];
    return (_jsxs("article", { className: "group overflow-hidden rounded-md border border-paper-400 bg-paper transition-colors hover:border-navy-500", children: [_jsxs("button", { type: "button", className: "block w-full text-left", onClick: aoAbrir, "aria-label": `Abrir o projeto ${p.nome}`, children: [_jsxs("div", { className: "relative aspect-video bg-preto", children: [p.miniatura ? (_jsx("img", { src: p.miniatura, alt: "", className: "h-full w-full object-cover opacity-90 group-hover:opacity-100" })) : (_jsx("div", { className: "flex h-full items-center justify-center text-2xs text-cabine-suave", children: "sem miniatura" })), _jsx("span", { className: "absolute bottom-1.5 left-1.5 rounded bg-preto/75 px-1.5 text-2xs text-cabine-texto", children: quando(p.atualizadoEm) })] }), _jsxs("div", { className: "px-3 pb-2 pt-2.5", children: [_jsx("h3", { className: "truncate text-sm font-semibold", children: p.nome }), _jsx("p", { className: "truncate text-2xs text-navy-500", children: p.video ?? 'sem vídeo' }), _jsx("ul", { className: "mt-2 space-y-0.5 text-2xs", children: etapas.map((e) => (_jsxs("li", { className: "flex items-center gap-1.5", children: [_jsx("span", { "aria-hidden": "true", className: e.feito === null ? 'text-navy-500' : e.feito ? 'text-ok' : 'text-warn', children: e.feito === null ? '○' : e.feito ? '●' : '◐' }), _jsx("span", { className: "w-10 font-medium text-navy-700", children: e.rotulo }), _jsx("span", { className: "text-navy-500", children: e.texto })] }, e.rotulo))) })] })] }), _jsx("div", { className: "flex justify-end border-t border-paper-400 px-2 py-1", children: _jsx("button", { type: "button", className: "btn-fantasma h-6 px-2 text-2xs", onClick: aoEsquecer, "aria-label": `Remover ${p.nome} da lista (o arquivo continua no disco)`, children: "Remover da lista" }) })] }));
}
function DialogoNovo({ aoFechar, aoErro }) {
    const acoes = useAcoesProjeto();
    const [nome, setNome] = useState('');
    const id = useId();
    useEffect(() => {
        const t = (e) => e.key === 'Escape' && aoFechar();
        window.addEventListener('keydown', t);
        return () => window.removeEventListener('keydown', t);
    }, [aoFechar]);
    async function criar() {
        try {
            const ok = await acoes.novo(nome.trim() || 'Projeto sem título');
            if (ok)
                aoFechar();
        }
        catch (e) {
            aoErro(e instanceof Error ? e.message : String(e));
            aoFechar();
        }
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-preto/60", onClick: aoFechar, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": `${id}-t`, className: "w-full max-w-md rounded-lg border border-paper-400 bg-paper p-5 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { id: `${id}-t`, className: "text-lg font-semibold", children: "Novo projeto" }), _jsxs("form", { className: "mt-4", onSubmit: (e) => {
                        e.preventDefault();
                        void criar();
                    }, children: [_jsx("label", { className: "rotulo", htmlFor: `${id}-nome`, children: "Nome da obra ou do projeto" }), _jsx("input", { id: `${id}-nome`, className: "campo mt-1 text-sm", autoFocus: true, value: nome, onChange: (e) => setNome(e.target.value), placeholder: "Ex.: Curta \u201CA Entrega\u201D \u2014 vers\u00E3o acess\u00EDvel" }), _jsx("p", { className: "mt-2 text-xs text-navy-500", children: ponte()
                                ? 'Em seguida você escolhe a pasta: o estúdio cria nela uma subpasta com o projeto e as gravações.'
                                : 'No navegador, o projeto vive só nesta sessão.' }), _jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "btn-fantasma", onClick: aoFechar, children: "Cancelar" }), _jsx("button", { type: "submit", className: "btn-primario", children: "Criar" })] })] })] }) }));
}
