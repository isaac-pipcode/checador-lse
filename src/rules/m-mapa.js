import { DOCUMENT_SCOPE } from '../model/types';
import { idSugestao, instantaneo } from './tipos';
import { formatarTimecode } from '../core/texto';
import { primeiroApos, sobreposicaoMs } from '../mapa/sinal';
/**
 * Regras M — dependem do mapa temporal (vídeo carregado). Sem mapa, não
 * executam: a ausência fica registrada no relatório, não simulada aqui.
 *
 * Verificabilidade `sinal`: inferência sobre energia de áudio e diferença entre
 * quadros. Nenhuma delas reconhece fala ou plano; todas vêm com confiança < 1
 * e nenhuma é aprovável em lote.
 */
const fmt = (ms) => formatarTimecode(ms);
const seg = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
/**
 * Atraso máximo considerado: além disso, a legenda entrou no meio de um som
 * contínuo (música, ambiente) e o início dele nada diz sobre a fala.
 */
const BUSCA_MS = 1000;
/** Abaixo desta cobertura sonora, a legenda está sobre "silêncio". */
const COBERTURA_MINIMA = 0.1;
function ordenadas(cues) {
    return [...cues].sort((a, b) => a.startMs - b.startMs || a.index - b.index);
}
/** Entrada possível sem violar intervalo mínimo com a anterior nem duração mínima. */
function entradaValida(novo, cue, anterior, intervalo, dMin) {
    if (anterior && novo < anterior.endMs + intervalo)
        return false;
    return cue.endMs - novo >= dMin;
}
/**
 * M1 — Sincronia de entrada com o som. A legenda deve entrar quando a fala
 * começa. Compara a entrada com o início do segmento sonoro mais próximo; se a
 * legenda está sobre trecho sem som algum, sinaliza possível deslocamento.
 */
export const m1 = (cues, config, ctx) => {
    const mapa = ctx.mapa;
    if (!mapa || !mapa.audio)
        return [];
    const out = [];
    const lista = ordenadas(cues);
    lista.forEach((cue, i) => {
        const dur = cue.endMs - cue.startMs;
        if (dur <= 0)
            return;
        const anterior = lista[i - 1];
        const texto = cue.lines.join(' ');
        const cobertura = sobreposicaoMs({ inicioMs: cue.startMs, fimMs: cue.endMs }, mapa.atividade) / dur;
        if (cobertura < COBERTURA_MINIMA) {
            if (/\[[^\]]*sil[eê]ncio[^\]]*\]/i.test(texto))
                return;
            out.push({
                id: idSugestao('M1', cue.index, 'silencio'),
                ruleId: 'M1',
                cueIndex: cue.index,
                severity: 'aviso',
                verifiability: 'sinal',
                confidence: 0.5,
                message: `Nenhum som relevante detectado enquanto a legenda está na tela (${Math.round(cobertura * 100)}% do tempo). Possível dessincronia — confira no vídeo.`,
                before: instantaneo(cue),
                autoFixable: false,
            });
            return;
        }
        const k = primeiroApos(mapa.atividade, cue.startMs);
        const s = mapa.atividade[k];
        if (!s)
            return;
        // s contém a entrada (s.inicio ≤ start) ou é o próximo som depois dela.
        const delta = s.inicioMs - cue.startMs; // >0: legenda antecipada; <0: atrasada
        if (Math.abs(delta) <= config.toleranciaSincroniaMs)
            return;
        // Antecipação: há silêncio antes do som, então vale enquanto o som começa
        // com a legenda ainda na tela. Atraso: só dentro da janela de busca.
        if (delta > 0 && s.inicioMs >= cue.endMs)
            return;
        if (delta < 0 && -delta > BUSCA_MS)
            return;
        const valido = entradaValida(s.inicioMs, cue, anterior, config.intervaloMinimoMs, config.duracaoMinimaMs);
        const sentido = delta > 0 ? `entra ${Math.abs(delta)} ms antes` : `entra ${Math.abs(delta)} ms depois`;
        out.push({
            id: idSugestao('M1', cue.index, 'entrada'),
            ruleId: 'M1',
            cueIndex: cue.index,
            severity: 'aviso',
            verifiability: 'sinal',
            confidence: 0.55,
            message: `A legenda ${sentido} do som detectado em ${fmt(s.inicioMs)}. O detector mede energia na banda de voz, não reconhece fala: confira se o som é a fala.` +
                (valido ? '' : ' Ajuste automático impedido pela duração mínima ou pelo intervalo com a legenda anterior.'),
            before: instantaneo(cue),
            ...(valido ? { after: { lines: [...cue.lines], startMs: s.inicioMs, endMs: cue.endMs } } : {}),
            autoFixable: valido,
        });
    });
    return out;
};
/**
 * M2 — Corte de plano. Uma legenda que entra pouco antes de um corte, ou sai
 * pouco depois dele, "salta" a mudança de plano e provoca releitura. Propõe
 * colar a entrada ou a saída ao corte. Convenção de mercado, não norma do Guia.
 */
export const m2 = (cues, config, ctx) => {
    const mapa = ctx.mapa;
    if (!mapa || mapa.statusCortes.tipo !== 'concluido')
        return [];
    const out = [];
    const lista = ordenadas(cues);
    const margem = config.margemCorteMs;
    lista.forEach((cue, i) => {
        const anterior = lista[i - 1];
        const dentro = mapa.cortes.filter((c) => c.ms > cue.startMs && c.ms < cue.endMs);
        if (dentro.length === 0)
            return;
        const corteInicio = dentro[0];
        const corteFim = dentro[dentro.length - 1];
        const conf = (c) => Math.min(0.85, 0.45 + c.intensidade / 2);
        const dInicio = corteInicio.ms - cue.startMs;
        const dFim = cue.endMs - corteFim.ms;
        let pertoDoInicio = dInicio < margem;
        let pertoDoFim = dFim < margem;
        // Um único corte perto das duas pontas (legenda curta): fica o lado mais próximo.
        if (pertoDoInicio && pertoDoFim && corteInicio === corteFim) {
            if (dInicio <= dFim)
                pertoDoFim = false;
            else
                pertoDoInicio = false;
        }
        if (pertoDoInicio) {
            const novo = corteInicio.ms;
            const valido = entradaValida(novo, cue, anterior, config.intervaloMinimoMs, config.duracaoMinimaMs);
            out.push({
                id: idSugestao('M2', cue.index, 'inicio'),
                ruleId: 'M2',
                cueIndex: cue.index,
                severity: 'aviso',
                verifiability: 'sinal',
                confidence: conf(corteInicio),
                message: `Corte de plano ${dInicio} ms depois da entrada (${fmt(corteInicio.ms)}, ±${corteInicio.precisaoMs} ms): a legenda atravessa o corte logo ao surgir.` +
                    (valido ? ' Proposta: entrar no corte.' : ' Entrar no corte violaria a duração mínima; considere antecipar.'),
                before: instantaneo(cue),
                ...(valido ? { after: { lines: [...cue.lines], startMs: novo, endMs: cue.endMs } } : {}),
                autoFixable: valido,
            });
        }
        if (pertoDoFim) {
            const novo = corteFim.ms;
            const valido = novo - cue.startMs >= config.duracaoMinimaMs;
            out.push({
                id: idSugestao('M2', cue.index, 'fim'),
                ruleId: 'M2',
                cueIndex: cue.index,
                severity: 'aviso',
                verifiability: 'sinal',
                confidence: conf(corteFim),
                message: `Corte de plano ${dFim} ms antes da saída (${fmt(corteFim.ms)}, ±${corteFim.precisaoMs} ms): a legenda invade o plano seguinte.` +
                    (valido ? ' Proposta: sair no corte.' : ' Sair no corte violaria a duração mínima.'),
                before: instantaneo(cue),
                ...(valido ? { after: { lines: [...cue.lines], startMs: cue.startMs, endMs: novo } } : {}),
                autoFixable: valido,
            });
        }
    });
    return out;
};
/**
 * M3 — Som sem legenda. Segmento sonoro longo sem nenhuma legenda: fala não
 * legendada, ou efeito sonoro/música que a LSE deveria descrever entre
 * colchetes (X2). Não decide qual: vira item de revisão com o trecho exato.
 */
export const m3 = (cues, config, ctx) => {
    const mapa = ctx.mapa;
    if (!mapa || !mapa.audio)
        return [];
    const intervalos = ordenadas(cues).map((c) => ({ inicioMs: c.startMs, fimMs: c.endMs }));
    const out = [];
    for (const s of mapa.atividade) {
        const dur = s.fimMs - s.inicioMs;
        if (dur < config.somSemLegendaMs)
            continue;
        const descoberto = dur - sobreposicaoMs(s, intervalos);
        if (descoberto / dur < 0.8)
            continue;
        out.push({
            id: idSugestao('M3', DOCUMENT_SCOPE, String(s.inicioMs)),
            ruleId: 'M3',
            cueIndex: DOCUMENT_SCOPE,
            severity: 'revisao_manual',
            verifiability: 'sinal',
            confidence: 0.4,
            message: `Som contínuo de ${seg(dur)} sem legenda, de ${fmt(s.inicioMs)} a ${fmt(s.fimMs)}. Fala não legendada, ou efeito sonoro/música a descrever entre colchetes?`,
            before: { lines: [], startMs: s.inicioMs, endMs: s.fimMs },
            autoFixable: false,
        });
    }
    return out;
};
