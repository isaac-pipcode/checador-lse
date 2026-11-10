import { useEffect, useState } from 'react';
import { ponte } from '../desktop/ponte';

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Metodologia → cache das análises: quanto ocupa e como esvaziar. */
export function SecaoCache() {
  const desktop = ponte();
  const [t, setT] = useState<{ bytes: number; entradas: number } | null>(null);
  const ler = () => desktop?.cacheAnalises?.tamanho().then(setT, () => setT(null));
  useEffect(() => {
    void ler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!desktop?.cacheAnalises) return null;
  return (
    <>
      <h3 className="mt-8 text-lg font-semibold">Cache das análises</h3>
      <p className="mt-2 text-sm text-navy-700">
        A análise do áudio (da obra e do clipe de Libras) fica guardada neste computador: reabrir o projeto ou importar
        de novo o mesmo arquivo não decodifica o áudio outra vez. Um arquivo alterado é analisado de novo. Os proxies
        ficam na pasta <code>proxies/</code> do projeto e também são reaproveitados.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span role="status">
          {t ? `${t.entradas} ${t.entradas === 1 ? 'análise' : 'análises'} · ${mb(t.bytes)} (limite de 500 MB)` : '…'}
        </span>
        <button
          type="button"
          className="btn-secundario"
          disabled={!t || t.entradas === 0}
          onClick={() => void desktop.cacheAnalises.limpar().then(ler)}
        >
          Limpar cache
        </button>
      </div>
    </>
  );
}
