import { describe, expect, it } from 'vitest';
import { analisar } from '../src/rules';
import { configDoPerfil, PERFIL_PADRAO } from '../src/model/perfis';
import { SegmentadorPtBr } from '../src/nlp/segmentador';
import { dividirEmLinhas, montarLegendas } from '../src/transcricao/montar';
import { ehAlucinacaoConhecida, palavrasDoWhisper, type PalavraTranscrita } from '../src/transcricao/whisperJson';

const cfg = configDoPerfil(PERFIL_PADRAO.perfilId);

/** Fala sintética: palavras a `ms` cada, com pausas onde há "|". */
function fala(texto: string, ms = 330, pausa = 900): PalavraTranscrita[] {
  let t = 1000;
  const out: PalavraTranscrita[] = [];
  for (const parte of texto.split('|')) {
    for (const w of parte.trim().split(/\s+/)) {
      out.push({ texto: w, inicioMs: t, fimMs: t + ms - 40, p: 0.9 });
      t += ms;
    }
    t += pausa;
  }
  return out;
}

describe('leitura do JSON do whisper.cpp (-ojf)', () => {
  const json = {
    result: { language: 'pt' },
    transcription: [
      {
        offsets: { from: 0, to: 2000 },
        text: ' Bom dia, Ana.',
        tokens: [
          { text: '[_BEG_]', offsets: { from: 0, to: 0 }, p: 1 },
          { text: ' Bom', offsets: { from: 100, to: 400 }, p: 0.9 },
          { text: ' dia', offsets: { from: 400, to: 800 }, p: 0.8 },
          { text: ',', offsets: { from: 800, to: 820 }, p: 0.99 },
          { text: ' An', offsets: { from: 900, to: 1100 }, p: 0.7 },
          { text: 'a.', offsets: { from: 1100, to: 1500 }, p: 0.9 },
          { text: '[_TT_100]', offsets: { from: 2000, to: 2000 }, p: 1 },
        ],
      },
      { offsets: { from: 5000, to: 7000 }, text: ' Legendas pela comunidade Amara.org', tokens: [] },
      { offsets: { from: 8000, to: 9000 }, text: ' Até logo' },
    ],
  };
  it('junta tokens em palavras com tempo, tira especiais e alucinações, reparte segmento sem tokens', () => {
    const r = palavrasDoWhisper(json);
    expect(r.idioma).toBe('pt');
    expect(r.descartados).toBe(1);
    expect(r.palavras.map((w) => w.texto)).toEqual(['Bom', 'dia,', 'Ana.', 'Até', 'logo']);
    expect(r.palavras[2]).toMatchObject({ inicioMs: 900, fimMs: 1500 });
    expect(r.palavras[2].p).toBeCloseTo(0.8, 2);
    expect(r.palavras[3].inicioMs).toBe(8000);
    expect(r.palavras[4].fimMs).toBe(9000);
  });
  it('reconhece créditos inventados, não frases legítimas', () => {
    expect(ehAlucinacaoConhecida('Obrigado por assistir!')).toBe(true);
    expect(ehAlucinacaoConhecida('Obrigado por assistir à peça comigo, mãe.')).toBe(false);
  });
});

describe('montagem do rascunho de LSE', () => {
  it('quebra a linha no mais alto nível sintático, sem separar artigo do nome', () => {
    const l = dividirEmLinhas('Eu não sei se vou conseguir chegar a tempo para a reunião', 37, 2)!;
    expect(l).toHaveLength(2);
    for (const x of l) expect(x.length).toBeLessThanOrEqual(37);
    expect(l[0]).not.toMatch(/\b(a|o|para|de)$/);
  });

  it('pausa longa encerra a legenda; fim de frase com corpo também', () => {
    const cues = montarLegendas(fala('Bom dia | Quem será que chegou tão cedo hoje?'), cfg);
    expect(cues[0].lines.join(' ')).toBe('Bom dia');
    expect(cues[1].lines.join(' ')).toBe('Quem será que chegou tão cedo hoje?');
  });

  it('fala longa e corrida vira várias legendas que respeitam todas as regras mecânicas do Guia', () => {
    const texto =
      'Olha eu não sei se você lembra mas a gente combinou de se encontrar na praça perto da estação ' +
      'depois do trabalho e eu fiquei esperando por mais de uma hora sem notícia nenhuma sua então fui embora ' +
      'e só depois descobri que o trem tinha parado no meio do caminho por causa da chuva forte.';
    const cues = montarLegendas(fala(texto, 300), cfg);
    expect(cues.length).toBeGreaterThan(3);
    // nenhuma palavra perdida ou duplicada
    expect(cues.map((c) => c.lines.join(' ')).join(' ')).toBe(texto);
    const mecanicas = new Set(['T1', 'T2', 'T3', 'T4', 'T6', 'T7']);
    const erros = analisar(cues, cfg, { nlp: new SegmentadorPtBr() }).filter(
      (s) => mecanicas.has(s.ruleId) && s.severity === 'erro',
    );
    expect(erros.map((e) => `${e.ruleId}@${e.cueIndex}: ${e.message}`)).toEqual([]);
    // tempos em ordem, com o intervalo mínimo
    for (let i = 1; i < cues.length; i++)
      expect(cues[i].startMs - cues[i - 1].endMs).toBeGreaterThanOrEqual(cfg.intervaloMinimoMs);
  });

  it('fala curta demais antes da próxima é juntada a ela quando cabe', () => {
    const cues = montarLegendas(fala('Sim | Não sei se vou poder ir amanhã', 250, 800), cfg);
    expect(cues).toHaveLength(1);
    expect(cues[0].lines.join(' ')).toBe('Sim Não sei se vou poder ir amanhã');
  });

  it('dá tempo de leitura depois da fala, sem invadir a próxima legenda', () => {
    const cues = montarLegendas(fala('Sim, claro. | Não sei se vou poder ir amanhã', 250, 1800), cfg);
    expect(cues).toHaveLength(2);
    expect(cues[0].endMs - cues[0].startMs).toBeGreaterThanOrEqual(cfg.duracaoMinimaMs);
    expect(cues[0].endMs).toBeLessThanOrEqual(cues[1].startMs - cfg.intervaloMinimoMs);
  });
});
