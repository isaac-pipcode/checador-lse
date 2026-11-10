import { useId, useState } from 'react';
import { PROVEDORES, type Provedor } from '../llm/cliente';
import { useAcoes, useDespachar, useEstado } from '../state/store';
import { Campo } from './primitivos';
import { Icone } from './icones';

/**
 * Configuração do módulo opcional de LLM. Desligado por padrão, com aviso
 * explícito. A chave fica só em memória: recarregar a página a descarta.
 */
export function ConfigLlm() {
  const { estado } = useEstado();
  const acoes = useAcoes();
  const despachar = useDespachar();
  const [aberto, setAberto] = useState(false);
  const idBase = useId();
  const ativo = estado.config.llmAtivo;
  const prov = PROVEDORES[estado.llm.provedor];

  return (
    <div className="text-sm">
      <button
        type="button"
        className="btn-fantasma"
        aria-expanded={aberto}
        aria-controls={`${idBase}-corpo`}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone nome={aberto ? 'aberto' : 'recolhido'} tamanho={14} />
        Módulo assistido (LLM): {ativo ? 'ativo' : 'desligado'}
      </button>

      <div
        id={`${idBase}-corpo`}
        hidden={!aberto}
        className="mt-2 max-w-xl rounded border border-paper-400 bg-paper p-3"
      >
        <p className="text-navy-700">
          Todo o restante do checador funciona <strong>offline</strong>. Ativando este módulo, o
          texto das legendas para as quais você pedir uma proposta — e somente elas — é enviado à
          API do provedor escolhido (hoje: <strong>{prov.empresa}</strong>). A chave fica apenas na
          memória desta aba e não é gravada em lugar nenhum.
        </p>

        <label className="mt-3 flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={ativo}
            onChange={(e) => acoes.config({ llmAtivo: e.target.checked })}
          />
          <span>
            Ativar chamadas ao provedor
            <span className="block text-xs text-navy-500">
              Toda saída do modelo entra como sugestão e passa pela sua aprovação.
            </span>
          </span>
        </label>

        {ativo ? (
          <div className="mt-3 grid gap-3">
            <Campo
              id={`${idBase}-provedor`}
              rotulo="Provedor"
              dica={estado.llm.provedor === 'maritaca' ? 'Modelos “Brasil (São Paulo)”: processados em servidores no país.' : undefined}
            >
              <select
                id={`${idBase}-provedor`}
                className="campo"
                value={estado.llm.provedor}
                onChange={(e) => {
                  const provedor = e.target.value as Provedor;
                  // a chave é de um provedor só: trocar a descarta, para não enviá-la ao outro
                  despachar({ tipo: 'llm', mudanca: { provedor, modelo: PROVEDORES[provedor].padrao, apiKey: '' } });
                }}
              >
                {(Object.keys(PROVEDORES) as Provedor[]).map((k) => (
                  <option key={k} value={k}>
                    {PROVEDORES[k].rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id={`${idBase}-chave`}
              rotulo={`Chave de API (${prov.empresa})`}
              dica="Somente em memória; não é salva."
            >
              <input
                id={`${idBase}-chave`}
                className="campo"
                type="password"
                autoComplete="off"
                value={estado.llm.apiKey}
                onChange={(e) => despachar({ tipo: 'llm', mudanca: { apiKey: e.target.value } })}
              />
            </Campo>
            <Campo id={`${idBase}-modelo`} rotulo="Modelo">
              <select
                id={`${idBase}-modelo`}
                className="campo"
                value={estado.llm.modelo}
                onChange={(e) => despachar({ tipo: 'llm', mudanca: { modelo: e.target.value } })}
              >
                {prov.modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        ) : null}
      </div>
    </div>
  );
}
