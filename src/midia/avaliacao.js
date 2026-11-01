/**
 * Avaliação de mídia para edição: o motor de vídeo do app (Chromium) toca
 * H.264 8 bits, VP8/VP9 e AV1; masters de finalização (ProRes, DNxHD/HR,
 * CineForm…) não abrem, e 4K de alta taxa abre mas pesa na busca quadro a
 * quadro. Nesses casos, trabalha-se num proxy leve e entrega-se do original.
 */
/** Codecs de finalização/intermediários que o Chromium não decodifica. */
const NAO_REPRODUZIVEIS = {
    prores: 'ProRes',
    dnxhd: 'DNxHD/DNxHR',
    cfhd: 'CineForm',
    mpeg2video: 'MPEG-2',
    dvvideo: 'DV',
    v210: 'v210 (sem compressão)',
    rawvideo: 'vídeo sem compressão',
    jpeg2000: 'JPEG 2000',
    qtrle: 'QuickTime Animation',
    hap: 'HAP',
    mjpeg: 'Motion JPEG',
};
const NOMES = {
    h264: 'H.264',
    hevc: 'HEVC (H.265)',
    vp8: 'VP8',
    vp9: 'VP9',
    av1: 'AV1',
    ...NAO_REPRODUZIVEIS,
};
const LIMITE_ALTURA = 1080;
const LIMITE_BITRATE = 50e6;
const LIMITE_FPS = 30.5;
export function fpsDeFracao(r) {
    if (!r)
        return null;
    const [a, b] = r.split('/').map(Number);
    if (!a || !b)
        return Number.isFinite(Number(r)) && Number(r) > 0 ? Number(r) : null;
    return a / b;
}
const fmtFps = (f) => (Math.abs(f - Math.round(f)) < 0.01 ? String(Math.round(f)) : f.toFixed(3).replace('.', ','));
export function avaliarMidia(i) {
    const motivos = [];
    const codec = (i.codec ?? '').toLowerCase();
    const nome = NOMES[codec] ?? (codec ? codec.toUpperCase() : 'codec desconhecido');
    const dezBits = /10|12/.test(i.pixFmt ?? '') || /high 10|high 4:2:2|high 4:4:4/i.test(i.perfil ?? '');
    const descricao = [
        nome + (dezBits ? ' 10 bits' : ''),
        i.largura && i.altura ? `${i.largura}×${i.altura}` : null,
        i.fps ? `${fmtFps(i.fps)} qd/s` : null,
    ]
        .filter(Boolean)
        .join(' · ');
    let reproduzivel = 'sim';
    if (!codec) {
        reproduzivel = 'incerto';
        motivos.push('Não foi possível identificar o codec de vídeo.');
    }
    else if (NAO_REPRODUZIVEIS[codec]) {
        reproduzivel = 'nao';
        motivos.push(`${NAO_REPRODUZIVEIS[codec]} é um formato de finalização: o motor de vídeo do app não o reproduz.`);
    }
    else if (codec === 'h264' && dezBits) {
        reproduzivel = 'nao';
        motivos.push('H.264 de 10 bits (ou 4:2:2/4:4:4) não é reproduzido pelo motor de vídeo do app.');
    }
    else if (codec === 'hevc') {
        reproduzivel = 'incerto';
        motivos.push('HEVC só é reproduzido com decodificação por hardware, que varia de máquina para máquina.');
    }
    else if (!['h264', 'vp8', 'vp9', 'av1'].includes(codec)) {
        reproduzivel = 'incerto';
        motivos.push(`${nome}: suporte não garantido no motor de vídeo do app.`);
    }
    if (i.altura > LIMITE_ALTURA)
        motivos.push(`Resolução acima de ${LIMITE_ALTURA}p torna a busca quadro a quadro lenta.`);
    if (i.bitrate && i.bitrate > LIMITE_BITRATE)
        motivos.push(`Taxa de ${Math.round(i.bitrate / 1e6)} Mb/s pesa na leitura do disco.`);
    if (i.fps && i.fps > LIMITE_FPS && i.altura > 720)
        motivos.push(`${fmtFps(i.fps)} qd/s em alta resolução dobra o trabalho de decodificação.`);
    const pesado = i.altura > LIMITE_ALTURA || (i.bitrate ?? 0) > LIMITE_BITRATE || ((i.fps ?? 0) > LIMITE_FPS && i.altura > 720);
    const necessidade = reproduzivel === 'nao' ? 'obrigatorio' : reproduzivel === 'incerto' || pesado ? 'recomendado' : 'dispensavel';
    return { necessidade, reproduzivel, motivos, descricao };
}
