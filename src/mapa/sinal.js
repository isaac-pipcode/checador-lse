const PISO_ABSOLUTO_DB = -100;
/** Energia RMS por janela, em dBFS. Funções puras: testáveis sem navegador. */
export function envelopeRmsDb(amostras, taxa, janelaMs) {
    const porJanela = Math.max(1, Math.round((taxa * janelaMs) / 1000));
    const n = Math.ceil(amostras.length / porJanela);
    const out = new Float32Array(n);
    for (let j = 0; j < n; j++) {
        const ini = j * porJanela;
        const fim = Math.min(amostras.length, ini + porJanela);
        let soma = 0;
        for (let i = ini; i < fim; i++)
            soma += amostras[i] * amostras[i];
        const rms = Math.sqrt(soma / Math.max(1, fim - ini));
        out[j] = rms > 0 ? Math.max(PISO_ABSOLUTO_DB, 20 * Math.log10(rms)) : PISO_ABSOLUTO_DB;
    }
    return out;
}
export function percentil(valores, p) {
    if (valores.length === 0)
        return PISO_ABSOLUTO_DB;
    const ordenados = Float32Array.from(valores).sort();
    const i = Math.min(ordenados.length - 1, Math.max(0, Math.floor(p * (ordenados.length - 1))));
    return ordenados[i];
}
/**
 * Detecção de atividade sonora por limiar adaptativo sobre o piso de ruído.
 * Não distingue fala de música ou ruído: é "há som relevante aqui", não
 * "há alguém falando aqui". Com trilha musical contínua, quase tudo é ativo.
 */
export function detectarAtividade(envelopeDb, janelaMs, p) {
    const pisoDb = percentil(envelopeDb, p.percentilPiso);
    const limiar = pisoDb + p.limiarDb;
    // Histerese simples: sai do estado ativo só 3 dB abaixo do limiar de entrada.
    const limiarSaida = limiar - 3;
    const brutos = [];
    let inicio = null;
    for (let j = 0; j < envelopeDb.length; j++) {
        const v = envelopeDb[j];
        if (inicio === null && v >= limiar)
            inicio = j;
        else if (inicio !== null && v < limiarSaida) {
            brutos.push({ inicioMs: inicio * janelaMs, fimMs: j * janelaMs });
            inicio = null;
        }
    }
    if (inicio !== null)
        brutos.push({ inicioMs: inicio * janelaMs, fimMs: envelopeDb.length * janelaMs });
    const fundidos = [];
    for (const s of brutos) {
        const ultimo = fundidos[fundidos.length - 1];
        if (ultimo && s.inicioMs - ultimo.fimMs < p.fusaoMs)
            ultimo.fimMs = s.fimMs;
        else
            fundidos.push({ ...s });
    }
    return {
        atividade: fundidos.filter((s) => s.fimMs - s.inicioMs >= p.duracaoMinimaMs),
        pisoDb,
    };
}
/** Complemento de uma lista ordenada de intervalos dentro de [0, duracao). */
export function complemento(intervalos, duracaoMs) {
    const out = [];
    let cursor = 0;
    for (const i of [...intervalos].sort((a, b) => a.inicioMs - b.inicioMs)) {
        if (i.inicioMs > cursor)
            out.push({ inicioMs: cursor, fimMs: i.inicioMs });
        cursor = Math.max(cursor, i.fimMs);
    }
    if (cursor < duracaoMs)
        out.push({ inicioMs: cursor, fimMs: duracaoMs });
    return out;
}
/** Quanto de [a] está coberto por [lista] (ms). */
export function sobreposicaoMs(a, lista) {
    let total = 0;
    for (const b of lista) {
        if (b.fimMs <= a.inicioMs)
            continue;
        if (b.inicioMs >= a.fimMs)
            break;
        total += Math.min(a.fimMs, b.fimMs) - Math.max(a.inicioMs, b.inicioMs);
    }
    return total;
}
/** Busca binária: primeiro intervalo cujo fim é > ms. Pressupõe lista ordenada. */
export function primeiroApos(lista, ms) {
    let lo = 0;
    let hi = lista.length;
    while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (lista[m].fimMs <= ms)
            lo = m + 1;
        else
            hi = m;
    }
    return lo;
}
/**
 * Versão incremental de `envelopeRmsDb`, para áudio que chega em blocos
 * (decodificação em streaming no desktop). Mesmo resultado, memória O(janelas).
 */
export class AcumuladorEnvelope {
    constructor(taxa, janelaMs) {
        Object.defineProperty(this, "porJanela", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "soma", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "n", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "valores", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.porJanela = Math.max(1, Math.round((taxa * janelaMs) / 1000));
    }
    adicionar(amostras) {
        for (let i = 0; i < amostras.length; i++) {
            this.soma += amostras[i] * amostras[i];
            if (++this.n === this.porJanela)
                this.fecharJanela();
        }
    }
    fecharJanela() {
        const rms = Math.sqrt(this.soma / Math.max(1, this.n));
        this.valores.push(rms > 0 ? Math.max(PISO_ABSOLUTO_DB, 20 * Math.log10(rms)) : PISO_ABSOLUTO_DB);
        this.soma = 0;
        this.n = 0;
    }
    concluir() {
        if (this.n > 0)
            this.fecharJanela();
        return Float32Array.from(this.valores);
    }
}
