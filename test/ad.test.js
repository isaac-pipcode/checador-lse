import { describe, expect, it } from 'vitest';
import { calibrarPpm, contarPalavras, duracaoEstimadaMs } from '../src/ad/estimativa';
import { verificarBloco, nivelDoBloco } from '../src/ad/verificacoes';
import { clipesDosBlocos, curvaDeDucking, ganhoEm, CursorDeGanho, dbParaLinear } from '../src/ad/mixagem';
import { aparar } from '../src/ad/takes';
import { roteiroVtt } from '../src/ad/roteiro';
import { PARAMETROS_AD_PADRAO } from '../src/ad/tipos';
import { AcumuladorEnvelope, envelopeRmsDb } from '../src/mapa/sinal';
import { cuesDe } from './auxiliares';
const P = PARAMETROS_AD_PADRAO;
function take(over = {}) {
    return { id: 't1', arquivo: null, duracaoMs: 3000, trimInicioMs: 200, trimFimMs: 2200, posicaoMs: 5000, ganhoDb: 0, gravadoEm: '', ...over };
}
function bloco(over = {}) {
    return { id: 'b1', inicioMs: 4000, fimMs: 9000, texto: 'Ana abre a porta devagar.', takes: [], takeAtivoId: null, nota: '', ...over };
}
describe('estimativa de leitura', () => {
    it('conta palavras com hífen e apóstrofo como uma', () => {
        expect(contarPalavras('Ana pega o guarda-chuva d’água.')).toBe(5);
        expect(duracaoEstimadaMs('um dois três quatro', 120)).toBe(2000);
    });
    it('calibra pela mediana dos takes, com no mínimo três amostras', () => {
        const b = (i, palavras, ms) => bloco({ id: `b${i}`, texto: Array(palavras).fill('p').join(' '), takes: [take({ id: `t${i}`, trimInicioMs: 0, trimFimMs: ms })], takeAtivoId: `t${i}` });
        expect(calibrarPpm([b(1, 10, 4000), b(2, 10, 4000)])).toBeNull();
        expect(calibrarPpm([b(1, 10, 4000), b(2, 10, 3000), b(3, 10, 5000)])).toEqual({ ppm: 150, amostras: 3 });
    });
});
describe('verificações de bloco', () => {
    const { cues } = cuesDe(`1
00:00:03,000 --> 00:00:04,000
Fala antes.

2
00:00:08,500 --> 00:00:10,000
Fala depois.

3
00:00:06,000 --> 00:00:06,800
[CAMPAINHA]`);
    it('A1: texto estimado maior que a janela', () => {
        const longo = Array(40).fill('palavra').join(' '); // 15 s a 160 ppm
        const ap = verificarBloco(bloco({ texto: longo }), cues, P);
        expect(ap.find((a) => a.codigo === 'A1')?.nivel).toBe('erro');
    });
    it('A3: take sobre fala é erro; sobre [efeito] não', () => {
        const t = take({ posicaoMs: 7000, trimInicioMs: 0, trimFimMs: 2000 }); // 7–9 s, fala em 8,5
        const ap = verificarBloco(bloco({ takes: [t], takeAtivoId: 't1' }), cues, P);
        expect(ap.map((a) => a.codigo).sort()).toEqual(['A3']);
        const t2 = take({ posicaoMs: 5500, trimInicioMs: 0, trimFimMs: 1500 }); // cobre só a campainha
        expect(nivelDoBloco(verificarBloco(bloco({ takes: [t2], takeAtivoId: 't1' }), cues, P))).toBe('ok');
    });
    it('A2: take fora da janela; A5: sem take', () => {
        const t = take({ posicaoMs: 3500, trimInicioMs: 0, trimFimMs: 1000 });
        expect(verificarBloco(bloco({ takes: [t], takeAtivoId: 't1' }), [], P).map((a) => a.codigo)).toEqual(['A2']);
        expect(verificarBloco(bloco({ aprovado: true }), [], P).map((a) => a.codigo)).toEqual(['A5']);
        expect(verificarBloco(bloco(), [], P).map((a) => a.codigo)).toEqual(['A6']);
    });
});
describe('mixagem', () => {
    const blocos = [
        bloco({ id: 'a', takes: [take({ id: 'x', posicaoMs: 5000, trimInicioMs: 100, trimFimMs: 1100 })], takeAtivoId: 'x' }),
        bloco({ id: 'b', takes: [take({ id: 'y', posicaoMs: 6400, trimInicioMs: 0, trimFimMs: 1000 })], takeAtivoId: 'y' }),
        bloco({ id: 'c', takes: [take({ id: 'z', posicaoMs: 20000, trimInicioMs: 0, trimFimMs: 1000 })], takeAtivoId: 'z' }),
    ];
    const clipes = clipesDosBlocos(blocos, P);
    const curva = curvaDeDucking(clipes, P);
    const g = dbParaLinear(P.duckingDb);
    it('clipes usam o trecho aparado', () => {
        expect(clipes[0]).toMatchObject({ posicaoMs: 5000, offsetMs: 100, duracaoMs: 1000 });
    });
    it('ducking: rampa antes, patamar durante, fusão de clipes próximos', () => {
        expect(ganhoEm(curva, 0)).toBe(1);
        expect(ganhoEm(curva, 5000 - P.ataqueMs)).toBe(1);
        expect(ganhoEm(curva, 5000)).toBeCloseTo(g);
        // entre o fim do 1º (6000) e o início do 2º (6400): continua abaixado
        expect(ganhoEm(curva, 6200)).toBeCloseTo(g);
        expect(ganhoEm(curva, 7400 + P.liberacaoMs)).toBe(1);
        expect(ganhoEm(curva, 7400 + P.liberacaoMs / 2)).toBeCloseTo((1 + g) / 2);
        expect(ganhoEm(curva, 20500)).toBeCloseTo(g);
    });
    it('cursor monotônico coincide com a busca binária', () => {
        const c = new CursorDeGanho(curva);
        for (let ms = 0; ms < 25000; ms += 37)
            expect(c.em(ms)).toBeCloseTo(ganhoEm(curva, ms), 9);
    });
});
describe('takes e envelope', () => {
    it('apara silêncio de cabeça e cauda', () => {
        const taxa = 16000;
        const a = new Float32Array(taxa * 3);
        for (let i = taxa; i < taxa * 2; i++)
            a[i] = 0.3 * Math.sin(i / 5);
        const r = aparar(a, taxa, 30);
        expect(r.trimInicioMs).toBeGreaterThanOrEqual(900);
        expect(r.trimInicioMs).toBeLessThanOrEqual(1000);
        expect(r.trimFimMs).toBeGreaterThanOrEqual(2000);
        expect(r.trimFimMs).toBeLessThanOrEqual(2200);
    });
    it('acumulador incremental = envelope de uma vez', () => {
        const a = Float32Array.from({ length: 16000 * 2 + 77 }, (_, i) => Math.sin(i / 7) * (i % 3000) / 3000);
        const acc = new AcumuladorEnvelope(16000, 10);
        for (let i = 0; i < a.length; i += 1234)
            acc.adicionar(a.subarray(i, i + 1234));
        const x = acc.concluir();
        const y = envelopeRmsDb(a, 16000, 10);
        expect(x.length).toBe(y.length);
        for (let i = 0; i < x.length; i++)
            expect(x[i]).toBeCloseTo(y[i], 3);
    });
    it('VTT de descrições usa a posição do take', () => {
        const b = bloco({ takes: [take()], takeAtivoId: 't1' });
        expect(roteiroVtt([b])).toContain('00:00:05.000 --> 00:00:07.000');
    });
});
describe('aprovação do roteiro e teleprompter', () => {
    it('editar o texto de um bloco aprovado revoga a aprovação; editar a nota, não', async () => {
        const { redutorParaTeste } = await import('../src/state/store');
        const { estadoInicial } = await import('../src/state/store');
        let e = { ...estadoInicial, ad: { ...estadoInicial.ad, blocos: [bloco({ aprovado: true })] } };
        e = redutorParaTeste(e, { tipo: 'adEditar', id: 'b1', mudanca: { nota: 'calmo' } });
        expect(e.ad.blocos[0].aprovado).toBe(true);
        e = redutorParaTeste(e, { tipo: 'adEditar', id: 'b1', mudanca: { texto: 'Outro texto.' } });
        expect(e.ad.blocos[0].aprovado).toBe(false);
        expect(e.anuncio).toMatch(/rascunho/);
    });
    it('só blocos aprovados e com texto entram na gravação', async () => {
        const { blocosGravaveis } = await import('../src/ad/prompter');
        const bs = [
            bloco({ id: 'a', aprovado: true }),
            bloco({ id: 'b', aprovado: false }),
            bloco({ id: 'c', aprovado: true, texto: '  ' }),
            bloco({ id: 'd', aprovado: true, takes: [take()], takeAtivoId: 't1' }),
        ];
        expect(blocosGravaveis(bs, false).map((b) => b.id)).toEqual(['a', 'd']);
        expect(blocosGravaveis(bs, true).map((b) => b.id)).toEqual(['a']);
    });
    it('estado do teleprompter: posição na fila, próximo bloco e resultado do take', async () => {
        const { montarEstadoPrompter } = await import('../src/ad/prompter');
        const bs = [
            bloco({ id: 'a', aprovado: true, texto: 'Primeiro.', takes: [take({ posicaoMs: 4500 })], takeAtivoId: 't1' }),
            bloco({ id: 'b', aprovado: true, texto: 'Segundo.', inicioMs: 12000, fimMs: 15000 }),
        ];
        const e = montarEstadoPrompter({
            blocos: bs, fila: ['a', 'b'], blocoId: 'a', fase: 'revisao', sequencia: true,
            videoUrl: null, tempoMs: 0, tocando: false, aviso: null, parametros: P,
        });
        expect(e.bloco).toMatchObject({ n: 1, total: 2, texto: 'Primeiro.' });
        expect(e.proximo?.texto).toBe('Segundo.');
        expect(e.take).toEqual({ duracaoMs: 2000, posicaoMs: 4500, cabe: true });
    });
    it('teclas da sessão dependem da fase', async () => {
        const { comandoDaTecla } = await import('../src/ad/prompter');
        expect(comandoDaTecla('Enter', 'agora')).toBe('parar');
        expect(comandoDaTecla('Enter', 'revisao')).toBe('manter');
        expect(comandoDaTecla('r', 'agora')).toBeNull();
        expect(comandoDaTecla('r', 'revisao')).toBe('regravar');
        expect(comandoDaTecla('Escape', 'preroll')).toBe('encerrar');
    });
});
describe('pré e pós-rolagem', () => {
    it('padrões: 3 s antes, 2 s depois', () => {
        expect(PARAMETROS_AD_PADRAO.prerollMs).toBe(3000);
        expect(PARAMETROS_AD_PADRAO.posrollMs).toBe(2000);
    });
    it('teleprompter recebe o fim da captura; pós-rolagem aceita encerrar o take', async () => {
        const { montarEstadoPrompter, comandoDaTecla } = await import('../src/ad/prompter');
        const e = montarEstadoPrompter({
            blocos: [bloco({ aprovado: true })], fila: ['b1'], blocoId: 'b1', fase: 'posroll', sequencia: false,
            videoUrl: null, tempoMs: 9500, tocando: true, aviso: null, parametros: P,
        });
        expect(e.bloco?.fimCapturaMs).toBe(9000 + 2000);
        expect(comandoDaTecla('Enter', 'posroll')).toBe('parar');
    });
    it('projeto antigo sem pós-rolagem recebe o padrão; pré-rolagem salva é mantida', async () => {
        const { redutorParaTeste, estadoInicial } = await import('../src/state/store');
        const antigo = { prerollMs: 2000, palavrasPorMinuto: 150 };
        const e = redutorParaTeste(estadoInicial, { tipo: 'projetoCarregado', caminho: 'x.json', ad: { blocos: [], parametros: antigo } });
        expect(e.ad.parametros.posrollMs).toBe(2000);
        expect(e.ad.parametros.prerollMs).toBe(2000);
        expect(e.ad.parametros.duckingDb).toBe(P.duckingDb);
    });
});
describe('legenda do teleprompter', () => {
    it('ajustes ficam dentro dos limites e arredondados', async () => {
        const { ajustarLegenda, LEGENDA_PROMPTER_PADRAO } = await import('../src/ad/tipos');
        expect(ajustarLegenda(LEGENDA_PROMPTER_PADRAO, { escala: 5 }).escala).toBe(2);
        expect(ajustarLegenda(LEGENDA_PROMPTER_PADRAO, { escala: 0.1 }).escala).toBe(0.6);
        expect(ajustarLegenda(LEGENDA_PROMPTER_PADRAO, { escala: 1 + 0.1 + 0.1 }).escala).toBe(1.2);
        expect(ajustarLegenda(LEGENDA_PROMPTER_PADRAO, { alturaMaxima: 0.9 }).alturaMaxima).toBe(0.5);
        expect(ajustarLegenda(LEGENDA_PROMPTER_PADRAO, { cor: 'amarelo' }).cor).toBe('amarelo');
    });
    it('+ e − mudam o tamanho em qualquer fase; o estado leva a legenda ao teleprompter', async () => {
        const { comandoDaTecla, montarEstadoPrompter } = await import('../src/ad/prompter');
        expect(comandoDaTecla('+', 'agora')).toBe('fonteMais');
        expect(comandoDaTecla('-', 'ocioso')).toBe('fonteMenos');
        const legenda = { cor: 'amarelo', escala: 1.4, alturaMaxima: 0.25 };
        const e = montarEstadoPrompter({
            blocos: [], fila: [], blocoId: null, fase: 'ocioso', sequencia: false,
            videoUrl: null, tempoMs: 0, tocando: false, aviso: null, parametros: { ...P, legenda },
        });
        expect(e.legenda).toEqual(legenda);
    });
    it('projeto sem ajustes de legenda abre com o padrão', async () => {
        const { redutorParaTeste, estadoInicial } = await import('../src/state/store');
        const e = redutorParaTeste(estadoInicial, {
            tipo: 'projetoCarregado', caminho: 'x.json',
            ad: { blocos: [], parametros: { prerollMs: 3000 } },
        });
        expect(e.ad.parametros.legenda).toEqual({ cor: 'branco', escala: 1, alturaMaxima: 0.33 });
    });
});
