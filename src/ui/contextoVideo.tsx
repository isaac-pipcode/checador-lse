import { createContext, useContext } from 'react';
import type { MotorPrevia } from '../ad/previa';

export interface ContextoVideo {
  video: HTMLVideoElement | null;
  tempoMs: number;
  buscar: (ms: number) => void;
  /** prévia de mixagem da AD (só no módulo de AD) */
  previa: MotorPrevia | null;
}

export const CtxVideo = createContext<ContextoVideo>({ video: null, tempoMs: 0, buscar: () => {}, previa: null });
export const useVideo = () => useContext(CtxVideo);
