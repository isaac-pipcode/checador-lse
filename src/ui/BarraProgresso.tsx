import { useEffect, useRef, useState } from 'react';

/**
 * Barra de progresso do app: visível nos dois temas, com etapa, percentual e
 * tempo restante estimado. `fracao` null = indeterminada (trabalhando, ainda
 * sem número: carregando um modelo, esperando a primeira leitura).
 *
 * `passo`: algumas ferramentas só informam o avanço em degraus (o Whisper, de
 * 5% em 5%). Com o passo, a barra avança suavemente pela taxa observada, sem
 * nunca passar do próximo degrau; o número escrito é sempre o informado.
 *
 * Acessível como `role=progressbar`, com valor e texto ("42%, cerca de 3 min
 * restantes"); atualiza o leitor de tela no máximo a cada ~10%.
 */

function formatarRestante(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${Math.max(5, Math.round(s / 5) * 5)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function BarraProgresso({
  fracao,
  rotulo,
  etapa,
  passo,
  aoCancelar,
  compacto = false,
  sobreEscuro = false,
  className = '',
}: {
  fracao: number | null;
  /** nome acessível ("Progresso da transcrição") */
  rotulo: string;
  /** o que está acontecendo agora ("Transcrevendo"); some no modo compacto */
  etapa?: string;
  passo?: number;
  aoCancelar?: () => void;
  compacto?: boolean;
  /** sobre o monitor (fundo sempre escuro, nos dois temas) */
  sobreEscuro?: boolean;
  className?: string;
}) {
  // histórico para a taxa (fração por ms) e o tempo restante
  const inicio = useRef<number>(performance.now());
  const ultima = useRef<{ f: number; t: number } | null>(null);
  const taxa = useRef<number | null>(null);
  const [agora, setAgora] = useState(() => performance.now());

  useEffect(() => {
    if (fracao === null) return;
    const t = performance.now();
    const u = ultima.current;
    if (u && fracao > u.f) {
      const r = (fracao - u.f) / (t - u.t);
      taxa.current = taxa.current === null ? r : taxa.current * 0.6 + r * 0.4;
    }
    if (fracao < (u?.f ?? 0)) {
      // recomeçou (nova etapa): zera a estimativa
      inicio.current = t;
      taxa.current = null;
    }
    ultima.current = { f: fracao, t };
  }, [fracao]);

  // relógio para a suavização e o tempo restante
  useEffect(() => {
    const id = window.setInterval(() => setAgora(performance.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const f = fracao === null ? null : Math.max(0, Math.min(1, fracao));
  let exibida = f;
  if (f !== null && passo && taxa.current && ultima.current && f < 1) {
    const avanco = taxa.current * (agora - ultima.current.t);
    exibida = Math.min(f + avanco, f + passo * 0.95, 0.995);
  }
  const decorrido = agora - inicio.current;
  const restante =
    f !== null && f > 0.02 && f < 1 && decorrido > 4000
      ? taxa.current
        ? (1 - (exibida ?? f)) / taxa.current
        : (decorrido * (1 - f)) / f
      : null;
  const pct = f === null ? null : Math.round(f * 100);
  const textoValor =
    pct === null
      ? 'em andamento'
      : `${pct}%${restante !== null && restante > 3000 ? `, cerca de ${formatarRestante(restante)} restantes` : ''}`;

  return (
    <div className={`text-xs ${className}`}>
      <div
        role="progressbar"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct === null ? undefined : Math.round(pct / 10) * 10}
        aria-valuetext={etapa ? `${etapa}: ${textoValor}` : textoValor}
        className={`relative w-full overflow-hidden rounded-full ${sobreEscuro ? 'bg-cabine-faixa' : 'bg-paper-400'} ${compacto ? 'h-1.5' : 'h-2'}`}
      >
        {exibida === null ? (
          <div className="barra-indeterminada absolute inset-y-0 w-1/3 rounded-full bg-terra" />
        ) : (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-terra transition-[width] duration-500 ease-linear"
            style={{ width: `${Math.max(2, exibida * 100)}%` }}
          />
        )}
      </div>
      {!compacto ? (
        <div
          className={`mt-1 flex items-center gap-2 tabular-nums ${sobreEscuro ? 'text-cabine-texto' : 'text-navy-700'}`}
        >
          {/* o texto repete o que a barra já anuncia (aria-valuetext); o Cancelar fica fora do aria-hidden */}
          <span className="min-w-0 truncate" aria-hidden="true">
            {etapa ? `${etapa}${pct === null ? '…' : ''}` : null}
            {pct !== null ? (
              <>
                {etapa ? ' · ' : ''}
                <strong className={`font-semibold ${sobreEscuro ? '' : 'text-navy'}`}>{pct}%</strong>
              </>
            ) : null}
            {restante !== null && restante > 3000 ? ` · ~${formatarRestante(restante)} restantes` : null}
          </span>
          {aoCancelar ? (
            <button type="button" className="btn-fantasma ml-auto h-6 shrink-0 px-2 text-2xs" onClick={aoCancelar}>
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
