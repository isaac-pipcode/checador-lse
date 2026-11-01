import { useMemo } from 'react';
import { useDespachar, useEstado, useResultadoFinal, type Pagina } from '../../state/store';
import { verificarBloco, nivelDoBloco } from '../../ad/verificacoes';
import { verificarJanela } from '../../libras/geometria';
import { NBR_15290 } from '../../libras/tipos';

interface Indicador {
  texto: string;
  tom: 'ok' | 'warn' | 'bad' | 'neutro';
}

/**
 * Barra de páginas, embaixo (como as páginas do DaVinci Resolve): cada página é
 * uma etapa do fluxo, com um indicador de estado em texto — nunca só em cor.
 */
export function BarraPaginas() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const final = useResultadoFinal();

  const ind = useMemo((): Record<Exclude<Pagina, 'projetos'>, Indicador> => {
    const pend = Object.values(estado.review).filter((r) => r.decision === 'pendente').length;
    const erros = final.remanescentes.filter((s) => s.severity === 'erro').length;
    const blocos = estado.ad.blocos;
    const gravados = blocos.filter((b) => b.takeAtivoId).length;
    const adErro = blocos.filter((b) => nivelDoBloco(verificarBloco(b, final.cues, estado.ad.parametros)) === 'erro').length;
    const lib = verificarJanela(estado.libras, NBR_15290, estado.mapa?.duracaoMs ?? 0, final.cues);
    return {
      lse: estado.cues.length === 0
        ? { texto: 'sem legenda', tom: 'neutro' }
        : erros > 0
          ? { texto: `${erros} erros`, tom: 'bad' }
          : pend > 0
            ? { texto: `${pend} pendentes`, tom: 'warn' }
            : { texto: 'revisada', tom: 'ok' },
      ad: blocos.length === 0
        ? { texto: 'sem blocos', tom: 'neutro' }
        : adErro > 0
          ? { texto: `${gravados}/${blocos.length} · ${adErro} erros`, tom: 'bad' }
          : { texto: `${gravados}/${blocos.length} gravados`, tom: gravados === blocos.length ? 'ok' : 'warn' },
      libras: !estado.libras.clipe
        ? { texto: 'sem intérprete', tom: 'neutro' }
        : lib.some((a) => a.nivel === 'erro')
          ? { texto: 'fora da norma', tom: 'bad' }
          : lib.length > 0
            ? { texto: `${lib.length} avisos`, tom: 'warn' }
            : { texto: 'pronta', tom: 'ok' },
      entrega: { texto: estado.video?.caminho ? 'pronta para renderizar' : 'abra o vídeo', tom: 'neutro' },
    };
  }, [estado, final]);

  const paginas: Array<[Exclude<Pagina, 'projetos'>, string, string]> = [
    ['lse', 'Legendas', 'Aa'],
    ['ad', 'Audiodescrição', '◉'],
    ['libras', 'Libras', '🤟'],
    ['entrega', 'Entrega', '⇪'],
  ];
  const corTom = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', neutro: 'text-navy-500' } as const;

  return (
    <nav aria-label="Etapas do projeto" className="relative flex items-stretch justify-center gap-1 border-t border-fundo bg-paper">
      <button
        type="button"
        className="aba absolute inset-y-0 left-0"
        onClick={() => despachar({ tipo: 'navegar', pagina: 'projetos' })}
      >
        <span aria-hidden="true" className="text-base leading-none">
          ▦
        </span>
        <span>Projetos</span>
      </button>
      {paginas.map(([p, rotulo, icone]) => (
        <button
          key={p}
          type="button"
          className="aba min-w-[112px]"
          aria-current={estado.pagina === p ? 'page' : undefined}
          onClick={() => despachar({ tipo: 'navegar', pagina: p })}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {icone}
          </span>
          <span>{rotulo}</span>
          <span className={`text-[10px] font-normal leading-none ${corTom[ind[p].tom]}`}>{ind[p].texto}</span>
        </button>
      ))}
    </nav>
  );
}
