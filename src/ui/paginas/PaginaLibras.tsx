import { useEffect, useId, useState, type ReactNode } from 'react';
import { useDespachar, useEstado, useResultadoFinal, type LibrasUi } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { ponte } from '../../desktop/ponte';
import { Deslizante, PainelAbas, Secao, tcSmpte } from '../comum';
import { retanguloJanela, verificarJanela } from '../../libras/geometria';
import { analisarSincronia } from '../../libras/sincronia';
import { JANELA_PADRAO, NBR_15290, type Canto, type JanelaLibras } from '../../libras/tipos';
import { aplicarProporcao, dentroDaAreaSegura, margemParaAreaSegura, propostas } from '../../libras/enquadramento';
import { JANELA_MS } from '../../mapa/midia';
import { avaliarMidia, type InfoVideo } from '../../midia/avaliacao';
import { invasaoDosNeutros, toleranciaSugerida } from '../../libras/chroma';
import { gerarProxyDe } from '../proxy';
import { amostrarQuadros, corChaveDosQuadros, enquadramentoAutomatico, envelopesDoClipe } from '../libras/analiseClipe';
import { ConferenciaOndas, ResiduoSincronia } from '../libras/GraficosSincronia';
import { DICA_EXPORTAR, ExportarEditores } from '../libras/ExportarEditores';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const dec = (v: number, c = 2) => v.toFixed(c).replace('.', ',');

function useJanela() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  return {
    j: estado.libras,
    ui: estado.librasUi,
    mudar: (mudanca: Partial<JanelaLibras>) => despachar({ tipo: 'libras', mudanca }),
    mudarUi: (mudanca: Partial<LibrasUi>) => despachar({ tipo: 'librasUi', mudanca }),
  };
}

/** Quadro da obra (master), para medidas em pixels e proporções. */
function useQuadro(): { w: number; h: number } {
  const { estado } = useEstado();
  const { video } = useVideo();
  const i = estado.video?.info;
  if (i?.largura && i.altura) return { w: i.largura, h: i.altura };
  if (video?.videoWidth) return { w: video.videoWidth, h: video.videoHeight };
  return { w: 1920, h: 1080 };
}

function Segmentos<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: Array<[T, string]>;
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="flex rounded bg-fundo p-0.5" role="group" aria-label={rotulo}>
      {opcoes.map(([v, r]) => (
        <button
          key={v}
          type="button"
          className="segmento h-7 flex-1 justify-center px-2"
          aria-pressed={valor === v}
          onClick={() => aoMudar(v)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ===========================================================================
// Painel esquerdo: clipe, sincronização, conferência, verificações
// ===========================================================================

export function LibrasEsquerda() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const final = useResultadoFinal();
  const { j, ui, mudar, mudarUi } = useJanela();
  const { buscar, tempoMs, duracaoMs } = useVideo();
  const desktop = ponte();
  const quadro = useQuadro();
  const [sinc, setSinc] = useState<{ progresso: number; etapa: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [razao, setRazao] = useState<string | null>(null);
  const fps = estado.config.fps;
  const ap = verificarJanela(j, NBR_15290, duracaoMs, final.cues, quadro);
  const [infoClipe, setInfoClipe] = useState<InfoVideo | null>(null);
  useEffect(() => {
    if (!j.clipe) setInfoClipe(null);
    if (!j.clipe?.caminho || infoClipe || !desktop) return;
    void desktop.sondarMidia(j.clipe.caminho).then(setInfoClipe, () => {});
  }, [j.clipe, j.clipe?.caminho, infoClipe, desktop]);
  const avalClipe = infoClipe ? avaliarMidia(infoClipe) : null;
  const trabalhoClipe = j.clipe?.caminho ? estado.proxies[j.clipe.caminho] : undefined;
  const envClipe = j.clipe?.caminho ? envelopesDoClipe.get(j.clipe.caminho) : undefined;
  const erros = ap.filter((a) => a.nivel === 'erro').length;

  async function escolher() {
    if (!desktop) return;
    const c = await desktop.escolherClipeLibras();
    if (!c) return;
    const clipe = {
      nome: c.nome,
      caminho: c.caminho,
      url: c.url,
      urlOriginal: c.url,
      duracaoMs: c.duracaoMs,
      proxy: null,
    };
    mudar({
      clipe,
      inicioNaObraMs: 0,
      velocidade: 1,
      sincronia: { metodo: 'nenhuma', confianca: null, relatorio: null },
    });
    setInfoClipe(c.info ?? null);
    setMsg(null);
    if (c.info && avaliarMidia(c.info).necessidade === 'obrigatorio') await proxyDoClipe(clipe);
  }

  async function proxyDoClipe(clipe: NonNullable<JanelaLibras['clipe']>) {
    if (!clipe.caminho) return;
    const px = await gerarProxyDe(despachar, clipe.caminho, estado.projeto.caminho);
    if (px) mudar({ clipe: { ...clipe, proxy: px, url: px.url } });
  }

  async function sincronizar() {
    if (!desktop || !j.clipe?.caminho || !estado.mapa?.audio) return;
    setMsg(null);
    setSinc({ progresso: 0, etapa: 'Lendo o som-guia' });
    try {
      const env = await desktop.analisarAudio(j.clipe.caminho, JANELA_MS, (f) =>
        setSinc({ progresso: f, etapa: 'Lendo o som-guia' }),
      );
      envelopesDoClipe.set(j.clipe.caminho, env.envelopeDb);
      setSinc({ progresso: 1, etapa: 'Comparando com a trilha do filme' });
      await new Promise((r) => setTimeout(r, 30)); // deixa a interface pintar antes do cálculo
      const r = analisarSincronia(estado.mapa.envelopeDb, env.envelopeDb, JANELA_MS, { fps });
      setRazao(r.razaoCadencia.razao !== 1 ? r.razaoCadencia.rotulo : null);
      mudar({
        inicioNaObraMs: r.inicioNaObraMs,
        velocidade: r.velocidade,
        sincronia: { metodo: 'audio', confianca: r.confianca, relatorio: r.relatorio },
      });
      setMsg(
        r.confianca >= 0.5
          ? 'Sincronizado pelo som-guia. Confira no gráfico e de ouvido.'
          : `Confiança baixa (${pct(r.confianca)}): o clipe pode não ter som-guia, ou ele difere muito da trilha. Ajuste à mão.`,
      );
    } catch (e) {
      setMsg(`Não foi possível analisar o áudio do clipe: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSinc(null);
    }
  }

  const deslocar = (delta: number) =>
    mudar({ inicioNaObraMs: Math.round(j.inicioNaObraMs + delta), sincronia: { ...j.sincronia, metodo: 'manual' } });
  const rel = j.sincronia.relatorio;

  const sincronia: ReactNode = (
    <>
      <Secao
        titulo="Clipe do intérprete"
        dica="Gravado com fundo verde e com a trilha do filme como som-guia: é por ela que o estúdio sincroniza."
      >
        {j.clipe ? (
          <div className="text-xs">
            <p className="truncate font-medium text-navy" title={j.clipe.caminho ?? ''}>
              {j.clipe.nome}
            </p>
            <p className="text-navy-500">
              {tcSmpte(j.clipe.duracaoMs, fps)}
              {avalClipe ? ` · ${avalClipe.descricao}` : ''}
            </p>
            <p className="mt-1 text-2xs" role="status">
              {trabalhoClipe && !trabalhoClipe.erro ? (
                <span className="text-navy-700">
                  Gerando proxy da prévia… {Math.round(trabalhoClipe.progresso * 100)}%
                </span>
              ) : j.clipe.proxy ? (
                <span className="text-ok">
                  <span aria-hidden="true">✓ </span>Prévia no proxy; a entrega usa o original.
                </span>
              ) : avalClipe && avalClipe.necessidade !== 'dispensavel' ? (
                <button
                  type="button"
                  className="btn-fantasma h-6 px-1.5 text-2xs"
                  onClick={() => j.clipe && void proxyDoClipe(j.clipe)}
                >
                  Gerar proxy para a prévia
                </button>
              ) : null}
              {trabalhoClipe?.erro ? <span className="text-bad">{trabalhoClipe.erro}</span> : null}
            </p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" className="btn-secundario h-7" onClick={() => void escolher()} disabled={!desktop}>
                Trocar…
              </button>
              <button
                type="button"
                className="btn-fantasma h-7"
                onClick={() => mudar({ clipe: null, sincronia: { metodo: 'nenhuma', confianca: null } })}
              >
                Remover
              </button>
            </div>
          </div>
        ) : desktop ? (
          <>
            <button type="button" className="btn-primario w-full justify-center" onClick={() => void escolher()}>
              Importar vídeo do intérprete…
            </button>
          </>
        ) : (
          <p className="text-xs text-navy-500">A importação do clipe usa o aplicativo desktop.</p>
        )}
      </Secao>

      {j.clipe ? (
        <Secao titulo="Sincronização pelo som-guia">
          <button
            type="button"
            className="btn-secundario w-full justify-center"
            disabled={!!sinc || !estado.mapa?.audio || !j.clipe.caminho}
            onClick={() => void sincronizar()}
          >
            {sinc
              ? `${sinc.etapa}… ${sinc.etapa.startsWith('Lendo') ? pct(sinc.progresso) : ''}`
              : rel
                ? 'Sincronizar de novo'
                : 'Sincronizar pelo som-guia'}
          </button>
          {!estado.mapa?.audio ? <p className="mt-1 text-2xs text-warn">É preciso o áudio da obra analisado.</p> : null}
          {msg ? (
            <p className="mt-2 text-2xs text-navy-700" role="status">
              {msg}
            </p>
          ) : null}

          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-navy-500">Início na obra</dt>
            <dd className="font-mono text-terra-700">
              {j.inicioNaObraMs < 0 ? '−' : ''}
              {tcSmpte(Math.abs(j.inicioNaObraMs), fps)}
            </dd>
            <dt className="text-navy-500">Deriva</dt>
            <dd>
              {rel
                ? rel.corrigida
                  ? `${rel.derivaMsPorHora > 0 ? '+' : ''}${rel.derivaMsPorHora} ms/h — corrigida (velocidade ×${dec(j.velocidade, 5)})`
                  : 'desprezível (< ½ quadro no clipe)'
                : j.velocidade !== 1
                  ? `velocidade ×${dec(j.velocidade, 5)}`
                  : '—'}
            </dd>
            {razao ? (
              <>
                <dt className="text-navy-500">Cadência</dt>
                <dd>conversão {razao}</dd>
              </>
            ) : null}
            <dt className="text-navy-500">Método</dt>
            <dd>
              {j.sincronia.metodo === 'audio'
                ? `som-guia · confiança ${pct(j.sincronia.confianca ?? 0)}`
                : j.sincronia.metodo === 'manual'
                  ? 'ajustado à mão'
                  : 'não sincronizado'}
            </dd>
          </dl>

          {envClipe && estado.mapa?.audio ? (
            <div className="mt-3">
              <ConferenciaOndas
                envObra={estado.mapa.envelopeDb}
                envClipe={envClipe}
                janelaMs={JANELA_MS}
                tempoMs={tempoMs}
                inicioNaObraMs={j.inicioNaObraMs}
                velocidade={j.velocidade}
              />
            </div>
          ) : null}
          {rel && rel.pontos.length > 0 ? (
            <div className="mt-3">
              <ResiduoSincronia relatorio={rel} fps={fps} />
            </div>
          ) : null}
        </Secao>
      ) : null}

      {j.clipe ? (
        <Secao titulo="Ajuste fino">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Deslocar o clipe">
            {(
              [
                [-1000, '−1 s'],
                [-1000 / fps, '−1 qd'],
                [1000 / fps, '+1 qd'],
                [1000, '+1 s'],
              ] as const
            ).map(([d, r]) => (
              <button key={r} type="button" className="btn-secundario h-7 px-2 text-2xs" onClick={() => deslocar(d)}>
                {r}
              </button>
            ))}
            <button
              type="button"
              className="btn-fantasma h-7 px-2 text-2xs"
              onClick={() => mudar({ inicioNaObraMs: tempoMs, sincronia: { ...j.sincronia, metodo: 'manual' } })}
              title="O clipe começa na posição atual do vídeo"
            >
              Começar aqui
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <label htmlFor="libras-vel" className="text-navy-700">
              Velocidade
            </label>
            <input
              id="libras-vel"
              className="campo w-28 font-mono"
              type="number"
              step={0.0001}
              min={0.9}
              max={1.1}
              value={Number(j.velocidade.toFixed(5))}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0.5 && v < 1.5) mudar({ velocidade: v, sincronia: { ...j.sincronia, metodo: 'manual' } });
              }}
            />
            {j.velocidade !== 1 ? (
              <button
                type="button"
                className="btn-fantasma h-6 px-1.5 text-2xs"
                onClick={() => mudar({ velocidade: 1 })}
              >
                1,0
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-fantasma mt-1 h-7 px-2 text-2xs"
            onClick={() => buscar(Math.max(0, j.inicioNaObraMs))}
          >
            Ir ao início do clipe
          </button>
        </Secao>
      ) : null}

      {j.clipe ? (
        <Secao
          titulo="Conferir de ouvido"
          dica="Em “Ambos”, com fones: filme à esquerda, som-guia à direita. Em sincronia, soam juntos; defasados, como eco."
        >
          <Segmentos
            rotulo="O que ouvir"
            valor={ui.escuta}
            aoMudar={(v) => mudarUi({ escuta: v })}
            opcoes={[
              ['filme', 'Filme'],
              ['ambos', 'Ambos (E/D)'],
              ['interprete', 'Som-guia'],
            ]}
          />
        </Secao>
      ) : null}

      {j.clipe ? (
        <Secao titulo="Exportar para editores" dica={DICA_EXPORTAR}>
          <ExportarEditores />
        </Secao>
      ) : null}
    </>
  );

  return (
    <PainelAbas
      memoria="libras-esquerda"
      rotulo="Intérprete de Libras"
      titulo="Intérprete"
      abas={[
        { id: 'sincronia', rotulo: 'Clipe e sincronia', conteudo: sincronia },
        {
          id: 'verificacoes',
          rotulo: 'Verificações',
          marca: ap.filter((a) => a.nivel !== 'pendente').length || null,
          tom: erros ? 'erro' : 'aviso',
          conteudo: (
            <Secao titulo="Verificações">
              {ap.length === 0 ? (
                <p className="text-xs text-ok">
                  <span aria-hidden="true">✓ </span>Sem apontamentos.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {ap.map((a) => (
                    <li
                      key={a.codigo}
                      className={a.nivel === 'erro' ? 'text-bad' : a.nivel === 'aviso' ? 'text-warn' : 'text-navy-700'}
                    >
                      <span aria-hidden="true">{a.nivel === 'erro' ? '✕ ' : a.nivel === 'aviso' ? '! ' : '… '}</span>
                      <span className="font-mono text-2xs">{a.codigo}</span> {a.mensagem}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-2xs text-navy-500">Referência: {NBR_15290.fonte}.</p>
            </Secao>
          ),
        },
      ]}
    />
  );
}

// ===========================================================================
// Inspetor: janela, enquadramento, recorte, cor
// ===========================================================================

const CANTOS: Array<[Canto, string]> = [
  ['sup-esq', 'Superior esquerdo'],
  ['sup-dir', 'Superior direito'],
  ['inf-esq', 'Inferior esquerdo'],
  ['inf-dir', 'Inferior direito'],
];

/** classes literais (o Tailwind não gera nomes montados em tempo de execução) */
const ALINHAMENTO: Record<Canto, string> = {
  'sup-esq': 'items-start justify-start',
  'sup-dir': 'items-start justify-end',
  'inf-esq': 'items-end justify-start',
  'inf-dir': 'items-end justify-end',
};

export function LibrasDireita() {
  const id = useId();
  const { j, ui, mudar, mudarUi } = useJanela();
  const quadro = useQuadro();
  const [auto, setAuto] = useState<{ estado: 'analisando' | 'ok' | 'erro'; texto: string } | null>(null);
  const [detectando, setDetectando] = useState(false);
  const mudarChroma = (m: Partial<JanelaLibras['chroma']>) => mudar({ chroma: { ...j.chroma, ...m } });
  const mudarCor = (m: Partial<JanelaLibras['cor']>) => mudar({ cor: { ...j.cor, ...m } });
  const r = retanguloJanela(j, quadro.w, quadro.h);
  const aspecto = r.w / r.h;
  const props = propostas(quadro, NBR_15290);
  const ativa = props.find((p) => p.aspecto !== null && Math.abs(p.aspecto - aspecto) < 0.02)?.id ?? 'livre';
  const seguro = dentroDaAreaSegura(j, quadro);

  async function enquadrar() {
    if (!j.clipe) return;
    setAuto({ estado: 'analisando', texto: 'Analisando 16 quadros do clipe…' });
    try {
      const amostra = await amostrarQuadros(j.clipe.url, 16);
      const r2 = enquadramentoAutomatico(j, amostra, { w: r.w, h: r.h });
      if (!r2) {
        setAuto({ estado: 'erro', texto: 'O intérprete não foi encontrado: confira a cor-chave do recorte.' });
        return;
      }
      mudar({ zoom: r2.zoom, deslocX: r2.deslocX, deslocY: r2.deslocY });
      setAuto({
        estado: 'ok',
        texto:
          `Espaço de sinalização: ${pct(r2.caixaFracao.w)} × ${pct(r2.caixaFracao.h)} do quadro do clipe, com folga.` +
          (r2.ignorados
            ? ` ${r2.ignorados} objeto(s) separado(s) do intérprete (tripé, refletor, borda do pano) ficaram de fora — se aparecerem na janela, use “Recortar bordas do quadro”.`
            : ''),
      });
    } catch (e) {
      setAuto({ estado: 'erro', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  async function detectarCor() {
    if (!j.clipe) return;
    setDetectando(true);
    try {
      const amostra = await amostrarQuadros(j.clipe.url, 6, 160);
      const cor = corChaveDosQuadros(amostra.quadros);
      if (cor) mudarChroma({ cor, ativo: true, ...toleranciaSugerida(cor) });
    } finally {
      setDetectando(false);
    }
  }

  const janela = (
    <>
      <Secao titulo="Proporção">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Proporção da janela">
          {props.map((p) => (
            <button
              key={p.id}
              type="button"
              className="segmento h-7 border border-paper-400 px-2"
              aria-pressed={ativa === p.id}
              title={p.descricao}
              onClick={() => p.aspecto !== null && mudar(aplicarProporcao(j.altura, p.aspecto, quadro, NBR_15290))}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-2xs text-navy-500">
          {r.w}×{r.h} px num quadro de {quadro.w}×{quadro.h}.
        </p>
      </Secao>
      <Secao titulo="Tamanho" dica="Com uma proporção escolhida, a altura arrasta a largura junto.">
        <Deslizante
          id={`${id}-h`}
          rotulo="Altura"
          valor={j.altura}
          min={0.3}
          max={0.9}
          passo={0.01}
          formatar={(v) => `${pct(v)} da tela`}
          aoMudar={(v) =>
            ativa !== 'livre'
              ? mudar(aplicarProporcao(v, aspecto, quadro, { ...NBR_15290, alturaMin: 0 }))
              : mudar({ altura: v })
          }
          marca={{ valor: NBR_15290.alturaMin, rotulo: `mínimo ${pct(NBR_15290.alturaMin)} (NBR 15290)` }}
        />
        <Deslizante
          id={`${id}-w`}
          rotulo="Largura"
          valor={j.largura}
          min={0.15}
          max={0.5}
          passo={0.01}
          formatar={(v) => `${pct(v)} da tela`}
          aoMudar={(v) => mudar({ largura: v })}
          marca={{ valor: NBR_15290.larguraMin, rotulo: `mínimo ${pct(NBR_15290.larguraMin)} (NBR 15290)` }}
        />
      </Secao>
      <Secao titulo="Posição e espaço">
        <div
          className="grid w-40 grid-cols-2 gap-1 rounded border border-paper-400 bg-fundo p-1"
          role="radiogroup"
          aria-label="Canto da tela"
        >
          {CANTOS.map(([c, rot]) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={j.canto === c}
              aria-label={rot}
              onClick={() => mudar({ canto: c })}
              className={`flex h-10 rounded p-1 ${ALINHAMENTO[c]} ${j.canto === c ? 'bg-paper-200' : 'hover:bg-paper'}`}
            >
              <span
                aria-hidden="true"
                className={`block h-5 w-3 rounded-sm ${j.canto === c ? 'bg-terra' : 'bg-navy-500/50'}`}
              />
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Deslizante
            id={`${id}-m`}
            rotulo="Margem"
            valor={j.margem}
            min={0}
            max={0.12}
            passo={0.005}
            formatar={pct}
            aoMudar={(v) => mudar({ margem: v })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={seguro ? 'text-ok' : 'text-warn'}>
            <span aria-hidden="true">{seguro ? '✓ ' : '! '}</span>
            {seguro ? 'Dentro da área segura' : 'Fora da área segura de 5%'}
          </span>
          {!seguro ? (
            <button
              type="button"
              className="btn-fantasma h-6 px-1.5 text-2xs"
              onClick={() => mudar({ margem: margemParaAreaSegura(quadro) })}
            >
              Encaixar
            </button>
          ) : null}
          <label className="ml-auto flex items-center gap-1.5 text-2xs">
            <input
              type="checkbox"
              checked={ui.areaSegura}
              onChange={(e) => mudarUi({ areaSegura: e.target.checked })}
            />
            Mostrar no monitor
          </label>
        </div>
      </Secao>
    </>
  );

  const enquadramento = (
    <>
      <Secao titulo="Enquadramento automático">
        <button
          type="button"
          className="btn-secundario w-full justify-center"
          disabled={!j.clipe || auto?.estado === 'analisando'}
          onClick={() => void enquadrar()}
        >
          {auto?.estado === 'analisando' ? 'Analisando…' : 'Enquadrar o intérprete'}
        </button>
        <p className={`mt-1.5 text-2xs ${auto?.estado === 'erro' ? 'text-bad' : 'text-navy-500'}`} role="status">
          {auto?.texto ??
            'Mede, em 16 quadros espalhados pelo clipe, o espaço que o intérprete ocupa com as mãos em movimento, e ajusta zoom e posição para caber na janela com folga.'}
        </p>
      </Secao>
      <Secao
        titulo="Ajuste manual"
        dica="O clipe preenche a janela; o excedente é cortado. Mãos e rosto precisam caber inteiros."
      >
        <Deslizante
          id={`${id}-z`}
          rotulo="Zoom"
          valor={j.zoom}
          min={1}
          max={3}
          passo={0.01}
          formatar={(v) => `${dec(v)}×`}
          aoMudar={(v) => mudar({ zoom: v })}
        />
        <Deslizante
          id={`${id}-x`}
          rotulo="Horizontal"
          valor={j.deslocX}
          min={-1}
          max={1}
          passo={0.01}
          formatar={(v) => (v < -0.02 ? 'à esquerda' : v > 0.02 ? 'à direita' : 'centro')}
          aoMudar={(v) => mudar({ deslocX: v })}
        />
        <Deslizante
          id={`${id}-y`}
          rotulo="Vertical"
          valor={j.deslocY}
          min={-1}
          max={1}
          passo={0.01}
          formatar={(v) => (v < -0.02 ? 'acima' : v > 0.02 ? 'abaixo' : 'centro')}
          aoMudar={(v) => mudar({ deslocY: v })}
        />
      </Secao>
    </>
  );

  const ch = j.chroma;
  const recorte = (
    <>
      <Secao titulo="Fundo verde (chroma key)">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={ch.ativo} onChange={(e) => mudarChroma({ ativo: e.target.checked })} />
          Remover o fundo
        </label>
        {ch.ativo ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <label className="rotulo" htmlFor={`${id}-cor`}>
                Cor-chave
              </label>
              <input
                id={`${id}-cor`}
                type="color"
                value={ch.cor}
                onChange={(e) => mudarChroma({ cor: e.target.value.toUpperCase() })}
                className="h-7 w-10 cursor-pointer rounded border border-paper-400 bg-transparent"
              />
              <span className="font-mono text-2xs text-navy-500">{ch.cor}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                type="button"
                className="btn-secundario h-7 px-2 text-2xs"
                disabled={!j.clipe || detectando}
                onClick={() => void detectarCor()}
              >
                {detectando ? 'Detectando…' : 'Detectar'}
              </button>
              <button
                type="button"
                className="btn-secundario h-7 px-2 text-2xs"
                aria-pressed={ui.contaGotas}
                disabled={!j.clipe}
                onClick={() => mudarUi({ contaGotas: !ui.contaGotas })}
              >
                {ui.contaGotas ? 'Clique no fundo, no monitor…' : 'Conta-gotas'}
              </button>
              <button
                type="button"
                className="btn-fantasma h-7 px-1.5 text-2xs"
                onClick={() => mudarChroma({ cor: '#00B140' })}
              >
                verde
              </button>
              <button
                type="button"
                className="btn-fantasma h-7 px-1.5 text-2xs"
                onClick={() => mudarChroma({ cor: '#0047BB' })}
              >
                azul
              </button>
            </div>
            <div className="mt-2">
              <Deslizante
                id={`${id}-sim`}
                rotulo="Tolerância"
                valor={ch.similaridade}
                min={0.01}
                max={0.5}
                passo={0.01}
                formatar={(v) => dec(v)}
                aoMudar={(v) => mudarChroma({ similaridade: v })}
              />
              <Deslizante
                id={`${id}-suav`}
                rotulo="Transição"
                valor={ch.suavidade}
                min={0}
                max={0.3}
                passo={0.01}
                formatar={(v) => dec(v)}
                aoMudar={(v) => mudarChroma({ suavidade: v })}
              />
            </div>
            {(() => {
              const inv = invasaoDosNeutros(ch.cor, ch.similaridade, ch.suavidade);
              return (
                <p className={`text-2xs ${inv > 1 ? 'text-bad' : inv > 0.9 ? 'text-warn' : 'text-navy-500'}`}>
                  <span aria-hidden="true">{inv > 1 ? '✕ ' : inv > 0.9 ? '! ' : '✓ '}</span>
                  {inv > 1
                    ? 'Tons neutros (roupa preta, cabelo) ficam translúcidos com esta tolerância.'
                    : inv > 0.9
                      ? 'Perto dos tons neutros: confira a roupa no Matte.'
                      : `Folga para tons neutros: ${Math.round((1 - inv) * 100)}%.`}{' '}
                  {inv > 0.75 ? (
                    <button type="button" className="underline" onClick={() => mudarChroma(toleranciaSugerida(ch.cor))}>
                      Ajustar à cor-chave
                    </button>
                  ) : null}
                </p>
              );
            })()}
          </>
        ) : null}
      </Secao>
      {ch.ativo ? (
        <Secao
          titulo="Borda do recorte"
          dica="Encolher tira a franja verde que sobra em volta do corpo; suavizar evita o contorno serrilhado."
        >
          <Deslizante
            id={`${id}-enc`}
            rotulo="Encolher"
            valor={ch.encolher}
            min={0}
            max={6}
            passo={1}
            formatar={(v) => `${v} px`}
            aoMudar={(v) => mudarChroma({ encolher: v })}
          />
          <Deslizante
            id={`${id}-sb`}
            rotulo="Suavizar"
            valor={ch.suavizarBorda}
            min={0}
            max={6}
            passo={0.1}
            formatar={(v) => `${dec(v, 1)} px`}
            aoMudar={(v) => mudarChroma({ suavizarBorda: v })}
          />
        </Secao>
      ) : null}
      {ch.ativo ? (
        <Secao
          titulo="Recortar bordas do quadro"
          dica="Para cortar o que o verde não cobre: refletores, tripé, a borda do pano."
        >
          <div className="grid grid-cols-2 gap-x-3">
            {(
              [
                ['esq', 'Esquerda'],
                ['dir', 'Direita'],
                ['topo', 'Topo'],
                ['base', 'Base'],
              ] as const
            ).map(([k, rot]) => (
              <Deslizante
                key={k}
                id={`${id}-b-${k}`}
                rotulo={rot}
                valor={ch.bordas[k]}
                min={0}
                max={0.4}
                passo={0.005}
                formatar={pct}
                aoMudar={(v) => mudarChroma({ bordas: { ...ch.bordas, [k]: v } })}
              />
            ))}
          </div>
        </Secao>
      ) : null}
      <Secao
        titulo="Ver no monitor"
        dica="Matte: branco = intérprete, preto = removido; buracos no corpo ou verde sobrando aparecem aqui. Sobre cinza: revela franjas."
      >
        <Segmentos
          rotulo="Visualização da janela"
          valor={ui.visual}
          aoMudar={(v) => mudarUi({ visual: v })}
          opcoes={[
            ['composicao', 'Composição'],
            ['matte', 'Matte'],
            ['cinza', 'Sobre cinza'],
          ]}
        />
      </Secao>
    </>
  );

  const cor = (
    <>
      <Secao titulo="Reflexo verde (despill)">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={ch.despill.ativo}
            disabled={!ch.ativo}
            onChange={(e) => mudarChroma({ despill: { ...ch.despill, ativo: e.target.checked } })}
          />
          Neutralizar o verde refletido na pele e na roupa
        </label>
        {ch.ativo && ch.despill.ativo ? (
          <div className="mt-2">
            <Deslizante
              id={`${id}-dm`}
              rotulo="Mistura"
              valor={ch.despill.mistura}
              min={0}
              max={1}
              passo={0.05}
              formatar={(v) => dec(v)}
              aoMudar={(v) => mudarChroma({ despill: { ...ch.despill, mistura: v } })}
            />
            <Deslizante
              id={`${id}-de`}
              rotulo="Expansão"
              valor={ch.despill.expandir}
              min={0}
              max={1}
              passo={0.05}
              formatar={(v) => dec(v)}
              aoMudar={(v) => mudarChroma({ despill: { ...ch.despill, expandir: v } })}
            />
          </div>
        ) : null}
      </Secao>
      <Secao titulo="Correção do intérprete" dica="Aplicada depois do recorte: não muda a chave.">
        <Deslizante
          id={`${id}-br`}
          rotulo="Brilho"
          valor={j.cor.brilho}
          min={-0.3}
          max={0.3}
          passo={0.01}
          formatar={(v) => (v > 0 ? '+' : '') + dec(v)}
          aoMudar={(v) => mudarCor({ brilho: v })}
        />
        <Deslizante
          id={`${id}-ct`}
          rotulo="Contraste"
          valor={j.cor.contraste}
          min={0.5}
          max={1.5}
          passo={0.01}
          formatar={(v) => `${dec(v)}×`}
          aoMudar={(v) => mudarCor({ contraste: v })}
        />
        <Deslizante
          id={`${id}-st`}
          rotulo="Saturação"
          valor={j.cor.saturacao}
          min={0}
          max={2}
          passo={0.01}
          formatar={(v) => `${dec(v)}×`}
          aoMudar={(v) => mudarCor({ saturacao: v })}
        />
        <button
          type="button"
          className="btn-fantasma h-7 px-2 text-2xs"
          onClick={() => mudar({ cor: JANELA_PADRAO.cor })}
        >
          Restaurar cor
        </button>
      </Secao>
      <Secao
        titulo="Atrás do intérprete"
        dica="A prévia aplica a mesma cadeia da entrega (ffmpeg). Medido: 99,99% do alfa idêntico, diferença média de cor de ~3 níveis em 255."
      >
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${id}-fundo`}
              checked={j.fundo === 'transparente'}
              onChange={() => mudar({ fundo: 'transparente' })}
            />
            a própria imagem
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`${id}-fundo`}
              checked={j.fundo === 'solido'}
              onChange={() => mudar({ fundo: 'solido' })}
            />
            cor sólida
          </label>
          {j.fundo === 'solido' ? (
            <input
              type="color"
              aria-label="Cor de fundo da janela"
              value={j.corFundo}
              onChange={(e) => mudar({ corFundo: e.target.value.toUpperCase() })}
              className="h-6 w-8 rounded border border-paper-400 bg-transparent"
            />
          ) : null}
        </div>
      </Secao>
    </>
  );

  return (
    <PainelAbas
      memoria="libras-direita"
      rotulo="Inspetor da janela de Libras"
      titulo="Inspetor"
      acoes={
        <button
          type="button"
          className="btn-fantasma h-6 px-2 text-2xs"
          onClick={() =>
            mudar({
              ...JANELA_PADRAO,
              clipe: j.clipe,
              inicioNaObraMs: j.inicioNaObraMs,
              velocidade: j.velocidade,
              sincronia: j.sincronia,
            })
          }
        >
          Restaurar padrão
        </button>
      }
      abas={[
        { id: 'janela', rotulo: 'Janela', marca: seguro ? null : '!', tom: 'aviso', conteudo: janela },
        { id: 'enquadramento', rotulo: 'Enquadramento', conteudo: enquadramento },
        { id: 'recorte', rotulo: 'Recorte', marca: ch.ativo ? null : 'off', conteudo: recorte },
        { id: 'cor', rotulo: 'Cor', conteudo: cor },
      ]}
    />
  );
}
