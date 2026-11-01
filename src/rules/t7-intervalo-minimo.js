import { idSugestao, instantaneo } from './tipos';
import { msParaFrames } from '../core/texto';
/**
 * T7 — Intervalo mínimo entre legendas consecutivas (≥ 2 quadros ≈ 83 ms a
 * 24 fps). Sem esse respiro o espectador não percebe a troca de legenda
 * ("cintilação"). Só se aplica quando não há sobreposição (T6 trata disso).
 */
export const t7 = (cues, config) => {
    const out = [];
    for (let i = 0; i + 1 < cues.length; i++) {
        const atual = cues[i];
        const proxima = cues[i + 1];
        const intervalo = proxima.startMs - atual.endMs;
        if (intervalo < 0)
            continue; // sobreposição: responsabilidade de T6
        if (intervalo >= config.intervaloMinimoMs)
            continue;
        const novoFim = proxima.startMs - config.intervaloMinimoMs;
        const cabe = novoFim - atual.startMs >= config.duracaoMinimaMs;
        out.push({
            id: idSugestao('T7', atual.index),
            ruleId: 'T7',
            cueIndex: atual.index,
            severity: 'aviso',
            verifiability: 'deterministica',
            message: `Intervalo de ${intervalo} ms até a legenda ${proxima.index}; o mínimo é ${config.intervaloMinimoMs} ms (${msParaFrames(config.intervaloMinimoMs, config.fps)} quadros a ${config.fps} fps).`,
            before: instantaneo(atual),
            ...(cabe
                ? { after: { lines: [...atual.lines], startMs: atual.startMs, endMs: novoFim } }
                : {}),
            autoFixable: cabe,
        });
    }
    return out;
};
