import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { useAcoesProjeto } from '../Projeto';
import { salvarTema, temaSalvo } from '../tema/tokens';
import { Sobre } from '../Sobre';
import { Marca } from './Marca';
/** Barra superior: projeto, salvar, tema, metodologia. */
export function BarraSuperior() {
    const { estado } = useEstado();
    const despachar = useDespachar();
    const acoes = useAcoesProjeto();
    const [erro, setErro] = useState(null);
    const [sobre, setSobre] = useState(false);
    const nome = estado.projeto.nome || (estado.video?.nome ?? 'Projeto sem título');
    async function salvar(como) {
        setErro(null);
        try {
            await acoes.salvar(como);
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : String(e));
        }
    }
    // Ctrl/⌘+S salva
    useEffect(() => {
        const t = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                void salvar(e.shiftKey);
            }
        };
        window.addEventListener('keydown', t);
        return () => window.removeEventListener('keydown', t);
    });
    return (_jsxs("header", { className: "flex items-center gap-3 border-b border-paper-400 bg-paper px-3", children: [_jsx("a", { href: "#conteudo", className: "sr-only-focusable absolute left-2 top-2 z-50 rounded bg-navy px-3 py-2 text-paper", children: "Pular para o conte\u00FAdo" }), _jsxs("button", { type: "button", className: "flex items-center gap-2 rounded px-1 hover:bg-paper-200", onClick: () => despachar({ tipo: 'navegar', pagina: 'projetos' }), title: "Voltar aos projetos", children: [_jsx(Marca, {}), _jsx("span", { className: "sr-only-focusable", children: " \u2014 voltar aos projetos" })] }), _jsx("span", { className: "text-paper-400", "aria-hidden": "true", children: "/" }), _jsxs("h1", { className: "min-w-0 truncate text-sm font-semibold", children: [nome, estado.projeto.sujo ? (_jsxs("span", { className: "ml-1.5 text-terra", title: "Altera\u00E7\u00F5es n\u00E3o salvas", children: ["\u25CF", _jsx("span", { className: "sr-only-focusable", children: " altera\u00E7\u00F5es n\u00E3o salvas" })] })) : null] }), estado.projeto.caminho ? (_jsx("span", { className: "hidden truncate text-2xs text-navy-500 xl:inline", children: estado.projeto.caminho })) : null, _jsxs("div", { className: "ml-auto flex items-center gap-1", children: [erro ? _jsx("span", { className: "max-w-xs truncate text-xs text-bad", children: erro }) : null, acoes.disponivel ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn-secundario h-7", onClick: () => void salvar(false), title: "Ctrl+S", children: "Salvar" }), _jsx("button", { type: "button", className: "btn-fantasma h-7", onClick: () => void salvar(true), title: "Ctrl+Shift+S", children: "Salvar como\u2026" })] })) : (_jsx("span", { className: "text-2xs text-navy-500", children: "Modo navegador: o projeto n\u00E3o \u00E9 salvo em disco" })), _jsx(SeletorTema, {}), _jsx("button", { type: "button", className: "btn-fantasma h-7", onClick: () => setSobre(true), children: "Metodologia" })] }), sobre ? (_jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": "Sobre e metodologia", className: "fixed inset-0 z-50 overflow-auto bg-fundo/95", children: [_jsx("div", { className: "sticky top-0 flex justify-end p-3", children: _jsx("button", { type: "button", className: "btn-secundario", onClick: () => setSobre(false), autoFocus: true, children: "Fechar (Esc)" }) }), _jsx(FecharComEsc, { aoFechar: () => setSobre(false) }), _jsx(Sobre, {})] })) : null] }));
}
function FecharComEsc({ aoFechar }) {
    useEffect(() => {
        const t = (e) => e.key === 'Escape' && aoFechar();
        window.addEventListener('keydown', t);
        return () => window.removeEventListener('keydown', t);
    }, [aoFechar]);
    return null;
}
export function SeletorTema() {
    const [tema, setTema] = useState(temaSalvo());
    return (_jsx("button", { type: "button", className: "btn-icone h-7 w-7", "aria-label": tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro', title: tema === 'escuro' ? 'Tema claro' : 'Tema escuro', onClick: () => {
            const novo = tema === 'escuro' ? 'claro' : 'escuro';
            salvarTema(novo);
            setTema(novo);
        }, children: _jsx("span", { "aria-hidden": "true", children: tema === 'escuro' ? '☀' : '☾' }) }));
}
