import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProvedorEstado } from './state/store';
import { JanelaPrompter } from './ui/ad/JanelaPrompter';
import './index.css';
import { aplicarTema, temaSalvo } from './ui/tema/tokens';

// Antes do primeiro render: sem piscar o tema errado.
aplicarTema(window.location.hash === '#prompter' ? 'escuro' : temaSalvo());

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

// A janela do locutor carrega o mesmo app com #prompter: só o teleprompter, sem estado próprio.
createRoot(raiz).render(
  <React.StrictMode>
    {window.location.hash === '#prompter' ? (
      <JanelaPrompter />
    ) : (
      <ProvedorEstado>
        <App />
      </ProvedorEstado>
    )}
  </React.StrictMode>,
);
