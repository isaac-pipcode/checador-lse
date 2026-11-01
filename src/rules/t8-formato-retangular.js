import { idSugestao, instantaneo } from './tipos';
import { contarCaracteres } from '../core/texto';
/**
 * T8 — Formato retangular.
 * O Guia prefere legendas de duas linhas com comprimentos próximos (formato
 * retangular ou em pirâmide). Desequilíbrio forte é aviso estético; a correção
 * é uma requebra, portanto compete a L1 — aqui não se propõe `after`, para não
 * quebrar sintagma em nome da simetria.
 */
export const t8 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        if (cue.lines.length !== 2)
            continue;
        const a = contarCaracteres(cue.lines[0], config);
        const b = contarCaracteres(cue.lines[1], config);
        const maior = Math.max(a, b);
        if (maior === 0)
            continue;
        const desequilibrio = Math.abs(a - b) / maior;
        if (desequilibrio <= config.desequilibrioMaximo)
            continue;
        out.push({
            id: idSugestao('T8', cue.index),
            ruleId: 'T8',
            cueIndex: cue.index,
            severity: 'aviso',
            verifiability: 'deterministica',
            message: `Linhas muito desiguais (${a} e ${b} caracteres, ${Math.round(desequilibrio * 100)}% de diferença); o Guia recomenda formato retangular. A requebra deve preservar os sintagmas (ver L1).`,
            before: instantaneo(cue),
            autoFixable: false,
        });
    }
    return out;
};
