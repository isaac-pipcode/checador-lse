/**
 * Sincronização do clipe do intérprete pela trilha-guia: em estúdio, o
 * intérprete ouve a obra e a câmera costuma registrar esse som. A defasagem é
 * o atraso que maximiza a correlação entre os envelopes de energia da obra e
 * do clipe.
 *
 * Sem som-guia no clipe (gravação muda), não há o que correlacionar: a
 * confiança sai baixa e a interface pede ajuste manual.
 */

/** Envelope em dB → energia linear, centrada e normalizada (média 0, desvio 1). */
function normalizar(env: Float32Array): Float32Array {
  const lin = Float32Array.from(env, (db) => Math.pow(10, db / 20));
  let m = 0;
  for (const v of lin) m += v;
  m /= Math.max(1, lin.length);
  let s = 0;
  for (let i = 0; i < lin.length; i++) {
    lin[i] -= m;
    s += lin[i] * lin[i];
  }
  const dp = Math.sqrt(s / Math.max(1, lin.length)) || 1;
  for (let i = 0; i < lin.length; i++) lin[i] /= dp;
  return lin;
}

function decimar(env: Float32Array, fator: number): Float32Array {
  if (fator <= 1) return env;
  const n = Math.floor(env.length / fator);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < fator; k++) s += env[i * fator + k];
    out[i] = s / fator;
  }
  return out;
}

/**
 * Correlação de Pearson entre a[i] e b[i − lag], calculada só na sobreposição.
 * Sobreposições curtas demais são recusadas (−1): com poucas amostras, a
 * correlação chega a 1 por acaso — foi o defeito que levou a esta regra.
 */
function correlacao(a: Float32Array, b: Float32Array, lag: number, minimo: number): number {
  const ini = Math.max(0, lag);
  const fim = Math.min(a.length, b.length + lag);
  const n = fim - ini;
  if (n < minimo) return -1;
  let sa = 0,
    sb = 0;
  for (let i = ini; i < fim; i++) {
    sa += a[i];
    sb += b[i - lag];
  }
  const ma = sa / n,
    mb = sb / n;
  let sab = 0,
    saa = 0,
    sbb = 0;
  for (let i = ini; i < fim; i++) {
    const x = a[i] - ma;
    const y = b[i - lag] - mb;
    sab += x * y;
    saa += x * x;
    sbb += y * y;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : -1;
}

export interface ResultadoSincronia {
  /** instante da obra em que o clipe começa (ms) */
  inicioNaObraMs: number;
  /** correlação no pico, 0–1 */
  correlacao: number;
  /** quanto o pico se destaca do segundo melhor, fora da vizinhança (0–1) */
  destaque: number;
  confianca: number;
}

/**
 * Busca em duas resoluções: grossa (50 ms, até ±maxMs) e fina (10 ms, ±100 ms
 * em torno do pico). Usa no máximo os primeiros `analiseMs` de cada sinal.
 */
export function estimarInicio(
  envObra: Float32Array,
  envClipe: Float32Array,
  janelaMs: number,
  maxMs = 60000,
  analiseMs = 600000,
): ResultadoSincronia {
  const corte = Math.round(analiseMs / janelaMs);
  const A = normalizar(envObra.subarray(0, corte));
  const B = normalizar(envClipe.subarray(0, corte));

  const fator = Math.max(1, Math.round(50 / janelaMs));
  const a = decimar(A, fator);
  const b = decimar(B, fator);
  const passo = janelaMs * fator;
  const maxLag = Math.round(maxMs / passo);
  // sobreposição mínima: 5 s ou 1/4 do sinal mais curto, o que for maior
  const minimoMs = Math.max(5000, 0.25 * Math.min(a.length, b.length) * passo);
  const minimoGrosso = Math.round(minimoMs / passo);
  const valores: number[] = [];
  let melhor = -Infinity;
  let melhorLag = 0;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const c = correlacao(a, b, lag, minimoGrosso);
    valores.push(c);
    if (c > melhor) {
      melhor = c;
      melhorLag = lag;
    }
  }
  // segundo pico: o maior valor fora do lóbulo principal (a região em torno do
  // pico onde a correlação só desce). Sons longos dão lóbulos largos; uma
  // vizinhança fixa confundiria a encosta do pico com um rival.
  const ip = melhorLag + maxLag;
  let esq = ip;
  while (esq > 0 && valores[esq - 1] <= valores[esq]) esq--;
  let dir = ip;
  while (dir < valores.length - 1 && valores[dir + 1] <= valores[dir]) dir++;
  let segundo = -Infinity;
  valores.forEach((c, i) => {
    if ((i < esq || i > dir) && c > segundo) segundo = c;
  });

  // refinamento na resolução original
  let fino = melhorLag * fator;
  let melhorFino = -Infinity;
  const raio = Math.round(100 / janelaMs);
  for (let lag = fino - raio - fator; lag <= fino + raio + fator; lag++) {
    const c = correlacao(A, B, lag, minimoGrosso * fator);
    if (c > melhorFino) {
      melhorFino = c;
      fino = lag;
    }
  }

  const corr = Math.max(0, Math.min(1, melhorFino));
  const destaque = melhor > 0 ? Math.max(0, Math.min(1, (melhor - Math.max(0, segundo)) / melhor)) : 0;
  return {
    inicioNaObraMs: fino * janelaMs,
    correlacao: corr,
    destaque,
    // correlação no pico, penalizada só quando o pico não se destaca: um rival
    // acima de 70% do pico (destaque < 0,3) torna a escolha ambígua.
    confianca: Math.round(corr * Math.min(1, destaque / 0.3) * 100) / 100,
  };
}

export interface AnaliseSincronia {
  inicioNaObraMs: number;
  /** tempo na obra = início + tempo no clipe × velocidade */
  velocidade: number;
  confianca: number;
  relatorio: {
    janelasValidas: number;
    janelasTotais: number;
    derivaMsPorHora: number;
    desvioMs: number;
    corrigida: boolean;
    pontos: Array<{ tClipeMs: number; residuoMs: number; corr: number }>;
  };
}

/**
 * Sincronização completa: início (estimativa global) + deriva (defasagem medida
 * em janelas ao longo do clipe, ajustada por reta com rejeição de discrepantes).
 *
 * A deriva só é corrigida quando acumula ao menos meio quadro ao longo do
 * clipe e há janelas válidas suficientes; abaixo disso, velocidade = 1.
 */
/**
 * Razões de velocidade típicas de conversão de cadência (pulldown, PAL speed-up,
 * 1000/1001). Testadas antes da medida fina: com 4% de diferença, a estimativa
 * global se borra demais para a análise por janelas recuperar.
 */
export const RAZOES_CADENCIA: Array<{ razao: number; rotulo: string }> = [
  { razao: 1, rotulo: 'mesma cadência' },
  { razao: 1001 / 1000, rotulo: '1000/1001 (NTSC)' },
  { razao: 1000 / 1001, rotulo: '1001/1000 (NTSC)' },
  { razao: 25 / 24, rotulo: '25 ↔ 24 qd/s' },
  { razao: 24 / 25, rotulo: '24 ↔ 25 qd/s' },
  { razao: 25 / (24000 / 1001), rotulo: '25 ↔ 23,976 qd/s' },
  { razao: 24000 / 1001 / 25, rotulo: '23,976 ↔ 25 qd/s' },
];

/** Reamostra o envelope do clipe para a escala de tempo da obra (tObra = tClipe × razão). */
export function reamostrar(env: Float32Array, razao: number): Float32Array {
  if (razao === 1) return env;
  const n = Math.floor(env.length * razao);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / razao;
    const k = Math.floor(x);
    const f = x - k;
    out[i] = k + 1 < env.length ? env[k] * (1 - f) + env[k + 1] * f : env[Math.min(k, env.length - 1)];
  }
  return out;
}

export function analisarSincronia(
  envObra: Float32Array,
  envClipeOriginal: Float32Array,
  janelaMs: number,
  opcoes: { fps?: number; janelaAnaliseMs?: number; maxJanelas?: number; buscaMs?: number } = {},
): AnaliseSincronia & { razaoCadencia: { razao: number; rotulo: string } } {
  const fps = opcoes.fps ?? 24;
  // 1. razão de cadência: a que dá a maior correlação global (empate → mesma cadência)
  // "mesma cadência" vence se estiver a até 0,05 da melhor (não inventar conversão);
  // entre as demais, a de maior correlação
  const candidatas = RAZOES_CADENCIA.map((c) => ({
    ...c,
    est: estimarInicio(envObra, reamostrar(envClipeOriginal, c.razao), janelaMs, 60000, 300000),
  }));
  const melhor = candidatas.reduce((m, c) => (c.est.correlacao > m.est.correlacao ? c : m));
  const escolha = candidatas[0].est.correlacao >= melhor.est.correlacao - 0.05 ? candidatas[0] : melhor;
  const envClipe = reamostrar(envClipeOriginal, escolha.razao);
  const global = escolha.razao === 1 ? estimarInicio(envObra, envClipe, janelaMs) : escolha.est;
  const A = normalizar(envObra);
  const B = normalizar(envClipe);
  const lenJ = Math.round((opcoes.janelaAnaliseMs ?? 20000) / janelaMs);
  const busca = Math.round((opcoes.buscaMs ?? 2500) / janelaMs);
  const lag0 = Math.round(global.inicioNaObraMs / janelaMs);

  // janelas do clipe que caem dentro da obra
  const ini = Math.max(0, -lag0);
  const fim = Math.min(B.length, A.length - lag0);
  const disponiveis = Math.floor((fim - ini) / lenJ);
  const total = Math.min(disponiveis, opcoes.maxJanelas ?? 60);
  const passo = total > 0 ? Math.floor((fim - ini - lenJ) / Math.max(1, total - 1)) : 0;

  const medidas: Array<{ t: number; d: number; corr: number }> = [];
  for (let k = 0; k < total; k++) {
    const j0 = ini + k * passo;
    const trechoB = B.subarray(j0, j0 + lenJ);
    // energia mínima: trecho mudo não mede nada
    let e = 0;
    for (const v of trechoB) e += v * v;
    if (e / lenJ < 0.05) continue;
    let melhor = -Infinity;
    let melhorLag = lag0;
    for (let lag = lag0 - busca; lag <= lag0 + busca; lag++) {
      const a0 = j0 + lag;
      if (a0 < 0 || a0 + lenJ > A.length) continue;
      let s = 0,
        sa = 0,
        sb = 0,
        saa = 0,
        sbb = 0;
      for (let i = 0; i < lenJ; i++) {
        const x = A[a0 + i];
        const y = trechoB[i];
        s += x * y;
        sa += x;
        sb += y;
        saa += x * x;
        sbb += y * y;
      }
      const cov = s - (sa * sb) / lenJ;
      const den = Math.sqrt((saa - (sa * sa) / lenJ) * (sbb - (sb * sb) / lenJ));
      const c = den > 0 ? cov / den : -1;
      if (c > melhor) {
        melhor = c;
        melhorLag = lag;
      }
    }
    if (melhor >= 0.6) medidas.push({ t: (j0 + lenJ / 2) * janelaMs, d: melhorLag * janelaMs, corr: melhor });
  }

  // reta d(t) = a + b·t, com uma rodada de rejeição de discrepantes (3 × MAD)
  const ajustar = (pts: typeof medidas) => {
    const n = pts.length;
    const mt = pts.reduce((s, p) => s + p.t, 0) / n;
    const md = pts.reduce((s, p) => s + p.d, 0) / n;
    let num = 0,
      den = 0;
    for (const p of pts) {
      num += (p.t - mt) * (p.d - md);
      den += (p.t - mt) ** 2;
    }
    const b = den > 0 ? num / den : 0;
    return { a: md - b * mt, b };
  };
  let usados = medidas;
  let reta = { a: global.inicioNaObraMs, b: 0 };
  if (medidas.length >= 3) {
    reta = ajustar(medidas);
    const res = medidas.map((p) => Math.abs(p.d - (reta.a + reta.b * p.t)));
    const mad = [...res].sort((x, y) => x - y)[Math.floor(res.length / 2)] || janelaMs;
    usados = medidas.filter((_, i) => res[i] <= Math.max(3 * mad, 2 * janelaMs));
    if (usados.length >= 3) reta = ajustar(usados);
  }

  const duracaoClipeMs = envClipe.length * janelaMs;
  const acumulado = Math.abs(reta.b) * duracaoClipeMs;
  const corrigirFino = usados.length >= 4 && acumulado >= 500 / fps; // ≥ meio quadro
  const corrigir = corrigirFino || escolha.razao !== 1;
  const velocidade = escolha.razao * (corrigirFino ? 1 + reta.b : 1);
  const a = corrigirFino
    ? reta.a
    : usados.length
      ? usados.reduce((s, p) => s + p.d, 0) / usados.length
      : global.inicioNaObraMs;
  const residuo = (p: { t: number; d: number }) => p.d - (corrigirFino ? reta.a + reta.b * p.t : a);
  const desvio = usados.length ? Math.sqrt(usados.reduce((s, p) => s + residuo(p) ** 2, 0) / usados.length) : 0;
  const cobertura = total > 0 ? usados.length / total : 0;

  return {
    inicioNaObraMs: Math.round(a),
    velocidade,
    // confiança: a global, ponderada pela fração de janelas que concordam
    confianca: Math.round(global.confianca * (total > 0 ? 0.5 + 0.5 * cobertura : 1) * 100) / 100,
    razaoCadencia: { razao: escolha.razao, rotulo: escolha.rotulo },
    relatorio: {
      janelasValidas: usados.length,
      janelasTotais: total,
      // deriva total em relação à obra: cadência + relógio
      derivaMsPorHora: Math.round((velocidade - 1) * 3_600_000),
      desvioMs: Math.round(desvio),
      corrigida: corrigir,
      // t medido na escala da obra; convertido para o tempo do clipe
      pontos: medidas.map((p) => ({
        tClipeMs: Math.round(p.t / escolha.razao),
        residuoMs: Math.round(residuo(p)),
        corr: Math.round(p.corr * 100) / 100,
      })),
    },
  };
}
