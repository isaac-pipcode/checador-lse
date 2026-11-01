/**
 * Tokens de cor — fonte única. Geram as variáveis CSS (aplicarTema) e são
 * verificados no teste de contraste: o que é testado é o que vai para a tela.
 *
 * Os nomes são PAPÉIS, não cores literais, apesar de herdarem os nomes da
 * marca Ouver: `paper` = superfície, `navy` = tinta (texto e traço), `terra` =
 * acento. No tema escuro, "navy" é claro — por isso o sistema documenta o
 * papel ao lado de cada token (docs/design-system.md).
 */
export const TEMAS = {
    // Grafite levemente azulado (derivado do navy da marca), como em editores de vídeo:
    // a imagem é a coisa mais clara da tela.
    escuro: {
        fundo: '#101216',
        paper: '#1A1D23',
        'paper-200': '#23272F',
        'paper-400': '#343945',
        navy: '#E8EAF0',
        'navy-700': '#C5CAD4',
        'navy-500': '#9EA5B3',
        'navy-300': '#8D94A3',
        terra: '#E37B51',
        'terra-700': '#F2A383',
        'terra-900': '#FFD6C4',
        ok: '#62CC95',
        'ok-100': '#14302A',
        warn: '#E8B54C',
        'warn-100': '#322A13',
        bad: '#F4797F',
        'bad-100': '#3A1B20',
        'serie-1': '#3987E5',
        'serie-2': '#D95926',
    },
    // Paleta original do checador (Ouver), mantida como alternativa.
    claro: {
        fundo: '#EDE8DC',
        paper: '#FAF8F3',
        'paper-200': '#F2EEE4',
        'paper-400': '#E3DDCD',
        navy: '#1B2230',
        'navy-700': '#2C3547',
        'navy-500': '#4A566E',
        'navy-300': '#5D6880',
        terra: '#B85F3E',
        'terra-700': '#8E4227',
        'terra-900': '#5E2B19',
        ok: '#1F6B4A',
        'ok-100': '#E4F1EA',
        warn: '#8A5B00',
        'warn-100': '#FBF0DA',
        bad: '#A3242B',
        'bad-100': '#FBE6E7',
        'serie-1': '#2A78D6',
        'serie-2': '#EB6834',
    },
};
/** Cores fixas, independentes do tema: o que precisa ser escuro sempre (monitor, cabine). */
export const FIXAS = {
    preto: '#0A0B0D',
    cabine: '#161A22',
    'cabine-texto': '#F4F2EC',
    'cabine-suave': '#A9B0BE',
    // faixas de fase do teleprompter (sempre sobre a cabine escura)
    'cabine-faixa': '#2C3547',
    'cabine-gravando': '#A3242B',
    'cabine-preparo': '#FBF0DA',
    'cabine-preparo-texto': '#7A5000',
    'cabine-ok': '#9BE3BC',
    'cabine-erro': '#FFB3B7',
};
const rgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};
export function aplicarTema(tema, raiz = document.documentElement) {
    for (const [nome, hex] of Object.entries(TEMAS[tema]))
        raiz.style.setProperty(`--c-${nome}`, rgb(hex));
    raiz.dataset.tema = tema;
    raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
}
export function temaSalvo() {
    try {
        return localStorage.getItem('estudio:tema') === 'claro' ? 'claro' : 'escuro';
    }
    catch {
        return 'escuro';
    }
}
export function salvarTema(t) {
    try {
        localStorage.setItem('estudio:tema', t);
    }
    catch {
        /* sem armazenamento: o tema vale só para a sessão */
    }
    aplicarTema(t);
}
