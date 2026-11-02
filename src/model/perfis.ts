import type { Perfil, RuleConfig } from './types';

const base = {
  maxCaracteresPorLinha: 37,
  maxLinhas: 2,
  duracaoMinimaMs: 1000,
  duracaoAvisoMs: 4000,
  duracaoMaximaMs: 6000,
  cpsMaximo: 18,
  // 2 quadros a 24 fps ≈ 83 ms (Guia, cap. de LSE: intervalo mínimo entre legendas).
  intervaloMinimoMs: 83,
  fps: 24,
  desequilibrioMaximo: 0.4,
  maxExclamacoesPorObra: 10,
  janelaSemRotulo: 20,
  toleranciaSincroniaMs: 300,
  // ≈12 quadros a 24 fps: convenção de mercado (guias de estilo de streaming), não do Guia MinC.
  margemCorteMs: 500,
  somSemLegendaMs: 1500,
  lacunaMinimaAdMs: 3000,
  contarEspacos: true,
  contarColchetes: true,
  checarTracoDialogo: true,
  nlpAtivo: true,
  llmAtivo: false,
} as const;

export const PERFIS: Perfil[] = [
  {
    ...base,
    perfilId: 'guia-145',
    perfilNome: 'Guia MinC — 145 ppm',
    descricao:
      'Velocidade de 145 palavras por minuto (≈14–15 cps), a mais confortável segundo os testes de recepção do LEAD/UECE. Default do checador.',
    aderenteAoGuia: true,
    cpsAlvo: 15,
  },
  {
    ...base,
    perfilId: 'guia-160',
    perfilNome: 'Guia MinC — 160 ppm',
    descricao: 'Velocidade intermediária prevista no Guia (≈16 cps).',
    aderenteAoGuia: true,
    cpsAlvo: 16,
  },
  {
    ...base,
    perfilId: 'guia-180',
    perfilNome: 'Guia MinC — 180 ppm',
    descricao: 'Velocidade máxima prevista no Guia (≈17–18 cps).',
    aderenteAoGuia: true,
    cpsAlvo: 18,
  },
  {
    ...base,
    perfilId: 'mercado',
    perfilNome: 'Mercado (referência alternativa)',
    descricao:
      'Parâmetros correntes em casas de legendagem para streaming (37→42 CPL, 17 cps, 1–7 s). NÃO é o Guia MinC/SAv; serve apenas para comparação.',
    aderenteAoGuia: false,
    maxCaracteresPorLinha: 42,
    cpsAlvo: 17,
    cpsMaximo: 20,
    duracaoAvisoMs: 7000,
    duracaoMaximaMs: 7000,
  },
];

export const PERFIL_PADRAO = PERFIS[0];

export function configDoPerfil(perfilId: string): RuleConfig {
  const p = PERFIS.find((x) => x.perfilId === perfilId) ?? PERFIL_PADRAO;
  const { descricao: _d, aderenteAoGuia: _a, ...config } = p;
  return { ...config };
}
