import { useEffect, useRef } from 'react';

/**
 * Comandos do menu nativo (Arquivo, Exibir, Reprodução, Ajuda) para a interface.
 *
 * O menu fica no processo principal; cada item chega aqui como um nome de ação.
 * Quem sabe executar a ação se inscreve com useAcaoMenu. Se ninguém estiver
 * montado para ela (ex.: "Importar vídeo da intérprete" pedido na página de
 * Legendas), a ação fica pendente e é executada por quem montar em seguida,
 * depois que o app navega até a página certa.
 */

export type AcaoMenu =
  | 'novoProjeto'
  | 'abrirProjeto'
  | 'salvar'
  | 'salvarComo'
  | 'abrirVideo'
  | 'importarLegenda'
  | 'transcrever'
  | 'importarInterprete'
  | 'irProjetos'
  | 'irLse'
  | 'irAd'
  | 'irLibras'
  | 'irEntrega'
  | 'painelEsq'
  | 'painelLinha'
  | 'painelDir'
  | 'layoutPadrao'
  | 'layoutFoco'
  | 'temaClaro'
  | 'temaEscuro'
  | 'ajudas'
  | 'reproduzir'
  | 'inicio'
  | 'fim'
  | 'metodologia';

const ouvintes = new Map<AcaoMenu, Set<() => void>>();
const pendentes = new Set<AcaoMenu>();

export function emitirAcao(a: AcaoMenu) {
  const s = ouvintes.get(a);
  if (s && s.size > 0) for (const f of s) f();
  else pendentes.add(a);
}

/** Inscreve `f` na ação `a`; um pedido pendente é entregue logo (em microtarefa). Devolve o cancelamento. */
export function inscrever(a: AcaoMenu, f: () => void): () => void {
  let s = ouvintes.get(a);
  if (!s) ouvintes.set(a, (s = new Set()));
  s.add(f);
  if (pendentes.delete(a)) queueMicrotask(f);
  return () => {
    s!.delete(f);
  };
}

/** Executa `f` quando o menu pedir a ação `a` (inclusive um pedido feito antes de montar). */
export function useAcaoMenu(a: AcaoMenu, f: () => void) {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => inscrever(a, () => ref.current()), [a]);
}

/** só para testes */
export function limparAcoesParaTeste() {
  ouvintes.clear();
  pendentes.clear();
}
