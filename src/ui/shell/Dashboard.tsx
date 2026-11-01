import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { ponte, type ResumoProjeto } from '../../desktop/ponte';
import { useAcoesProjeto } from '../Projeto';
import { Marca } from './Marca';
import { SeletorTema } from './BarraSuperior';

const quando = (iso: string) => {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR');
};

/**
 * Dashboard de projetos: recentes (com miniatura e o estado de cada etapa),
 * novo projeto e abrir de outro lugar. No navegador, sem disco, oferece uma
 * sessão rápida.
 */
export function Dashboard() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const acoes = useAcoesProjeto();
  const desktop = ponte();
  const [recentes, setRecentes] = useState<ResumoProjeto[] | null>(desktop ? null : []);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idBusca = useId();
  // React 18 não repassa `inert`: aplica-se direto no elemento
  const fundo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fundo.current) fundo.current.inert = criando;
  }, [criando]);

  const recarregar = () => desktop?.projetosRecentes().then(setRecentes, () => setRecentes([]));
  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(
    () => (recentes ?? []).filter((p) => `${p.nome} ${p.video ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase())),
    [recentes, busca],
  );

  async function tentar(f: () => Promise<unknown>) {
    setErro(null);
    try {
      await f();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const emAberto = estado.projeto.caminho || estado.video || estado.cues.length > 0;

  return (
    <div className="flex h-screen flex-col bg-paper text-navy">
      {/* com o diálogo aberto, o fundo sai da ordem de foco e da árvore de acessibilidade */}
      <div ref={fundo} className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-fundo bg-paper-200 px-6">
        <Marca grande />
        <span className="text-xs text-navy-500">LSE · Audiodescrição · Libras</span>
        <div className="ml-auto flex items-center gap-2">
          <SeletorTema />
        </div>
      </header>

      <main id="conteudo" className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
              <p className="mt-1 text-sm text-navy-500">
                Cada projeto reúne uma obra e suas três camadas de acessibilidade.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {emAberto ? (
                <button type="button" className="btn-secundario" onClick={() => despachar({ tipo: 'navegar', pagina: 'lse' })}>
                  Voltar ao projeto aberto
                </button>
              ) : null}
              {desktop ? (
                <button type="button" className="btn-secundario" onClick={() => void tentar(acoes.abrir)}>
                  Abrir…
                </button>
              ) : null}
              <button type="button" className="btn-primario" onClick={() => setCriando(true)}>
                + Novo projeto
              </button>
            </div>
          </div>

          {erro ? (
            <p role="alert" className="mt-4 rounded border border-bad bg-bad-100 px-3 py-2 text-sm text-bad">
              {erro}
            </p>
          ) : null}

          {!desktop ? (
            <div className="mt-6 cartao">
              <h2 className="font-semibold">Modo navegador</h2>
              <p className="mt-1 text-sm text-navy-700">
                Sem o aplicativo desktop, projetos não são salvos em disco e a renderização (mixagem, Libras, entrega) não
                está disponível. A revisão de LSE e a prévia funcionam numa sessão rápida.
              </p>
              <button type="button" className="btn-primario mt-3" onClick={() => void acoes.novo('Sessão rápida')}>
                Começar sessão rápida
              </button>
            </div>
          ) : null}

          {desktop ? (
            <>
              <div className="mt-8 flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-navy-500">Recentes</h2>
                <label htmlFor={idBusca} className="sr-only-focusable">
                  Filtrar projetos
                </label>
                <input
                  id={idBusca}
                  className="campo ml-auto max-w-xs"
                  placeholder="Filtrar por nome ou vídeo…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              {recentes === null ? (
                <p className="mt-6 text-sm text-navy-500">Carregando…</p>
              ) : filtrados.length === 0 ? (
                <div className="mt-6 rounded-md border border-dashed border-paper-400 p-10 text-center">
                  <p className="text-navy-700">{busca ? 'Nenhum projeto corresponde ao filtro.' : 'Nenhum projeto ainda.'}</p>
                  {!busca ? (
                    <button type="button" className="btn-primario mt-4" onClick={() => setCriando(true)}>
                      Criar o primeiro projeto
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtrados.map((p) => (
                    <li key={p.caminho}>
                      <CartaoProjeto
                        p={p}
                        aoAbrir={() => void tentar(() => acoes.abrirEm(p.caminho))}
                        aoEsquecer={async () => {
                          await desktop.esquecerProjeto(p.caminho);
                          await recarregar();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </main>
      </div>

      {criando ? <DialogoNovo aoFechar={() => setCriando(false)} aoErro={setErro} /> : null}
    </div>
  );
}

function CartaoProjeto({ p, aoAbrir, aoEsquecer }: { p: ResumoProjeto; aoAbrir: () => void; aoEsquecer: () => void }) {
  const etapas: Array<{ rotulo: string; texto: string; feito: boolean | null }> = [
    { rotulo: 'LSE', texto: p.lse ? `${p.lse.legendas} legendas` : '—', feito: p.lse ? true : null },
    {
      rotulo: 'AD',
      texto: p.ad.blocos ? `${p.ad.gravados}/${p.ad.blocos} gravados` : '—',
      feito: p.ad.blocos ? p.ad.gravados === p.ad.blocos : null,
    },
    { rotulo: 'Libras', texto: p.libras.clipe ? (p.libras.sincronizado ? 'sincronizada' : 'sem sincronia') : '—', feito: p.libras.clipe ? p.libras.sincronizado : null },
  ];
  return (
    <article className="group overflow-hidden rounded border border-paper-400 bg-paper-200 transition-colors hover:border-navy-500">
      <button type="button" className="block w-full text-left" onClick={aoAbrir} aria-label={`Abrir o projeto ${p.nome}`}>
        <div className="relative aspect-video bg-preto">
          {p.miniatura ? (
            <img src={p.miniatura} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xs text-cabine-suave">sem miniatura</div>
          )}
          <span className="absolute bottom-1.5 left-1.5 rounded bg-preto/75 px-1.5 text-2xs text-cabine-texto">{quando(p.atualizadoEm)}</span>
        </div>
        <div className="px-3 pb-2 pt-2.5">
          <h3 className="truncate text-sm font-semibold">{p.nome}</h3>
          <p className="truncate text-2xs text-navy-500">{p.video ?? 'sem vídeo'}</p>
          <ul className="mt-2 space-y-0.5 text-2xs">
            {etapas.map((e) => (
              <li key={e.rotulo} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={e.feito === null ? 'text-navy-500' : e.feito ? 'text-ok' : 'text-warn'}>
                  {e.feito === null ? '○' : e.feito ? '●' : '◐'}
                </span>
                <span className="w-10 font-medium text-navy-700">{e.rotulo}</span>
                <span className="text-navy-500">{e.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </button>
      <div className="flex justify-end border-t border-paper-400 px-2 py-1">
        <button type="button" className="btn-fantasma h-6 px-2 text-2xs" onClick={aoEsquecer} aria-label={`Remover ${p.nome} da lista (o arquivo continua no disco)`}>
          Remover da lista
        </button>
      </div>
    </article>
  );
}

function DialogoNovo({ aoFechar, aoErro }: { aoFechar: () => void; aoErro: (e: string) => void }) {
  const acoes = useAcoesProjeto();
  const [nome, setNome] = useState('');
  const id = useId();
  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [aoFechar]);

  async function criar() {
    try {
      const ok = await acoes.novo(nome.trim() || 'Projeto sem título');
      if (ok) aoFechar();
    } catch (e) {
      aoErro(e instanceof Error ? e.message : String(e));
      aoFechar();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-preto/60" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className="w-full max-w-md rounded-lg border border-paper-400 bg-paper p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${id}-t`} className="text-lg font-semibold">
          Novo projeto
        </h2>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void criar();
          }}
        >
          <label className="rotulo" htmlFor={`${id}-nome`}>
            Nome da obra ou do projeto
          </label>
          <input id={`${id}-nome`} className="campo mt-1 text-sm" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Curta “A Entrega” — versão acessível" />
          <p className="mt-2 text-xs text-navy-500">
            {ponte()
              ? 'Em seguida você escolhe a pasta: o estúdio cria nela uma subpasta com o projeto e as gravações.'
              : 'No navegador, o projeto vive só nesta sessão.'}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-fantasma" onClick={aoFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario">
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
