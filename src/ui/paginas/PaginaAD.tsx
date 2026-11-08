import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDespachar, useEstado, useResultadoFinal } from '../../state/store';
import { useVideo } from '../contextoVideo';
import { formatarTimecode } from '../../core/texto';
import type { BlocoAD } from '../../ad/tipos';
import { duracaoUtil, takeAtivo } from '../../ad/tipos';
import { calibrarPpm } from '../../ad/estimativa';
import { verificarBloco, nivelDoBloco, type NivelAD } from '../../ad/verificacoes';
import { blocosGravaveis, GRAVANDO } from '../../ad/prompter';
import { ponte } from '../../desktop/ponte';
import { useSessaoGravacao, type SessaoGravacao } from '../ad/useSessaoGravacao';
import { Teleprompter } from '../ad/Teleprompter';
import { SeletorMicrofone } from '../ad/SeletorMicrofone';
import { AjustesLegenda, CartaoBloco, CLASSE_NIVEL, ICONE, Numero, ROTULO_NIVEL, seg } from '../ad/componentes';
import { PainelAbas, Secao, useLacunas } from '../comum';
import { Icone } from '../icones';

type Modo = 'roteiro' | 'gravacao';

interface ContextoAD {
  sessao: SessaoGravacao;
  modo: Modo;
  setModo: (m: Modo) => void;
  repetir: boolean;
  setRepetir: (v: boolean) => void;
  foco: string | null;
  setFoco: (id: string | null) => void;
}

const CtxAD = createContext<ContextoAD | null>(null);
const useAD = () => {
  const c = useContext(CtxAD);
  if (!c) throw new Error('fora de ProvedorPaginaAD');
  return c;
};

/**
 * A sessão de gravação vive acima das páginas: trocar de página no meio de uma
 * sessão não a interrompe, e o teleprompter continua recebendo o estado.
 */
export function ProvedorPaginaAD({ children }: { children: ReactNode }) {
  const sessao = useSessaoGravacao();
  const [modo, setModo] = useState<Modo>('roteiro');
  const [repetir, setRepetir] = useState(true);
  const [foco, setFoco] = useState<string | null>(null);
  useEffect(() => {
    if (sessao.ativa) setModo('gravacao');
  }, [sessao.ativa]);
  return (
    <CtxAD.Provider value={{ sessao, modo, setModo, repetir, setRepetir, foco, setFoco }}>{children}</CtxAD.Provider>
  );
}

function SeletorModo() {
  const { modo, setModo, sessao } = useAD();
  return (
    <div
      className="ml-auto flex rounded bg-fundo p-0.5 normal-case tracking-normal"
      role="group"
      aria-label="Modo de trabalho"
    >
      <button
        type="button"
        className="segmento"
        aria-pressed={modo === 'roteiro'}
        disabled={sessao.ativa}
        onClick={() => setModo('roteiro')}
      >
        Roteiro
      </button>
      <button type="button" className="segmento" aria-pressed={modo === 'gravacao'} onClick={() => setModo('gravacao')}>
        Gravação
      </button>
    </div>
  );
}

// ===========================================================================
// Painel esquerdo
// ===========================================================================

export function AdEsquerda() {
  const { modo } = useAD();
  return (
    <section className="painel" aria-label="Blocos de audiodescrição">
      <header className="painel-cabeca">
        <h2>Audiodescrição</h2>
        <SeletorModo />
      </header>
      <div className="painel-corpo">{modo === 'roteiro' ? <RoteiroLista /> : <GravacaoLista />}</div>
    </section>
  );
}

function RoteiroLista() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, tempoMs, buscar } = useVideo();
  const final = useResultadoFinal();
  const { sessao, repetir, foco, setFoco } = useAD();
  const { blocos, parametros } = estado.ad;
  const focoRef = useRef(foco);
  focoRef.current = foco;
  const pendenteFoco = useRef<number | null>(null);

  // "Escrever assistindo": com um bloco em foco e o vídeo tocando, o trecho repete.
  useEffect(() => {
    if (!repetir || !video || !foco) return;
    const b = blocos.find((x) => x.id === foco);
    if (b && !video.paused && tempoMs > b.fimMs + 700) buscar(Math.max(0, b.inicioMs - 1500));
  }, [tempoMs, repetir, foco, blocos, video, buscar]);

  function irPara(b: BlocoAD) {
    buscar(Math.max(0, b.inicioMs - 1500));
    const el = document.getElementById(`texto-${b.id}`);
    el?.scrollIntoView({ block: 'center' });
    el?.focus({ preventScroll: true });
  }

  // Atalhos da editora (Ctrl ou ⌘), valem também com o cursor na caixa de texto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const atual = blocos.findIndex((b) => b.id === focoRef.current);
      let feito = true;
      if (e.key === ' ') {
        if (video) void (video.paused ? video.play() : video.pause());
      } else if (e.key === 'b' || e.key === 'B') {
        despachar({ tipo: 'adAdicionar', inicioMs: tempoMs, fimMs: tempoMs + 3000 });
        pendenteFoco.current = tempoMs;
      } else if (e.key === 'ArrowLeft') buscar(Math.max(0, tempoMs - 2000));
      else if (e.key === 'ArrowRight') buscar(tempoMs + 2000);
      else if (e.key === 'ArrowDown' && atual < blocos.length - 1) irPara(blocos[atual + 1]);
      else if (e.key === 'ArrowUp' && atual > 0) irPara(blocos[atual - 1]);
      else if (e.key === 'Enter' && atual >= 0) {
        const b = blocos[atual];
        if (b.texto.trim()) despachar({ tipo: 'adAprovar', id: b.id, aprovado: true });
        if (atual < blocos.length - 1) irPara(blocos[atual + 1]);
      } else feito = false;
      if (feito) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  useEffect(() => {
    if (pendenteFoco.current === null) return;
    const b = blocos.find((x) => x.inicioMs === pendenteFoco.current);
    if (b) {
      pendenteFoco.current = null;
      document.getElementById(`texto-${b.id}`)?.focus();
    }
  }, [blocos]);

  if (blocos.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-navy-700">
        <p>Nenhum bloco ainda.</p>
        <p className="mt-1 text-xs text-navy-500">
          Crie blocos nas lacunas pelo inspetor, ou use <kbd>Ctrl+B</kbd> na posição do vídeo.
        </p>
      </div>
    );
  }
  return (
    <>
      <SeletorMicrofone sessao={sessao} compacto />
      {sessao.erroMic || sessao.aviso ? (
        <div
          role="alert"
          className={`m-2 mb-0 rounded border px-3 py-2 text-xs ${sessao.erroMic ? 'border-bad bg-bad-100 text-bad' : 'border-paper-400 bg-paper-200 text-navy-700'}`}
        >
          {sessao.erroMic ?? sessao.aviso}
        </div>
      ) : null}
      <ol className="space-y-2 p-2">
        {blocos.map((b, i) => (
          <li key={b.id}>
            <CartaoBloco
              n={i + 1}
              bloco={b}
              apontamentos={verificarBloco(b, final.cues, parametros)}
              ppm={parametros.palavrasPorMinuto}
              aoFocar={() => setFoco(b.id)}
              podeGravar={!!video && !sessao.ativa}
              aoGravar={() => sessao.gravarAvulso(b.id)}
              aoOuvir={() => {
                buscar(Math.max(0, b.inicioMs - 2000));
                void video?.play();
              }}
            />
          </li>
        ))}
      </ol>
    </>
  );
}

function GravacaoLista() {
  const { estado } = useEstado();
  const { video, buscar } = useVideo();
  const final = useResultadoFinal();
  const desktop = ponte();
  const { sessao } = useAD();
  const { blocos, parametros } = estado.ad;
  const [somenteSemTake, setSomenteSemTake] = useState(true);
  const [telaCheia, setTelaCheia] = useState(false);
  const fila = blocosGravaveis(blocos, somenteSemTake);
  const aprovados = blocosGravaveis(blocos, false);
  const naoAprovados = blocos.filter((b) => !b.aprovado && b.texto.trim()).length;

  useEffect(() => {
    if (!telaCheia || sessao.ativa) return;
    const t = (e: KeyboardEvent) => e.key === 'Escape' && setTelaCheia(false);
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [telaCheia, sessao.ativa]);

  return (
    <>
      <div className="secao" role="group" aria-label="Sessão">
        <h3 className="secao-titulo">Sessão</h3>
        {sessao.ativa ? (
          <div className="flex flex-wrap gap-1.5">
            {GRAVANDO.has(sessao.fase) ? (
              <button type="button" className="btn-primario" onClick={() => sessao.comando('parar')}>
                Encerrar take (Enter)
              </button>
            ) : null}
            {sessao.fase === 'revisao' ? (
              <>
                <button type="button" className="btn-primario" onClick={() => sessao.comando('manter')}>
                  Manter (Enter)
                </button>
                <button type="button" className="btn-secundario" onClick={() => sessao.comando('regravar')}>
                  Regravar (R)
                </button>
                <button type="button" className="btn-secundario" onClick={() => sessao.comando('ouvir')}>
                  Ouvir (Espaço)
                </button>
                <button type="button" className="btn-secundario" onClick={() => sessao.comando('descartar')}>
                  Descartar (⌫)
                </button>
              </>
            ) : null}
            <button type="button" className="btn-fantasma text-bad" onClick={() => sessao.comando('encerrar')}>
              Encerrar sessão (Esc)
            </button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={somenteSemTake} onChange={(e) => setSomenteSemTake(e.target.checked)} />
              Só blocos ainda sem gravação
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="btn-primario"
                disabled={!video || fila.length === 0}
                onClick={() => sessao.gravarSequencia(fila.map((b) => b.id))}
              >
                <Icone nome="gravar" tamanho={14} /> Gravar em sequência ({fila.length})
              </button>
              {!desktop ? (
                <button type="button" className="btn-secundario" onClick={() => setTelaCheia(true)}>
                  Teleprompter em tela cheia
                </button>
              ) : null}
            </div>
            {sessao.aviso ? (
              <p className="mt-2 text-xs text-navy-700" role="status">
                {sessao.aviso}
              </p>
            ) : null}
            {naoAprovados > 0 ? (
              <p className="mt-2 text-2xs text-warn">
                <Icone nome="aviso" tamanho={14} />
                {naoAprovados} bloco(s) em rascunho não entram na gravação. Aprove-os no modo Roteiro.
              </p>
            ) : null}
          </>
        )}
      </div>

      <h3 className="secao-titulo px-3 pt-3">Blocos aprovados ({aprovados.length})</h3>
      {aprovados.length === 0 ? (
        <p className="px-3 text-xs text-navy-500">Nenhum bloco aprovado. A aprovação é feita no modo Roteiro.</p>
      ) : (
        <ol className="divide-y divide-paper-400">
          {aprovados.map((b, i) => {
            const t = takeAtivo(b);
            const nivel = nivelDoBloco(verificarBloco(b, final.cues, parametros));
            const atual = sessao.blocoId === b.id;
            return (
              <li
                key={b.id}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-2 px-3 py-2 text-xs ${atual ? 'bg-bad-100' : ''}`}
              >
                <span className="font-mono text-2xs text-navy-500">
                  {String(i + 1).padStart(2, '0')}
                  <br />
                  {formatarTimecode(b.inicioMs).slice(3, 8)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-navy" title={b.texto}>
                    {b.texto}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-navy-500">
                    <span className={`chip ${CLASSE_NIVEL[nivel]}`}>
                      <Icone nome={ICONE[nivel]} tamanho={12} />
                      {ROTULO_NIVEL[nivel]}
                    </span>
                    {t ? `${b.takes.length} take(s) · ${seg(duracaoUtil(t))}` : 'sem gravação'}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="btn-icone h-7 w-7"
                    aria-label={`Ir ao bloco ${i + 1}`}
                    onClick={() => buscar(Math.max(0, b.inicioMs - 2000))}
                  >
                    <Icone nome="ir" tamanho={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secundario h-7 px-2 text-2xs"
                    disabled={!video || sessao.ativa}
                    onClick={() => sessao.gravarAvulso(b.id)}
                  >
                    <Icone nome="gravar" tamanho={14} /> Gravar
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {telaCheia ? (
        <div className="fixed inset-0 z-50">
          <Teleprompter estado={sessao.estadoPrompter} />
          {!sessao.ativa ? (
            <button type="button" className="btn-secundario fixed right-4 top-14" onClick={() => setTelaCheia(false)}>
              Fechar (Esc)
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// ===========================================================================
// Inspetor
// ===========================================================================

export function AdDireita() {
  const { modo, sessao } = useAD();
  const titulo = (
    <>
      Inspetor{' '}
      <span className="font-normal normal-case tracking-normal text-navy-500">
        {modo === 'roteiro' ? 'roteiro' : 'gravação'}
      </span>
    </>
  );
  if (modo === 'roteiro') {
    return (
      <PainelAbas
        key="roteiro"
        memoria="ad-direita-roteiro"
        rotulo="Inspetor de audiodescrição"
        titulo={titulo}
        abas={[
          { id: 'blocos', rotulo: 'Blocos', conteudo: <RoteiroInspetor secao="blocos" /> },
          { id: 'leitura', rotulo: 'Leitura e mixagem', conteudo: <RoteiroInspetor secao="leitura" /> },
          { id: 'atalhos', rotulo: 'Atalhos', conteudo: <RoteiroInspetor secao="atalhos" /> },
        ]}
      />
    );
  }
  return (
    <PainelAbas
      key="gravacao"
      memoria="ad-direita-gravacao"
      rotulo="Inspetor de audiodescrição"
      titulo={titulo}
      abas={[
        {
          id: 'teleprompter',
          rotulo: 'Teleprompter',
          marca: sessao.prompterAberto ? '●' : null,
          conteudo: <GravacaoInspetor secao="teleprompter" />,
        },
        { id: 'legenda', rotulo: 'Legenda', conteudo: <GravacaoInspetor secao="legenda" /> },
        {
          id: 'microfone',
          rotulo: 'Microfone',
          marca: sessao.micAberto ? '●' : null,
          conteudo: <GravacaoInspetor secao="microfone" />,
        },
      ]}
    />
  );
}

function RoteiroInspetor({ secao }: { secao: 'blocos' | 'leitura' | 'atalhos' }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const { video, tempoMs } = useVideo();
  const final = useResultadoFinal();
  const { repetir, setRepetir } = useAD();
  const { lacunas, fonte } = useLacunas();
  const { blocos, parametros: p } = estado.ad;
  const calibracao = useMemo(() => calibrarPpm(blocos), [blocos]);
  const resumo = useMemo(() => {
    const n: Record<NivelAD, number> = { ok: 0, aviso: 0, erro: 0, pendente: 0 };
    for (const b of blocos) n[nivelDoBloco(verificarBloco(b, final.cues, p))]++;
    return n;
  }, [blocos, final.cues, p]);
  const aprovaveis = blocos.filter((b) => !b.aprovado && b.texto.trim());
  const mudar = (mudanca: Partial<typeof p>) => despachar({ tipo: 'adParametros', mudanca });

  if (secao === 'blocos')
    return (
      <Secao titulo="Blocos">
        <p className="text-xs">
          {blocos.length} blocos · {blocos.filter((b) => b.aprovado).length} aprovados
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {(['ok', 'aviso', 'erro', 'pendente'] as NivelAD[]).map((n) => (
            <li key={n} className={`chip ${CLASSE_NIVEL[n]}`}>
              <Icone nome={ICONE[n]} tamanho={12} />
              {resumo[n]} {ROTULO_NIVEL[n].toLowerCase()}
            </li>
          ))}
        </ul>
        <div className="mt-2 grid gap-1.5">
          <button
            type="button"
            className="btn-secundario justify-center"
            disabled={lacunas.length === 0}
            onClick={() => despachar({ tipo: 'adCriarDasLacunas', lacunas })}
          >
            Criar blocos nas {lacunas.length} lacunas
          </button>
          <button
            type="button"
            className="btn-fantasma justify-center"
            disabled={!video}
            onClick={() => despachar({ tipo: 'adAdicionar', inicioMs: tempoMs, fimMs: tempoMs + 3000 })}
          >
            + Bloco em {formatarTimecode(tempoMs)}
          </button>
          {aprovaveis.length > 0 ? (
            <button
              type="button"
              className="btn-fantasma justify-center"
              onClick={() => {
                if (
                  window.confirm(`Aprovar para gravação os ${aprovaveis.length} blocos com texto ainda em rascunho?`)
                ) {
                  aprovaveis.forEach((b) => despachar({ tipo: 'adAprovar', id: b.id, aprovado: true }));
                }
              }}
            >
              Aprovar todos com texto ({aprovaveis.length})
            </button>
          ) : null}
        </div>
        {fonte === 'silencio' ? (
          <p className="mt-2 text-2xs text-warn">
            Sem LSE carregada: lacunas tiradas dos silêncios do áudio, menos confiáveis.
          </p>
        ) : null}
      </Secao>
    );
  if (secao === 'atalhos')
    return (
      <Secao titulo="Atalhos (Ctrl ou ⌘)">
        <ul className="grid gap-0.5 text-2xs text-navy-700">
          <li>
            <kbd>Espaço</kbd> tocar/pausar
          </li>
          <li>
            <kbd>←</kbd>/<kbd>→</kbd> voltar/avançar 2 s
          </li>
          <li>
            <kbd>B</kbd> novo bloco na posição
          </li>
          <li>
            <kbd>↑</kbd>/<kbd>↓</kbd> bloco anterior/seguinte
          </li>
          <li>
            <kbd>Enter</kbd> aprovar e ir ao seguinte
          </li>
        </ul>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
          Repetir o trecho do bloco em foco
        </label>
      </Secao>
    );
  return (
    <Secao titulo="Leitura e mixagem">
      <div className="grid grid-cols-2 gap-2">
        <Numero
          rotulo="Velocidade (ppm)"
          valor={p.palavrasPorMinuto}
          passo={5}
          aoMudar={(v) => mudar({ palavrasPorMinuto: v })}
        />
        <Numero
          rotulo="Ducking (dB)"
          valor={p.duckingDb}
          passo={1}
          min={-40}
          max={0}
          aoMudar={(v) => mudar({ duckingDb: v })}
        />
        <Numero rotulo="Ataque (ms)" valor={p.ataqueMs} passo={50} aoMudar={(v) => mudar({ ataqueMs: v })} />
        <Numero rotulo="Liberação (ms)" valor={p.liberacaoMs} passo={50} aoMudar={(v) => mudar({ liberacaoMs: v })} />
      </div>
      <p className="mt-2 text-2xs text-navy-500">
        {calibracao ? (
          <>
            Medido nas gravações: <strong className="text-navy">{calibracao.ppm} ppm</strong> ({calibracao.amostras}{' '}
            takes).{' '}
            {calibracao.ppm !== p.palavrasPorMinuto ? (
              <button type="button" className="underline" onClick={() => mudar({ palavrasPorMinuto: calibracao.ppm })}>
                Usar na estimativa
              </button>
            ) : null}
          </>
        ) : (
          'Estimativa até haver três gravações; depois, o estúdio mede a velocidade do locutor.'
        )}
      </p>
    </Secao>
  );
}

function GravacaoInspetor({ secao }: { secao: 'teleprompter' | 'legenda' | 'microfone' }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const desktop = ponte();
  const { sessao } = useAD();
  const p = estado.ad.parametros;

  if (secao === 'teleprompter')
    return (
      <Secao titulo="O que o locutor vê">
        <Teleprompter estado={sessao.estadoPrompter} compacto />
        {desktop ? (
          sessao.prompterAberto ? (
            <div className="mt-2 flex items-center gap-2 text-2xs">
              <span className="chip border-ok bg-ok-100 text-ok">
                <Icone nome="ok" tamanho={14} /> {sessao.prompterAberto}
              </span>
              <button type="button" className="btn-fantasma h-6 px-2 text-2xs" onClick={sessao.fecharPrompter}>
                Fechar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secundario mt-2 w-full justify-center"
              onClick={() => void sessao.abrirPrompter()}
            >
              Abrir no monitor do locutor
            </button>
          )
        ) : null}
      </Secao>
    );
  if (secao === 'legenda')
    return (
      <Secao titulo="Legenda do teleprompter">
        <AjustesLegenda />
      </Secao>
    );
  return (
    <Secao titulo="Microfone" dica="Fones para o locutor. Eco, ruído e ganho automáticos ficam desligados.">
      <SeletorMicrofone sessao={sessao} />
      {sessao.erroMic ? <p className="mt-2 text-xs text-bad">{sessao.erroMic}</p> : null}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Numero
          rotulo="Pré (ms)"
          valor={p.prerollMs}
          passo={500}
          aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { prerollMs: v } })}
        />
        <Numero
          rotulo="Pós (ms)"
          valor={p.posrollMs}
          passo={500}
          aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { posrollMs: v } })}
        />
        <Numero
          rotulo="Latência"
          valor={p.latenciaMs}
          passo={10}
          min={-500}
          aoMudar={(v) => despachar({ tipo: 'adParametros', mudanca: { latenciaMs: v } })}
        />
      </div>
    </Secao>
  );
}
