import { idSugestao, instantaneo } from './tipos';
import { caracteresDaLegenda, cpsDaLegenda, duracaoMs, formatarDuracao } from '../core/texto';
const n1 = (x) => x.toFixed(1).replace('.', ',');
/**
 * T5 — Velocidade de leitura (caracteres por segundo).
 * Verde até o alvo do perfil; âmbar entre o alvo e o teto; vermelho acima do
 * teto (erro). A correção passa por redução textual (L2) ou por mais tempo em
 * tela — nenhuma das duas é automatizável sem decisão editorial.
 */
export const t5 = (cues, config) => {
    const out = [];
    for (const cue of cues) {
        const d = duracaoMs(cue);
        if (d <= 0)
            continue;
        const cps = cpsDaLegenda(cue, config);
        if (cps <= config.cpsAlvo)
            continue;
        const erro = cps > config.cpsMaximo;
        const chars = caracteresDaLegenda(cue, config);
        out.push({
            id: idSugestao('T5', cue.index),
            ruleId: 'T5',
            cueIndex: cue.index,
            severity: erro ? 'erro' : 'aviso',
            verifiability: 'deterministica',
            message: `${n1(cps)} cps (${chars} caracteres em ${formatarDuracao(d)}) — ${erro
                ? `acima do teto de ${config.cpsMaximo} cps`
                : `acima do alvo de ${config.cpsAlvo} cps do perfil "${config.perfilNome}"`}.`,
            before: instantaneo(cue),
            autoFixable: false,
        });
    }
    return out;
};
