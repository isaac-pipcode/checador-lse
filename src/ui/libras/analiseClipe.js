import { processarQuadro } from '../../libras/tratamento';
import { detectarCorChave } from '../../libras/tratamento';
import { caixaDoInterprete, enquadramentoPara } from '../../libras/enquadramento';
/** Envelopes de som-guia já analisados, por caminho do clipe (para os gráficos de conferência). */
export const envelopesDoClipe = new Map();
/**
 * Amostra `n` quadros espalhados pelo clipe, reduzidos a `largura` px, num
 * vídeo próprio (não interfere na prévia).
 */
export async function amostrarQuadros(url, n, largura = 200) {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.src = url;
    await new Promise((ok, falha) => {
        v.addEventListener('loadeddata', () => ok(), { once: true });
        v.addEventListener('error', () => falha(new Error('Não foi possível ler o clipe.')), { once: true });
    });
    const fonte = { w: v.videoWidth, h: v.videoHeight };
    const w = largura;
    const h = Math.max(2, Math.round((largura * fonte.h) / fonte.w));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const quadros = [];
    for (let i = 0; i < n; i++) {
        const t = (v.duration * (i + 0.5)) / n;
        await new Promise((ok) => {
            v.addEventListener('seeked', () => ok(), { once: true });
            v.currentTime = t;
        });
        ctx.drawImage(v, 0, 0, w, h);
        quadros.push(ctx.getImageData(0, 0, w, h));
    }
    v.removeAttribute('src');
    v.load();
    return { quadros, w, h, fonte };
}
/** Cor-chave mais frequente entre os quadros (detecção nas bordas de cada um). */
export function corChaveDosQuadros(quadros) {
    const votos = new Map();
    for (const q of quadros) {
        const c = detectarCorChave(q.data, q.width, q.height);
        if (c)
            votos.set(c, (votos.get(c) ?? 0) + 1);
    }
    if (votos.size === 0)
        return null;
    // média das cores votadas (são próximas entre si; a média é mais estável que a moda)
    const cores = [...votos.keys()].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    const med = [0, 1, 2].map((k) => Math.round(cores.reduce((s, c) => s + c[k], 0) / cores.length));
    return `#${med
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
}
/**
 * Enquadramento automático: recorta o fundo de cada quadro com os parâmetros
 * atuais, une as silhuetas (o espaço de sinalização) e calcula zoom e
 * deslocamentos para a proporção da janela.
 */
export function enquadramentoAutomatico(j, amostra, janelaPx) {
    const escala = amostra.w / amostra.fonte.w;
    const alfas = amostra.quadros.map((q) => {
        const d = new Uint8ClampedArray(q.data);
        processarQuadro(d, amostra.w, amostra.h, { chroma: { ...j.chroma, ativo: true, bordas: j.chroma.bordas }, cor: j.cor }, escala);
        const a = new Uint8Array(amostra.w * amostra.h);
        for (let i = 0; i < a.length; i++)
            a[i] = d[4 * i + 3];
        return a;
    });
    const caixa = caixaDoInterprete(alfas, amostra.w, amostra.h, Math.max(2, Math.round(amostra.h * 0.01)));
    if (!caixa)
        return null;
    const naFonte = { x: caixa.x / escala, y: caixa.y / escala, w: caixa.w / escala, h: caixa.h / escala };
    return {
        ...enquadramentoPara(naFonte, amostra.fonte, janelaPx),
        caixaFracao: { x: caixa.x / amostra.w, y: caixa.y / amostra.h, w: caixa.w / amostra.w, h: caixa.h / amostra.h },
        ignorados: caixa.ignorados.length,
    };
}
