import { idSugestao, instantaneo } from './tipos';
/**
 * C2 — Travessão de diálogo.
 * O Guia grafa o traço colado à palavra (`-Fala`), e, havendo dois falantes na
 * mesma legenda, ambas as linhas recebem traço.
 */
const RE_TRACO_INICIAL = /^(\s*)([-–—])(\s+)(\S)/;
const RE_TEM_TRACO = /^\s*[-–—]/;
export const c2 = (cues, config) => {
    const out = [];
    if (!config.checarTracoDialogo)
        return out;
    for (const cue of cues) {
        const linhasComTraco = cue.lines.filter((l) => RE_TEM_TRACO.test(l)).length;
        let espacoDepois = false;
        let novas = cue.lines.map((l) => {
            if (RE_TRACO_INICIAL.test(l)) {
                espacoDepois = true;
                return l.replace(RE_TRACO_INICIAL, '$1$2$4');
            }
            return l;
        });
        // Diálogo marcado em apenas uma das duas linhas: o Guia pede traço em ambas.
        const faltaNaOutra = cue.lines.length === 2 && linhasComTraco === 1 && cue.lines[0].trim() !== '' && cue.lines[1].trim() !== '';
        if (faltaNaOutra) {
            novas = novas.map((l) => (RE_TEM_TRACO.test(l) ? l : l.replace(/^(\s*)/, '$1-')));
        }
        if (!espacoDepois && !faltaNaOutra)
            continue;
        const partes = [];
        if (espacoDepois)
            partes.push('há espaço entre o traço e a palavra');
        if (faltaNaOutra)
            partes.push('apenas uma das duas falas está marcada com traço');
        out.push({
            id: idSugestao('C2', cue.index),
            ruleId: 'C2',
            cueIndex: cue.index,
            severity: 'aviso',
            verifiability: 'deterministica',
            message: `Travessão de diálogo: ${partes.join(' e ')}; o Guia grafa o traço colado à palavra e em ambas as falas.`,
            ...(faltaNaOutra ? { confidence: 0.7 } : {}),
            before: instantaneo(cue),
            after: { lines: novas },
            autoFixable: true,
        });
    }
    return out;
};
