import { retanguloJanela } from './geometria';
/** Proporções sugeridas. "NBR" é a que resulta dos mínimos (1/4 × 1/2) no quadro da obra. */
export function propostas(quadro, norma) {
    const nbr = (norma.larguraMin * quadro.w) / (norma.alturaMin * quadro.h);
    const fr = (a) => {
        const casos = [
            [8 / 9, '8:9'],
            [1, '1:1'],
            [3 / 4, '3:4'],
            [9 / 16, '9:16'],
            [2 / 3, '2:3'],
        ];
        const m = casos.find(([v]) => Math.abs(v - a) < 0.01);
        return m ? m[1] : a.toFixed(2).replace('.', ',');
    };
    return [
        {
            id: 'nbr',
            rotulo: `NBR (${fr(nbr)})`,
            descricao: 'Mínimos da norma: 1/4 da largura × 1/2 da altura do quadro.',
            aspecto: nbr,
        },
        {
            id: '3:4',
            rotulo: '3:4',
            descricao: 'Mais alta: corpo inteiro e espaço de sinalização acima da cabeça.',
            aspecto: 3 / 4,
        },
        { id: '1:1', rotulo: '1:1', descricao: 'Quadrada: mais espaço lateral para os braços.', aspecto: 1 },
        { id: 'livre', rotulo: 'Livre', descricao: 'Altura e largura independentes.', aspecto: null },
    ];
}
/**
 * Aplica uma proporção mantendo a altura e respeitando os mínimos: se a largura
 * resultante ficar abaixo do mínimo, cresce a altura junto.
 */
export function aplicarProporcao(altura, aspecto, quadro, norma) {
    let h = Math.max(altura, norma.alturaMin);
    let w = (h * quadro.h * aspecto) / quadro.w;
    if (w < norma.larguraMin) {
        w = norma.larguraMin;
        h = (w * quadro.w) / (aspecto * quadro.h);
    }
    // não passar de 95% do quadro
    const k = Math.min(1, 0.95 / h, 0.95 / w);
    return { altura: round3(h * k), largura: round3(w * k) };
}
const round3 = (x) => Math.round(x * 1000) / 1000;
/** Área segura para grafismos: 5% de cada borda (convenção de broadcast). */
export const AREA_SEGURA = 0.05;
export function dentroDaAreaSegura(j, quadro) {
    const r = retanguloJanela(j, quadro.w, quadro.h);
    const mx = AREA_SEGURA * quadro.w;
    const my = AREA_SEGURA * quadro.h;
    return r.x >= mx - 1 && r.y >= my - 1 && r.x + r.w <= quadro.w - mx + 1 && r.y + r.h <= quadro.h - my + 1;
}
/** Margem (fração do menor lado, como em `retanguloJanela`) que põe a janela na área segura. */
export function margemParaAreaSegura(quadro) {
    return round3((AREA_SEGURA * Math.max(quadro.w, quadro.h)) / Math.min(quadro.w, quadro.h));
}
/**
 * Caixa que contém o intérprete em todos os quadros amostrados (alfa > 0,5).
 * Unir os quadros mede o espaço de sinalização: as mãos se movem.
 *
 * Horizontalmente, fica com o bloco de colunas onde está o corpo (a coluna mais
 * ocupada) e os blocos vizinhos a menos de `vao` (fração da largura): mãos e
 * braços. Objetos separados por um vão maior (tripé, refletor, a borda do pano)
 * ficam de fora e são devolvidos em `ignorados`. Linhas/colunas com menos de
 * `minimo` pixels são ruído do recorte.
 */
export function caixaDoInterprete(alfas, w, h, minimo = 2, vao = 0.06) {
    const ocupCol = new Float32Array(w);
    const ocupLin = new Uint8Array(h);
    for (const a of alfas) {
        const l = new Uint32Array(h);
        const c = new Uint32Array(w);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (a[y * w + x] > 127) {
                    l[y]++;
                    c[x]++;
                }
            }
        }
        for (let x = 0; x < w; x++)
            if (c[x] >= minimo)
                ocupCol[x] += c[x];
        for (let y = 0; y < h; y++)
            if (l[y] >= minimo)
                ocupLin[y] = 1;
    }
    // blocos contíguos de colunas ocupadas
    const blocos = [];
    for (let x = 0; x < w; x++) {
        if (ocupCol[x] <= 0)
            continue;
        const ult = blocos[blocos.length - 1];
        if (ult && ult.x1 === x - 1) {
            ult.x1 = x;
            ult.massa += ocupCol[x];
        }
        else
            blocos.push({ x0: x, x1: x, massa: ocupCol[x] });
    }
    if (blocos.length === 0)
        return null;
    // o bloco do corpo é o de maior massa; agrega vizinhos a menos de `vao`
    const iCorpo = blocos.reduce((m, b, i) => (b.massa > blocos[m].massa ? i : m), 0);
    let e = iCorpo;
    let d = iCorpo;
    const v = vao * w;
    while (e > 0 && blocos[e].x0 - blocos[e - 1].x1 <= v)
        e--;
    while (d < blocos.length - 1 && blocos[d + 1].x0 - blocos[d].x1 <= v)
        d++;
    const x0 = blocos[e].x0;
    const x1 = blocos[d].x1;
    const ignorados = blocos.filter((_, i) => i < e || i > d).map(({ x0: a, x1: b }) => ({ x0: a, x1: b }));
    // linhas: só as das colunas aceitas
    const lin = new Uint8Array(h);
    for (const a of alfas) {
        for (let y = 0; y < h; y++) {
            let n = 0;
            for (let x = x0; x <= x1; x++)
                if (a[y * w + x] > 127)
                    n++;
            if (n >= minimo)
                lin[y] = 1;
        }
    }
    const y0 = lin.indexOf(1);
    if (y0 < 0)
        return null;
    const y1 = h - 1 - [...lin].reverse().indexOf(1);
    void ocupLin;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ignorados };
}
/**
 * Zoom e deslocamentos que fazem o recorte (na proporção da janela) conter a
 * caixa do intérprete com folga. Inverso de `recorteNaFonte`.
 */
export function enquadramentoPara(caixa, fonte, janela, folga = 0.08) {
    const A = janela.w / janela.h;
    const bw = caixa.w * (1 + 2 * folga);
    const bh = caixa.h * (1 + folga); // folga vertical menor: o corpo pode sair pela base
    let rh = Math.max(bh, bw / A);
    let rw = rh * A;
    // recorte de zoom 1 ("cobrir")
    const e1 = Math.max(janela.w / fonte.w, janela.h / fonte.h);
    const rh1 = Math.min(fonte.h, janela.h / e1);
    if (rw > fonte.w) {
        rw = fonte.w;
        rh = rw / A;
    }
    if (rh > fonte.h) {
        rh = fonte.h;
        rw = rh * A;
    }
    const zoom = Math.max(1, Math.min(3, rh1 / rh));
    // centro da caixa; a folga vertical vai para cima (espaço acima da cabeça)
    const cx = caixa.x + caixa.w / 2;
    const cy = caixa.y + caixa.h / 2 - (caixa.h * folga) / 2;
    const x = Math.min(Math.max(cx - rw / 2, 0), fonte.w - rw);
    const y = Math.min(Math.max(cy - rh / 2, 0), fonte.h - rh);
    const dx = fonte.w - rw > 1 ? (2 * x) / (fonte.w - rw) - 1 : 0;
    const dy = fonte.h - rh > 1 ? (2 * y) / (fonte.h - rh) - 1 : 0;
    return { zoom: round3(zoom), deslocX: round3(dx), deslocY: round3(dy) };
}
