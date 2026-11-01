import { parseSubtitle } from '../src/parser/srt';
import { analisar } from '../src/rules';
import { SegmentadorPtBr } from '../src/nlp/segmentador';
import { configDoPerfil } from '../src/model/perfis';
export function config(over = {}) {
    return { ...configDoPerfil('guia-145'), ...over };
}
export function cuesDe(srt) {
    const r = parseSubtitle(srt.trim());
    return r;
}
export function rodar(srt, over = {}) {
    const cfg = config(over);
    const { cues, erros, avisos } = cuesDe(srt);
    const sugestoes = analisar(cues, cfg, {
        nlp: cfg.nlpAtivo ? new SegmentadorPtBr() : null,
    });
    return { cues, erros, avisos, sugestoes, config: cfg };
}
export const daRegra = (s, id) => s.filter((x) => x.ruleId === id);
