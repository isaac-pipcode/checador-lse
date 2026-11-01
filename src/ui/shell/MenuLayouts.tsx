import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icone } from '../icones';
import { canonico, PRONTOS, type Layout } from './divisorias';

/**
 * Menu de layouts nomeados (como os "workspaces" do Resolve): aplica um layout
 * pronto ou salvo, salva o arranjo atual com um nome e exclui os salvos.
 *
 * É um painel de divulgação (botão com `aria-expanded` + região), não um menu
 * ARIA: contém um campo de texto, o que um `role=menu` não admite. Esc ou
 * clique fora fecham, e o foco volta ao botão.
 */
export function MenuLayouts({
  atual,
  aoAplicar,
  salvos,
  aoSalvar,
  aoExcluir,
}: {
  atual: Layout;
  aoAplicar: (l: Layout) => void;
  salvos: Record<string, Layout>;
  aoSalvar: (nome: string, l: Layout) => void;
  aoExcluir: (nome: string) => void;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const chave = canonico(atual);
  const nomeAtual =
    Object.entries(PRONTOS).find(([, l]) => canonico(l) === chave)?.[0] ??
    Object.entries(salvos).find(([, l]) => canonico(l) === chave)?.[0] ??
    null;
  const limpo = nome.trim();
  const reservado = limpo in PRONTOS;
  const existe = limpo in salvos;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  function salvar(e: FormEvent) {
    e.preventDefault();
    if (!limpo || reservado) return;
    aoSalvar(limpo, atual);
    setNome('');
  }

  const item = (n: string, l: Layout, removivel: boolean) => {
    const corrente = canonico(l) === chave;
    return (
      <li key={n} className="flex items-center">
        <button
          type="button"
          className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[3px] px-2 text-left hover:bg-paper-400"
          aria-current={corrente ? 'true' : undefined}
          onClick={() => {
            aoAplicar(l);
            setAberto(false);
            botao.current?.focus();
          }}
        >
          <span className="w-4">{corrente ? <Icone nome="ok" tamanho={14} className="text-terra-700" /> : null}</span>
          <span className="truncate">{n}</span>
        </button>
        {removivel ? (
          <button
            type="button"
            className="btn-icone h-6 w-6"
            aria-label={`Excluir o layout ${n}`}
            onClick={() => aoExcluir(n)}
          >
            <Icone nome="excluir" tamanho={14} />
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <div className="relative">
      <button
        ref={botao}
        type="button"
        className="btn-fantasma h-6 gap-1.5 px-2"
        aria-expanded={aberto}
        aria-controls={`${id}-m`}
        onClick={() => setAberto(!aberto)}
      >
        <Icone nome="layout" />
        Layout
        <span className="max-w-[9rem] truncate font-normal text-navy-500">· {nomeAtual ?? 'personalizado'}</span>
        <Icone nome="aberto" tamanho={14} className="text-navy-500" />
      </button>
      {aberto ? (
        <div
          ref={caixa}
          id={`${id}-m`}
          role="region"
          aria-label="Layouts"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded border border-paper-400 bg-paper-200 p-1.5 text-xs shadow-2xl"
        >
          <p className="px-2 pb-1 pt-0.5 text-2xs font-semibold text-navy-500">Prontos</p>
          <ul>{Object.entries(PRONTOS).map(([n, l]) => item(n, l, false))}</ul>
          <p className="mt-1.5 border-t border-paper-400 px-2 pb-1 pt-2 text-2xs font-semibold text-navy-500">Salvos</p>
          {Object.keys(salvos).length ? (
            <ul>
              {Object.entries(salvos)
                .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                .map(([n, l]) => item(n, l, true))}
            </ul>
          ) : (
            <p className="px-2 pb-1 text-2xs text-navy-500">Nenhum ainda.</p>
          )}
          <form className="mt-1.5 flex gap-1 border-t border-paper-400 px-1 pt-2" onSubmit={salvar}>
            <label htmlFor={`${id}-n`} className="sr-only-focusable">
              Nome do layout
            </label>
            <input
              id={`${id}-n`}
              className="campo h-7"
              placeholder="Nome do layout atual"
              value={nome}
              maxLength={40}
              aria-describedby={reservado ? `${id}-r` : undefined}
              onChange={(e) => setNome(e.target.value)}
            />
            <button type="submit" className="btn-secundario h-7 shrink-0 px-2" disabled={!limpo || reservado}>
              {existe ? 'Substituir' : 'Salvar'}
            </button>
          </form>
          {reservado ? (
            <p id={`${id}-r`} className="px-2 pt-1 text-2xs text-warn">
              Nome reservado a um layout pronto.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
