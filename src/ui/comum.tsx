import { useMemo, type ReactNode } from 'react';
import { useEstado, useResultadoFinal } from '../state/store';
import { lacunasParaAd, lacunasPorSilencio, type Lacuna } from '../mapa/lacunas';
import { ponte } from '../desktop/ponte';

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
export function Secao({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <section className="secao" aria-labelledby={id}>
      <h3 id={id} className="secao-titulo">
        {titulo}
      </h3>
      {children}
    </section>
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
          className="w-full accent-[rgb(var(--c-terra))]"
        />
        {marca ? (
          <span
            aria-hidden="true"
            title={marca.rotulo}
            className="pointer-events-none absolute top-0 h-2 w-0.5 bg-warn"
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
