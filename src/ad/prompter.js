import { duracaoUtil, takeAtivo } from './tipos';
/** fases em que o microfone está gravando */
export const GRAVANDO = new Set(['preroll', 'agora', 'posroll']);
/** Teclas da sessão, iguais nas duas janelas. Devolve null se a tecla não é da sessão. */
export function comandoDaTecla(tecla, fase) {
    if (tecla === 'Escape')
        return 'encerrar';
    // tamanho da letra: vale em qualquer fase, inclusive lendo
    if (tecla === '+' || tecla === '=')
        return 'fonteMais';
    if (tecla === '-' || tecla === '_')
        return 'fonteMenos';
    if (GRAVANDO.has(fase))
        return tecla === 'Enter' || tecla === ' ' ? 'parar' : null;
    if (fase === 'revisao') {
        if (tecla === 'Enter')
            return 'manter';
        if (tecla === 'r' || tecla === 'R')
            return 'regravar';
        if (tecla === 'Backspace' || tecla === 'Delete')
            return 'descartar';
        if (tecla === ' ')
            return 'ouvir';
    }
    return null;
}
export const ESTADO_PROMPTER_OCIOSO = {
    videoUrl: null,
    tempoMs: 0,
    tocando: false,
    fase: 'ocioso',
    sequencia: false,
    bloco: null,
    proximo: null,
    take: null,
    aviso: null,
    legenda: { cor: 'branco', escala: 1, alturaMaxima: 0.33 },
};
/** Blocos que entram no modo de gravação: aprovados e com texto, em ordem. */
export function blocosGravaveis(blocos, somenteSemTake) {
    return blocos.filter((b) => b.aprovado && b.texto.trim() !== '' && (!somenteSemTake || !takeAtivo(b)));
}
export function montarEstadoPrompter(args) {
    const { blocos, fila, blocoId } = args;
    const b = blocos.find((x) => x.id === blocoId) ?? null;
    const i = blocoId ? fila.indexOf(blocoId) : -1;
    const prox = i >= 0 && args.sequencia ? blocos.find((x) => x.id === fila[i + 1]) ?? null : null;
    const t = b && args.fase === 'revisao' ? takeAtivo(b) : null;
    return {
        videoUrl: args.videoUrl,
        tempoMs: args.tempoMs,
        tocando: args.tocando,
        fase: args.fase,
        sequencia: args.sequencia,
        bloco: b
            ? {
                n: i >= 0 ? i + 1 : 1,
                total: i >= 0 ? fila.length : 1,
                texto: b.texto,
                nota: b.nota,
                inicioMs: b.inicioMs,
                fimMs: b.fimMs,
                fimCapturaMs: b.fimMs + args.parametros.posrollMs,
            }
            : null,
        proximo: prox ? { texto: prox.texto, inicioMs: prox.inicioMs } : null,
        take: t
            ? {
                duracaoMs: duracaoUtil(t),
                posicaoMs: t.posicaoMs,
                cabe: t.posicaoMs >= b.inicioMs && t.posicaoMs + duracaoUtil(t) <= b.fimMs,
            }
            : null,
        aviso: args.aviso,
        legenda: args.parametros.legenda,
    };
}
