import { idSugestao, instantaneo } from './tipos';
import { contarCaracteres } from '../core/texto';
/**
 * T1 — Caracteres por linha (≤ 37).
 * Guia MinC/SAv (2016): a linha de legenda não deve ultrapassar 37 caracteres.
 * Não há auto-correção trivial: reduzir ou requebrar é tarefa de L1/L2.
 */
export const t1 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        cue.lines.forEach((linha, i) => {
            const n = contarCaracteres(linha, config);
            if (n > config.maxCaracteresPorLinha) {
                out.push({
                    id: idSugestao('T1', cue.index, `l${i}`),
                    ruleId: 'T1',
                    cueIndex: cue.index,
                    severity: 'erro',
                    verifiability: 'deterministica',
                    message: `Linha ${i + 1} com ${n} caracteres; o Guia limita a ${config.maxCaracteresPorLinha} por linha.`,
                    before: instantaneo(cue),
                    autoFixable: false,
                });
            }
        });
    }
    return out;
};
