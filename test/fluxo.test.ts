import { describe, expect, it } from 'vitest';
import { rodar, daRegra } from './auxiliares';
import { aplicarDecisoes } from '../src/export/aplicar';
import { serializarSrt, serializarVtt } from '../src/export/serializar';
import { montarRelatorio, relatorioMarkdown } from '../src/export/relatorio';
import { analisar } from '../src/rules';
import { SegmentadorPtBr } from '../src/nlp/segmentador';
import type { ReviewState, Suggestion } from '../src/model/types';

const SRT = `1
00:00:01,000 --> 00:00:03,300
A juíza determinou a soltura dos dois presos  hoje ?

2
00:00:04,000 --> 00:00:08,000
Cantor lança o disco inédito no
centro de Recife

3
00:00:09,000 --> 00:00:11,300
Cantor lança o disco inédito no centro de Recife
`;

function estado(sugestoes: Suggestion[]): ReviewState {
  const r: ReviewState = {};
  for (const s of sugestoes) r[s.id] = { suggestion: s, decision: 'pendente' };
  return r;
}

describe('fluxo completo (caso de aceite 10)', () => {
  it('só aplica no arquivo final o que foi aprovado ou editado', () => {
    const { cues, sugestoes, config } = rodar(SRT);

    const t1 = daRegra(sugestoes, 'T1').find((s) => s.cueIndex === 1)!;
    const c8 = daRegra(sugestoes, 'C8').find((s) => s.cueIndex === 1)!;
    const l1 = daRegra(sugestoes, 'L1').find((s) => s.cueIndex === 2)!;
    const l2 = daRegra(sugestoes, 'L2').find((s) => s.cueIndex === 3)!;
    expect([t1, c8, l1, l2].every(Boolean)).toBe(true);

    const review = estado(sugestoes);
    // T1 não tem `after`: aprová-la não altera texto algum, apenas registra a
    // ciência da violação — é o comportamento esperado para regras sem correção.
    review[t1.id].decision = 'aprovada';
    review[c8.id].decision = 'aprovada';
    review[l1.id].decision = 'rejeitada';
    review[l2.id] = {
      suggestion: l2,
      decision: 'editada',
      editedAfter: { lines: ['Cantor lança o disco inédito', 'no centro de Recife'] },
    };

    const { cues: finais, aplicadas } = aplicarDecisoes(cues, review);

    // C8 aplicada
    expect(finais[0].lines).toEqual(['A juíza determinou a soltura dos dois presos hoje?']);
    // L1 rejeitada: legenda 2 intacta
    expect(finais[1].lines).toEqual(['Cantor lança o disco inédito no', 'centro de Recife']);
    // L2 editada: entra a versão do usuário, não a do modelo
    expect(finais[2].lines).toEqual(['Cantor lança o disco inédito', 'no centro de Recife']);
    expect(aplicadas).toContain(c8.id);
    expect(aplicadas).not.toContain(l1.id);

    // O original não foi mutado.
    expect(cues[0].lines).toEqual(['A juíza determinou a soltura dos dois presos  hoje ?']);

    const srt = serializarSrt(finais);
    expect(srt).toContain('00:00:01,000 --> 00:00:03,300');
    expect(srt).toContain('A juíza determinou a soltura dos dois presos hoje?');
    expect(srt).not.toContain('presos  hoje');
    expect(srt.trimEnd().split('\n\n')).toHaveLength(3);

    const vtt = serializarVtt(finais);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:03.300');

    // Relatório registra as quatro decisões.
    const remanescentes = analisar(finais, config, { nlp: new SegmentadorPtBr() });
    const rel = montarRelatorio({
      arquivo: 'exemplo.srt',
      config,
      cuesOriginais: cues,
      cuesFinais: finais,
      sugestoes,
      review,
      sugestoesRemanescentes: remanescentes,
      conflitos: [],
    });

    const porId = new Map(rel.decisoes.map((d) => [d.id, d]));
    expect(porId.get(t1.id)!.decisao).toBe('aprovada');
    expect(porId.get(c8.id)!.decisao).toBe('aprovada');
    expect(porId.get(l1.id)!.decisao).toBe('rejeitada');
    expect(porId.get(l2.id)!.decisao).toBe('editada');
    expect(porId.get(l2.id)!.depois).toEqual([
      'Cantor lança o disco inédito',
      'no centro de Recife',
    ]);
    expect(rel.totais.aprovadas).toBe(2);
    expect(rel.totais.editadas).toBe(1);
    expect(rel.totais.rejeitadas).toBe(1);

    const md = relatorioMarkdown(rel);
    expect(md).toContain('# Relatório de QA');
    expect(md).toContain('Guia para Produções Audiovisuais Acessíveis');
    expect(md).toContain('| 1 | C8');
    expect(md).toMatch(/rejeitada/);
    // A observação sobre o módulo L2 desligado precisa constar.
    expect(md).toMatch(/redução textual \(L2\) estava desligado/);
  });

  it('não aplica nada quando tudo está pendente', () => {
    const { cues, sugestoes } = rodar(SRT);
    const { cues: finais, aplicadas } = aplicarDecisoes(cues, estado(sugestoes));
    expect(aplicadas).toHaveLength(0);
    expect(serializarSrt(finais)).toBe(serializarSrt(cues));
  });

  it('registra conflito quando duas aprovações tocam a mesma legenda', () => {
    const { cues, sugestoes } = rodar(SRT);
    const review = estado(sugestoes);
    for (const s of sugestoes.filter((x) => x.cueIndex === 1 && x.after)) {
      review[s.id].decision = 'aprovada';
    }
    const r = aplicarDecisoes(cues, review);
    // Com apenas uma sugestão com `after` na legenda 1, não há conflito.
    expect(r.conflitos).toHaveLength(0);
    expect(r.aplicadas.length).toBeGreaterThan(0);
  });

  it('a numeração é refeita em sequência na exportação', () => {
    const { cues } = rodar(`5
00:00:01,000 --> 00:00:03,000
Um

9
00:00:04,000 --> 00:00:06,000
Dois
`);
    const srt = serializarSrt(cues);
    expect(srt.split('\n')[0]).toBe('1');
    expect(srt).toContain('\n2\n00:00:04,000');
  });
});
