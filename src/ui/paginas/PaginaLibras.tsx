import { useEffect, useId, useState } from 'react';
import { useDespachar, useEstado, useResultadoFinal } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { ponte } from '../../desktop/ponte';
import { Deslizante, PainelAbas, Secao, tcSmpte } from '../comum';
import { verificarJanela } from '../../libras/geometria';
import { estimarInicio } from '../../libras/sincronia';
import { JANELA_PADRAO, NBR_15290, type Canto, type JanelaLibras } from '../../libras/tipos';
import { JANELA_MS } from '../../mapa/midia';
import { avaliarMidia, type InfoVideo } from '../../midia/avaliacao';
import { gerarProxyDe } from '../proxy';

const pct = (v: number) => `${Math.round(v * 100)}%`;

function useJanela() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  return {
    j: estado.libras,
    mudar: (mudanca: Partial<JanelaLibras>) => despachar({ tipo: 'libras', mudanca }),
  };
}

// ===========================================================================
// Painel esquerdo: intérprete, sincronia, verificações
// ===========================================================================

export function LibrasEsquerda() {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const { j, mudar } = useJanela();
  const { buscar, tempoMs, duracaoMs } = useVideo();
  const desktop = ponte();
  const [sinc, setSinc] = useState<{ progresso: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fps = estado.config.fps;
  const ap = verificarJanela(j, NBR_15290, duracaoMs, final.cues);
  const despachar = useDespachar();
  const [infoClipe, setInfoClipe] = useState<InfoVideo | null>(null);
  // ao reabrir o projeto, a sondagem do clipe é refeita
  useEffect(() => {
    if (!j.clipe?.caminho || infoClipe || !desktop) return;
    void desktop.sondarMidia(j.clipe.caminho).then(setInfoClipe, () => {});
  }, [j.clipe?.caminho, infoClipe, desktop]);
  const avalClipe = infoClipe ? avaliarMidia(infoClipe) : null;
  const trabalhoClipe = j.clipe?.caminho ? estado.proxies[j.clipe.caminho] : undefined;

  async function escolher() {
    if (!desktop) return;
    const c = await desktop.escolherClipeLibras();
    if (!c) return;
    const clipe = { nome: c.nome, caminho: c.caminho, url: c.url, urlOriginal: c.url, duracaoMs: c.duracaoMs, proxy: null };
    mudar({ clipe, inicioNaObraMs: 0, sincronia: { metodo: 'nenhuma', confianca: null } });
    setInfoClipe(c.info ?? null);
    setMsg(null);
    // ProRes 4444 e afins: a prévia precisa de proxy; a entrega usa o original
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
    setSinc({ progresso: 0 });
    try {
      const env = await desktop.analisarAudio(j.clipe.caminho, JANELA_MS, (f) => setSinc({ progresso: f }));
      const r = estimarInicio(estado.mapa.envelopeDb, env.envelopeDb, JANELA_MS);
      mudar({ inicioNaObraMs: r.inicioNaObraMs, sincronia: { metodo: 'audio', confianca: r.confianca } });
      setMsg(
        r.confianca >= 0.5
          ? `Sincronizado: o clipe começa em ${(r.inicioNaObraMs / 1000).toFixed(2).replace('.', ',')} s da obra (confiança ${pct(r.confianca)}).`
          : `Confiança baixa (${pct(r.confianca)}): o clipe pode não ter som-guia. Confira no monitor e ajuste à mão.`,
      );
    } catch (e) {
      setMsg(`Não foi possível analisar o áudio do clipe: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSinc(null);
    }
  }

  const deslocar = (delta: number) =>
    mudar({ inicioNaObraMs: Math.round(j.inicioNaObraMs + delta), sincronia: { metodo: 'manual', confianca: null } });

  const erros = ap.filter((a) => a.nivel === 'erro').length;
  const clipeESincronia = (
    <>
      <Secao titulo="Clipe">
        {j.clipe ? (
          <div className="text-xs">
            <p className="truncate font-medium text-navy" title={j.clipe.caminho ?? ''}>
              {j.clipe.nome}
            </p>
            <p className="text-navy-500">duração {tcSmpte(j.clipe.duracaoMs, fps)}</p>
            {avalClipe ? <p className="font-mono text-2xs text-navy-500">{avalClipe.descricao}</p> : null}
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
                <button type="button" className="btn-fantasma h-6 px-1.5 text-2xs" onClick={() => j.clipe && void proxyDoClipe(j.clipe)}>
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
            <p className="mt-2 text-2xs text-navy-500">
              Em geral gravado em estúdio, com fundo verde e o som da obra como guia. Fundo de outra cor: ajuste a
              cor-chave no inspetor.
            </p>
          </>
        ) : (
          <p className="text-xs text-navy-500">A importação do clipe usa o aplicativo desktop.</p>
        )}
      </Secao>

      <Secao titulo="Sincronia">
        {!j.clipe ? (
          <p className="text-xs text-navy-500">Importe o clipe para sincronizar.</p>
        ) : (
          <div className="text-xs">
            <button
              type="button"
              className="btn-secundario w-full justify-center"
              disabled={!!sinc || !estado.mapa?.audio || !j.clipe.caminho}
              onClick={() => void sincronizar()}
            >
              {sinc ? `Analisando o som-guia… ${pct(sinc.progresso)}` : 'Sincronizar pelo som-guia'}
            </button>
            {!estado.mapa?.audio ? (
              <p className="mt-1 text-2xs text-warn">É preciso o áudio da obra analisado.</p>
            ) : null}
            {msg ? (
              <p className="mt-2 text-2xs text-navy-700" role="status">
                {msg}
              </p>
            ) : null}

            <p className="rotulo mt-3">Início do clipe na obra</p>
            <p className="font-mono text-sm text-terra-700">
              {j.inicioNaObraMs < 0 ? '−' : ''}
              {tcSmpte(Math.abs(j.inicioNaObraMs), fps)}
            </p>
            <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Ajuste fino da sincronia">
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
                onClick={() => mudar({ inicioNaObraMs: tempoMs, sincronia: { metodo: 'manual', confianca: null } })}
                title="O clipe começa na posição atual do vídeo"
              >
                Começar aqui
              </button>
            </div>
            <p className="mt-2 text-2xs text-navy-500">
              Método:{' '}
              {j.sincronia.metodo === 'audio'
                ? `som-guia (confiança ${pct(j.sincronia.confianca ?? 0)})`
                : j.sincronia.metodo === 'manual'
                  ? 'manual'
                  : 'não sincronizado'}
            </p>
            <button
              type="button"
              className="btn-fantasma mt-1 h-7 px-2 text-2xs"
              onClick={() => buscar(Math.max(0, j.inicioNaObraMs))}
            >
              Ir ao início do clipe
            </button>
          </div>
        )}
      </Secao>
    </>
  );
  const verificacoes = (
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
  );
  return (
    <PainelAbas
      memoria="libras-esquerda"
      rotulo="Intérprete de Libras"
      titulo="Intérprete"
      abas={[
        { id: 'clipe', rotulo: 'Clipe e sincronia', conteudo: clipeESincronia },
        {
          id: 'verificacoes',
          rotulo: 'Verificações',
          marca: ap.filter((a) => a.nivel !== 'pendente').length || null,
          tom: erros ? 'erro' : 'aviso',
          conteudo: verificacoes,
        },
      ]}
    />
  );
}

// ===========================================================================
// Inspetor: posição, tamanho, enquadramento, chroma
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
  const { j, mudar } = useJanela();
  const mudarChroma = (m: Partial<JanelaLibras['chroma']>) => mudar({ chroma: { ...j.chroma, ...m } });

  const janela = (
    <>
      <Secao titulo="Posição">
        <div
          className="grid w-40 grid-cols-2 gap-1 rounded border border-paper-400 bg-fundo p-1"
          role="radiogroup"
          aria-label="Canto da tela"
        >
          {CANTOS.map(([c, r]) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={j.canto === c}
              aria-label={r}
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
        <Deslizante
          id={`${id}-m`}
          rotulo="Margem"
          valor={j.margem}
          min={0}
          max={0.08}
          passo={0.005}
          formatar={pct}
          aoMudar={(v) => mudar({ margem: v })}
        />
      </Secao>

      <Secao titulo="Tamanho">
        <Deslizante
          id={`${id}-h`}
          rotulo="Altura"
          valor={j.altura}
          min={0.3}
          max={0.9}
          passo={0.01}
          formatar={(v) => `${pct(v)} da tela`}
          aoMudar={(v) => mudar({ altura: v })}
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
    </>
  );
  const enquadramento = (
    <Secao titulo="Enquadramento do intérprete">
      <Deslizante
        id={`${id}-z`}
        rotulo="Zoom"
        valor={j.zoom}
        min={1}
        max={2.5}
        passo={0.05}
        formatar={(v) => `${v.toFixed(2)}×`}
        aoMudar={(v) => mudar({ zoom: v })}
      />
      <Deslizante
        id={`${id}-y`}
        rotulo="Posição vertical"
        valor={j.deslocY}
        min={-1}
        max={1}
        passo={0.05}
        formatar={(v) => (v < -0.02 ? 'acima' : v > 0.02 ? 'abaixo' : 'centro')}
        aoMudar={(v) => mudar({ deslocY: v })}
      />
      <p className="text-2xs text-navy-500">
        O clipe preenche a janela; o excedente é cortado. Mãos e rosto precisam caber inteiros.
      </p>
    </Secao>
  );
  const fundo = (
    <Secao titulo="Recorte de fundo (chroma key)">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={j.chroma.ativo} onChange={(e) => mudarChroma({ ativo: e.target.checked })} />
        Remover o fundo
      </label>
      {j.chroma.ativo ? (
        <>
          <div className="mt-2 flex items-center gap-2">
            <label className="rotulo" htmlFor={`${id}-cor`}>
              Cor-chave
            </label>
            <input
              id={`${id}-cor`}
              type="color"
              value={j.chroma.cor}
              onChange={(e) => mudarChroma({ cor: e.target.value.toUpperCase() })}
              className="h-7 w-10 cursor-pointer rounded border border-paper-400 bg-transparent"
            />
            <span className="font-mono text-2xs text-navy-500">{j.chroma.cor}</span>
            <span className="ml-auto flex gap-1">
              {['#00B140', '#0047BB'].map((c) => (
                <button
                  key={c}
                  type="button"
                  className="btn-fantasma h-6 px-1.5 text-2xs"
                  onClick={() => mudarChroma({ cor: c })}
                >
                  {c === '#00B140' ? 'verde' : 'azul'}
                </button>
              ))}
            </span>
          </div>
          <div className="mt-2">
            <Deslizante
              id={`${id}-sim`}
              rotulo="Similaridade"
              valor={j.chroma.similaridade}
              min={0.01}
              max={0.5}
              passo={0.01}
              formatar={(v) => v.toFixed(2)}
              aoMudar={(v) => mudarChroma({ similaridade: v })}
            />
            <Deslizante
              id={`${id}-suav`}
              rotulo="Suavidade da borda"
              valor={j.chroma.suavidade}
              min={0}
              max={0.3}
              passo={0.01}
              formatar={(v) => v.toFixed(2)}
              aoMudar={(v) => mudarChroma({ suavidade: v })}
            />
          </div>
          <fieldset className="mt-1">
            <legend className="rotulo">Atrás do intérprete</legend>
            <div className="mt-1 flex items-center gap-3 text-xs">
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
          </fieldset>
          <p className="mt-2 text-2xs text-navy-500">
            A prévia aproxima o filtro <code>chromakey</code> do ffmpeg usado na entrega (que ainda faz média 3×3).
          </p>
        </>
      ) : null}
    </Secao>
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
            mudar({ ...JANELA_PADRAO, clipe: j.clipe, inicioNaObraMs: j.inicioNaObraMs, sincronia: j.sincronia })
          }
        >
          Restaurar padrão
        </button>
      }
      abas={[
        { id: 'janela', rotulo: 'Janela', conteudo: janela },
        { id: 'enquadramento', rotulo: 'Enquadramento', conteudo: enquadramento },
        { id: 'fundo', rotulo: 'Fundo', marca: j.chroma.ativo ? 'chroma' : null, conteudo: fundo },
      ]}
    />
  );
}
