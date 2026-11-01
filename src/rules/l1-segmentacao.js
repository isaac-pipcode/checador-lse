import { idSugestao, instantaneo } from './tipos';
/**
 * L1 — Segmentação no mais alto nível sintático.
 *
 * Delegada ao motor de segmentação (src/nlp). Se o motor estiver desligado, a
 * regra se declara indisponível: não há heurística de reserva apresentada como
 * análise. Toda proposta traz `confidence` e exige aprovação.
 */
export const l1 = (cues, config, ctx) => {
    const out = [];
    const motor = ctx.nlp;
    const candidatas = cues.filter((c) => c.lines.length === 2 && c.lines.every((l) => l.trim().length > 0));
    if (candidatas.length === 0)
        return out;
    if (!motor || !motor.disponivel) {
        out.push({
            id: idSugestao('L1', -1),
            ruleId: 'L1',
            cueIndex: -1,
            severity: 'aviso',
            verifiability: 'nlp',
            message: `Segmentação sintática não verificada: o módulo assistido está desligado. ${candidatas.length} legenda(s) de duas linhas não foram analisadas.`,
            confidence: 0,
            before: { lines: [] },
            autoFixable: false,
            unavailable: true,
        });
        return out;
    }
    for (const cue of candidatas) {
        const proposta = motor.avaliarQuebra(cue.lines, config.maxCaracteresPorLinha);
        if (!proposta)
            continue;
        if (proposta.linhas.join('\n') === cue.lines.join('\n'))
            continue;
        out.push({
            id: idSugestao('L1', cue.index),
            ruleId: 'L1',
            cueIndex: cue.index,
            severity: 'aviso',
            verifiability: 'nlp',
            message: proposta.diagnostico,
            confidence: proposta.confianca,
            before: instantaneo(cue),
            after: { lines: proposta.linhas },
            autoFixable: false,
        });
    }
    return out;
};
