import { useEffect, useState } from 'react';
import { useDespachar, useEstado } from '../../state/store';
import { useAcoesProjeto } from '../Projeto';
import { salvarTema, temaSalvo, type Tema } from '../tema/tokens';
import { Sobre } from '../Sobre';
import { Marca } from './Marca';
import { definirMostrarAjudas, mostrarAjudas, useMostrarAjudas } from '../ajudas';
import { Icone } from '../icones';

/** Barra superior: projeto, salvar, ajudas, tema, metodologia. */
export function BarraSuperior() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const acoes = useAcoesProjeto();
  const [erro, setErro] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const nome = estado.projeto.nome || (estado.video?.nome ?? 'Projeto sem título');

  async function salvar(como: boolean) {
    setErro(null);
    try {
      await acoes.salvar(como);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  // Ctrl/⌘+S salva
  useEffect(() => {
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
        {acoes.disponivel ? (
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
        <BotaoAjudas />
        <SeletorTema />
        <button type="button" className="btn-fantasma h-6" onClick={() => setSobre(true)}>
          Metodologia
        </button>
      </div>

      {sobre ? (
        <div role="dialog" aria-modal="true" aria-label="Sobre e metodologia" className="fixed inset-0 z-50 overflow-auto bg-fundo/95">
          <div className="sticky top-0 flex justify-end p-3">
            <button type="button" className="btn-secundario" onClick={() => setSobre(false)} autoFocus>
              Fechar (Esc)
            </button>
          </div>
          <FecharComEsc aoFechar={() => setSobre(false)} />
          <Sobre />
        </div>
      ) : null}
    </header>
  );
}

function FecharComEsc({ aoFechar }: { aoFechar: () => void }) {
  useEffect(() => {
    const t = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [aoFechar]);
  return null;
}

/** Liga o modo "mostrar ajudas" (todas as explicações abertas). Atalho: F1. */
export function BotaoAjudas() {
  const ligado = useMostrarAjudas();
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      definirMostrarAjudas(!mostrarAjudas());
    };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, []);
  return (
    <button
      type="button"
      className="btn-fantasma h-6 gap-1.5 aria-pressed:text-terra-700"
      aria-pressed={ligado}
      title={ligado ? 'Esconder ajudas (F1)' : 'Mostrar todas as ajudas (F1)'}
      onClick={() => definirMostrarAjudas(!ligado)}
    >
      <Icone nome="ajuda" />
      Ajudas
    </button>
  );
}

export function SeletorTema() {
  const [tema, setTema] = useState<Tema>(temaSalvo());
  return (
    <button
      type="button"
      className="btn-icone h-6 w-6"
      aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
      onClick={() => {
        const novo = tema === 'escuro' ? 'claro' : 'escuro';
        salvarTema(novo);
        setTema(novo);
      }}
    >
      <Icone nome={tema === 'escuro' ? 'temaClaro' : 'temaEscuro'} />
    </button>
  );
}
