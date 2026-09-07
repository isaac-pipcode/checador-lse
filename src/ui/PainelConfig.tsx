import { useId, useState } from 'react';
import { PERFIS } from '../model/perfis';
import { configDoPerfil } from '../model/perfis';
import { useAcoes, useEstado } from '../state/store';
import { Campo } from './primitivos';
import { msParaFrames } from '../core/texto';

export function PainelConfig() {
  const { estado } = useEstado();
  const acoes = useAcoes();
  const [aberto, setAberto] = useState(false);
  const idBase = useId();
  const c = estado.config;
  const perfil = PERFIS.find((p) => p.perfilId === c.perfilId);

  const num = (campo: keyof typeof c, valor: string) => {
    const n = Number(valor);
    if (Number.isFinite(n)) acoes.config({ [campo]: n } as never);
  };

  return (
    <section aria-labelledby={`${idBase}-titulo`} className="border-b border-paper-400 bg-paper-200">
      <div className="mx-auto max-w-6xl px-4 py-2">
        <h2 id={`${idBase}-titulo`} className="sr-only">
          Configuração dos parâmetros
        </h2>
        <button
          type="button"
          className="btn-fantasma"
          aria-expanded={aberto}
          aria-controls={`${idBase}-corpo`}
          onClick={() => setAberto((v) => !v)}
        >
          <span aria-hidden="true">{aberto ? '▾' : '▸'}</span>
          Parâmetros: {c.perfilNome} · {c.maxCaracteresPorLinha} CPL · alvo {c.cpsAlvo} cps
        </button>

        <div id={`${idBase}-corpo`} hidden={!aberto} className="pb-4 pt-2">
          {perfil && !perfil.aderenteAoGuia ? (
            <p role="status" className="mb-3 rounded border border-warn bg-warn-100 px-3 py-2 text-sm text-warn">
              <span aria-hidden="true">! </span>
              Este perfil <strong>não</strong> reproduz os parâmetros do Guia MinC/SAv; serve apenas
              para comparação com práticas de mercado.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo id={`${idBase}-perfil`} rotulo="Perfil" dica={perfil?.descricao}>
              <select
                id={`${idBase}-perfil`}
                className="campo"
                value={c.perfilId}
                onChange={(e) => acoes.config(configDoPerfil(e.target.value))}
              >
                {PERFIS.map((p) => (
                  <option key={p.perfilId} value={p.perfilId}>
                    {p.perfilNome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id={`${idBase}-cpl`} rotulo="Caracteres por linha (máx.)">
              <input
                id={`${idBase}-cpl`}
                className="campo"
                type="number"
                min={10}
                max={60}
                value={c.maxCaracteresPorLinha}
                onChange={(e) => num('maxCaracteresPorLinha', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-alvo`} rotulo="Velocidade alvo (cps)">
              <input
                id={`${idBase}-alvo`}
                className="campo"
                type="number"
                min={5}
                max={30}
                step={0.5}
                value={c.cpsAlvo}
                onChange={(e) => num('cpsAlvo', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-teto`} rotulo="Velocidade teto (cps)">
              <input
                id={`${idBase}-teto`}
                className="campo"
                type="number"
                min={5}
                max={40}
                step={0.5}
                value={c.cpsMaximo}
                onChange={(e) => num('cpsMaximo', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-dmin`} rotulo="Duração mínima (ms)">
              <input
                id={`${idBase}-dmin`}
                className="campo"
                type="number"
                min={200}
                step={100}
                value={c.duracaoMinimaMs}
                onChange={(e) => num('duracaoMinimaMs', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-daviso`} rotulo="Duração de aviso (ms)">
              <input
                id={`${idBase}-daviso`}
                className="campo"
                type="number"
                min={1000}
                step={100}
                value={c.duracaoAvisoMs}
                onChange={(e) => num('duracaoAvisoMs', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-dmax`} rotulo="Duração máxima (ms)">
              <input
                id={`${idBase}-dmax`}
                className="campo"
                type="number"
                min={1000}
                step={100}
                value={c.duracaoMaximaMs}
                onChange={(e) => num('duracaoMaximaMs', e.target.value)}
              />
            </Campo>

            <Campo
              id={`${idBase}-intervalo`}
              rotulo="Intervalo mínimo (ms)"
              dica={`${msParaFrames(c.intervaloMinimoMs, c.fps)} quadros a ${c.fps} fps`}
            >
              <input
                id={`${idBase}-intervalo`}
                className="campo"
                type="number"
                min={0}
                step={1}
                value={c.intervaloMinimoMs}
                onChange={(e) => num('intervaloMinimoMs', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-fps`} rotulo="Taxa de quadros (fps)">
              <input
                id={`${idBase}-fps`}
                className="campo"
                type="number"
                min={1}
                max={120}
                step={0.001}
                value={c.fps}
                onChange={(e) => num('fps', e.target.value)}
              />
            </Campo>

            <Campo id={`${idBase}-excl`} rotulo="Limiar de exclamações na obra">
              <input
                id={`${idBase}-excl`}
                className="campo"
                type="number"
                min={0}
                value={c.maxExclamacoesPorObra}
                onChange={(e) => num('maxExclamacoesPorObra', e.target.value)}
              />
            </Campo>
          </div>

          <fieldset className="mt-4 rounded border border-paper-400 p-3">
            <legend className="px-1 text-sm font-medium">Contagem e checagens</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={c.contarEspacos}
                  onChange={(e) => acoes.config({ contarEspacos: e.target.checked })}
                />
                <span>
                  Contar espaços
                  <span className="block text-xs text-navy-500">
                    Padrão do Guia, que inclui espaços no cômputo de caracteres.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={c.contarColchetes}
                  onChange={(e) => acoes.config({ contarColchetes: e.target.checked })}
                />
                <span>
                  Contar conteúdo entre colchetes
                  <span className="block text-xs text-navy-500">
                    Rótulos de falante e efeitos sonoros ocupam a tela e o tempo de leitura.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={c.checarTracoDialogo}
                  onChange={(e) => acoes.config({ checarTracoDialogo: e.target.checked })}
                />
                <span>Checar travessão de diálogo (C2)</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={c.nlpAtivo}
                  onChange={(e) => acoes.config({ nlpAtivo: e.target.checked })}
                />
                <span>
                  Módulo de segmentação sintática (L1)
                  <span className="block text-xs text-navy-500">
                    Local, offline. Desligado, L1 é declarada não verificada.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </section>
  );
}
