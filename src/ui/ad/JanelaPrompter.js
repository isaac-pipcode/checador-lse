import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ESTADO_PROMPTER_OCIOSO } from '../../ad/prompter';
import { ponte } from '../../desktop/ponte';
import { Teleprompter } from './Teleprompter';
/** Raiz da janela do locutor (index.html#prompter, só no desktop). */
export function JanelaPrompter() {
    const [estado, setEstado] = useState({
        ...ESTADO_PROMPTER_OCIOSO,
        aviso: 'Aguardando a sessão de gravação na janela principal.',
    });
    const p = ponte();
    useEffect(() => p?.aoEstadoDoPrompter(setEstado), [p]);
    useEffect(() => {
        document.title = 'Teleprompter — locutor';
    }, []);
    return _jsx(Teleprompter, { estado: estado, aoComando: p ? (c) => p.enviarComando(c) : undefined });
}
