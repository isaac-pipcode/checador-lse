import { idSugestao, instantaneo } from './tipos';
import { formatarTimecode } from '../core/texto';
/**
 * T6 — Sobreposição temporal: exige start[i+1] ≥ end[i].
 * Auto-correção: antecipa a saída da legenda anterior, preservando o intervalo
 * mínimo (T7) e a duração mínima (T3). Se não houver folga para isso, apenas
 * sinaliza — encurtar abaixo do mínimo legível trocaria um erro por outro.
 */
export const t6 = (cues, config) => {
    const out = [];
    for (let i = 0; i + 1 < cues.length; i++) {
        const atual = cues[i];
        const proxima = cues[i + 1];
        if (proxima.startMs >= atual.endMs)
            continue;
        const comIntervalo = proxima.startMs - config.intervaloMinimoMs;
        const colado = proxima.startMs;
        let novoFim = null;
        if (comIntervalo - atual.startMs >= config.duracaoMinimaMs)
            novoFim = comIntervalo;
        else if (colado - atual.startMs >= config.duracaoMinimaMs)
            novoFim = colado;
        out.push({
            id: idSugestao('T6', atual.index),
            ruleId: 'T6',
            cueIndex: atual.index,
            severity: 'erro',
            verifiability: 'deterministica',
            message: `Sobreposição com a legenda ${proxima.index}: esta sai em ${formatarTimecode(atual.endMs)} e a seguinte entra em ${formatarTimecode(proxima.startMs)}.` +
                (novoFim === null
                    ? ' Não há folga para encurtar esta legenda sem violar a duração mínima; ajuste manualmente.'
                    : ''),
            before: instantaneo(atual),
            ...(novoFim === null
                ? {}
                : { after: { lines: [...atual.lines], startMs: atual.startMs, endMs: novoFim } }),
            autoFixable: novoFim !== null,
        });
    }
    return out;
};
