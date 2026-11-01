function snapshotAlvo(item) {
    if (item.decision === 'editada')
        return item.editedAfter ?? item.suggestion.after ?? null;
    if (item.decision === 'aprovada')
        return item.suggestion.after ?? null;
    return null;
}
/**
 * Aplica ao clone da lista original apenas as sugestões `aprovada` ou `editada`.
 * O arquivo de entrada nunca é mutado; rejeitadas e pendentes não entram.
 *
 * Duas sugestões aprovadas podem tocar a mesma legenda (p. ex. C8 e C2). Elas
 * são aplicadas em sequência sobre o estado corrente da legenda; quando a
 * segunda foi calculada a partir de um texto que a primeira já alterou, o
 * conflito é registrado e a mais recente prevalece — o relatório de QA o
 * declara, em vez de silenciar.
 */
export function aplicarDecisoes(originais, review) {
    const cues = originais.map((c) => ({ ...c, lines: [...c.lines] }));
    const porIndice = new Map(cues.map((c) => [c.index, c]));
    const aplicadas = [];
    const conflitos = [];
    const tocadas = new Map();
    const itens = Object.values(review)
        .filter((i) => i.decision === 'aprovada' || i.decision === 'editada')
        .sort((a, b) => a.suggestion.cueIndex - b.suggestion.cueIndex);
    for (const item of itens) {
        const alvo = snapshotAlvo(item);
        if (!alvo)
            continue;
        const cue = porIndice.get(item.suggestion.cueIndex);
        if (!cue)
            continue;
        const anterior = tocadas.get(cue.index);
        if (anterior && item.suggestion.before.lines.join('\n') !== cue.lines.join('\n')) {
            conflitos.push({
                id: item.suggestion.id,
                motivo: `calculada sobre o texto anterior à aplicação de ${anterior}; prevaleceu a versão mais recente`,
            });
        }
        cue.lines = [...alvo.lines];
        if (typeof alvo.startMs === 'number')
            cue.startMs = alvo.startMs;
        if (typeof alvo.endMs === 'number')
            cue.endMs = alvo.endMs;
        tocadas.set(cue.index, item.suggestion.ruleId);
        aplicadas.push(item.suggestion.id);
    }
    return { cues, aplicadas, conflitos };
}
