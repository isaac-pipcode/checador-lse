import { idSugestao, instantaneo } from './tipos';
const CORRECOES = [
    {
        nome: 'espaço duplicado',
        detectar: /\S {2,}\S/,
        aplicar: (s) => s.replace(/ {2,}/g, ' '),
    },
    {
        nome: 'espaço antes de pontuação',
        detectar: /\s+[,.!?;:](?!\d)/,
        aplicar: (s) => s.replace(/\s+([,.!?;:])/g, '$1'),
    },
    {
        nome: 'espaço interno em colchetes',
        detectar: /\[\s+[^\]]*\]|\[[^\]]*\s+\]/,
        aplicar: (s) => s.replace(/\[\s*([^\]]*?)\s*\]/g, '[$1]'),
    },
    {
        nome: 'espaço no fim da linha',
        detectar: /\s+$/,
        aplicar: (s) => s.replace(/\s+$/, ''),
    },
    {
        nome: 'espaço no início da linha',
        detectar: /^\s+/,
        aplicar: (s) => s.replace(/^\s+/, ''),
    },
];
export const c8 = (cues) => {
    const out = [];
    for (const cue of cues) {
        const encontradas = new Set();
        const novas = cue.lines.map((linha) => {
            let s = linha;
            for (const c of CORRECOES) {
                if (c.detectar.test(s)) {
                    encontradas.add(c.nome);
                    s = c.aplicar(s);
                }
            }
            return s;
        });
        if (encontradas.size === 0)
            continue;
        if (novas.join('\n') === cue.lines.join('\n'))
            continue;
        out.push({
            id: idSugestao('C8', cue.index),
            ruleId: 'C8',
            cueIndex: cue.index,
            severity: 'aviso',
            verifiability: 'deterministica',
            message: `Limpeza tipográfica: ${[...encontradas].join(', ')}.`,
            before: instantaneo(cue),
            after: { lines: novas },
            autoFixable: true,
        });
    }
    return out;
};
