import { useEffect, useState } from 'react';
import { ESTADO_PROMPTER_OCIOSO, type EstadoPrompter } from '../../ad/prompter';
import { ponte } from '../../desktop/ponte';
import { Teleprompter } from './Teleprompter';

/** Raiz da janela do locutor (index.html#prompter, só no desktop). */
export function JanelaPrompter() {
  const [estado, setEstado] = useState<EstadoPrompter>({
    ...ESTADO_PROMPTER_OCIOSO,
    aviso: 'Aguardando a sessão de gravação na janela principal.',
  });
  const p = ponte();
  useEffect(() => p?.aoEstadoDoPrompter(setEstado), [p]);
  useEffect(() => {
    document.title = 'Teleprompter — locutor';
  }, []);
  return <Teleprompter estado={estado} aoComando={p ? (c) => p.enviarComando(c) : undefined} />;
}
