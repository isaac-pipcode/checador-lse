import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProvedorEstado } from './state/store';
import './index.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

createRoot(raiz).render(
  <React.StrictMode>
    <ProvedorEstado>
      <App />
    </ProvedorEstado>
  </React.StrictMode>,
);
