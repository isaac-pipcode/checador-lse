import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Marca do aplicativo: quadro de monitor com as três camadas (legenda, voz, Libras). */
export function Marca({ grande = false }) {
    const t = grande ? 28 : 20;
    return (_jsxs("span", { className: "flex items-center gap-2", children: [_jsxs("svg", { width: t, height: t, viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("rect", { x: "2", y: "4", width: "20", height: "15", rx: "2.5", fill: "none", stroke: "rgb(var(--c-navy))", strokeWidth: "1.6" }), _jsx("rect", { x: "6", y: "14", width: "8", height: "2", rx: "1", fill: "rgb(var(--c-navy-500))" }), _jsx("rect", { x: "15", y: "9", width: "5", height: "8", rx: "1", fill: "rgb(var(--c-terra))" }), _jsx("path", { d: "M5 8.5c1.2-1.4 2.4-1.4 3.6 0", stroke: "rgb(var(--c-ok))", strokeWidth: "1.4", fill: "none", strokeLinecap: "round" })] }), _jsxs("span", { className: `font-semibold tracking-tight ${grande ? 'text-lg' : 'text-sm'}`, children: ["Est\u00FAdio", _jsx("span", { className: "text-terra", children: "\u00B7" }), "A11y"] })] }));
}
