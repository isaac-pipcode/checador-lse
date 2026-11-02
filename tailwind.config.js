/** @type {import('tailwindcss').Config} */
// Cores por papel, via variáveis CSS geradas de src/ui/tema/tokens.ts (fonte única).
const v = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: v('fundo'),
        navy: { DEFAULT: v('navy'), 700: v('navy-700'), 500: v('navy-500'), 300: v('navy-300') },
        paper: { DEFAULT: v('paper'), 200: v('paper-200'), 400: v('paper-400') },
        terra: { DEFAULT: v('terra'), 700: v('terra-700'), 900: v('terra-900') },
        ok: { DEFAULT: v('ok'), 100: v('ok-100') },
        warn: { DEFAULT: v('warn'), 100: v('warn-100') },
        bad: { DEFAULT: v('bad'), 100: v('bad-100') },
        serie: { 1: v('serie-1'), 2: v('serie-2') },
        // fixas (não mudam com o tema): monitor e cabine do locutor
        preto: '#0A0B0D',
        cabine: {
          DEFAULT: '#161A22',
          texto: '#F4F2EC',
          suave: '#A9B0BE',
          faixa: '#2C3547',
          gravando: '#A3242B',
          preparo: '#FBF0DA',
          'preparo-texto': '#7A5000',
          ok: '#9BE3BC',
          erro: '#FFB3B7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // escala densa de editor: 11/12/13 para painéis, 14+ para conteúdo
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
