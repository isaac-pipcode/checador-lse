import { useEffect, useId, useState } from 'react';
import { ponte } from '../desktop/ponte';
import { PROVEDORES, type Provedor } from '../llm/cliente';
import { useAcoes, useDespachar, useEstado } from '../state/store';
import { Campo } from './primitivos';
import { Icone } from './icones';

/** Traz a chave guardada deste provedor, se houver (desktop). */
export async function carregarChaveLembrada(provedor: Provedor, aplicar: (m: { apiKey: string; lembrada: boolean }) => void) {
  const chaves = ponte()?.chaves;
  if (!chaves) return;
  try {
    const k = await chaves.ler(provedor);
    if (k) aplicar({ apiKey: k, lembrada: true });
  } catch {
    /* sem chave guardada */
  }
}

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
  const desktop = ponte();
  const [cifra, setCifra] = useState<boolean | null>(null);
  const [erroChave, setErroChave] = useState<string | null>(null);
  useEffect(() => {
    void desktop?.chaves?.estado().then((e) => setCifra(e.cifra), () => setCifra(false));
  }, [desktop]);

  async function lembrar(sim: boolean) {
    if (!desktop?.chaves) return;
    setErroChave(null);
    try {
      if (sim && estado.llm.apiKey.trim()) await desktop.chaves.salvar(estado.llm.provedor, estado.llm.apiKey);
      else await desktop.chaves.esquecer(estado.llm.provedor);
      despachar({ tipo: 'llm', mudanca: { lembrada: sim && !!estado.llm.apiKey.trim() } });
    } catch (e) {
      setErroChave(e instanceof Error ? e.message : String(e));
    }
  }

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
          API do provedor escolhido (hoje: <strong>{prov.empresa}</strong>). A chave fica só na memória,
          a menos que você peça para lembrá-la neste computador (guardada cifrada pelo sistema).
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
                  // a chave é de um provedor só: trocar a descarta (e traz a lembrada do outro, se houver)
                  despachar({ tipo: 'llm', mudanca: { provedor, modelo: PROVEDORES[provedor].padrao, apiKey: '', lembrada: false } });
                  void carregarChaveLembrada(provedor, (m) => despachar({ tipo: 'llm', mudanca: m }));
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
              dica={estado.llm.lembrada ? 'Guardada neste computador.' : 'Somente em memória.'}
            >
              <input
                id={`${idBase}-chave`}
                className="campo"
                type="password"
                autoComplete="off"
                value={estado.llm.apiKey}
                onChange={(e) => despachar({ tipo: 'llm', mudanca: { apiKey: e.target.value } })}
                // lembrada: a chave editada substitui a guardada ao sair do campo
                onBlur={() => {
                  if (estado.llm.lembrada) void lembrar(true);
                }}
              />
            </Campo>
            {desktop?.chaves ? (
              <label className={`flex items-start gap-2 text-xs ${cifra === false ? 'text-navy-500' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={estado.llm.lembrada}
                  disabled={cifra === false || (!estado.llm.lembrada && !estado.llm.apiKey.trim())}
                  onChange={(e) => void lembrar(e.target.checked)}
                />
                <span>
                  Lembrar a chave neste computador
                  <span className="block text-2xs text-navy-500">
                    {cifra === false
                      ? 'Indisponível: o sistema não oferece armazenamento seguro.'
                      : 'Cifrada pelo sistema (Windows, macOS ou chaveiro do Linux). Desmarque para apagá-la.'}
                  </span>
                  {erroChave ? <span className="block text-2xs text-bad">{erroChave}</span> : null}
                </span>
              </label>
            ) : null}
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
