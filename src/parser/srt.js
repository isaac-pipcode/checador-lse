const RE_TEMPO_SRT = /^\s*(\d{1,3}):([0-5]?\d):([0-5]?\d)[,.](\d{1,3})\s*-->\s*(\d{1,3}):([0-5]?\d):([0-5]?\d)[,.](\d{1,3})(?:\s+.*)?$/;
/** WebVTT admite MM:SS.mmm além de HH:MM:SS.mmm */
const RE_TEMPO_VTT = /^\s*(?:(\d{1,3}):)?([0-5]?\d):([0-5]?\d)[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?([0-5]?\d):([0-5]?\d)[.,](\d{1,3})(?:\s+.*)?$/;
function ms(h, m, s, frac) {
    const milis = Number(frac.padEnd(3, '0').slice(0, 3));
    return Number(h || 0) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + milis;
}
export function parseSubtitle(texto) {
    const normalizado = texto.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    const ehVtt = /^\s*WEBVTT/.test(normalizado);
    return ehVtt ? parseVtt(normalizado) : parseSrt(normalizado);
}
export function parseSrt(texto) {
    const linhas = texto.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
    const cues = [];
    const erros = [];
    const avisos = [];
    let i = 0;
    let indice = 0;
    while (i < linhas.length) {
        // pula linhas vazias entre blocos
        while (i < linhas.length && linhas[i].trim() === '')
            i++;
        if (i >= linhas.length)
            break;
        const inicioBloco = i;
        let linhaNumero = null;
        // O número sequencial é opcional na prática (arquivos gerados por editores
        // que o omitem); só o consumimos se a próxima linha for um timecode.
        if (/^\s*\d+\s*$/.test(linhas[i]) && i + 1 < linhas.length && RE_TEMPO_SRT.test(linhas[i + 1])) {
            linhaNumero = linhas[i].trim();
            i++;
        }
        const linhaTempo = linhas[i] ?? '';
        const m = RE_TEMPO_SRT.exec(linhaTempo);
        if (!m) {
            // Aponta a linha que tentou ser um timecode (a que contém "-->"), que é
            // mais útil ao revisor do que o início do bloco.
            let fim = i;
            while (fim < linhas.length && linhas[fim].trim() !== '')
                fim++;
            const relativa = linhas.slice(i, fim).findIndex((l) => l.includes('-->') || l.includes('->'));
            const linhaErro = relativa >= 0 ? i + relativa : i;
            erros.push({
                linha: linhaErro + 1,
                mensagem: 'Timecode inválido ou ausente. Esperado o formato "HH:MM:SS,mmm --> HH:MM:SS,mmm".',
                trecho: (linhas[linhaErro] ?? '').slice(0, 120),
            });
            // Descarta o bloco inteiro (até a próxima linha em branco) e segue.
            i = fim;
            continue;
        }
        i++;
        const startMs = ms(m[1], m[2], m[3], m[4]);
        const endMs = ms(m[5], m[6], m[7], m[8]);
        const textoLinhas = [];
        while (i < linhas.length && linhas[i].trim() !== '') {
            textoLinhas.push(linhas[i]);
            i++;
        }
        if (endMs < startMs) {
            erros.push({
                linha: inicioBloco + 1,
                mensagem: 'Timecode final anterior ao inicial; a legenda foi ignorada.',
                trecho: linhaTempo.slice(0, 120),
            });
            continue;
        }
        if (textoLinhas.length === 0) {
            avisos.push(`Legenda sem texto no bloco iniciado na linha ${inicioBloco + 1}.`);
        }
        indice++;
        if (linhaNumero !== null && Number(linhaNumero) !== indice) {
            avisos.push(`Numeração fora de sequência na linha ${inicioBloco + 1}: arquivo diz "${linhaNumero}", esperado "${indice}". A numeração será refeita na exportação.`);
        }
        const raw = linhas.slice(inicioBloco, i).join('\n');
        cues.push({ index: indice, startMs, endMs, lines: textoLinhas, raw });
    }
    if (cues.length === 0 && erros.length === 0) {
        erros.push({
            linha: 1,
            mensagem: 'Nenhuma legenda encontrada. O arquivo parece vazio ou não está no formato SRT/WebVTT.',
            trecho: linhas[0]?.slice(0, 120) ?? '',
        });
    }
    return { cues, erros, avisos, formato: 'srt' };
}
export function parseVtt(texto) {
    const linhas = texto.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
    const cues = [];
    const erros = [];
    const avisos = [];
    let i = 0;
    let indice = 0;
    if (/^\s*WEBVTT/.test(linhas[0] ?? ''))
        i = 1;
    while (i < linhas.length) {
        while (i < linhas.length && linhas[i].trim() === '')
            i++;
        if (i >= linhas.length)
            break;
        // Blocos NOTE/STYLE/REGION são ignorados integralmente.
        if (/^(NOTE|STYLE|REGION)\b/.test(linhas[i])) {
            while (i < linhas.length && linhas[i].trim() !== '')
                i++;
            continue;
        }
        const inicioBloco = i;
        // Cue identifier opcional (qualquer linha que não seja timecode).
        if (!RE_TEMPO_VTT.test(linhas[i]) && i + 1 < linhas.length && RE_TEMPO_VTT.test(linhas[i + 1])) {
            i++;
        }
        const linhaTempo = linhas[i] ?? '';
        const m = RE_TEMPO_VTT.exec(linhaTempo);
        if (!m) {
            erros.push({
                linha: i + 1,
                mensagem: 'Timecode WebVTT inválido. Esperado "MM:SS.mmm --> MM:SS.mmm".',
                trecho: linhaTempo.slice(0, 120),
            });
            while (i < linhas.length && linhas[i].trim() !== '')
                i++;
            continue;
        }
        i++;
        const startMs = ms(m[1] ?? '0', m[2], m[3], m[4]);
        const endMs = ms(m[5] ?? '0', m[6], m[7], m[8]);
        const textoLinhas = [];
        while (i < linhas.length && linhas[i].trim() !== '') {
            textoLinhas.push(linhas[i]);
            i++;
        }
        if (endMs < startMs) {
            erros.push({
                linha: inicioBloco + 1,
                mensagem: 'Timecode final anterior ao inicial; a legenda foi ignorada.',
                trecho: linhaTempo.slice(0, 120),
            });
            continue;
        }
        indice++;
        cues.push({
            index: indice,
            startMs,
            endMs,
            lines: textoLinhas,
            raw: linhas.slice(inicioBloco, i).join('\n'),
        });
    }
    if (cues.length === 0 && erros.length === 0) {
        erros.push({ linha: 1, mensagem: 'Nenhuma legenda encontrada no arquivo WebVTT.', trecho: '' });
    }
    return { cues, erros, avisos, formato: 'vtt' };
}
