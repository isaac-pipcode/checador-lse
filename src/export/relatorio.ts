import type { Cue, Decision, ReviewState, RuleConfig, Suggestion } from '../model/types';
import type { MapaTemporal } from '../mapa/tipos';
import { DOCUMENT_SCOPE } from '../model/types';
import { META_POR_ID } from '../rules';
import { calcularMetricas, contarPorSeveridade, type Metricas } from '../core/metricas';
import { formatarTimecode } from '../core/texto';

export interface RegistroDecisao {
  id: string;
  regra: string;
  regraNome: string;
  legenda: number | 'documento';
  severidade: string;
  verificabilidade: string;
  confianca: number | null;
  mensagem: string;
  decisao: Decision;
  antes: string[];
  depois: string[] | null;
  disponivel: boolean;
}

export interface RelatorioQa {
  geradoEm: string;
  arquivo: string;
  perfil: { id: string; nome: string };
  parametros: RuleConfig;
  totais: {
    legendas: number;
    sugestoes: number;
    erros: number;
    avisos: number;
    revisoesManuais: number;
    aprovadas: number;
    editadas: number;
    rejeitadas: number;
    pendentes: number;
    pendenciasManuaisNaoConfirmadas: number;
    violacoesRemanescentes: number;
  };
  metricasIniciais: Metricas;
  metricasFinais: Metricas;
  decisoes: RegistroDecisao[];
  conflitos: Array<{ id: string; motivo: string }>;
  observacoes: string[];
}

export interface EntradaRelatorio {
  arquivo: string;
  config: RuleConfig;
  cuesOriginais: Cue[];
  cuesFinais: Cue[];
  sugestoes: Suggestion[];
  review: ReviewState;
  sugestoesRemanescentes: Suggestion[];
  conflitos: Array<{ id: string; motivo: string }>;
  /** mapa temporal usado nas regras M; ausente = nenhum vídeo carregado */
  mapa?: MapaTemporal | null;
}

export function montarRelatorio(e: EntradaRelatorio): RelatorioQa {
  const decisoes: RegistroDecisao[] = e.sugestoes.map((s) => {
    const item = e.review[s.id];
    const decisao = item?.decision ?? 'pendente';
    const depois =
      decisao === 'editada'
        ? (item?.editedAfter?.lines ?? s.after?.lines ?? null)
        : (s.after?.lines ?? null);
    return {
      id: s.id,
      regra: s.ruleId,
      regraNome: META_POR_ID.get(s.ruleId)?.nome ?? s.ruleId,
      legenda: s.cueIndex === DOCUMENT_SCOPE ? 'documento' : s.cueIndex,
      severidade: s.severity,
      verificabilidade: s.verifiability,
      confianca: typeof s.confidence === 'number' ? s.confidence : null,
      mensagem: s.message,
      decisao,
      antes: s.before.lines,
      depois,
      disponivel: !s.unavailable,
    };
  });

  const contagem = contarPorSeveridade(e.sugestoes);
  const porDecisao = (d: Decision) => decisoes.filter((x) => x.decisao === d).length;
  const manuaisPendentes = decisoes.filter(
    (x) => x.verificabilidade === 'manual' && x.decisao === 'pendente',
  ).length;

  const observacoes: string[] = [];
  if (!e.config.nlpAtivo) {
    observacoes.push(
      'O módulo de segmentação sintática (L1) estava desligado: a regra não foi verificada.',
    );
  }
  if (!e.config.llmAtivo) {
    observacoes.push(
      'O módulo assistido de redução textual (L2) estava desligado: as candidatas foram apenas listadas, sem proposta de reescrita.',
    );
  }
  if (!e.config.contarEspacos) {
    observacoes.push(
      'Contagem de caracteres SEM espaços — divergente do Guia, que inclui espaços no cômputo.',
    );
  }
  if (!e.mapa) {
    observacoes.push(
      'Nenhum vídeo carregado: as verificações temporais M1 (sincronia), M2 (corte de plano) e M3 (som sem legenda) não foram executadas.',
    );
  } else {
    observacoes.push(
      `Verificações temporais sobre o vídeo «${e.mapa.arquivoVideo}». São inferências sobre o sinal (energia de áudio, diferença entre quadros), não reconhecimento de fala ou de plano.`,
    );
    if (!e.mapa.audio) {
      observacoes.push('O áudio do vídeo não pôde ser decodificado: M1 e M3 não foram executadas.');
    } else {
      observacoes.push(
        `Detecção de som: limiar de ${e.mapa.parametros.limiarDb} dB acima do piso estimado (${e.mapa.pisoDb.toFixed(1)} dBFS), banda de 150–4000 Hz.`,
      );
    }
    if (e.mapa.statusCortes.tipo === 'concluido') {
      observacoes.push(
        `Cortes de plano: ${e.mapa.cortes.length} detectados, amostragem a cada ${e.mapa.statusCortes.passoMs} ms com refinamento a ~1 quadro.`,
      );
    } else {
      observacoes.push('A detecção de cortes não foi concluída: M2 não foi verificada.');
    }
  }
  if (!e.config.contarColchetes) {
    observacoes.push('Contagem de caracteres excluindo o conteúdo entre colchetes.');
  }

  return {
    geradoEm: new Date().toISOString(),
    arquivo: e.arquivo,
    perfil: { id: e.config.perfilId, nome: e.config.perfilNome },
    parametros: e.config,
    totais: {
      legendas: e.cuesOriginais.length,
      sugestoes: e.sugestoes.length,
      erros: contagem.erro,
      avisos: contagem.aviso,
      revisoesManuais: contagem.revisao_manual,
      aprovadas: porDecisao('aprovada'),
      editadas: porDecisao('editada'),
      rejeitadas: porDecisao('rejeitada'),
      pendentes: porDecisao('pendente'),
      pendenciasManuaisNaoConfirmadas: manuaisPendentes,
      violacoesRemanescentes: e.sugestoesRemanescentes.filter((s) => s.severity !== 'revisao_manual')
        .length,
    },
    metricasIniciais: calcularMetricas(e.cuesOriginais, e.config),
    metricasFinais: calcularMetricas(e.cuesFinais, e.config),
    decisoes,
    conflitos: e.conflitos,
    observacoes,
  };
}

const n1 = (x: number) => x.toFixed(1).replace('.', ',');
const n2 = (x: number) => x.toFixed(2).replace('.', ',');

function tabelaMetricas(m: Metricas): string[] {
  return [
    `- Legendas: ${m.totalLegendas}`,
    `- CPS média: ${n2(m.cpsMedia)}`,
    `- CPS máxima: ${n2(m.cpsMaxima)}${m.cpsMaximaIndice ? ` (legenda ${m.cpsMaximaIndice})` : ''}`,
    `- Dentro do alvo: ${n1(m.percentualDentroDoAlvo)}%`,
    `- Linhas acima do limite de caracteres: ${m.linhasAcimaDoLimite}`,
    `- Legendas acima do teto de velocidade: ${m.legendasAcimaDoTeto}`,
    `- Sobreposições: ${m.sobreposicoes}`,
  ];
}

const ROTULO_DECISAO: Record<Decision, string> = {
  pendente: 'pendente',
  aprovada: 'aprovada',
  rejeitada: 'rejeitada',
  editada: 'editada',
};

export function relatorioMarkdown(r: RelatorioQa): string {
  const l: string[] = [];
  l.push('# Relatório de QA — Checador de LSE');
  l.push('');
  l.push(`**Arquivo:** ${r.arquivo}  `);
  l.push(`**Gerado em:** ${new Date(r.geradoEm).toLocaleString('pt-BR')}  `);
  l.push(`**Perfil:** ${r.perfil.nome}`);
  l.push('');
  l.push('## Parâmetros aplicados');
  l.push('');
  l.push(`- Caracteres por linha: ≤ ${r.parametros.maxCaracteresPorLinha}`);
  l.push(`- Linhas por legenda: ≤ ${r.parametros.maxLinhas}`);
  l.push(
    `- Duração: ${r.parametros.duracaoMinimaMs} ms a ${r.parametros.duracaoAvisoMs} ms (aviso), teto ${r.parametros.duracaoMaximaMs} ms`,
  );
  l.push(`- Velocidade: alvo ${r.parametros.cpsAlvo} cps, teto ${r.parametros.cpsMaximo} cps`);
  l.push(
    `- Intervalo mínimo: ${r.parametros.intervaloMinimoMs} ms (${r.parametros.fps} fps)`,
  );
  l.push(
    `- Contagem de caracteres: ${r.parametros.contarEspacos ? 'com' : 'sem'} espaços, ${r.parametros.contarColchetes ? 'incluindo' : 'excluindo'} colchetes`,
  );
  l.push(
    `- Verificações com vídeo: tolerância de sincronia ${r.parametros.toleranciaSincroniaMs} ms (M1), margem ao corte ${r.parametros.margemCorteMs} ms (M2), som sem legenda ≥ ${r.parametros.somSemLegendaMs} ms (M3)`,
  );
  l.push(
    `- Módulos assistidos: segmentação (L1) ${r.parametros.nlpAtivo ? 'ativa' : 'desligada'}; redução (L2) ${r.parametros.llmAtivo ? 'ativa' : 'desligada'}`,
  );
  l.push('');
  l.push('## Resumo das decisões');
  l.push('');
  l.push(`- Sugestões geradas: ${r.totais.sugestoes}`);
  l.push(
    `  - erros: ${r.totais.erros} · avisos: ${r.totais.avisos} · revisão manual: ${r.totais.revisoesManuais}`,
  );
  l.push(
    `- Aprovadas: ${r.totais.aprovadas} · editadas: ${r.totais.editadas} · rejeitadas: ${r.totais.rejeitadas} · pendentes: ${r.totais.pendentes}`,
  );
  l.push(`- Pendências manuais não confirmadas: ${r.totais.pendenciasManuaisNaoConfirmadas}`);
  l.push(`- Violações remanescentes no arquivo gerado: ${r.totais.violacoesRemanescentes}`);
  l.push('');
  l.push('## Métricas');
  l.push('');
  l.push('### Antes');
  l.push(...tabelaMetricas(r.metricasIniciais));
  l.push('');
  l.push('### Depois');
  l.push(...tabelaMetricas(r.metricasFinais));
  l.push('');
  l.push('## Trilha de auditoria');
  l.push('');
  l.push('| Legenda | Regra | Severidade | Verificab. | Confiança | Decisão | Justificativa |');
  l.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const d of r.decisoes) {
    const conf = d.confianca === null ? '—' : n2(d.confianca);
    const msg = d.mensagem.replace(/\|/g, '\\|');
    l.push(
      `| ${d.legenda} | ${d.regra} — ${d.regraNome} | ${d.severidade} | ${d.verificabilidade} | ${conf} | ${ROTULO_DECISAO[d.decisao]} | ${msg} |`,
    );
  }
  l.push('');

  const comDiff = r.decisoes.filter(
    (d) => (d.decisao === 'aprovada' || d.decisao === 'editada') && d.depois,
  );
  if (comDiff.length > 0) {
    l.push('## Alterações aplicadas');
    l.push('');
    for (const d of comDiff) {
      l.push(`### Legenda ${d.legenda} — ${d.regra} (${ROTULO_DECISAO[d.decisao]})`);
      l.push('');
      l.push('```diff');
      for (const linha of d.antes) l.push(`- ${linha}`);
      for (const linha of d.depois ?? []) l.push(`+ ${linha}`);
      l.push('```');
      l.push('');
    }
  }

  if (r.conflitos.length > 0) {
    l.push('## Conflitos entre sugestões');
    l.push('');
    for (const c of r.conflitos) l.push(`- \`${c.id}\`: ${c.motivo}`);
    l.push('');
  }

  if (r.observacoes.length > 0) {
    l.push('## Observações metodológicas');
    l.push('');
    for (const o of r.observacoes) l.push(`- ${o}`);
    l.push('');
  }

  l.push('---');
  l.push('');
  l.push(
    'Parâmetros conforme NAVES, S. B.; MAUCH, C.; ALVES, S. F.; ARAÚJO, V. L. S. *Guia para Produções Audiovisuais Acessíveis*. Brasília: MinC/SAv, 2016.',
  );
  return l.join('\n');
}

export function nomeArquivoSaida(original: string, sufixo: string, extensao: string): string {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base}${sufixo}.${extensao}`;
}

export { formatarTimecode };
