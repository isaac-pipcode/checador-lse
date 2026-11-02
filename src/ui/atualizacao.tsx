import { useEffect, useState } from 'react';
import { ponte, type EstadoAtualizacao } from '../desktop/ponte';

/**
 * Atualização do aplicativo, lado da interface. Verifica ao abrir (preferência
 * do computador, ligada por padrão), mostra um aviso discreto quando há versão
 * nova e uma seção em Metodologia com a versão instalada e "Verificar agora".
 */

const CHAVE = 'estudio:atualizar-ao-abrir';
let verificadoNestaSessao = false;

export function verificarAoAbrir(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== '0';
  } catch {
    return true;
  }
}
export function definirVerificarAoAbrir(v: boolean) {
  try {
    localStorage.setItem(CHAVE, v ? '1' : '0');
  } catch {
    /* sem armazenamento */
  }
}

function useAtualizacao() {
  const desktop = ponte();
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null);
  const [versao, setVersao] = useState<string | null>(null);
  useEffect(() => {
    if (!desktop?.atualizacao) return;
    void desktop.atualizacao.versao().then(setVersao);
    void desktop.atualizacao.estado().then(setEstado);
    return desktop.atualizacao.aoMudar(setEstado);
  }, [desktop]);
  return { desktop, estado, versao, verificar: () => desktop?.atualizacao.verificar().then(setEstado) };
}

/** Aviso flutuante (canto inferior direito), em qualquer tela do app. */
export function AvisoAtualizacao() {
  const { desktop, estado } = useAtualizacao();
  const [dispensado, setDispensado] = useState<string | null>(null);
  useEffect(() => {
    if (!desktop?.atualizacao || verificadoNestaSessao || !verificarAoAbrir()) return;
    verificadoNestaSessao = true;
    // espera o app assentar: a verificação não deve competir com a abertura do projeto
    const t = window.setTimeout(() => void desktop.atualizacao.verificar(), 4000);
    return () => window.clearTimeout(t);
  }, [desktop]);
  if (!desktop || !estado) return null;
  const chave = 'versao' in estado ? `${estado.estado}:${estado.versao}` : estado.estado;
  if (dispensado === chave) return null;

  let corpo: JSX.Element | null = null;
  if (estado.estado === 'baixando')
    corpo = (
      <>
        <p>
          Baixando a versão <strong>{estado.versao}</strong>… {Math.round(estado.fracao * 100)}%
        </p>
        <progress className="mt-1 w-full" max={1} value={estado.fracao} aria-label="Progresso do download" />
      </>
    );
  else if (estado.estado === 'pronta')
    corpo = (
      <>
        <p>
          Versão <strong>{estado.versao}</strong> pronta. Será instalada quando você fechar o app.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primario h-7" onClick={() => desktop.atualizacao.reiniciar()}>
            Reiniciar agora
          </button>
          <button type="button" className="btn-fantasma h-7" onClick={() => setDispensado(chave)}>
            Depois
          </button>
        </div>
      </>
    );
  else if (estado.estado === 'disponivel')
    corpo = (
      <>
        <p>
          Versão <strong>{estado.versao}</strong> disponível.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primario h-7" onClick={() => desktop.atualizacao.abrirPagina(estado.url)}>
            Baixar
          </button>
          <button type="button" className="btn-fantasma h-7" onClick={() => setDispensado(chave)}>
            Depois
          </button>
        </div>
      </>
    );
  if (!corpo) return null;
  return (
    <div
      role="status"
      aria-label="Atualização do Ouver Estúdio"
      className="fixed bottom-[68px] right-3 z-40 w-72 rounded border border-paper-400 bg-paper-200 p-3 text-xs text-navy shadow-2xl"
    >
      {corpo}
    </div>
  );
}

/** Seção de Metodologia: versão instalada, verificar agora e a preferência. */
export function SecaoAtualizacao() {
  const { desktop, estado, versao, verificar } = useAtualizacao();
  const [auto, setAuto] = useState(verificarAoAbrir);
  if (!desktop?.atualizacao) return null;
  const texto =
    !estado || estado.estado === 'desativada'
      ? estado?.estado === 'desativada' && estado.motivo === 'em desenvolvimento'
        ? 'Atualização desativada em modo de desenvolvimento.'
        : null
      : estado.estado === 'verificando'
        ? 'Verificando…'
        : estado.estado === 'atual'
          ? 'Você está na versão mais recente.'
          : estado.estado === 'baixando'
            ? `Baixando a versão ${estado.versao}… ${Math.round(estado.fracao * 100)}%`
            : estado.estado === 'pronta'
              ? `Versão ${estado.versao} pronta: será instalada ao fechar o app.`
              : estado.estado === 'disponivel'
                ? `Versão ${estado.versao} disponível para baixar.`
                : `Não foi possível verificar: ${estado.mensagem}`;
  return (
    <>
      <h3 className="mt-8 text-lg font-semibold">Versão e atualizações</h3>
      <p className="mt-2 text-sm text-navy-700">
        Versão instalada: <strong>{versao ?? '…'}</strong>. No Windows e no AppImage do Linux, as atualizações são
        baixadas sozinhas e instaladas ao fechar o app; no macOS e no pacote .deb, o app avisa e abre a página de
        download.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="btn-secundario" onClick={() => void verificar()}>
          Verificar agora
        </button>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              definirVerificarAoAbrir(e.target.checked);
            }}
          />
          Verificar ao abrir o app
        </label>
      </div>
      {texto ? (
        <p className="mt-2 text-xs text-navy-500" role="status">
          {texto}
        </p>
      ) : null}
    </>
  );
}
