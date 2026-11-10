import { useSyncExternalStore } from 'react';
import { useEstado, type Estado } from '../state/store';
import { Icone } from './icones';

/**
 * De onde vêm as mídias nas exportações (pacote, AD com vídeo, sequência para
 * editores): dos originais (alta qualidade, o padrão) ou dos proxies (leves,
 * para revisão ou envio rápido). Mídia sem proxy sai do original, e isso é dito.
 *
 * A escolha vale para a sessão e é a mesma nas três saídas, para não haver
 * pacote em alta e sequência em baixa por engano. Não fica no projeto: entregar
 * em alta é o caso normal, e reabrir um projeto não deve herdar "proxy".
 */

export type Qualidade = 'original' | 'proxy';

let qualidade: Qualidade = 'original';
const ouvintes = new Set<() => void>();
function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
export function definirQualidade(q: Qualidade) {
  qualidade = q;
  ouvintes.forEach((f) => f());
}
export function useQualidade(): Qualidade {
  return useSyncExternalStore(assinar, () => qualidade);
}

export interface Fonte {
  caminho: string;
  nome: string;
  /** a mídia que de fato sai: proxy ou original */
  ehProxy: boolean;
  /** pediu proxy, mas não há proxy desta mídia */
  semProxy: boolean;
}

const nomeDe = (c: string) => c.split(/[\\/]/).pop() ?? c;

/** Caminhos que as exportações devem usar, conforme a qualidade escolhida. */
export function fontesExportacao(estado: Estado, q: Qualidade) {
  const escolher = (original: string | null | undefined, proxy: string | null | undefined): Fonte | null => {
    if (!original) return null;
    const usaProxy = q === 'proxy' && !!proxy;
    const caminho = usaProxy ? proxy! : original;
    return { caminho, nome: nomeDe(caminho), ehProxy: usaProxy, semProxy: q === 'proxy' && !proxy };
  };
  const video = escolher(estado.video?.caminho, estado.video?.proxy?.caminho);
  const libras = escolher(estado.libras.clipe?.caminho, estado.libras.clipe?.proxy?.caminho);
  return {
    video,
    libras,
    /** a saída é sugerida ao lado do original, não na pasta de proxies */
    pastaPadrao: estado.video?.caminho ? estado.video.caminho.replace(/[\\/][^\\/]*$/, '') || undefined : undefined,
    /** sufixo do nome dos arquivos gerados: uma saída em proxy nunca passa por master */
    sufixo: q === 'proxy' && (video?.ehProxy || libras?.ehProxy) ? '-proxy' : '',
  };
}

export function useFontesExportacao() {
  const { estado } = useEstado();
  const q = useQualidade();
  return { qualidade: q, ...fontesExportacao(estado, q) };
}

function LinhaFonte({ rotulo, f }: { rotulo: string; f: Fonte | null }) {
  if (!f) return null;
  return (
    <li className="flex items-baseline gap-1.5">
      <span className="w-14 shrink-0 text-navy-500">{rotulo}</span>
      <span className={`chip ${f.ehProxy ? 'border-warn bg-warn-100 text-warn' : 'border-ok bg-ok-100 text-ok'}`}>
        {f.ehProxy ? 'Proxy' : 'Original'}
      </span>
      <span className="min-w-0 truncate" title={f.caminho}>
        {f.nome}
      </span>
      {f.semProxy ? <span className="shrink-0 text-2xs text-navy-500">(sem proxy gerado)</span> : null}
    </li>
  );
}

/**
 * Escolha e conferência da qualidade das mídias. `compacto`: só a linha de
 * estado, para as saídas secundárias (a escolha fica no pacote).
 */
export function FonteDasMidias({ compacto = false }: { compacto?: boolean }) {
  const { qualidade: q, video, libras } = useFontesExportacao();
  if (!video && !libras) return null;
  const algumProxy = !!(video?.ehProxy || libras?.ehProxy);
  if (compacto)
    return (
      <p className={`mt-1 text-2xs ${algumProxy ? 'text-warn' : 'text-navy-500'}`}>
        {algumProxy ? <Icone nome="aviso" tamanho={12} /> : null} Mídias:{' '}
        {algumProxy ? 'proxy (baixa resolução)' : 'originais (alta qualidade)'} — escolha em Entrega → Pacote.
      </p>
    );
  return (
    <div className="text-xs">
      <div className="flex rounded bg-fundo p-0.5" role="group" aria-label="Qualidade das mídias na exportação">
        <button
          type="button"
          className="segmento flex-1"
          aria-pressed={q === 'original'}
          onClick={() => definirQualidade('original')}
        >
          Originais (alta)
        </button>
        <button
          type="button"
          className="segmento flex-1"
          aria-pressed={q === 'proxy'}
          onClick={() => definirQualidade('proxy')}
        >
          Proxy (baixa)
        </button>
      </div>
      <ul className="mt-2 space-y-1" aria-label="Arquivos usados na exportação">
        <LinhaFonte rotulo="Obra" f={video} />
        <LinhaFonte rotulo="Libras" f={libras} />
      </ul>
      {algumProxy ? (
        <p className="mt-1.5 text-2xs text-warn">
          <Icone nome="aviso" tamanho={12} /> Saída em baixa resolução (até 720p), para revisão; os arquivos levam
          “-proxy” no nome.
        </p>
      ) : null}
    </div>
  );
}
