import { useEstado } from './state/store';
import { Dashboard } from './ui/shell/Dashboard';
import { Espaco } from './ui/shell/Espaco';
import { AvisoAtualizacao } from './ui/atualizacao';

/**
 * Raiz: o dashboard de projetos ou o espaço de trabalho (editor). O anúncio
 * para leitores de tela fica fora de ambos, para sobreviver à troca.
 */
export function App() {
  const { estado } = useEstado();
  return (
    <>
      {estado.pagina === 'projetos' ? <Dashboard /> : <Espaco />}
      <AvisoAtualizacao />
      <div aria-live="polite" aria-atomic="true" className="sr-only-focusable absolute">
        {estado.anuncio}
      </div>
    </>
  );
}
