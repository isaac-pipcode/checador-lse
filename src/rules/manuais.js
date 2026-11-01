import { DOCUMENT_SCOPE } from '../model/types';
import { idSugestao, instantaneo } from './tipos';
const RE_ROTULO = /\[[^\]]+\]/;
const RE_TRACO = /^\s*[-–—]/;
function itemManual(ruleId, message) {
    return {
        id: idSugestao(ruleId, DOCUMENT_SCOPE),
        ruleId,
        cueIndex: DOCUMENT_SCOPE,
        severity: 'revisao_manual',
        verifiability: 'manual',
        message,
        before: { lines: [] },
        autoFixable: false,
    };
}
/**
 * C3 — Maiúsculas para texto diegético escrito (placas, cartas, letreiros) e
 * para o título da obra. Não verificável sem saber o que está na tela.
 */
export const c3 = (cues) => cues.length === 0
    ? []
    : [
        itemManual('C3', 'Confirme que todo texto escrito em cena (placas, cartas, letreiros) e o título da obra estão em caixa-alta, como pede o Guia.'),
    ];
/** C4 (parte manual) — adequação do uso do itálico. */
export const c4Manual = (cues) => cues.length === 0
    ? []
    : [
        itemManual('C4', 'Confirme que o itálico marca vozes mediadas ou em off e as canções — e apenas isso. O uso não é verificável a partir do texto.'),
    ];
/** C7 — Reticências apenas para hesitação/interrupção, não para continuidade. */
export const c7 = (cues) => {
    const comReticencias = cues.filter((c) => /(\.\.\.|…)/.test(c.lines.join(' ')));
    if (comReticencias.length === 0)
        return [];
    return [
        itemManual('C7', `${comReticencias.length} legenda(s) usam reticências. Confirme que marcam hesitação ou interrupção de fala, e não continuidade entre legendas (uso desaconselhado pelo Guia).`),
    ];
};
/**
 * X1 — Identificação de falante a cada troca de turno.
 * Heurística parcial, declarada como tal: (a) trechos longos sem nenhum rótulo
 * entre colchetes; (b) legendas com traço de diálogo e nenhuma identificação.
 */
export const x1 = (cues, config) => {
    const out = [];
    if (cues.length === 0)
        return out;
    let inicioJanela = null;
    let consecutivas = 0;
    const trechos = [];
    for (const cue of cues) {
        if (RE_ROTULO.test(cue.lines.join(' '))) {
            if (consecutivas >= config.janelaSemRotulo && inicioJanela !== null) {
                trechos.push([inicioJanela, cue.index - 1]);
            }
            inicioJanela = null;
            consecutivas = 0;
        }
        else {
            if (inicioJanela === null)
                inicioJanela = cue.index;
            consecutivas++;
        }
    }
    if (consecutivas >= config.janelaSemRotulo && inicioJanela !== null) {
        trechos.push([inicioJanela, cues[cues.length - 1].index]);
    }
    for (const [de, ate] of trechos) {
        out.push({
            id: idSugestao('X1', de, `trecho-${ate}`),
            ruleId: 'X1',
            cueIndex: de,
            severity: 'revisao_manual',
            verifiability: 'manual',
            message: `Legendas ${de} a ${ate} (${ate - de + 1} seguidas) sem nenhuma identificação de falante entre colchetes. Verifique se há trocas de turno não identificadas — a checagem exige o vídeo.`,
            before: { lines: [] },
            autoFixable: false,
        });
    }
    for (const cue of cues) {
        const comTraco = cue.lines.filter((l) => RE_TRACO.test(l)).length;
        if (comTraco >= 2 && !RE_ROTULO.test(cue.lines.join(' '))) {
            out.push({
                id: idSugestao('X1', cue.index, 'dialogo'),
                ruleId: 'X1',
                cueIndex: cue.index,
                severity: 'revisao_manual',
                verifiability: 'manual',
                message: 'Dois falantes marcados por traço sem identificação nominal. Confirme se o espectador surdo consegue saber quem fala.',
                before: instantaneo(cue),
                autoFixable: false,
            });
        }
    }
    return out;
};
/**
 * X2 — Efeitos sonoros relevantes presentes.
 * A ausência de um efeito necessário só é detectável com o áudio. O checklist
 * registra a pendência; a formatação dos efeitos existentes é coberta por C1.
 */
export const x2 = (cues) => {
    if (cues.length === 0)
        return [];
    const comEfeito = cues.filter((c) => RE_ROTULO.test(c.lines.join(' '))).length;
    return [
        itemManual('X2', `${comEfeito} legenda(s) trazem informação entre colchetes. Só com o áudio é possível confirmar se todos os efeitos sonoros relevantes à narrativa foram legendados (NASCIMENTO, 2013).`),
    ];
};
