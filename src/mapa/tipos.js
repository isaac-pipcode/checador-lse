/**
 * Mapa temporal da obra: a representação compartilhada que alimenta a trilha de
 * legenda (LSE) e, adiante, a de audiodescrição (lacunas) e a de Libras.
 *
 * Tudo aqui é *inferência sobre o sinal* — energia de áudio e diferença entre
 * quadros —, não reconhecimento de fala nem de plano. As regras que o consomem
 * declaram isso (verificabilidade `sinal`) e vêm sempre com grau de confiança.
 */
export const PARAMETROS_ATIVIDADE_PADRAO = {
    limiarDb: 12,
    percentilPiso: 0.1,
    duracaoMinimaMs: 150,
    fusaoMs: 300,
};
