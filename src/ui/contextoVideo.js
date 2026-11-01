import { createContext, useContext } from 'react';
export const CtxVideo = createContext({ video: null, tempoMs: 0, buscar: () => { }, previa: null, duracaoMs: 0 });
export const useVideo = () => useContext(CtxVideo);
