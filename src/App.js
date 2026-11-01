import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEstado } from './state/store';
import { Dashboard } from './ui/shell/Dashboard';
import { Espaco } from './ui/shell/Espaco';
/**
 * Raiz: o dashboard de projetos ou o espaço de trabalho (editor). O anúncio
 * para leitores de tela fica fora de ambos, para sobreviver à troca.
 */
export function App() {
    const { estado } = useEstado();
    return (_jsxs(_Fragment, { children: [estado.pagina === 'projetos' ? _jsx(Dashboard, {}) : _jsx(Espaco, {}), _jsx("div", { "aria-live": "polite", "aria-atomic": "true", className: "sr-only-focusable absolute", children: estado.anuncio })] }));
}
