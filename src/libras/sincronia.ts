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
  let sa = 0, sb = 0;
  for (let i = ini; i < fim; i++) {
    sa += a[i];
    sb += b[i - lag];
  }
  const ma = sa / n, mb = sb / n;
  let sab = 0, saa = 0, sbb = 0;
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
