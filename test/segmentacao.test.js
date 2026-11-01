import { describe, expect, it } from 'vitest';
import { SegmentadorPtBr, SegmentadorIndisponivel } from '../src/nlp/segmentador';
import { rodar, daRegra } from './auxiliares';
const motor = new SegmentadorPtBr();
describe('L1 — segmentação sintática (caso de aceite 3)', () => {
    it('reposiciona a quebra que separa a contração do seu complemento', () => {
        const p = motor.avaliarQuebra(['Empresário mata ex-mulher no', 'centro de Fortaleza'], 37);
        expect(p).not.toBeNull();
        expect(p.linhas).toEqual(['Empresário mata ex-mulher', 'no centro de Fortaleza']);
        expect(p.confianca).toBeGreaterThan(0.7);
        expect(p.diagnostico).toMatch(/contração/);
    });
    it('não mexe em quebra já bem posicionada', () => {
        expect(motor.avaliarQuebra(['Empresário mata ex-mulher', 'no centro de Fortaleza'], 37)).toBeNull();
    });
    it('acusa quebra após determinante e depois de preposição', () => {
        expect(motor.avaliarQuebra(['Ele guardou o', 'documento na gaveta'], 37)).not.toBeNull();
        expect(motor.avaliarQuebra(['Ela veio para', 'a festa de ontem'], 37)).not.toBeNull();
        expect(motor.avaliarQuebra(['Eu não', 'quero mais falar disso'], 37)).not.toBeNull();
    });
    it('acusa quebra que separa auxiliar de verbo principal', () => {
        const p = motor.avaliarQuebra(['Nós tínhamos acabado de sair e', 'ele ainda ia', 'x'], 37);
        expect(p).toBeNull(); // três linhas: fora do escopo de L1
        const q = motor.avaliarQuebra(['O trem já tinha', 'partido quando chegamos'], 37);
        expect(q).not.toBeNull();
        expect(q.diagnostico).toMatch(/auxiliar|sintagma verbal/);
    });
    it('quebra depois de pontuação forte é sempre aceitável', () => {
        expect(motor.avaliarQuebra(['Ele chegou tarde.', 'Ninguém percebeu nada'], 37)).toBeNull();
    });
    it('ignora legendas com dois falantes marcados por traço', () => {
        expect(motor.avaliarQuebra(['-Você vem para', '-Não sei ainda'], 37)).toBeNull();
    });
    it('prefere o ponto de quebra de nível sintático mais alto', () => {
        // A quebra atual isola o advérbio "não" do verbo. Entre os pontos legais,
        // o de nível mais alto é a fronteira de oração coordenada (antes de "e"),
        // e não uma fronteira de sintagma interna à segunda oração.
        const p = motor.avaliarQuebra(['Maria saiu de casa cedo e não', 'voltou quando prometeu'], 40);
        expect(p).not.toBeNull();
        expect(p.linhas).toEqual(['Maria saiu de casa cedo', 'e não voltou quando prometeu']);
    });
    it('L1 se declara indisponível — e não inventa análise — com o motor desligado', () => {
        const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
Empresário mata ex-mulher no
centro de Fortaleza
`, { nlpAtivo: false });
        const l1 = daRegra(sugestoes, 'L1');
        expect(l1).toHaveLength(1);
        expect(l1[0].unavailable).toBe(true);
        expect(l1[0].after).toBeUndefined();
        expect(l1[0].message).toMatch(/desligado/);
        expect(new SegmentadorIndisponivel().disponivel).toBe(false);
    });
    it('produz sugestão L1 com confiança e sem auto-correção', () => {
        const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
Empresário mata ex-mulher no
centro de Fortaleza
`);
        const l1 = daRegra(sugestoes, 'L1');
        expect(l1).toHaveLength(1);
        expect(l1[0].verifiability).toBe('nlp');
        expect(l1[0].confidence).toBeGreaterThan(0);
        expect(l1[0].autoFixable).toBe(false);
        expect(l1[0].after?.lines).toEqual(['Empresário mata ex-mulher', 'no centro de Fortaleza']);
    });
});
