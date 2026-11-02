import { useState, useSyncExternalStore } from 'react';

/**
 * Modo "mostrar ajudas": abre de uma vez todas as explicações que ficam atrás
 * do "?" (seções do inspetor, legenda da linha do tempo). Preferência do
 * usuário, não do projeto: fica no armazenamento local, como o tema.
 */

const CHAVE = 'estudio:ajudas';
const ouvintes = new Set<() => void>();

function lerSalvo(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

let atual = lerSalvo();

export function mostrarAjudas(): boolean {
  return atual;
}

export function definirMostrarAjudas(v: boolean) {
  atual = v;
  try {
    localStorage.setItem(CHAVE, v ? '1' : '0');
  } catch {
    /* sem armazenamento: vale só para a sessão */
  }
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export function useMostrarAjudas(): boolean {
  return useSyncExternalStore(assinar, mostrarAjudas, mostrarAjudas);
}

/**
 * Estado de uma ajuda individual: segue o modo global, mas cada uma pode ser
 * aberta ou fechada à mão; a escolha manual vale até o modo global mudar.
 */
export function useAjudaAberta(): [boolean, () => void] {
  const global = useMostrarAjudas();
  const [local, setLocal] = useState<{ base: boolean; aberta: boolean } | null>(null);
  const aberta = local && local.base === global ? local.aberta : global;
  return [aberta, () => setLocal({ base: global, aberta: !aberta })];
}
