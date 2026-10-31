import { useState } from 'react';
import { useEstado, useDespachar } from './state/store';
import { Carregador } from './ui/Carregador';
import { PainelConfig } from './ui/PainelConfig';
import { ConfigLlm } from './ui/ConfigLlm';
import { Resumo } from './ui/Resumo';
import { Filtros } from './ui/Filtros';
import { ListaLegendas } from './ui/ListaLegendas';
import { Exportar } from './ui/Exportar';
import { Sobre } from './ui/Sobre';
import { Estudio } from './ui/Estudio';
import { PainelAD } from './ui/ad/PainelAD';
import { SaidasAD } from './ui/ad/SaidasAD';
import { BarraProjeto } from './ui/Projeto';
import { ponte } from './desktop/ponte';

type Tela = 'revisao' | 'ad' | 'sobre';

export function App() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const [tela, setTela] = useState<Tela>('revisao');
  const [previa, setPrevia] = useState(false);
  const [estudio, setEstudio] = useState(false);
  const carregado = estado.cues.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-navy">
      <a
        href="#conteudo"
        className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-navy px-3 py-2 text-paper"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 border-b border-paper-400 bg-paper px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold">
            {ponte() ? 'Estúdio de Acessibilidade' : 'Checador de LSE'}
            <span className="block text-xs font-normal text-navy-700">
              LSE e audiodescrição · Guia MinC/SAv (2016)
            </span>
          </h1>

          <nav aria-label="Seções" className="flex gap-1">
            <button
              type="button"
              className={tela === 'revisao' ? 'btn-secundario' : 'btn-fantasma'}
              aria-current={tela === 'revisao' ? 'page' : undefined}
              onClick={() => setTela('revisao')}
            >
              Legendas (LSE)
            </button>
            <button
              type="button"
              className={tela === 'ad' ? 'btn-secundario' : 'btn-fantasma'}
              aria-current={tela === 'ad' ? 'page' : undefined}
              onClick={() => setTela('ad')}
            >
              Audiodescrição
            </button>
            <button
              type="button"
              className={tela === 'sobre' ? 'btn-secundario' : 'btn-fantasma'}
              aria-current={tela === 'sobre' ? 'page' : undefined}
              onClick={() => setTela('sobre')}
            >
              Sobre e metodologia
            </button>
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <BarraProjeto />
            <ConfigLlm />
            {carregado ? (
              <>
                <p className="text-sm text-navy-700">
                  <span className="font-medium">{estado.arquivoNome}</span>
                  <span className="block text-xs">
                    {estado.cues.length} legendas · {estado.encoding}
                  </span>
                </p>
                <button
                  type="button"
                  className="btn-fantasma"
                  onClick={() => despachar({ tipo: 'limpar' })}
                >
                  Trocar arquivo
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {carregado && tela === 'revisao' ? <PainelConfig /> : null}

      <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
        {tela === 'sobre' ? (
          <Sobre />
        ) : tela === 'ad' ? (
          <div className="mx-auto w-full max-w-6xl">
            {!carregado ? (
              <p className="mx-4 mt-3 rounded border border-paper-400 bg-paper-200 px-3 py-2 text-sm text-navy-700">
                Sem legenda carregada, as lacunas vêm dos silêncios do áudio e a checagem de sobreposição com a fala
                (A3) não é feita. Carregue a LSE na aba <em>Legendas</em> para um mapa de diálogo confiável.
              </p>
            ) : null}
            <Estudio previa modo="ad">
              <PainelAD />
              <SaidasAD />
            </Estudio>
          </div>
        ) : !carregado ? (
          <>
            <Carregador />
            {estado.errosParse.length > 0 ? <ErrosParse /> : null}
          </>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            {estado.errosParse.length > 0 || estado.avisosParse.length > 0 ? <ErrosParse /> : null}
            <Resumo />
            <Filtros />

            <div className="flex flex-wrap items-center gap-3 border-b border-paper-400 px-4 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={previa}
                  onChange={(e) => setPrevia(e.target.checked)}
                />
                Pré-visualizar o resultado com as decisões aplicadas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={estudio}
                  onChange={(e) => setEstudio(e.target.checked)}
                />
                Abrir estúdio (vídeo, mapa temporal e linha do tempo)
              </label>
              <a className="btn-fantasma" href="#titulo-exportar">
                Ir para a geração do arquivo final
              </a>
              <p className="ml-auto text-xs text-navy-500">
                Atalhos, com um apontamento em foco: <kbd>A</kbd> aprovar · <kbd>R</kbd> rejeitar ·{' '}
                <kbd>E</kbd> editar · <kbd>J</kbd>/<kbd>K</kbd> ou setas para navegar
              </p>
            </div>

            {estudio ? <Estudio previa={previa} modo="lse" /> : null}

            <ListaLegendas mostrarPrevia={previa} />
            <Exportar />
          </div>
        )}
      </main>

      <div aria-live="polite" aria-atomic="true" className="sr-only-focusable absolute">
        {estado.anuncio}
      </div>

      <footer className="border-t border-paper-400 px-4 py-3 text-center text-xs text-navy-700">
        Processamento local, no seu navegador. Parâmetros do{' '}
        <em>Guia para Produções Audiovisuais Acessíveis</em> (MinC/SAv, 2016).
      </footer>
    </div>
  );
}

function ErrosParse() {
  const { estado } = useEstado();
  return (
    <section
      aria-labelledby="titulo-erros"
      className="mx-4 my-3 rounded border border-warn bg-warn-100 px-3 py-2"
    >
      <h2 id="titulo-erros" className="text-sm font-semibold text-warn">
        <span aria-hidden="true">! </span>
        Problemas na leitura do arquivo
      </h2>
      <ul className="mt-1 space-y-1 text-sm text-warn">
        {estado.errosParse.map((e, i) => (
          <li key={i}>
            <strong>Linha {e.linha}:</strong> {e.mensagem}
            {e.trecho ? <code className="ml-1 font-mono text-xs">«{e.trecho}»</code> : null}
          </li>
        ))}
        {estado.avisosParse.map((a, i) => (
          <li key={`a${i}`}>{a}</li>
        ))}
      </ul>
    </section>
  );
}
