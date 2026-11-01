export const CONTEXTO_VAZIO = { nlp: null };
/** Ids estáveis: sobrevivem à reanálise, preservando as decisões do usuário. */
export function idSugestao(ruleId, cueIndex, discriminante = '') {
    return discriminante ? `${ruleId}:${cueIndex}:${discriminante}` : `${ruleId}:${cueIndex}`;
}
export function instantaneo(cue) {
    return { lines: [...cue.lines], startMs: cue.startMs, endMs: cue.endMs };
}
