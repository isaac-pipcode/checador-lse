import { idSugestao, instantaneo } from './tipos';
import { duracaoMs, formatarDuracao } from '../core/texto';
/**
 * T4 — Duração máxima.
 * Prática brasileira: até 4 s. Teto absoluto de 6 s ("regra dos seis segundos",
 * d'Ydewalle et al., 1987), acima do qual o espectador tende a reler a legenda.
 */
export const t4 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        const d = duracaoMs(cue);
        if (d <= config.duracaoAvisoMs)
            continue;
        const erro = d > config.duracaoMaximaMs;
        out.push({
            id: idSugestao('T4', cue.index),
            ruleId: 'T4',
            cueIndex: cue.index,
            severity: erro ? 'erro' : 'aviso',
            verifiability: 'deterministica',
            message: erro
                ? `Duração de ${formatarDuracao(d)} acima do teto de ${formatarDuracao(config.duracaoMaximaMs)} (regra dos seis segundos).`
                : `Duração de ${formatarDuracao(d)} acima dos ${formatarDuracao(config.duracaoAvisoMs)} recomendados.`,
            before: instantaneo(cue),
            autoFixable: false,
        });
    }
    return out;
};
