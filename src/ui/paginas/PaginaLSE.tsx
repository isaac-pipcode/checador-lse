import { useEffect, useId, useRef, useState } from 'react';
import { Painel, PainelAbas } from '../comum';
import { useDespachar, useEstado } from '../../state/store';
import { Carregador } from '../Carregador';
import { Resumo } from '../Resumo';
import { AcoesLote, Filtros } from '../Filtros';
import { ApontamentosObra, ListaLegendas, useContagemObra } from '../ListaLegendas';
import { PainelConfig } from '../PainelConfig';
import { ConfigLlm } from '../ConfigLlm';
import { Secao, baixar, useLacunas } from '../comum';
import { useVideo } from '../contextoVideo';
import { detectarCortes } from '../../mapa/midia';
import { lacunasCsv } from '../../mapa/lacunas';
import { formatarTimecode } from '../../core/texto';
import { Icone } from '../icones';

/**
 * Painel esquerdo da página de Legendas. Abas: a lista revisável (com filtros
 * compactos), os apontamentos da obra inteira e o lote com as métricas. O
 * resumo fica numa faixa fixa, visível em qualquer aba.
 */
export function LseEsquerda() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const [previa, setPrevia] = useState(false);
  const obra = useContagemObra();
  const pendentes = Object.values(estado.review).filter(
    (r) => r.decision === 'pendente' && r.suggestion.cueIndex !== -1,
  ).length;
  const carregado = estado.cues.length > 0;

  if (!carregado) {
    return (
      <Painel titulo="Legendas" rotulo="Legendas">
        <Carregador />
        {estado.errosParse.length > 0 ? <ErrosParse /> : null}
      </Painel>
    );
  }

  return (
    <PainelAbas
      memoria="lse-esquerda"
      rotulo="Legendas"
      titulo={
        <>
          Legendas{' '}
          <span className="font-normal normal-case tracking-normal text-navy-500">
            {estado.arquivoNome} · {estado.cues.length}
          </span>
        </>
      }
      acoes={
        <>
          <button
            type="button"
            className="segmento"
            aria-pressed={previa}
            onClick={() => setPrevia((v) => !v)}
            title="Mostrar o texto com as decisões aplicadas"
          >
            Prévia
          </button>
          <button
            type="button"
            className="btn-fantasma h-6 px-2 text-2xs"
            onClick={() => despachar({ tipo: 'limpar' })}
          >
            Trocar arquivo
          </button>
        </>
      }
      faixa={<Resumo variante="chips" />}
      abas={[
        {
          id: 'lista',
          rotulo: 'Legendas',
          marca: pendentes || null,
          tom: 'aviso',
          conteudo: (rolagem) => (
            <>
              {estado.errosParse.length > 0 || estado.avisosParse.length > 0 ? <ErrosParse /> : null}
              <Filtros />
              <ListaLegendas mostrarPrevia={previa} rolagem={rolagem} />
            </>
          ),
        },
        {
          id: 'obra',
          rotulo: 'Obra inteira',
          marca: obra.pendentes || null,
          tom: 'aviso',
          conteudo: <ApontamentosObra />,
        },
        {
          id: 'lote',
          rotulo: 'Lote e métricas',
          conteudo: (
            <>
              <Secao
                titulo="Aprovar em lote"
                dica="O lote só alcança auto-correções determinísticas ainda pendentes. Sugestões assistidas (NLP, LLM, sinal) e pendências manuais exigem decisão uma a uma."
              >
                <AcoesLote />
              </Secao>
              <Secao titulo="Métricas da obra">
                <Resumo variante="metricas" />
              </Secao>
              <Secao titulo="Atalhos da revisão">
                <p className="text-2xs text-navy-700">
                  Com um apontamento em foco: <kbd>A</kbd> aprovar · <kbd>R</kbd> rejeitar · <kbd>E</kbd> editar ·{' '}
                  <kbd>J</kbd>/<kbd>K</kbd> navegar.
                </p>
              </Secao>
            </>
          ),
        },
      ]}
    />
  );
}

function ErrosParse() {
  const { estado } = useEstado();
  return (
    <section
      aria-label="Problemas na leitura do arquivo"
      className="m-3 rounded border border-warn bg-warn-100 px-3 py-2"
    >
      <h3 className="text-sm font-semibold text-warn">
        <Icone nome="aviso" tamanho={14} /> Problemas na leitura do arquivo
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-warn">
        {estado.errosParse.map((e, i) => (
          <li key={i}>
            <strong>Linha {e.linha}:</strong> {e.mensagem}
            {e.trecho ? <code className="ml-1 font-mono text-xs">«{e.trecho}»</code> : null}
          </li>
        ))}
        {estado.avisosParse.map((a, i) => (
          <li key={`a${i}`}>{a}</li>
        ))}
      </ul>
    </section>
  );
}

/** Inspetor da página de Legendas, em abas: vídeo, regras, assistente. */
export function LseDireita() {
  return (
    <PainelAbas
      memoria="lse-direita"
      rotulo="Inspetor de legendas"
      titulo="Inspetor"
      abas={[
        {
          id: 'video',
          rotulo: 'Vídeo',
          conteudo: (
            <div className="p-3">
              <AnaliseVideo />
            </div>
          ),
        },
        {
          id: 'regras',
          rotulo: 'Regras',
          conteudo: (
            <div className="p-3">
              <PainelConfig embutido />
            </div>
          ),
        },
        {
          id: 'assistente',
          rotulo: 'Assistente',
          conteudo: (
            <div className="p-3">
              <ConfigLlm />
            </div>
          ),
        },
      ]}
    />
  );
}

/** Sensibilidade da detecção de som, cortes de plano e lacunas — o mapa temporal. */
function AnaliseVideo() {
  const id = useId();
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { duracaoMs } = useVideo();
  const { mapa, video, config } = estado;
  const [passo, setPasso] = useState(500);
  const abortar = useRef<AbortController | null>(null);
  const { lacunas, fonte } = useLacunas();
  useEffect(() => () => abortar.current?.abort(), []);

  if (!video)
    return <p className="text-xs text-navy-500">Abra o vídeo no monitor para analisar som, cortes e lacunas.</p>;
  if (!mapa) return <p className="text-xs text-navy-500">Analisando o áudio…</p>;
  const sc = mapa.statusCortes;

  async function cortes() {
    if (!video || !mapa) return;
    const ctrl = new AbortController();
    abortar.current = ctrl;
    despachar({ tipo: 'cortes', status: { tipo: 'em_andamento', progresso: 0 } });
    try {
      const r = await detectarCortes(
        video.url,
        duracaoMs,
        passo,
        config.fps,
        (f) => despachar({ tipo: 'cortes', status: { tipo: 'em_andamento', progresso: f } }),
        ctrl.signal,
      );
      despachar({ tipo: 'cortes', status: { tipo: 'concluido', passoMs: passo }, cortes: r });
    } catch (e) {
      const cancelado = e instanceof DOMException && e.name === 'AbortError';
      despachar({
        tipo: 'cortes',
        status: cancelado ? { tipo: 'cancelado' } : { tipo: 'erro', mensagem: String(e) },
        cortes: [],
      });
    }
  }

  return (
    <div className="space-y-3 text-xs">
      {mapa.audio ? (
        <div>
          <div className="flex items-baseline justify-between">
            <label className="rotulo" htmlFor={`${id}-lim`}>
              Sensibilidade do som
            </label>
            <span className="font-mono">{mapa.parametros.limiarDb} dB</span>
          </div>
          <input
            id={`${id}-lim`}
            type="range"
            min={3}
            max={30}
            value={mapa.parametros.limiarDb}
            onChange={(e) =>
              despachar({ tipo: 'atividade', parametros: { ...mapa.parametros, limiarDb: Number(e.target.value) } })
            }
            className="w-full accent-[rgb(var(--c-terra))]"
          />
          <p className="text-2xs text-navy-500">
            {mapa.atividade.length} segmentos com som · piso {mapa.pisoDb.toFixed(0)} dBFS. Energia na banda de voz, não
            reconhecimento de fala.
          </p>
        </div>
      ) : (
        <p className="text-warn">{mapa.erroAudio ?? 'Áudio não analisado'}: M1 e M3 não são verificadas.</p>
      )}

      <div>
        <p className="rotulo">Cortes de plano</p>
        <div className="mt-1 flex items-center gap-1.5">
          <select
            className="campo w-auto"
            aria-label="Amostragem"
            value={passo}
            onChange={(e) => setPasso(Number(e.target.value))}
            disabled={sc.tipo === 'em_andamento'}
          >
            <option value={250}>a cada 250 ms</option>
            <option value={500}>a cada 500 ms</option>
            <option value={1000}>a cada 1 s</option>
          </select>
          {sc.tipo === 'em_andamento' ? (
            <button type="button" className="btn-secundario h-7" onClick={() => abortar.current?.abort()}>
              Cancelar {Math.round(sc.progresso * 100)}%
            </button>
          ) : (
            <button type="button" className="btn-secundario h-7" onClick={() => void cortes()}>
              {sc.tipo === 'concluido' ? 'Detectar de novo' : 'Detectar'}
            </button>
          )}
        </div>
        {sc.tipo === 'em_andamento' ? (
          <progress max={1} value={sc.progresso} className="mt-1 w-full" aria-label="Progresso" />
        ) : null}
        <p className="mt-1 text-2xs text-navy-500">
          {sc.tipo === 'concluido'
            ? `${mapa.cortes.length} cortes, a ~1 quadro. Cortes a menos de ${sc.passoMs} ms e fusões lentas podem escapar.`
            : 'Sem isso, M2 (corte de plano) não é verificada.'}
        </p>
      </div>

      <div>
        <p className="rotulo">Lacunas para audiodescrição</p>
        <p className="mt-0.5">
          <strong>{lacunas.length}</strong> lacunas ≥ {(config.lacunaMinimaAdMs / 1000).toLocaleString('pt-BR')} s,
          somando {(lacunas.reduce((a, l) => a + l.fimMs - l.inicioMs, 0) / 1000).toFixed(0)} s
          {fonte === 'silencio' ? ' (dos silêncios: sem legenda carregada)' : ''}.
        </p>
        {lacunas.length > 0 ? (
          <button
            type="button"
            className="btn-fantasma mt-1 h-7 px-2"
            onClick={() =>
              baixar(
                `${(estado.arquivoNome ?? video.nome).replace(/\.[^.]+$/, '')}-lacunas-ad.csv`,
                lacunasCsv(lacunas, (ms) => formatarTimecode(ms)),
                'text/csv',
              )
            }
          >
            Exportar CSV
          </button>
        ) : null}
      </div>
    </div>
  );
}
