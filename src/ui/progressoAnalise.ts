import { useSyncExternalStore } from 'react';

/**
 * Progresso da análise do som da obra, visível de qualquer lugar (monitor,
 * inspetor). Quem dispara a análise (abrir vídeo, abrir projeto) informa aqui;
 * null = nada em andamento; fração null = em andamento, sem número ainda.
 */
let atual: { fracao: number | null } | null = null;
const ouvintes = new Set<() => void>();

export function informarAnalise(v: { fracao: number | null } | null) {
  atual = v;
  ouvintes.forEach((f) => f());
}

export function useProgressoAnalise() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    () => atual,
  );
}
