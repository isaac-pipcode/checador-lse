import { idSugestao, instantaneo } from './tipos';
import { contarCaracteres, reflowEquilibrado, semMarcacao } from '../core/texto';
/**
 * T2 — Número de linhas (≤ 2).
 * Quando o texto cabe em 2×CPL, propõe reflow tipográfico equilibrado; caso
 * contrário apenas sinaliza, porque a solução exige redução textual (L2).
 */
export const t2 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        if (cue.lines.length <= config.maxLinhas)
            continue;
        const texto = cue.lines.map((l) => l.trim()).join(' ').replace(/\s+/g, ' ');
        const cabe = contarCaracteres(texto, config) <= config.maxCaracteresPorLinha * config.maxLinhas;
        const reflow = cabe ? reflowEquilibrado(semMarcacao(texto), config.maxCaracteresPorLinha) : null;
        out.push({
            id: idSugestao('T2', cue.index),
            ruleId: 'T2',
            cueIndex: cue.index,
            severity: 'erro',
            verifiability: 'deterministica',
            message: reflow
                ? `Legenda com ${cue.lines.length} linhas; o Guia admite no máximo ${config.maxLinhas}. O texto cabe em ${config.maxLinhas} linhas — reflow proposto (sem análise sintática; confira com L1).`
                : `Legenda com ${cue.lines.length} linhas; o Guia admite no máximo ${config.maxLinhas}. O texto não cabe em ${config.maxLinhas}×${config.maxCaracteresPorLinha} caracteres: exige redução textual.`,
            before: instantaneo(cue),
            ...(reflow ? { after: { lines: reflow } } : {}),
            autoFixable: Boolean(reflow),
        });
    }
    return out;
};
