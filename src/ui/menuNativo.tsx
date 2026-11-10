import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ponte } from '../desktop/ponte';
import { useDespachar, useEstado, type Pagina } from '../state/store';
import { definirMostrarAjudas, mostrarAjudas, useMostrarAjudas } from './ajudas';
import { emitirAcao, type AcaoMenu } from './acoesMenu';
import { useImportarLegenda } from './Carregador';
import { useAcoesProjeto } from './Projeto';
import { carregarChaveLembrada } from './ConfigLlm';
import { Sobre } from './Sobre';
import { assinarTema, salvarTema, temaSalvo } from './tema/tokens';

/**
 * Ponte entre o menu nativo (desktop/menu.ts) e a interface.
 *
 * Ações globais (navegar, salvar, abrir, tema, ajudas, metodologia, importar
 * legenda) são executadas aqui. As que dependem de uma tela (painéis, abrir
 * vídeo, intérprete de Libras, novo projeto, transporte) vão para o barramento
 * de acoesMenu, depois de navegar até a página que sabe executá-las.
 *
 * Em sentido contrário, informa ao menu o que ele precisa refletir.
 */

// ---- Metodologia (diálogo de tela inteira) ---------------------------------

const ouvintesMetodologia = new Set<() => void>();
let metodologiaAberta = false;
function definirMetodologia(v: boolean) {
  metodologiaAberta = v;
  for (const f of ouvintesMetodologia) f();
}
export function abrirMetodologia() {
  definirMetodologia(true);
}
function assinarMetodologia(f: () => void) {
  ouvintesMetodologia.add(f);
  return () => {
    ouvintesMetodologia.delete(f);
  };
}

function DialogoMetodologia() {
  const aberta = useSyncExternalStore(assinarMetodologia, () => metodologiaAberta);
  useEffect(() => {
    if (!aberta) return;
    const t = (e: KeyboardEvent) => e.key === 'Escape' && definirMetodologia(false);
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [aberta]);
  if (!aberta) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sobre e metodologia"
      className="fixed inset-0 z-50 overflow-auto bg-fundo/95"
    >
      <div className="sticky top-0 flex justify-end p-3">
        <button type="button" className="btn-secundario" onClick={() => definirMetodologia(false)} autoFocus>
          Fechar (Esc)
        </button>
      </div>
      <Sobre />
    </div>
  );
}

// ---- Roteador ----------------------------------------------------------------

/** página que executa cada ação local (as demais valem em qualquer página do editor) */
const PAGINA_DA_ACAO: Partial<Record<AcaoMenu, Pagina>> = {
  novoProjeto: 'projetos',
  importarInterprete: 'libras',
};

const NAVEGACAO: Partial<Record<AcaoMenu, Pagina>> = {
  irProjetos: 'projetos',
  irLse: 'lse',
  irAd: 'ad',
  irLibras: 'libras',
  irEntrega: 'entrega',
};

export function MenuNativo() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const acoes = useAcoesProjeto();
  const importarLegenda = useImportarLegenda();
  const ajudas = useMostrarAjudas();
  const tema = useSyncExternalStore(assinarTema, temaSalvo, temaSalvo);
  const [erro, setErro] = useState<string | null>(null);
  const desktop = ponte();

  // o tratador muda a cada render (usa o estado atual); a inscrição, não
  const tratar = useRef<(a: AcaoMenu) => void>(() => {});
  tratar.current = (a: AcaoMenu) => {
    const tentar = (f: () => Promise<unknown>) => {
      setErro(null);
      f().catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
    };
    const destino = NAVEGACAO[a];
    if (destino) return despachar({ tipo: 'navegar', pagina: destino });
    switch (a) {
      case 'salvar':
        return tentar(() => acoes.salvar(false));
      case 'salvarComo':
        return tentar(() => acoes.salvar(true));
      case 'abrirProjeto':
        return tentar(() => acoes.abrir());
      case 'temaClaro':
        return salvarTema('claro');
      case 'temaEscuro':
        return salvarTema('escuro');
      case 'ajudas':
        return definirMostrarAjudas(!mostrarAjudas());
      case 'metodologia':
        return abrirMetodologia();
      case 'importarLegenda':
        if (estado.pagina !== 'lse') despachar({ tipo: 'navegar', pagina: 'lse' });
        return tentar(() => importarLegenda(estado.cues.length > 0));
    }
    const pagina = PAGINA_DA_ACAO[a];
    if (pagina && estado.pagina !== pagina) despachar({ tipo: 'navegar', pagina });
    emitirAcao(a);
  };

  useEffect(() => desktop?.menu?.aoAcao((a) => tratar.current(a as AcaoMenu)), [desktop]);

  // chave de API lembrada neste computador: carregada ao abrir, para o assistente funcionar sem redigitar
  useEffect(() => {
    void carregarChaveLembrada(estado.llm.provedor, (m) => despachar({ tipo: 'llm', mudanca: m }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F1 liga/desliga as ajudas em qualquer tela (o menu só exibe o atalho)
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      definirMostrarAjudas(!mostrarAjudas());
    };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, []);

  const projetoAberto =
    estado.pagina !== 'projetos' || !!estado.projeto.caminho || !!estado.video || estado.cues.length > 0;
  const temVideo = !!estado.video;
  useEffect(() => {
    desktop?.menu?.estado({ projetoAberto, temVideo, pagina: estado.pagina, tema, ajudas });
  }, [desktop, projetoAberto, temVideo, estado.pagina, tema, ajudas]);

  return (
    <>
      <DialogoMetodologia />
      {erro ? (
        <div
          role="alert"
          className="fixed bottom-[68px] left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-3 rounded border border-bad bg-bad-100 px-3 py-2 text-xs text-bad shadow-2xl"
        >
          <span>{erro}</span>
          <button type="button" className="btn-fantasma h-6" onClick={() => setErro(null)}>
            Fechar
          </button>
        </div>
      ) : null}
    </>
  );
}

/** Informa ao menu quais painéis estão visíveis (chamado pelo espaço de trabalho). */
export function useEstadoPaineisNoMenu(paineis: { esq: boolean; linha: boolean; dir: boolean }) {
  const { esq, linha, dir } = paineis;
  useEffect(() => {
    ponte()?.menu?.estado({ paineis: { esq, linha, dir } });
  }, [esq, linha, dir]);
}
