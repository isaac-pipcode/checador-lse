import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { DOCUMENT_SCOPE } from '../model/types';
import type {
  Cue,
  CueSnapshot,
  Decision,
  ReviewState,
  RuleConfig,
  Severity,
  Suggestion,
} from '../model/types';
import { configDoPerfil, PERFIL_PADRAO } from '../model/perfis';
import { analisar } from '../rules';
import { SegmentadorPtBr } from '../nlp/segmentador';
import type { ParseError } from '../parser/srt';
import { aplicarDecisoes } from '../export/aplicar';
import { calcularMetricas } from '../core/metricas';
import type { Corte, MapaTemporal, ParametrosAtividade, StatusCortes } from '../mapa/tipos';
import { detectarAtividade } from '../mapa/sinal';
import type { ContextoRegras } from '../rules';

export interface Filtros {
  regra: string;
  severidade: Severity | 'todas';
  somentePendentes: boolean;
  de: number | null;
  ate: number | null;
  busca: string;
}

export interface EstadoLlm {
  apiKey: string;
  modelo: string;
  ocupadas: string[];
  erro: string | null;
}

export interface Estado {
  arquivoNome: string | null;
  encoding: string | null;
  cues: Cue[];
  errosParse: ParseError[];
  avisosParse: string[];
  config: RuleConfig;
  sugestoes: Suggestion[];
  review: ReviewState;
  filtros: Filtros;
  llm: EstadoLlm;
  anuncio: string;
  /** pilha de operações em lote, para desfazer */
  historicoLote: Array<{ rotulo: string; anterior: ReviewState }>;
  /** vídeo local (object URL); independe do arquivo de legenda */
  video: { url: string; nome: string } | null;
  mapa: MapaTemporal | null;
  /** pedidos de navegação entre lista e linha do tempo (n distingue pedidos repetidos) */
  pedidoSeek: { ms: number; n: number } | null;
  pedidoLista: { index: number; n: number } | null;
}

const FILTROS_INICIAIS: Filtros = {
  regra: 'todas',
  severidade: 'todas',
  somentePendentes: false,
  de: null,
  ate: null,
  busca: '',
};

export const estadoInicial: Estado = {
  arquivoNome: null,
  encoding: null,
  cues: [],
  errosParse: [],
  avisosParse: [],
  config: configDoPerfil(PERFIL_PADRAO.perfilId),
  sugestoes: [],
  review: {},
  filtros: FILTROS_INICIAIS,
  llm: { apiKey: '', modelo: 'claude-sonnet-5', ocupadas: [], erro: null },
  anuncio: '',
  historicoLote: [],
  video: null,
  mapa: null,
  pedidoSeek: null,
  pedidoLista: null,
};

type Acao =
  | {
      tipo: 'carregar';
      nome: string;
      encoding: string;
      cues: Cue[];
      erros: ParseError[];
      avisos: string[];
    }
  | { tipo: 'limpar' }
  | { tipo: 'config'; mudanca: Partial<RuleConfig> }
  | { tipo: 'decidir'; id: string; decisao: Decision }
  | { tipo: 'editar'; id: string; lines: string[] }
  | { tipo: 'lote'; ruleId: string }
  | { tipo: 'desfazerLote' }
  | { tipo: 'filtros'; mudanca: Partial<Filtros> }
  | { tipo: 'llm'; mudanca: Partial<EstadoLlm> }
  | { tipo: 'sugestaoLlm'; base: Suggestion; after: CueSnapshot; confianca: number; texto: string }
  | { tipo: 'anunciar'; texto: string }
  | { tipo: 'video'; url: string; nome: string }
  | { tipo: 'mapa'; mapa: MapaTemporal | null }
  | { tipo: 'atividade'; parametros: ParametrosAtividade }
  | { tipo: 'cortes'; status: StatusCortes; cortes?: Corte[] }
  | { tipo: 'seek'; ms: number }
  | { tipo: 'irParaLegenda'; index: number };

/** Descreve o escopo de um apontamento para os anúncios de leitor de tela. */
function escopo(cueIndex: number): string {
  return cueIndex === DOCUMENT_SCOPE ? 'da obra inteira' : `da legenda ${cueIndex}`;
}

function motor(config: RuleConfig, mapa: MapaTemporal | null): ContextoRegras {
  return { nlp: config.nlpAtivo ? new SegmentadorPtBr() : null, mapa };
}

/** Preserva o que independe do arquivo de legenda (configuração, LLM, vídeo). */
function persistentes(estado: Estado) {
  return { config: estado.config, llm: estado.llm, video: estado.video, mapa: estado.mapa };
}

function chaveConteudo(s: Suggestion): string {
  return JSON.stringify([s.message, s.after ?? null, s.unavailable ?? false]);
}

/**
 * Reanalisa preservando as decisões já tomadas. Uma decisão só sobrevive se a
 * sugestão correspondente continuar existindo *com o mesmo conteúdo*: mudar um
 * limiar pode alterar a proposta, e herdar a aprovação seria aplicar ao arquivo
 * algo que o usuário não aprovou.
 */
function reanalisar(estado: Estado, config: RuleConfig): Estado {
  const sugestoes = analisar(estado.cues, config, motor(config, estado.mapa));
  const review: ReviewState = {};
  for (const s of sugestoes) {
    const anterior = estado.review[s.id];
    const mesmoConteudo = anterior && chaveConteudo(anterior.suggestion) === chaveConteudo(s);
    review[s.id] = mesmoConteudo
      ? { suggestion: s, decision: anterior.decision, editedAfter: anterior.editedAfter }
      : { suggestion: s, decision: 'pendente' };
  }
  return { ...estado, config, sugestoes, review, historicoLote: [] };
}

function redutor(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case 'carregar': {
      const base: Estado = {
        ...estadoInicial,
        ...persistentes(estado),
        arquivoNome: acao.nome,
        encoding: acao.encoding,
        cues: acao.cues,
        errosParse: acao.erros,
        avisosParse: acao.avisos,
      };
      const analisado = reanalisar(base, estado.config);
      return {
        ...analisado,
        anuncio: `${acao.cues.length} legendas carregadas; ${analisado.sugestoes.length} apontamentos.`,
      };
    }

    case 'limpar':
      return { ...estadoInicial, ...persistentes(estado) };

    case 'config': {
      const config = { ...estado.config, ...acao.mudanca };
      if (estado.cues.length === 0) return { ...estado, config };
      const novo = reanalisar(estado, config);
      return { ...novo, anuncio: `Configuração atualizada; ${novo.sugestoes.length} apontamentos.` };
    }

    case 'decidir': {
      const item = estado.review[acao.id];
      if (!item) return estado;
      return {
        ...estado,
        review: { ...estado.review, [acao.id]: { ...item, decision: acao.decisao } },
        anuncio: `Apontamento ${item.suggestion.ruleId} ${escopo(item.suggestion.cueIndex)} marcado como ${acao.decisao}.`,
      };
    }

    case 'editar': {
      const item = estado.review[acao.id];
      if (!item) return estado;
      return {
        ...estado,
        review: {
          ...estado.review,
          [acao.id]: {
            ...item,
            decision: 'editada',
            editedAfter: { ...(item.suggestion.after ?? {}), lines: acao.lines },
          },
        },
        anuncio: `Apontamento ${item.suggestion.ruleId} ${escopo(item.suggestion.cueIndex)} editado e aprovado.`,
      };
    }

    case 'lote': {
      const anterior = estado.review;
      const review = { ...estado.review };
      let n = 0;
      for (const [id, item] of Object.entries(review)) {
        const s = item.suggestion;
        // Lote é restrito a auto-correções determinísticas pendentes.
        if (s.ruleId !== acao.ruleId) continue;
        if (s.verifiability !== 'deterministica' || !s.autoFixable || !s.after) continue;
        if (item.decision !== 'pendente') continue;
        review[id] = { ...item, decision: 'aprovada' };
        n++;
      }
      if (n === 0) return { ...estado, anuncio: 'Nenhuma sugestão pendente para aprovar em lote.' };
      return {
        ...estado,
        review,
        historicoLote: [
          ...estado.historicoLote,
          { rotulo: `${n} sugestões ${acao.ruleId}`, anterior },
        ],
        anuncio: `${n} sugestões da regra ${acao.ruleId} aprovadas em lote. É possível desfazer.`,
      };
    }

    case 'desfazerLote': {
      const ultimo = estado.historicoLote[estado.historicoLote.length - 1];
      if (!ultimo) return estado;
      return {
        ...estado,
        review: ultimo.anterior,
        historicoLote: estado.historicoLote.slice(0, -1),
        anuncio: `Lote desfeito: ${ultimo.rotulo}.`,
      };
    }

    case 'filtros':
      return { ...estado, filtros: { ...estado.filtros, ...acao.mudanca } };

    case 'llm':
      return { ...estado, llm: { ...estado.llm, ...acao.mudanca } };

    case 'sugestaoLlm': {
      const item = estado.review[acao.base.id];
      if (!item) return estado;
      const atualizada: Suggestion = {
        ...item.suggestion,
        after: acao.after,
        confidence: acao.confianca,
        message: acao.texto,
        unavailable: false,
      };
      return {
        ...estado,
        sugestoes: estado.sugestoes.map((s) => (s.id === acao.base.id ? atualizada : s)),
        review: {
          ...estado.review,
          [acao.base.id]: { suggestion: atualizada, decision: 'pendente' },
        },
        anuncio: `Proposta recebida ${escopo(acao.base.cueIndex)}. Aguardando sua decisão.`,
      };
    }

    case 'anunciar':
      return { ...estado, anuncio: acao.texto };

    case 'video': {
      const novo = { ...estado, video: { url: acao.url, nome: acao.nome }, mapa: null };
      return estado.cues.length > 0 ? reanalisar(novo, estado.config) : novo;
    }

    case 'mapa': {
      const novo = { ...estado, mapa: acao.mapa };
      return estado.cues.length > 0 ? reanalisar(novo, estado.config) : novo;
    }

    case 'atividade': {
      if (!estado.mapa) return estado;
      const { atividade, pisoDb } = detectarAtividade(
        estado.mapa.envelopeDb,
        estado.mapa.janelaMs,
        acao.parametros,
      );
      const novo = { ...estado, mapa: { ...estado.mapa, parametros: acao.parametros, atividade, pisoDb } };
      return estado.cues.length > 0 ? reanalisar(novo, estado.config) : novo;
    }

    case 'cortes': {
      if (!estado.mapa) return estado;
      const mapa = { ...estado.mapa, statusCortes: acao.status, cortes: acao.cortes ?? estado.mapa.cortes };
      const novo = { ...estado, mapa };
      const terminou = acao.status.tipo === 'concluido';
      if (!terminou || estado.cues.length === 0) return novo;
      const r = reanalisar(novo, estado.config);
      return { ...r, anuncio: `${mapa.cortes.length} cortes de plano detectados.` };
    }

    case 'seek':
      return { ...estado, pedidoSeek: { ms: acao.ms, n: (estado.pedidoSeek?.n ?? 0) + 1 } };

    case 'irParaLegenda':
      return {
        ...estado,
        pedidoLista: { index: acao.index, n: (estado.pedidoLista?.n ?? 0) + 1 },
      };

    default:
      return estado;
  }
}

interface Contexto {
  estado: Estado;
  despachar: React.Dispatch<Acao>;
}

const Ctx = createContext<Contexto | null>(null);

export function ProvedorEstado({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(redutor, estadoInicial);
  const valor = useMemo(() => ({ estado, despachar }), [estado]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEstado() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEstado precisa estar dentro de ProvedorEstado');
  return c;
}

/** Sugestões filtradas, na ordem de exibição. */
export function useSugestoesFiltradas(): Suggestion[] {
  const { estado } = useEstado();
  const { sugestoes, filtros, review } = estado;
  return useMemo(() => {
    const busca = filtros.busca.trim().toLowerCase();
    return sugestoes.filter((s) => {
      if (filtros.regra !== 'todas' && s.ruleId !== filtros.regra) return false;
      if (filtros.severidade !== 'todas' && s.severity !== filtros.severidade) return false;
      if (filtros.somentePendentes && review[s.id]?.decision !== 'pendente') return false;
      if (filtros.de !== null && s.cueIndex !== -1 && s.cueIndex < filtros.de) return false;
      if (filtros.ate !== null && s.cueIndex !== -1 && s.cueIndex > filtros.ate) return false;
      if (busca && !s.message.toLowerCase().includes(busca)) return false;
      return true;
    });
  }, [sugestoes, filtros, review]);
}

export function useResultadoFinal() {
  const { estado } = useEstado();
  return useMemo(() => {
    const aplicacao = aplicarDecisoes(estado.cues, estado.review);
    const remanescentes = analisar(aplicacao.cues, estado.config, motor(estado.config, estado.mapa));
    return {
      ...aplicacao,
      remanescentes,
      metricas: calcularMetricas(aplicacao.cues, estado.config),
    };
  }, [estado.cues, estado.review, estado.config, estado.mapa]);
}

export function useAcoes() {
  const { despachar } = useEstado();
  return useMemo(
    () => ({
      decidir: (id: string, decisao: Decision) => despachar({ tipo: 'decidir', id, decisao }),
      editar: (id: string, lines: string[]) => despachar({ tipo: 'editar', id, lines }),
      lote: (ruleId: string) => despachar({ tipo: 'lote', ruleId }),
      desfazerLote: () => despachar({ tipo: 'desfazerLote' }),
      config: (mudanca: Partial<RuleConfig>) => despachar({ tipo: 'config', mudanca }),
      filtros: (mudanca: Partial<Filtros>) => despachar({ tipo: 'filtros', mudanca }),
      anunciar: (texto: string) => despachar({ tipo: 'anunciar', texto }),
    }),
    [despachar],
  );
}

export const useDespachar = () => useEstado().despachar;
export type { Acao };
