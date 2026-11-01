import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { lacunasParaAd, lacunasPorSilencio, type Lacuna } from '../mapa/lacunas';
import { ponte } from '../desktop/ponte';
import { useAjudaAberta } from './ajudas';
import { Icone } from './icones';

/** Salva texto: diálogo do sistema no desktop; download no navegador. */
export function baixar(nome: string, conteudo: string, mime: string) {
  const p = ponte();
  if (p) {
    void p.salvarTexto(nome, conteudo);
    return;
  }
  const url = URL.createObjectURL(new Blob([conteudo], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lacunas da obra: da legenda, se houver; senão, dos silêncios do áudio. */
export function useLacunas(): { lacunas: Lacuna[]; fonte: 'legenda' | 'silencio' | null } {
  const { estado } = useEstado();
  const final = useResultadoFinal();
  const { mapa, config } = estado;
  const cues = final.cues;
  return useMemo(() => {
    const duracaoMs = Math.max(mapa?.duracaoMs ?? 0, cues.length ? Math.max(...cues.map((c) => c.endMs)) : 0);
    if (cues.length > 0) {
      return {
        lacunas: lacunasParaAd(cues, duracaoMs, config.lacunaMinimaAdMs, mapa?.audio ? mapa : null),
        fonte: 'legenda' as const,
      };
    }
    if (mapa?.audio) return { lacunas: lacunasPorSilencio(mapa, config.lacunaMinimaAdMs), fonte: 'silencio' as const };
    return { lacunas: [], fonte: null };
  }, [cues, mapa, config.lacunaMinimaAdMs]);
}

/** Painel de editor: cabeçalho fino + corpo rolável. */
export function Painel({
  titulo,
  acoes,
  children,
  className = '',
  corpoClassName = '',
  rotulo,
}: {
  titulo: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  corpoClassName?: string;
  /** nome acessível da região, quando o título não é texto simples */
  rotulo?: string;
}) {
  return (
    <section className={`painel ${className}`} aria-label={rotulo ?? (typeof titulo === 'string' ? titulo : undefined)}>
      <header className="painel-cabeca">
        <h2 className="min-w-0 truncate">{titulo}</h2>
        {acoes ? <div className="ml-auto flex items-center gap-1 normal-case tracking-normal">{acoes}</div> : null}
      </header>
      <div className={`painel-corpo ${corpoClassName}`}>{children}</div>
    </section>
  );
}

/** Seção do inspetor. */
const CHAVE_RECOLHIDAS = 'estudio:secoes-recolhidas';
function lerRecolhidas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_RECOLHIDAS) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Seção do inspetor: faixa de cabeçalho que recolhe o conteúdo (estado lembrado
 * entre sessões, por título) e, opcionalmente, uma explicação atrás de "?".
 */
export function Secao({
  titulo,
  children,
  id,
  dica,
}: {
  titulo: string;
  children: ReactNode;
  id?: string;
  /** explicação sob demanda: fica atrás de um botão "?" no cabeçalho */
  dica?: ReactNode;
}) {
  const auto = useId();
  const idTitulo = id ?? `${auto}-t`;
  const [aberta, alternar] = useAjudaAberta();
  const [recolhida, setRecolhida] = useState(() => lerRecolhidas().has(titulo));
  function recolher() {
    const novo = !recolhida;
    setRecolhida(novo);
    const r = lerRecolhidas();
    if (novo) r.add(titulo);
    else r.delete(titulo);
    try {
      localStorage.setItem(CHAVE_RECOLHIDAS, JSON.stringify([...r]));
    } catch {
      /* sem armazenamento */
    }
  }
  return (
    <section className="secao-r" aria-labelledby={idTitulo}>
      <div className="secao-cabeca">
        <h3 id={idTitulo} className="min-w-0 flex-1">
          <button
            type="button"
            className="flex h-7 w-full items-center gap-1 text-left"
            aria-expanded={!recolhida}
            aria-controls={`${auto}-c`}
            onClick={recolher}
          >
            <Icone nome={recolhida ? 'recolhido' : 'aberto'} tamanho={14} className="text-navy-500" />
            <span className="truncate">{titulo}</span>
          </button>
        </h3>
        {dica && !recolhida ? (
          <BotaoDica titulo={titulo} aberta={aberta} alvo={`${auto}-d`} aoAlternar={alternar} />
        ) : null}
      </div>
      <div id={`${auto}-c`} className="secao-corpo" hidden={recolhida}>
        {dica && aberta ? (
          <p id={`${auto}-d`} className="dica">
            {dica}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function BotaoDica({
  titulo,
  aberta,
  alvo,
  aoAlternar,
}: {
  titulo: string;
  aberta: boolean;
  alvo: string;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      className="botao-dica"
      aria-expanded={aberta}
      aria-controls={aberta ? alvo : undefined}
      aria-label={`Ajuda: ${titulo}`}
      title={aberta ? 'Fechar ajuda' : 'Ajuda'}
      onClick={aoAlternar}
    >
      <Icone nome="ajuda" tamanho={15} />
    </button>
  );
}

/** Ajuda sob demanda fora de uma Secao: botão "?" seguido do texto quando aberto. */
export function Dica({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  const [aberta, alternar] = useAjudaAberta();
  return (
    <>
      <BotaoDica titulo={titulo} aberta={aberta} alvo={id} aoAlternar={alternar} />
      {aberta ? (
        <span id={id} className="dica basis-full">
          {children}
        </span>
      ) : null}
    </>
  );
}

/** Controle deslizante com rótulo e valor, padrão do inspetor. */
export function Deslizante({
  id,
  rotulo,
  valor,
  min,
  max,
  passo,
  formatar,
  aoMudar,
  marca,
}: {
  id: string;
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  formatar: (v: number) => string;
  aoMudar: (v: number) => void;
  /** posição de referência (p. ex. mínimo da norma), desenhada sobre a trilha */
  marca?: { valor: number; rotulo: string };
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between">
        <label className="rotulo" htmlFor={id}>
          {rotulo}
        </label>
        <span className="font-mono text-xs text-navy">{formatar(valor)}</span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={passo}
          value={valor}
          onChange={(e) => aoMudar(Number(e.target.value))}
          className="block w-full"
        />
        {marca ? (
          <span
            aria-hidden="true"
            title={marca.rotulo}
            className="pointer-events-none absolute top-0.5 h-2.5 w-0.5 bg-warn"
            style={{ left: `${((marca.valor - min) / (max - min)) * 100}%` }}
          />
        ) : null}
      </div>
      {marca ? <p className="text-2xs text-navy-500">{marca.rotulo}</p> : null}
    </div>
  );
}

export const tcSmpte = (ms: number, fps: number) => {
  const t = Math.max(0, ms);
  const q = Math.floor(((t % 1000) / 1000) * fps);
  const s = Math.floor(t / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}:${p(q)}`;
};

export interface Aba {
  id: string;
  rotulo: string;
  /** contagem ou estado curto ao lado do rótulo (ex.: "3") */
  marca?: string | number | null;
  /** tom da marca */
  tom?: 'neutro' | 'aviso' | 'erro';
  /** conteúdo; recebe o elemento que rola (para listas virtualizadas) */
  conteudo: ReactNode | ((rolagem: RefObject<HTMLDivElement>) => ReactNode);
}

/**
 * Painel com abas internas (padrão WAI-ARIA de abas): setas ←/→, Home e End
 * movem entre as abas; só a aba ativa entra na ordem de Tab. A última aba
 * escolhida é lembrada por painel (`memoria`) durante a sessão.
 */
export function PainelAbas({
  titulo,
  acoes,
  faixa,
  abas,
  memoria,
  rotulo,
  className = '',
}: {
  titulo: ReactNode;
  acoes?: ReactNode;
  /** linha fixa entre as abas e o conteúdo (ex.: resumo) */
  faixa?: ReactNode;
  abas: Aba[];
  memoria: string;
  rotulo: string;
  className?: string;
}) {
  const idBase = useId();
  const chave = `estudio:aba:${memoria}`;
  const [ativa, setAtivaEstado] = useState<string>(() => {
    try {
      const s = sessionStorage.getItem(chave);
      if (s && abas.some((a) => a.id === s)) return s;
    } catch {
      /* sem armazenamento */
    }
    return abas[0]?.id ?? '';
  });
  const setAtiva = (id: string) => {
    setAtivaEstado(id);
    try {
      sessionStorage.setItem(chave, id);
    } catch {
      /* sem armazenamento */
    }
  };
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];
  const rolagem = useRef<HTMLDivElement>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    const i = abas.findIndex((a) => a.id === atual?.id);
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % abas.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = abas.length - 1;
    if (j < 0) return;
    e.preventDefault();
    setAtiva(abas[j].id);
    botoes.current[abas[j].id]?.focus();
  }

  const corMarca = {
    neutro: 'bg-paper-400 text-navy',
    aviso: 'bg-warn-100 text-warn',
    erro: 'bg-bad-100 text-bad',
  } as const;

  return (
    <section className={`painel ${className}`} aria-label={rotulo}>
      <header className="painel-cabeca">
        <h2 className="min-w-0 truncate">{titulo}</h2>
        {acoes ? <div className="ml-auto flex items-center gap-1 normal-case tracking-normal">{acoes}</div> : null}
      </header>
      <div
        role="tablist"
        aria-label={`Seções de ${rotulo}`}
        className="flex shrink-0 gap-0.5 overflow-x-auto [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto border-b border-fundo bg-paper px-1.5"
        onKeyDown={teclado}
      >
        {abas.map((a) => {
          const sel = a.id === atual?.id;
          return (
            <button
              key={a.id}
              ref={(el) => {
                botoes.current[a.id] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-aba-${a.id}`}
              aria-selected={sel}
              aria-controls={`${idBase}-painel-${a.id}`}
              tabIndex={sel ? 0 : -1}
              onClick={() => setAtiva(a.id)}
              className={`-mb-px inline-flex h-7 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium ${
                sel ? 'border-navy text-navy' : 'border-transparent text-navy-500 hover:text-navy'
              }`}
            >
              {a.rotulo}
              {a.marca !== undefined && a.marca !== null && a.marca !== '' ? (
                <span className={`rounded-full px-1.5 text-2xs leading-4 ${corMarca[a.tom ?? 'neutro']}`}>
                  {a.marca}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {faixa}
      <div
        ref={rolagem}
        role="tabpanel"
        id={`${idBase}-painel-${atual?.id}`}
        aria-labelledby={`${idBase}-aba-${atual?.id}`}
        tabIndex={0}
        className="painel-corpo focus-visible:outline-offset-[-2px]"
      >
        {atual ? (typeof atual.conteudo === 'function' ? atual.conteudo(rolagem) : atual.conteudo) : null}
      </div>
    </section>
  );
}
