import { useEffect, useId, useRef, useState } from 'react';
import { ponte } from '../desktop/ponte';
import { useDespachar, useEstado } from '../state/store';
import { montarLegendas } from '../transcricao/montar';
import { MODELO_WHISPER_PADRAO, MODELOS_WHISPER, modeloWhisper } from '../transcricao/modelos';
import { palavrasDoWhisper } from '../transcricao/whisperJson';
import { useAcaoMenu } from './acoesMenu';
import { Icone } from './icones';

/**
 * Rascunho de LSE por transcrição automática (Whisper, no próprio computador).
 *
 * O resultado entra como uma legenda importada: as regras do Guia rodam sobre
 * ele e a revisão segue o fluxo de sempre. O rascunho já sai dentro dos limites
 * mecânicos (linhas, caracteres, durações, intervalo, quebra sintática); falantes,
 * efeitos sonoros e a conferência do texto ficam com a equipe.
 */

const CHAVE_MODELO = 'estudio:whisper-modelo';
const gb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`);

type Fase =
  | { tipo: 'ocioso' }
  | { tipo: 'baixando'; f: number }
  | { tipo: 'transcrevendo'; f: number; etapa: string }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'feito'; legendas: number; doCache: boolean; descartados: number };

export function PainelTranscricao({ aoConcluir }: { aoConcluir?: () => void }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const desktop = ponte();
  const id = useId();
  const [info, setInfo] = useState<Awaited<ReturnType<NonNullable<typeof desktop>['whisper']['estado']>> | null>(null);
  const [modelo, setModelo] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MODELO) || MODELO_WHISPER_PADRAO;
    } catch {
      return MODELO_WHISPER_PADRAO;
    }
  });
  const [idioma, setIdioma] = useState('pt');
  const [fase, setFase] = useState<Fase>({ tipo: 'ocioso' });
  const trabalho = useRef<string | null>(null);

  const recarregar = () => desktop?.whisper?.estado().then(setInfo, () => setInfo(null));
  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!desktop?.whisper) return null;
  const caminho = estado.video?.caminho ?? null;
  const ocupado = fase.tipo === 'baixando' || fase.tipo === 'transcrevendo';
  const disponiveis = MODELOS_WHISPER.filter((m) => info?.modelos.some((x) => x.id === m.id));
  const m = modeloWhisper(modelo) ?? modeloWhisper(MODELO_WHISPER_PADRAO)!;
  const baixado = !!info?.modelos.find((x) => x.id === m.id)?.baixado;

  async function iniciar() {
    if (!desktop || !caminho) return;
    if (
      estado.cues.length > 0 &&
      !window.confirm(
        'Substituir a legenda atual pelo rascunho da transcrição? As decisões de revisão dela serão descartadas.',
      )
    )
      return;
    const t = `whisper-${Date.now().toString(36)}`;
    trabalho.current = t;
    try {
      if (!baixado) {
        setFase({ tipo: 'baixando', f: 0 });
        await desktop.whisper.baixarModelo(t, m.id, (f) => setFase({ tipo: 'baixando', f }));
        await recarregar();
      }
      setFase({ tipo: 'transcrevendo', f: 0, etapa: 'Preparando' });
      const r = await desktop.whisper.transcrever(t, caminho, m.id, idioma, (f, etapa) =>
        setFase({ tipo: 'transcrevendo', f, etapa: etapa || 'Transcrevendo' }),
      );
      const { palavras, descartados } = palavrasDoWhisper(r.json);
      const cues = montarLegendas(palavras, estado.config);
      if (cues.length === 0) throw new Error('Nenhuma fala encontrada no áudio.');
      const nome = `${(estado.video?.nome ?? 'obra').replace(/\.[^.]+$/, '')} (transcrição).srt`;
      despachar({
        tipo: 'carregar',
        nome,
        encoding: 'utf-8',
        cues,
        erros: [],
        avisos: [
          `Rascunho por transcrição automática (Whisper, ${m.rotulo.toLowerCase()}): confira o texto, identifique os falantes e marque os efeitos sonoros [entre colchetes].`,
          ...(descartados > 0
            ? [
                `${descartados} trecho(s) descartado(s) por serem frases que o Whisper costuma inventar em silêncio ou música (créditos de legenda, "inscreva-se"…).`,
              ]
            : []),
        ],
      });
      setFase({ tipo: 'feito', legendas: cues.length, doCache: r.doCache, descartados });
      aoConcluir?.();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e);
      setFase(/cancelad|abort/i.test(msg) ? { tipo: 'ocioso' } : { tipo: 'erro', mensagem: msg });
    } finally {
      trabalho.current = null;
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="text-xs">
      <h3 id={`${id}-t`} className="flex items-center gap-1.5 text-sm font-semibold">
        <Icone nome="audiodescricao" /> Transcrever o áudio da obra
      </h3>
      <p className="mt-1 text-navy-700">
        O Whisper transcreve a fala neste computador (nada sai da máquina) e o estúdio monta um rascunho de LSE dentro
        das regras do Guia. Falantes e efeitos sonoros ficam para a revisão.
      </p>
      {info && !info.disponivel ? (
        <p className="mt-2 text-warn" role="status">
          <Icone nome="aviso" tamanho={14} /> O Whisper não está disponível nesta instalação.
        </p>
      ) : !caminho ? (
        <p className="mt-2 text-navy-500">Abra o vídeo da obra no monitor para transcrever.</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Modelo</span>
              <select
                className="campo"
                value={m.id}
                disabled={ocupado}
                onChange={(e) => {
                  setModelo(e.target.value);
                  try {
                    localStorage.setItem(CHAVE_MODELO, e.target.value);
                  } catch {
                    /* sem armazenamento */
                  }
                }}
              >
                {disponiveis.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.rotulo} · {gb(x.bytes)}
                    {info?.modelos.find((y) => y.id === x.id)?.baixado ? ' · baixado' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Idioma</span>
              <select className="campo" value={idioma} disabled={ocupado} onChange={(e) => setIdioma(e.target.value)}>
                <option value="pt">Português</option>
                <option value="auto">Detectar</option>
              </select>
            </label>
          </div>
          <p className="mt-1 text-2xs text-navy-500">
            {m.descricao}
            {!baixado ? ` Baixado uma vez (${gb(m.bytes)}) do repositório oficial e conferido.` : ''}
          </p>
          {ocupado ? (
            <div className="mt-2" role="status">
              <progress
                className="w-full"
                max={1}
                value={fase.f}
                aria-label={fase.tipo === 'baixando' ? 'Progresso do download do modelo' : 'Progresso da transcrição'}
              />
              <div className="mt-0.5 flex items-center">
                <span>
                  {fase.tipo === 'baixando' ? 'Baixando o modelo' : fase.etapa} · {Math.round(fase.f * 100)}%
                </span>
                <button
                  type="button"
                  className="btn-fantasma ml-auto h-6 px-2 text-2xs"
                  onClick={() => trabalho.current && void desktop.whisper.cancelar(trabalho.current)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-primario mt-2 w-full justify-center" onClick={() => void iniciar()}>
              {baixado ? 'Transcrever' : `Baixar o modelo e transcrever`}
            </button>
          )}
          {fase.tipo === 'erro' ? (
            <p className="mt-2 text-bad" role="alert">
              <Icone nome="erro" tamanho={14} /> {fase.mensagem}
            </p>
          ) : null}
          {fase.tipo === 'feito' ? (
            <p className="mt-2 text-ok" role="status">
              <Icone nome="ok" tamanho={14} /> Rascunho com {fase.legendas} legendas
              {fase.doCache ? ' (transcrição já feita antes, guardada no cache)' : ''}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Arquivo → Transcrever o áudio da obra: o painel num diálogo, em qualquer estado da página de Legendas. */
export function DialogoTranscricao() {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  useAcaoMenu('transcrever', () => setAberto(true));
  useEffect(() => {
    if (!aberto) return;
    const t = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-preto/60" onClick={() => setAberto(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transcrever o áudio da obra"
        id={id}
        className="w-full max-w-md rounded-lg border border-paper-400 bg-paper p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PainelTranscricao />
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secundario" onClick={() => setAberto(false)}>
            Fechar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
