import { describe, expect, it } from 'vitest';
import { rodar, daRegra, config } from './auxiliares';
import { contarCaracteres, cpsDaLegenda } from '../src/core/texto';

describe('T1 — caracteres por linha (caso de aceite 1)', () => {
  it('acusa erro em linha de 44 caracteres', () => {
    const linha = 'A juíza determinou a soltura dos dois presos';
    expect(contarCaracteres(linha, config())).toBe(44);
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
${linha}
`);
    const t1 = daRegra(sugestoes, 'T1');
    expect(t1).toHaveLength(1);
    expect(t1[0].severity).toBe('erro');
    expect(t1[0].message).toMatch(/44 caracteres/);
    expect(t1[0].autoFixable).toBe(false);
  });

  it('não acusa linha de exatamente 37 caracteres', () => {
    const linha = 'a'.repeat(37);
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
${linha}
`);
    expect(daRegra(sugestoes, 'T1')).toHaveLength(0);
  });
});

describe('T2 — número de linhas (caso de aceite 2)', () => {
  it('acusa erro em legenda de 3 linhas e propõe reflow quando cabe em 2', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
Primeira
segunda
terceira
`);
    const t2 = daRegra(sugestoes, 'T2');
    expect(t2).toHaveLength(1);
    expect(t2[0].severity).toBe('erro');
    // O texto cabe em uma única linha; o reflow devolve o mínimo de linhas
    // necessário, sempre dentro do teto de duas.
    expect(t2[0].after!.lines.length).toBeLessThanOrEqual(2);
    expect(t2[0].after?.lines.join(' ')).toBe('Primeira segunda terceira');
  });

  it('não propõe reflow quando o texto não cabe em 2×37', () => {
    const longa = 'palavra '.repeat(15).trim();
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:09,000
${longa}
${longa}
${longa}
`);
    const t2 = daRegra(sugestoes, 'T2');
    expect(t2[0].after).toBeUndefined();
    expect(t2[0].autoFixable).toBe(false);
  });
});

describe('T3 — duração mínima (caso de aceite 8)', () => {
  it('acusa erro em legenda de 900 ms', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:01,900
Curta
`);
    const t3 = daRegra(sugestoes, 'T3');
    expect(t3).toHaveLength(1);
    expect(t3[0].severity).toBe('erro');
  });
});

describe('T4 — duração máxima', () => {
  it('avisa acima de 4 s e erra acima de 6 s', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:06,000
Legenda de cinco segundos

2
00:00:10,000 --> 00:00:17,000
Legenda de sete segundos
`);
    const t4 = daRegra(sugestoes, 'T4');
    expect(t4).toHaveLength(2);
    expect(t4[0].severity).toBe('aviso');
    expect(t4[1].severity).toBe('erro');
  });
});

describe('T5 — velocidade (caso de aceite 3)', () => {
  const texto = 'Cantor lança o disco inédito no centro de Recife';

  it('conta 48 caracteres, como o Guia', () => {
    expect(contarCaracteres(texto, config())).toBe(48);
  });

  it('acusa erro acima do teto de 18 cps e lista a legenda como candidata a L2', () => {
    const { sugestoes, cues, config: cfg } = rodar(`1
00:00:01,000 --> 00:00:03,300
${texto}
`);
    expect(cpsDaLegenda(cues[0], cfg)).toBeCloseTo(20.87, 1);
    const t5 = daRegra(sugestoes, 'T5');
    expect(t5).toHaveLength(1);
    expect(t5[0].severity).toBe('erro');
    const l2 = daRegra(sugestoes, 'L2');
    expect(l2).toHaveLength(1);
    expect(l2[0].verifiability).toBe('llm');
    // Sem o módulo assistido, L2 se declara indisponível em vez de simular.
    expect(l2[0].unavailable).toBe(true);
    expect(l2[0].after).toBeUndefined();
  });

  it('classifica como aviso entre o alvo e o teto', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
${texto}
`);
    const t5 = daRegra(sugestoes, 'T5');
    expect(t5[0].severity).toBe('aviso'); // 16 cps: acima do alvo 15, abaixo do teto 18
  });
});

describe('T6 — sobreposição (caso de aceite 6)', () => {
  it('acusa erro e propõe antecipar a saída preservando o intervalo mínimo', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
Primeira

2
00:00:04,800 --> 00:00:08,000
Segunda
`);
    const t6 = daRegra(sugestoes, 'T6');
    expect(t6).toHaveLength(1);
    expect(t6[0].severity).toBe('erro');
    expect(t6[0].autoFixable).toBe(true);
    expect(t6[0].after?.endMs).toBe(4800 - 83);
  });

  it('não propõe correção quando não há folga para a duração mínima', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
Primeira

2
00:00:01,500 --> 00:00:08,000
Segunda
`);
    const t6 = daRegra(sugestoes, 'T6');
    expect(t6[0].autoFixable).toBe(false);
    expect(t6[0].after).toBeUndefined();
    expect(t6[0].message).toMatch(/manualmente/);
  });
});

describe('T7 — intervalo mínimo', () => {
  it('avisa quando o intervalo é menor que 2 quadros', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
Primeira

2
00:00:05,040 --> 00:00:08,000
Segunda
`);
    const t7 = daRegra(sugestoes, 'T7');
    expect(t7).toHaveLength(1);
    expect(t7[0].severity).toBe('aviso');
    expect(t7[0].after?.endMs).toBe(5040 - 83);
  });

  it('não dispara quando há sobreposição (assunto de T6)', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:05,000
Primeira

2
00:00:04,800 --> 00:00:08,000
Segunda
`);
    expect(daRegra(sugestoes, 'T7')).toHaveLength(0);
  });
});

describe('T8 — formato retangular', () => {
  it('avisa em desequilíbrio acima de 40% e não propõe requebra automática', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:06,000
Uma linha bem comprida aqui nesta
curta
`);
    const t8 = daRegra(sugestoes, 'T8');
    expect(t8).toHaveLength(1);
    expect(t8[0].after).toBeUndefined();
  });
});

describe('C1 — colchetes (caso de aceite 7)', () => {
  it('sugere [passos] para (passos) no início da legenda', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:03,000
(passos)
`);
    const c1 = daRegra(sugestoes, 'C1');
    expect(c1).toHaveLength(1);
    expect(c1[0].after?.lines).toEqual(['[passos]']);
    expect(c1[0].severity).toBe('aviso');
    expect(c1[0].confidence).toBeGreaterThan(0.5);
  });

  it('não mexe em parênteses no meio da fala', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
Ele disse (e eu ouvi bem) que viria
`);
    expect(daRegra(sugestoes, 'C1')).toHaveLength(0);
  });
});

describe('C2 — travessão de diálogo (caso de aceite 4)', () => {
  it('cola o traço na palavra', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:03,000
- Aguente firme
`);
    const c2 = daRegra(sugestoes, 'C2');
    expect(c2).toHaveLength(1);
    expect(c2[0].after?.lines).toEqual(['-Aguente firme']);
    expect(c2[0].autoFixable).toBe(true);
  });

  it('marca as duas falas quando só uma tem traço', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:03,000
-Você vem?
Não sei ainda
`);
    const c2 = daRegra(sugestoes, 'C2');
    expect(c2[0].after?.lines).toEqual(['-Você vem?', '-Não sei ainda']);
  });

  it('respeita o toggle de configuração', () => {
    const { sugestoes } = rodar(
      `1
00:00:01,000 --> 00:00:03,000
- Aguente firme
`,
      { checarTracoDialogo: false },
    );
    expect(daRegra(sugestoes, 'C2')).toHaveLength(0);
  });
});

describe('C5 — vírgula final', () => {
  it('sugere remover a vírgula quando a frase continua', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:03,000
Quando ele chegou,

2
00:00:03,200 --> 00:00:05,000
todos já tinham saído.
`);
    const c5 = daRegra(sugestoes, 'C5');
    expect(c5).toHaveLength(1);
    expect(c5[0].after?.lines).toEqual(['Quando ele chegou']);
  });

  it('não mexe quando a legenda seguinte inicia período novo', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:03,000
Sim, senhor,

2
00:00:03,200 --> 00:00:05,000
Amanhã eu volto.
`);
    expect(daRegra(sugestoes, 'C5')).toHaveLength(0);
  });
});

describe('C6 — exclamações', () => {
  it('avisa no escopo do documento acima do limiar', () => {
    const blocos = Array.from({ length: 12 }, (_, i) => {
      const s = 1 + i * 5;
      return `${i + 1}
00:00:${String(s).padStart(2, '0')},000 --> 00:00:${String(s + 3).padStart(2, '0')},000
Corre!`;
    }).join('\n\n');
    const { sugestoes } = rodar(blocos);
    const c6 = daRegra(sugestoes, 'C6');
    expect(c6).toHaveLength(1);
    expect(c6[0].cueIndex).toBe(-1);
    expect(c6[0].autoFixable).toBe(false);
  });
});

describe('C8 — limpeza tipográfica (caso de aceite 5)', () => {
  it('corrige espaço duplo e espaço antes de pontuação', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
Você  vem mesmo ?
`);
    const c8 = daRegra(sugestoes, 'C8');
    expect(c8).toHaveLength(1);
    expect(c8[0].after?.lines).toEqual(['Você vem mesmo?']);
    expect(c8[0].autoFixable).toBe(true);
    expect(c8[0].message).toMatch(/espaço duplicado/);
  });

  it('corrige espaço interno em colchetes e no fim da linha', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
[ passos ] na escada 
`);
    const c8 = daRegra(sugestoes, 'C8');
    expect(c8[0].after?.lines).toEqual(['[passos] na escada']);
  });
});

describe('C4 — markup de itálico', () => {
  it('acusa tag não fechada e propõe fechamento', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
<i>Voz distante na sala
`);
    const c4 = daRegra(sugestoes, 'C4').filter((s) => s.verifiability === 'deterministica');
    expect(c4).toHaveLength(1);
    expect(c4[0].after?.lines).toEqual(['<i>Voz distante na sala</i>']);
  });
});

describe('regras manuais', () => {
  it('X1 sinaliza trecho longo sem identificação de falante', () => {
    const blocos = Array.from({ length: 25 }, (_, i) => {
      const s = i * 4;
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      const mm2 = String(Math.floor((s + 3) / 60)).padStart(2, '0');
      const ss2 = String((s + 3) % 60).padStart(2, '0');
      return `${i + 1}
00:${mm}:${ss},000 --> 00:${mm2}:${ss2},000
Fala número ${i + 1}`;
    }).join('\n\n');
    const { sugestoes } = rodar(blocos);
    const x1 = daRegra(sugestoes, 'X1');
    expect(x1.length).toBeGreaterThan(0);
    expect(x1[0].severity).toBe('revisao_manual');
    expect(x1[0].autoFixable).toBe(false);
    expect(x1[0].after).toBeUndefined();
  });

  it('itens manuais nunca trazem correção automática', () => {
    const { sugestoes } = rodar(`1
00:00:01,000 --> 00:00:04,000
[MÚSICA] Um dia...
`);
    for (const s of sugestoes.filter((x) => x.verifiability === 'manual')) {
      expect(s.after).toBeUndefined();
      expect(s.autoFixable).toBe(false);
      expect(s.severity).toBe('revisao_manual');
    }
  });
});
