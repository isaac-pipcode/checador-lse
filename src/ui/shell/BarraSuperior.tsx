import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { useAcoesProjeto } from '../Projeto';
import { assinarTema, salvarTema, temaSalvo } from '../tema/tokens';
import { Marca } from './Marca';
import { definirMostrarAjudas, useMostrarAjudas } from '../ajudas';
import { Icone } from '../icones';
import { abrirMetodologia } from '../menuNativo';
import { ponte } from '../../desktop/ponte';

/**
 * Barra superior: projeto, salvar, ajudas, tema, metodologia. No desktop,
 * salvar, ajudas, tema e metodologia ficam no menu nativo (Arquivo, Exibir,
 * Ajuda); aqui ficam só no navegador, que não tem menu.
 */
export function BarraSuperior({ ferramentas }: { ferramentas?: ReactNode } = {}) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const acoes = useAcoesProjeto();
  const [erro, setErro] = useState<string | null>(null);
  const comMenu = !!ponte()?.menu;
  const nome = estado.projeto.nome || (estado.video?.nome ?? 'Projeto sem título');

  async function salvar(como: boolean) {
    setErro(null);
    try {
      await acoes.salvar(como);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  // Ctrl/⌘+S salva (no desktop, o atalho é do menu Arquivo)
  useEffect(() => {
    if (comMenu) return;
    const t = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void salvar(e.shiftKey);
      }
    };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  });

  return (
    <header className="relative flex items-center gap-3 bg-paper px-3">
      <a href="#conteudo" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-navy px-3 py-2 text-paper">
        Pular para o conteúdo
      </a>
      <button
        type="button"
        className="flex items-center gap-2 rounded px-1 hover:bg-paper-200"
        onClick={() => despachar({ tipo: 'navegar', pagina: 'projetos' })}
        title="Voltar aos projetos"
      >
        <Marca />
        <span className="sr-only-focusable"> — voltar aos projetos</span>
      </button>
      {ferramentas}
      <h1
        className="absolute left-1/2 max-w-[36%] -translate-x-1/2 truncate text-[13px] font-semibold"
        title={estado.projeto.caminho ?? undefined}
      >
        {nome}
        {estado.projeto.sujo ? (
          <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-terra align-middle" title="Alterações não salvas">
            <span className="sr-only-focusable"> alterações não salvas</span>
          </span>
        ) : null}
      </h1>

      <div className="ml-auto flex items-center gap-1">
        {erro ? <span className="max-w-xs truncate text-xs text-bad">{erro}</span> : null}
        {comMenu ? null : acoes.disponivel ? (
          <>
            <button type="button" className="btn-secundario h-6" onClick={() => void salvar(false)} title="Ctrl+S">
              Salvar
            </button>
            <button type="button" className="btn-fantasma h-6" onClick={() => void salvar(true)} title="Ctrl+Shift+S">
              Salvar como…
            </button>
          </>
        ) : (
          <span className="text-2xs text-navy-500">Modo navegador: o projeto não é salvo em disco</span>
        )}
        <BotaoAjudas visivel={!comMenu} />
        {comMenu ? null : (
          <>
            <SeletorTema />
            <button type="button" className="btn-fantasma h-6" onClick={abrirMetodologia}>
              Metodologia
            </button>
          </>
        )}
      </div>
    </header>
  );
}

/** Liga o modo "mostrar ajudas" (todas as explicações abertas). O atalho F1 é tratado em menuNativo. */
export function BotaoAjudas({ visivel = true }: { visivel?: boolean } = {}) {
  const ligado = useMostrarAjudas();
  if (!visivel) return null;
  return (
    <button
      type="button"
      className="btn-fantasma h-6 gap-1.5 aria-pressed:text-terra-700"
      aria-pressed={ligado}
      aria-label="Ajudas"
      title={ligado ? 'Esconder ajudas (F1)' : 'Mostrar todas as ajudas (F1)'}
      onClick={() => definirMostrarAjudas(!ligado)}
    >
      <Icone nome="ajuda" />
      <span className="hidden min-[1440px]:inline">Ajudas</span>
    </button>
  );
}

export function SeletorTema() {
  const tema = useSyncExternalStore(assinarTema, temaSalvo, temaSalvo);
  return (
    <button
      type="button"
      className="btn-icone h-6 w-6"
      aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      onClick={() => {
        const novo = tema === 'escuro' ? 'claro' : 'escuro';
        salvarTema(novo);
      }}
    >
      <Icone nome={tema === 'escuro' ? 'temaClaro' : 'temaEscuro'} />
    </button>
  );
}
