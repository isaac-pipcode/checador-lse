import { createContext, useContext } from 'react';
import type { MotorPrevia } from '../ad/previa';

export interface ContextoVideo {
  video: HTMLVideoElement | null;
  tempoMs: number;
  buscar: (ms: number) => void;
  /** duração da obra (ms), do mapa, do vídeo ou da última legenda */
  duracaoMs: number;
  /** prévia de mixagem da AD (só no módulo de AD) */
  previa: MotorPrevia | null;
}

export const CtxVideo = createContext<ContextoVideo>({ video: null, tempoMs: 0, buscar: () => {}, previa: null, duracaoMs: 0 });
export const useVideo = () => useContext(CtxVideo);
