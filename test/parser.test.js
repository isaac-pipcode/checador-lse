import { describe, expect, it } from 'vitest';
import { parseSubtitle, parseSrt } from '../src/parser/srt';
import { decodeBuffer } from '../src/parser/encoding';
describe('parser SRT', () => {
    it('lê blocos com numeração, timecode e múltiplas linhas', () => {
        const r = parseSrt(`1
00:00:01,000 --> 00:00:03,000
Primeira linha
Segunda linha

2
00:00:04,000 --> 00:00:05,500
Outra legenda
`);
        expect(r.erros).toHaveLength(0);
        expect(r.cues).toHaveLength(2);
        expect(r.cues[0]).toMatchObject({ index: 1, startMs: 1000, endMs: 3000 });
        expect(r.cues[0].lines).toEqual(['Primeira linha', 'Segunda linha']);
        expect(r.cues[1].startMs).toBe(4000);
    });
    // Caso de aceite 9
    it('reporta timecode inválido com a linha, sem lançar exceção', () => {
        const r = parseSrt(`1
00:00:01,000 --> 00:00:03,000
Legenda boa

2
00:00:04,000 -> 00:00:05,500
Legenda com seta errada

3
00:00:06,000 --> 00:00:07,000
Legenda seguinte
`);
        expect(r.erros).toHaveLength(1);
        expect(r.erros[0].linha).toBe(6);
        expect(r.erros[0].mensagem).toMatch(/Timecode inválido/);
        // O parser não aborta: as legendas válidas continuam disponíveis.
        expect(r.cues).toHaveLength(2);
    });
    it('reporta arquivo sem nenhuma legenda em vez de devolver lista vazia silenciosa', () => {
        const r = parseSrt('isto não é um SRT\nnem de longe\n');
        expect(r.cues).toHaveLength(0);
        expect(r.erros.length).toBeGreaterThan(0);
    });
    it('avisa quando a numeração está fora de sequência', () => {
        const r = parseSrt(`1
00:00:01,000 --> 00:00:02,000
A

7
00:00:03,000 --> 00:00:04,000
B
`);
        expect(r.avisos.join(' ')).toMatch(/fora de sequência/);
        expect(r.cues[1].index).toBe(2);
    });
    it('lê WebVTT com timecodes MM:SS.mmm', () => {
        const r = parseSubtitle(`WEBVTT

00:01.000 --> 00:03.000
Olá

00:04.000 --> 00:06.000
Tudo bem?
`);
        expect(r.formato).toBe('vtt');
        expect(r.cues).toHaveLength(2);
        expect(r.cues[0].startMs).toBe(1000);
    });
    it('tolera BOM e detecta Latin-1', () => {
        const utf8 = new TextEncoder().encode('﻿Olá');
        expect(decodeBuffer(utf8.buffer).encoding).toBe('utf-8 (BOM)');
        const latin1 = new Uint8Array([0x4f, 0x6c, 0xe1]); // "Olá" em ISO-8859-1
        const r = decodeBuffer(latin1.buffer);
        expect(r.encoding).toBe('windows-1252');
        expect(r.texto).toBe('Olá');
        expect(r.avisos).toHaveLength(1);
    });
});
