import { detectarAtividade } from '../mapa/sinal';
import { ErroMidia, JANELA_MS } from '../mapa/midia';
import { PARAMETROS_ATIVIDADE_PADRAO } from '../mapa/tipos';
/**
 * Carrega uma mídia e monta o mapa temporal. A análise de áudio vem de fora:
 * no desktop, ffmpeg em streaming no processo principal (qualquer duração,
 * qualquer codec que o ffmpeg leia); no navegador, decodeAudioData.
 */
export async function carregarMidia(despachar, midia, analisar) {
    despachar({ tipo: 'video', ...midia });
    const parametros = PARAMETROS_ATIVIDADE_PADRAO;
    const base = {
        arquivoVideo: midia.nome,
        janelaMs: JANELA_MS,
        parametros,
        cortes: [],
        statusCortes: { tipo: 'nao_detectado' },
    };
    try {
        const { envelopeDb, duracaoMs } = await analisar();
        const { atividade, pisoDb } = detectarAtividade(envelopeDb, JANELA_MS, parametros);
        despachar({ tipo: 'mapa', mapa: { ...base, duracaoMs, audio: true, envelopeDb, pisoDb, atividade } });
    }
    catch (e) {
        const erroAudio = e instanceof ErroMidia ? e.message : `Falha na análise do áudio: ${e instanceof Error ? e.message : String(e)}`;
        // Sem áudio, o mapa ainda serve aos cortes; M1 e M3 não executam.
        despachar({
            tipo: 'mapa',
            mapa: { ...base, duracaoMs: 0, audio: false, erroAudio, envelopeDb: new Float32Array(0), pisoDb: -100, atividade: [] },
        });
    }
}
