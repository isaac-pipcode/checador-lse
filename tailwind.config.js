/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens de marca Ouver. Terra é reservado a bordas/ícones/fundos de
        // realce: sobre Paper ele não atinge 4,5:1 (ver test/contraste.test.ts),
        // por isso o corpo de texto usa navy/navy-700.
        navy: { DEFAULT: '#1B2230', 700: '#2C3547', 500: '#4A566E', 300: '#8A93A6' },
        paper: { DEFAULT: '#FAF8F3', 200: '#F2EEE4', 400: '#E3DDCD' },
        terra: { DEFAULT: '#B85F3E', 700: '#8E4227', 900: '#5E2B19' },
        ok: { DEFAULT: '#1F6B4A', 100: '#E4F1EA' },
        warn: { DEFAULT: '#8A5B00', 100: '#FBF0DA' },
        bad: { DEFAULT: '#A3242B', 100: '#FBE6E7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
