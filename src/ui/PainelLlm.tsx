import { useState } from 'react';
import type { Suggestion } from '../model/types';
import { useDespachar, useEstado } from '../state/store';
import { ClienteLlm, descreverErroLlm } from '../llm/cliente';
import { Icone } from './icones';

/**
 * Aparece dentro de sugestões cujo módulo assistido está indisponível.
 * Nenhuma chamada acontece sem que o usuário ligue o módulo e clique aqui.
 */
const NOME_ESTRATEGIA: Record<string, string> = { condensacao: 'condensação', omissao: 'omissão', resegmentacao: 'ressegmentação' };

export function PainelLlm({ sugestao }: { sugestao: Suggestion }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehL2 = sugestao.ruleId === 'L2';
  const ehL1 = sugestao.ruleId === 'L1';
  const podeChamar = estado.config.llmAtivo && estado.llm.apiKey.trim().length > 0 && ehL2;

  if (ehL1 && !estado.config.nlpAtivo) {
    return (
      <p className="mt-2 rounded border border-navy-500 bg-paper px-3 py-2 text-sm text-navy-700">
        Ligue o módulo de segmentação nos parâmetros para que L1 seja verificada. Enquanto
        desligado, esta regra permanece <strong>não verificada</strong> — o checador não substitui a
        análise por heurística frágil.
      </p>
    );
  }

  if (!ehL2) return null;

  const cue = estado.cues.find((c) => c.index === sugestao.cueIndex);

  async function gerar() {
    if (!cue) return;
    setErro(null);
    setOcupado(true);
    try {
      const cliente = new ClienteLlm({ provedor: estado.llm.provedor, apiKey: estado.llm.apiKey, modelo: estado.llm.modelo });
      const p = await cliente.reduzir(cue, estado.config);
      despachar({
        tipo: 'sugestaoLlm',
        base: sugestao,
        after: { lines: p.propostaLinhas },
        confianca: p.confianca,
        texto: `Redução por ${NOME_ESTRATEGIA[p.estrategia] ?? p.estrategia}: ${p.justificativa}`,
      });
    } catch (e) {
      setErro(descreverErroLlm(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-navy-500 bg-paper px-3 py-2 text-sm">
      {podeChamar ? (
        <>
          <p className="text-navy-700">
            A proposta de redução será gerada pelo modelo e virá com grau de confiança, para sua
            aprovação. O texto desta legenda será enviado ao provedor.
          </p>
          <button type="button" className="btn-secundario mt-2" onClick={gerar} disabled={ocupado}>
            {ocupado ? 'Consultando…' : 'Gerar proposta de redução'}
          </button>
          {erro ? (
            <p role="alert" className="mt-2 text-bad">
              <Icone nome="erro" tamanho={14} /> 
              {erro}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-navy-700">
          Redução textual exige o módulo assistido, que está desligado. Ative-o em{' '}
          <strong>Módulo assistido</strong>, no topo da tela, ciente de que isso envia o texto das
          legendas escolhidas ao provedor.
        </p>
      )}
    </div>
  );
}
