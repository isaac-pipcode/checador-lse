import { idSugestao, instantaneo } from './tipos';
import { duracaoMs, formatarDuracao } from '../core/texto';
/**
 * T3 — Duração mínima (≥ 1 s).
 * Abaixo disso a legenda "pisca" e não é lida. Não há correção automática:
 * esticar a legenda pode invadir a legenda seguinte ou o corte de cena.
 */
export const t3 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        const d = duracaoMs(cue);
        if (d < config.duracaoMinimaMs) {
            out.push({
                id: idSugestao('T3', cue.index),
                ruleId: 'T3',
                cueIndex: cue.index,
                severity: 'erro',
                verifiability: 'deterministica',
                message: `Duração de ${formatarDuracao(d)}; o mínimo para leitura é ${formatarDuracao(config.duracaoMinimaMs)}.`,
                before: instantaneo(cue),
                autoFixable: false,
            });
        }
    }
    return out;
};
