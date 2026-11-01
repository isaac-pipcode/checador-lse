import { useMemo, useState } from 'react';
import { useDespachar, useEstado, useResultadoFinal, type Pagina } from '../../state/store';
import { ponte, type RelatorioEntrega } from '../../desktop/ponte';
import { Exportar } from '../Exportar';
import { SaidasAD } from '../ad/SaidasAD';
import { PainelAbas, Secao } from '../comum';
import { DICA_EXPORTAR, ExportarEditores } from '../libras/ExportarEditores';
import { clipesDosBlocos, curvaDeDucking } from '../../ad/mixagem';
import { bytesDoTake } from '../../ad/audio';
import { verificarBloco, nivelDoBloco } from '../../ad/verificacoes';
import { verificarJanela } from '../../libras/geometria';
import { NBR_15290 } from '../../libras/tipos';
import { serializarSrt } from '../../export/serializar';
import { useVideo } from '../contextoVideo';
import { Icone } from '../icones';

interface Item {
  ok: boolean | null; // null = não se aplica / não iniciado
  texto: string;
}

/** Prontidão de cada etapa, em texto, com atalho para a página. */
function useProntidao() {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const { duracaoMs } = useVideo();
  return useMemo(() => {
    const pend = Object.values(estado.review).filter((r) => r.decision === 'pendente').length;
    const errosLse = final.remanescentes.filter((s) => s.severity === 'erro').length;
    const blocos = estado.ad.blocos;
    const gravados = blocos.filter((b) => b.takeAtivoId).length;
    const errosAd = blocos.filter(
      (b) => nivelDoBloco(verificarBloco(b, final.cues, estado.ad.parametros)) === 'erro',
    ).length;
    const lib = verificarJanela(estado.libras, NBR_15290, duracaoMs, final.cues);
    const r: Array<{ pagina: Exclude<Pagina, 'projetos'>; titulo: string; itens: Item[] }> = [
      {
        pagina: 'lse',
        titulo: 'Legendas (LSE)',
        itens: estado.cues.length
          ? [
              {
                ok: errosLse === 0,
                texto: errosLse ? `${errosLse} erros permanecem no arquivo final` : 'Sem erros remanescentes',
              },
              { ok: pend === 0, texto: pend ? `${pend} apontamentos sem decisão` : 'Todos os apontamentos decididos' },
            ]
          : [{ ok: null, texto: 'Nenhuma legenda carregada' }],
      },
      {
        pagina: 'ad',
        titulo: 'Audiodescrição',
        itens: blocos.length
          ? [
              { ok: gravados === blocos.length, texto: `${gravados} de ${blocos.length} blocos gravados` },
              {
                ok: errosAd === 0,
                texto: errosAd
                  ? `${errosAd} blocos com erro (sobreposição à fala, fora da janela…)`
                  : 'Sem erros nos blocos',
              },
            ]
          : [{ ok: null, texto: 'Nenhum bloco de AD' }],
      },
      {
        pagina: 'libras',
        titulo: 'Janela de Libras',
        itens: estado.libras.clipe
          ? lib.length
            ? lib.map((a) => ({
                ok: a.nivel === 'erro' ? false : a.nivel === 'aviso' ? false : null,
                texto: `${a.codigo} — ${a.mensagem}`,
              }))
            : [{ ok: true, texto: 'Dentro da norma e sincronizada' }]
          : [{ ok: null, texto: 'Nenhum clipe do intérprete' }],
      },
    ];
    return r;
  }, [estado, final, duracaoMs]);
}

export function EntregaEsquerda() {
  const despachar = useDespachar();
  const prontidao = useProntidao();
  const pendencias = prontidao.flatMap((m) => m.itens).filter((i) => i.ok === false).length;
  return (
    <PainelAbas
      memoria="entrega-esquerda"
      rotulo="Prontidão e arquivos avulsos"
      titulo="Entrega"
      abas={[
        {
          id: 'prontidao',
          rotulo: 'Prontidão',
          marca: pendencias || null,
          tom: 'aviso',
          conteudo: (
            <Secao titulo="Estado por etapa">
              <ul className="space-y-3">
                {prontidao.map((m) => (
                  <li key={m.pagina}>
                    <div className="flex items-center">
                      <h4 className="text-sm font-semibold">{m.titulo}</h4>
                      <button
                        type="button"
                        className="btn-fantasma ml-auto h-6 px-2 text-2xs"
                        onClick={() => despachar({ tipo: 'navegar', pagina: m.pagina })}
                      >
                        Abrir etapa <Icone nome="ir" tamanho={12} />
                      </button>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {m.itens.map((i, k) => (
                        <li key={k} className={i.ok === null ? 'text-navy-500' : i.ok ? 'text-ok' : 'text-warn'}>
                          <Icone nome={i.ok === null ? 'etapaVazia' : i.ok ? 'ok' : 'aviso'} tamanho={14} /> {i.texto}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Secao>
          ),
        },
        { id: 'lse', rotulo: 'Legendas', conteudo: <Exportar /> },
        { id: 'ad', rotulo: 'Audiodescrição', conteudo: <SaidasAD /> },
        {
          id: 'editores',
          rotulo: 'Editores',
          conteudo: (
            <Secao titulo="Libras para Premiere e Resolve" dica={DICA_EXPORTAR}>
              <ExportarEditores />
            </Secao>
          ),
        },
      ]}
    />
  );
}

/** Pacote final: um arquivo com vídeo (+Libras), faixas Original e AD, e a LSE selecionável. */
export function EntregaDireita() {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const desktop = ponte();
  const { duracaoMs } = useVideo();
  const temLibras = !!estado.libras.clipe?.caminho;
  const clipes = useMemo(() => clipesDosBlocos(estado.ad.blocos, estado.ad.parametros), [estado.ad]);
  const temAd = clipes.length > 0;
  const temLse = final.cues.length > 0;
  const [incluir, setIncluir] = useState({ libras: true, ad: true, lse: true });
  const [progresso, setProgresso] = useState<{ f: number; etapa: string } | null>(null);
  const [rel, setRel] = useState<RelatorioEntrega | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function renderizar() {
    if (!desktop || !estado.video?.caminho) return;
    setErro(null);
    setRel(null);
    setProgresso({ f: 0, etapa: 'Preparando' });
    try {
      const takes: Array<{ id: string; bytes: Uint8Array }> = [];
      if (incluir.ad && temAd) {
        for (const c of clipes) {
          const b = await bytesDoTake(c.takeId);
          if (b) takes.push({ id: c.takeId, bytes: b });
        }
      }
      const { clipe, inicioNaObraMs, ...janela } = estado.libras;
      const r = await desktop.renderizarEntrega(
        {
          videoCaminho: estado.video.caminho,
          nomeBase: (estado.projeto.nome || estado.video.nome).replace(/\.[^.]+$/, ''),
          duracaoMs,
          libras:
            incluir.libras && clipe?.caminho
              ? {
                  caminho: clipe.caminho,
                  inicioNaObraMs,
                  janela,
                }
              : null,
          ad: incluir.ad && temAd ? { clipes, curva: curvaDeDucking(clipes, estado.ad.parametros), takes } : null,
          legendaSrt: incluir.lse && temLse ? serializarSrt(final.cues) : null,
        },
        (f, etapa) => setProgresso({ f, etapa }),
      );
      setRel(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso(null);
    }
  }

  const opcoes: Array<[keyof typeof incluir, string, boolean, string]> = [
    ['libras', 'Janela de Libras (queimada no vídeo)', temLibras, 'sem clipe do intérprete'],
    ['ad', 'Faixa de áudio com audiodescrição', temAd, 'nenhum bloco gravado'],
    ['lse', 'LSE como legenda selecionável', temLse, 'nenhuma legenda'],
  ];
  const algo = opcoes.some(([k, , disp]) => disp && incluir[k]);
  const formato = incluir.libras && temLibras ? 'MP4 (H.264 recodificado)' : 'MKV (vídeo copiado, sem recompressão)';

  return (
    <section className="painel" aria-label="Pacote acessível">
      <header className="painel-cabeca">
        <h2>Pacote acessível</h2>
      </header>
      <div className="painel-corpo">
        <Secao titulo="Conteúdo" dica="A faixa “Original” é mantida. A LSE sai com as decisões aprovadas na revisão.">
          {opcoes.map(([k, rotulo, disp, motivo]) => (
            <label key={k} className={`flex items-start gap-2 py-1 text-xs ${disp ? '' : 'text-navy-500'}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={!disp}
                checked={disp && incluir[k]}
                onChange={(e) => setIncluir({ ...incluir, [k]: e.target.checked })}
              />
              <span>
                {rotulo}
                {!disp ? <span className="block text-2xs">{motivo}</span> : null}
              </span>
            </label>
          ))}
          <p className="mt-2 text-2xs text-navy-500">Formato: {formato}</p>
        </Secao>
        <Secao titulo="Renderizar">
          {!desktop ? (
            <p className="text-xs text-navy-500">A renderização usa o ffmpeg do aplicativo desktop.</p>
          ) : !estado.video?.caminho ? (
            <p className="text-xs text-navy-500">Abra o vídeo no monitor.</p>
          ) : (
            <button
              type="button"
              className="btn-primario w-full justify-center"
              disabled={!algo || progresso !== null}
              onClick={() => void renderizar()}
            >
              Renderizar pacote…
            </button>
          )}
          {progresso ? (
            <div className="mt-2 text-2xs" role="status">
              <progress max={1} value={progresso.f} className="w-full" aria-label="Progresso da renderização" />
              {progresso.etapa} · {Math.round(progresso.f * 100)}%
            </div>
          ) : null}
          {erro ? <p className="mt-2 text-xs text-bad">Erro: {erro}</p> : null}
          {rel ? (
            <div className="mt-3 rounded border border-ok bg-ok-100 p-2 text-xs text-ok" role="status">
              <p className="font-semibold">
                <Icone nome="ok" tamanho={14} />
                {rel.arquivo.split(/[\\/]/).pop()}
              </p>
              <ul className="mt-1 space-y-0.5 text-navy">
                <li>Vídeo: {rel.faixas.video}</li>
                <li>Áudio: {rel.faixas.audios.join(' + ') || '—'}</li>
                <li>Legenda: {rel.faixas.legenda ?? '—'}</li>
                {rel.loudnessAd ? (
                  <li>
                    Loudness da faixa de AD: {rel.loudnessAd.integradoLufs?.toFixed(1).replace('.', ',') ?? '—'} LUFS ·
                    pico {rel.loudnessAd.picoVerdadeiroDbtp?.toFixed(1).replace('.', ',') ?? '—'} dBTP (medida, não
                    normalizada)
                  </li>
                ) : null}
              </ul>
              {rel.avisos.map((a) => (
                <p key={a} className="mt-1 text-warn">
                  ! {a}
                </p>
              ))}
              {desktop ? (
                <button
                  type="button"
                  className="btn-fantasma mt-1 h-6 px-2 text-2xs"
                  onClick={() => void desktop.mostrarNaPasta(rel.arquivo)}
                >
                  Mostrar na pasta
                </button>
              ) : null}
            </div>
          ) : null}
        </Secao>
      </div>
    </section>
  );
}
