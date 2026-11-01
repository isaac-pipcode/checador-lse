import { DOCUMENT_SCOPE } from '../model/types';
import { idSugestao } from './tipos';
/**
 * C6 — Exclamação em excesso.
 * Verificação de obra inteira: o ponto de exclamação, na LSE, tende a ser usado
 * como substituto barato da informação prosódica. Acima do limiar configurado,
 * cabe revisão editorial — não há correção automática possível.
 */
export const c6 = (cues, config) => {
    let total = 0;
    const legendas = [];
    for (const cue of cues) {
        const n = (cue.lines.join(' ').match(/!/g) ?? []).length;
        if (n > 0) {
            total += n;
            legendas.push(cue.index);
        }
    }
    if (total <= config.maxExclamacoesPorObra)
        return [];
    const out = [
        {
            id: idSugestao('C6', DOCUMENT_SCOPE),
            ruleId: 'C6',
            cueIndex: DOCUMENT_SCOPE,
            severity: 'aviso',
            verifiability: 'deterministica',
            message: `${total} pontos de exclamação em ${legendas.length} legendas (limiar configurado: ${config.maxExclamacoesPorObra}); avalie se todos são necessários.`,
            before: { lines: [] },
            autoFixable: false,
        },
    ];
    return out;
};
