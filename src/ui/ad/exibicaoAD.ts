import { useSyncExternalStore } from 'react';

/**
 * Estado de exibição da página de AD que precisa ser lido de fora dela:
 *
 * - Blocos retráteis. No modo "compacto" (padrão), cada bloco é uma linha
 *   (número, janela, estado e o começo do roteiro) e só os abertos mostram o
 *   editor; ir a um bloco (linha do tempo, Ctrl+↑/↓, novo bloco) abre esse e
 *   recolhe o anterior. No modo "todos", todos ficam abertos. O modo é
 *   preferência do usuário (armazenamento local); os abertos valem na sessão.
 *
 * - Monitor de gravação acoplado: sem segundo monitor, o teleprompter ocupa o
 *   lado direito da própria janela (o espaço de trabalho dá a ele uma largura
 *   própria, redimensionável e lembrada à parte).
 */

export type ModoBlocos = 'compacto' | 'todos';
const CHAVE_MODO = 'estudio:ad-blocos';

function lerModo(): ModoBlocos {
  try {
    return localStorage.getItem(CHAVE_MODO) === 'todos' ? 'todos' : 'compacto';
  } catch {
    return 'compacto';
  }
}

let modo: ModoBlocos = lerModo();
let abertos: ReadonlySet<string> = new Set();
let acoplado = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

export function definirModoBlocos(m: ModoBlocos) {
  modo = m;
  abertos = new Set();
  try {
    localStorage.setItem(CHAVE_MODO, m);
  } catch {
    /* sem armazenamento: vale só para a sessão */
  }
  avisar();
}

/** Abre um bloco; `exclusivo` recolhe os outros (navegação). */
export function abrirBloco(id: string, exclusivo = true) {
  if (modo === 'todos' || (abertos.has(id) && (!exclusivo || abertos.size === 1))) return;
  abertos = exclusivo ? new Set([id]) : new Set([...abertos, id]);
  avisar();
}

export function alternarBloco(id: string) {
  const novo = new Set(abertos);
  if (!novo.delete(id)) novo.add(id);
  abertos = novo;
  avisar();
}

export function useModoBlocos(): ModoBlocos {
  return useSyncExternalStore(assinar, () => modo);
}

export function blocoAberto(id: string): boolean {
  return modo === 'todos' || abertos.has(id);
}

export function useBlocoAberto(id: string): boolean {
  return useSyncExternalStore(assinar, () => blocoAberto(id));
}

export function definirMonitorAcoplado(v: boolean) {
  if (acoplado === v) return;
  acoplado = v;
  avisar();
}

export function useMonitorAcoplado(): boolean {
  return useSyncExternalStore(assinar, () => acoplado);
}

/** só para testes */
export function reiniciarExibicaoParaTeste() {
  modo = 'compacto';
  abertos = new Set();
  acoplado = false;
}
