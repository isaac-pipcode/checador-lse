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
import type { BlocoAD, ParametrosAD, Take } from '../ad/tipos';
import { PARAMETROS_AD_PADRAO } from '../ad/tipos';
import type { Intervalo } from '../mapa/tipos';
import { novoId } from '../ad/takes';
import { JANELA_PADRAO, type JanelaLibras } from '../libras/tipos';
import type { InfoVideo } from '../midia/avaliacao';

export type Pagina = 'projetos' | 'lse' | 'ad' | 'libras' | 'entrega';

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
  /**
   * Vídeo da obra. `caminho`/`urlOriginal` são o master (é dele que a entrega
   * renderiza); `url` é o que o monitor toca — o proxy, quando em uso.
   */
  video: {
    url: string;
    nome: string;
    caminho: string | null;
    urlOriginal: string;
    info: InfoVideo | null;
    proxy: { caminho: string; url: string } | null;
    usarProxy: boolean;
  } | null;
  /** proxies em geração, por caminho do original */
  proxies: Record<string, { progresso: number; erro: string | null }>;
  ad: { blocos: BlocoAD[]; parametros: ParametrosAD };
  /** projeto desktop: caminho do .estudio.json e se há mudanças não salvas */
  projeto: { caminho: string | null; sujo: boolean; nome: string | null };
  libras: JanelaLibras;
  pagina: Pagina;
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
  proxies: {},
  ad: { blocos: [], parametros: PARAMETROS_AD_PADRAO },
  projeto: { caminho: null, sujo: false, nome: null },
  libras: JANELA_PADRAO,
  pagina: 'projetos',
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
  | { tipo: 'video'; url: string; nome: string; caminho: string | null; info?: InfoVideo | null }
  | { tipo: 'videoProxy'; proxy: { caminho: string; url: string } | null; usar: boolean; restaurando?: boolean }
  | { tipo: 'videoUsarProxy'; usar: boolean }
  | { tipo: 'proxyTrabalho'; caminho: string; progresso: number | null; erro?: string | null }
  | { tipo: 'adCriarDasLacunas'; lacunas: Intervalo[] }
  | { tipo: 'adAdicionar'; inicioMs: number; fimMs: number }
  | { tipo: 'adEditar'; id: string; mudanca: Partial<Pick<BlocoAD, 'texto' | 'nota' | 'inicioMs' | 'fimMs'>> }
  | { tipo: 'adRemover'; id: string }
  | { tipo: 'adAprovar'; id: string; aprovado: boolean }
  | { tipo: 'adNovoTake'; blocoId: string; take: Take }
  | { tipo: 'adAjustarTake'; blocoId: string; takeId: string; mudanca: Partial<Take> }
  | { tipo: 'adAtivarTake'; blocoId: string; takeId: string }
  | { tipo: 'adRemoverTake'; blocoId: string; takeId: string }
  | { tipo: 'adParametros'; mudanca: Partial<ParametrosAD> }
  | { tipo: 'projetoCarregado'; caminho: string; ad: Estado['ad']; libras?: JanelaLibras }
  | { tipo: 'projetoNovo'; caminho: string | null; nome: string }
  | { tipo: 'navegar'; pagina: Pagina }
  | { tipo: 'libras'; mudanca: Partial<JanelaLibras> }
  | { tipo: 'projetoSalvo'; caminho: string; arquivosTakes: Record<string, string> }
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
  return {
    config: estado.config,
    llm: estado.llm,
    video: estado.video,
    mapa: estado.mapa,
    ad: estado.ad,
    projeto: estado.projeto,
    libras: estado.libras,
    pagina: estado.pagina,
  };
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

function nomeDoCaminho(c: string): string {
  return (c.split(/[\\/]/).pop() ?? c).replace(/\.estudio\.json$/i, '').replace(/\.json$/i, '');
}

function ordenarBlocos(blocos: BlocoAD[]): BlocoAD[] {
  return [...blocos].sort((a, b) => a.inicioMs - b.inicioMs);
}

function comAd(estado: Estado, blocos: BlocoAD[], anuncio?: string): Estado {
  return {
    ...estado,
    ad: { ...estado.ad, blocos },
    projeto: { ...estado.projeto, sujo: true },
    ...(anuncio ? { anuncio } : {}),
  };
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
      const novo = {
        ...estado,
        video: {
          url: acao.url,
          nome: acao.nome,
          caminho: acao.caminho,
          urlOriginal: acao.url,
          info: acao.info ?? null,
          proxy: null,
          usarProxy: false,
        },
        mapa: null,
      };
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

    case 'adCriarDasLacunas': {
      const existentes = estado.ad.blocos;
      const livres = acao.lacunas.filter(
        (l) => !existentes.some((b) => b.inicioMs < l.fimMs && b.fimMs > l.inicioMs),
      );
      if (livres.length === 0) return { ...estado, anuncio: 'Nenhuma lacuna nova: todas já têm bloco.' };
      const novos: BlocoAD[] = livres.map((l) => ({
        id: novoId('b'),
        inicioMs: l.inicioMs,
        fimMs: l.fimMs,
        texto: '',
        nota: '',
        takes: [],
        takeAtivoId: null,
      }));
      return comAd(estado, ordenarBlocos([...existentes, ...novos]), `${novos.length} blocos criados a partir das lacunas.`);
    }

    case 'adAdicionar':
      return comAd(
        estado,
        ordenarBlocos([
          ...estado.ad.blocos,
          { id: novoId('b'), inicioMs: acao.inicioMs, fimMs: acao.fimMs, texto: '', nota: '', takes: [], takeAtivoId: null },
        ]),
        'Bloco de audiodescrição criado.',
      );

    case 'adEditar': {
      const alvo = estado.ad.blocos.find((b) => b.id === acao.id);
      // Mudar o texto de um roteiro aprovado revoga a aprovação: o locutor
      // não pode gravar algo que a editora não liberou.
      const revoga =
        alvo?.aprovado === true && acao.mudanca.texto !== undefined && acao.mudanca.texto !== alvo.texto;
      return comAd(
        estado,
        ordenarBlocos(
          estado.ad.blocos.map((b) =>
            b.id === acao.id ? { ...b, ...acao.mudanca, ...(revoga ? { aprovado: false } : {}) } : b,
          ),
        ),
        revoga ? 'Texto alterado: o bloco voltou a rascunho e precisa ser aprovado de novo.' : undefined,
      );
    }

    case 'adAprovar':
      return comAd(
        estado,
        estado.ad.blocos.map((b) => (b.id === acao.id ? { ...b, aprovado: acao.aprovado } : b)),
        acao.aprovado ? 'Roteiro aprovado para gravação.' : 'Aprovação retirada.',
      );

    case 'adRemover':
      return comAd(estado, estado.ad.blocos.filter((b) => b.id !== acao.id), 'Bloco removido.');

    case 'adNovoTake':
      return comAd(
        estado,
        estado.ad.blocos.map((b) =>
          b.id === acao.blocoId ? { ...b, takes: [...b.takes, acao.take], takeAtivoId: acao.take.id } : b,
        ),
        'Gravação adicionada e escolhida para a mixagem.',
      );

    case 'adAjustarTake':
      return comAd(
        estado,
        estado.ad.blocos.map((b) =>
          b.id === acao.blocoId
            ? { ...b, takes: b.takes.map((t) => (t.id === acao.takeId ? { ...t, ...acao.mudanca } : t)) }
            : b,
        ),
      );

    case 'adAtivarTake':
      return comAd(
        estado,
        estado.ad.blocos.map((b) => (b.id === acao.blocoId ? { ...b, takeAtivoId: acao.takeId } : b)),
        'Gravação escolhida para a mixagem.',
      );

    case 'adRemoverTake':
      return comAd(
        estado,
        estado.ad.blocos.map((b) =>
          b.id === acao.blocoId
            ? {
                ...b,
                takes: b.takes.filter((t) => t.id !== acao.takeId),
                takeAtivoId: b.takeAtivoId === acao.takeId ? null : b.takeAtivoId,
              }
            : b,
        ),
        'Gravação descartada.',
      );

    case 'adParametros':
      return {
        ...estado,
        ad: { ...estado.ad, parametros: { ...estado.ad.parametros, ...acao.mudanca } },
        projeto: { ...estado.projeto, sujo: true },
      };

    case 'projetoCarregado':
      return {
        ...estado,
        // parâmetros novos ausentes em projetos antigos recebem o padrão
        ad: {
          ...acao.ad,
          parametros: {
            ...PARAMETROS_AD_PADRAO,
            ...acao.ad.parametros,
            legenda: { ...PARAMETROS_AD_PADRAO.legenda, ...(acao.ad.parametros.legenda ?? {}) },
          },
        },
        libras: acao.libras ?? JANELA_PADRAO,
        projeto: { caminho: acao.caminho, sujo: false, nome: nomeDoCaminho(acao.caminho) },
        anuncio: `Projeto aberto: ${acao.ad.blocos.length} blocos de audiodescrição.`,
      };

    case 'projetoSalvo':
      return {
        ...estado,
        ad: {
          ...estado.ad,
          blocos: estado.ad.blocos.map((b) => ({
            ...b,
            takes: b.takes.map((t) => (acao.arquivosTakes[t.id] ? { ...t, arquivo: acao.arquivosTakes[t.id] } : t)),
          })),
        },
        projeto: { caminho: acao.caminho, sujo: false, nome: nomeDoCaminho(acao.caminho) },
        anuncio: 'Projeto salvo.',
      };

    case 'projetoNovo':
      // projeto em branco: só a configuração de regras e o LLM sobrevivem
      return {
        ...estadoInicial,
        config: estado.config,
        llm: estado.llm,
        projeto: { caminho: acao.caminho, sujo: true, nome: acao.nome },
        pagina: 'lse',
        anuncio: `Projeto «${acao.nome}» criado.`,
      };

    case 'navegar':
      return { ...estado, pagina: acao.pagina };

    case 'libras':
      return {
        ...estado,
        libras: { ...estado.libras, ...acao.mudanca },
        projeto: { ...estado.projeto, sujo: true },
      };

    case 'videoProxy': {
      if (!estado.video) return estado;
      const usar = acao.usar && !!acao.proxy;
      return {
        ...estado,
        video: { ...estado.video, proxy: acao.proxy, usarProxy: usar, url: usar ? acao.proxy!.url : estado.video.urlOriginal },
        // restaurar o proxy ao abrir um projeto não é alteração
        projeto: acao.restaurando ? estado.projeto : { ...estado.projeto, sujo: true },
        anuncio: acao.proxy ? (usar ? 'Monitor usando o proxy de edição.' : 'Proxy disponível.') : estado.anuncio,
      };
    }

    case 'videoUsarProxy': {
      if (!estado.video) return estado;
      const usar = acao.usar && !!estado.video.proxy;
      return {
        ...estado,
        video: { ...estado.video, usarProxy: usar, url: usar ? estado.video.proxy!.url : estado.video.urlOriginal },
        projeto: { ...estado.projeto, sujo: true },
        anuncio: usar ? 'Monitor usando o proxy.' : 'Monitor usando o original.',
      };
    }

    case 'proxyTrabalho': {
      const proxies = { ...estado.proxies };
      if (acao.progresso === null && !acao.erro) delete proxies[acao.caminho];
      else proxies[acao.caminho] = { progresso: acao.progresso ?? 0, erro: acao.erro ?? null };
      return { ...estado, proxies };
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
/** exposto só para testes do redutor */
export const redutorParaTeste = redutor;
export type { Acao };
