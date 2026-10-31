import type { Cue, RuleConfig, Suggestion } from '../model/types';
import type { ContextoRegras, RegraRegistrada } from './tipos';
import { t1 } from './t1-caracteres-por-linha';
import { t2 } from './t2-numero-de-linhas';
import { t3 } from './t3-duracao-minima';
import { t4 } from './t4-duracao-maxima';
import { t5 } from './t5-velocidade';
import { t6 } from './t6-sobreposicao';
import { t7 } from './t7-intervalo-minimo';
import { t8 } from './t8-formato-retangular';
import { c1 } from './c1-colchetes';
import { c2 } from './c2-traco-dialogo';
import { c4 } from './c4-italico';
import { c5 } from './c5-virgula-final';
import { c6 } from './c6-exclamacoes';
import { c8 } from './c8-limpeza-tipografica';
import { l1 } from './l1-segmentacao';
import { l2 } from './l2-reducao';
import { c3, c4Manual, c7, x1, x2 } from './manuais';
import { m1, m2, m3 } from './m-mapa';

/** Catálogo de regras. A ordem define a ordem de exibição dentro de cada legenda. */
export const CATALOGO: RegraRegistrada[] = [
  { id: 'T1', nome: 'Caracteres por linha', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'O Guia MinC/SAv (2016) fixa o limite de 37 caracteres por linha para a LSE brasileira.', executar: t1 },
  { id: 'T2', nome: 'Número de linhas', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'A legenda ocupa no máximo duas linhas, para não encobrir a imagem.', executar: t2 },
  { id: 'T3', nome: 'Duração mínima', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'Abaixo de 1 segundo a legenda não é percebida como unidade de leitura.', executar: t3 },
  { id: 'T4', nome: 'Duração máxima', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'Prática brasileira de até 4 s; teto de 6 s pela "regra dos seis segundos" (D\'YDEWALLE et al., 1987).', executar: t4 },
  { id: 'T5', nome: 'Velocidade de leitura', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'As velocidades de 145, 160 e 180 ppm do Guia correspondem a ≈14–15, 16 e 17–18 cps.', executar: t5 },
  { id: 'T6', nome: 'Sobreposição temporal', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'Duas legendas não podem ocupar a tela ao mesmo tempo.', executar: t6 },
  { id: 'T7', nome: 'Intervalo mínimo', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'Dois quadros de intervalo (≈83 ms a 24 fps) evitam a cintilação entre legendas.', executar: t7 },
  { id: 'T8', nome: 'Formato retangular', categoria: 'tecnica', verificabilidade: 'deterministica', fundamento: 'O Guia prefere linhas de comprimento próximo (formato retangular ou piramidal).', executar: t8 },
  { id: 'C1', nome: 'Colchetes para informação adicional', categoria: 'formatacao', verificabilidade: 'deterministica', fundamento: 'Identificação de falante e efeitos sonoros vão entre colchetes, não entre parênteses.', executar: c1 },
  { id: 'C2', nome: 'Travessão de diálogo', categoria: 'formatacao', verificabilidade: 'deterministica', fundamento: 'O traço fica colado à palavra e marca ambas as falas quando há dois falantes.', executar: c2 },
  { id: 'C3', nome: 'Maiúsculas (texto em cena e título)', categoria: 'formatacao', verificabilidade: 'manual', fundamento: 'Texto escrito em cena e título da obra vão em caixa-alta — não verificável sem a imagem.', executar: c3 },
  { id: 'C4', nome: 'Itálico', categoria: 'formatacao', verificabilidade: 'manual', fundamento: 'Itálico para voz mediada/off e canção; a consistência do markup é checável automaticamente, a adequação do uso não.', executar: (cues, config, ctx) => [...c4(cues, config, ctx), ...c4Manual(cues, config, ctx)] },
  { id: 'C5', nome: 'Vírgula final', categoria: 'formatacao', verificabilidade: 'deterministica', fundamento: 'A vírgula ao fim de legenda cujo sentido continua é dispensável.', executar: c5 },
  { id: 'C6', nome: 'Exclamação em excesso', categoria: 'formatacao', verificabilidade: 'deterministica', fundamento: 'O excesso de exclamações substitui indevidamente a informação prosódica.', executar: c6 },
  { id: 'C7', nome: 'Reticências', categoria: 'formatacao', verificabilidade: 'manual', fundamento: 'Reticências apenas para hesitação ou interrupção de fala.', executar: c7 },
  { id: 'C8', nome: 'Limpeza tipográfica', categoria: 'formatacao', verificabilidade: 'deterministica', fundamento: 'Espaços duplicados, espaço antes de pontuação e espaço interno em colchetes.', executar: c8 },
  { id: 'L1', nome: 'Segmentação sintática', categoria: 'linguistica', verificabilidade: 'nlp', fundamento: 'A quebra deve ocorrer no mais alto nível sintático, preservando os sintagmas (LEAD/UECE).', executar: l1 },
  { id: 'L2', nome: 'Redução textual', categoria: 'linguistica', verificabilidade: 'llm', fundamento: 'Quando a velocidade excede o alvo, condensa-se ou omite-se o redundante, sem perder sentido.', executar: l2 },
  { id: 'X1', nome: 'Identificação de falante', categoria: 'contextual', verificabilidade: 'manual', fundamento: 'Cada troca de turno precisa ser identificável pelo espectador surdo.', executar: x1 },
  { id: 'X2', nome: 'Efeitos sonoros', categoria: 'contextual', verificabilidade: 'manual', fundamento: 'Efeitos sonoros relevantes à narrativa devem estar legendados (NASCIMENTO, 2013).', executar: x2 },
  { id: 'M1', nome: 'Sincronia com o som', categoria: 'temporal', verificabilidade: 'sinal', fundamento: 'A legenda entra quando a fala começa. Exige o vídeo: compara a entrada com o início do som detectado na banda de voz.', executar: m1 },
  { id: 'M2', nome: 'Corte de plano', categoria: 'temporal', verificabilidade: 'sinal', fundamento: 'Legenda que atravessa um corte por poucos quadros provoca releitura; cola-se ao corte. Convenção de mercado, não do Guia MinC.', executar: m2 },
  { id: 'M3', nome: 'Som sem legenda', categoria: 'temporal', verificabilidade: 'sinal', fundamento: 'Trecho sonoro longo sem legenda: fala omitida, ou efeito sonoro/música a descrever (complementa X2).', executar: m3 },
];

export const META_POR_ID = new Map(CATALOGO.map((r) => [r.id, r]));

export function analisar(
  cues: Cue[],
  config: RuleConfig,
  ctx: ContextoRegras,
): Suggestion[] {
  const todas: Suggestion[] = [];
  for (const regra of CATALOGO) {
    try {
      todas.push(...regra.executar(cues, config, ctx));
    } catch (e) {
      // Uma regra com defeito não pode derrubar a análise inteira.
      console.error(`Falha ao executar a regra ${regra.id}`, e);
    }
  }
  return todas.sort(
    (a, b) => a.cueIndex - b.cueIndex || a.ruleId.localeCompare(b.ruleId) || a.id.localeCompare(b.id),
  );
}

export * from './tipos';
