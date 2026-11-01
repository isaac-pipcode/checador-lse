/**
 * Marca Ouver Estúdio. "Ouver" junta ouvir e ver: o símbolo é um olho — que
 * também se lê como a letra O — de onde sai uma onda de som. O olho fica na
 * tinta do tema; a pupila e a onda, no acento (terra). Geometria em quadro de
 * 24 (a mesma de docs/marca/simbolo.svg e do ícone do aplicativo).
 */
export const SIMBOLO = {
  olho: 'M2.2 12C4.5 5.2 15.5 5.2 17.8 12C15.5 18.8 4.5 18.8 2.2 12Z',
  pupila: { cx: 10, cy: 12, r: 2.8 },
  onda: 'M18.9 5.53A11 11 0 0 1 18.9 18.47',
  traco: 2.4,
} as const;

export function Simbolo({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={SIMBOLO.olho}
        fill="none"
        stroke="rgb(var(--c-navy))"
        strokeWidth={SIMBOLO.traco}
        strokeLinejoin="round"
      />
      <circle {...SIMBOLO.pupila} fill="rgb(var(--c-terra))" />
      <path d={SIMBOLO.onda} fill="none" stroke="rgb(var(--c-terra))" strokeWidth={SIMBOLO.traco} strokeLinecap="round" />
    </svg>
  );
}

/** Símbolo + nome. O nome é texto real (lido por leitores de tela), não imagem. */
export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Simbolo tamanho={grande ? 28 : 20} />
      <span className={`tracking-tight ${grande ? 'text-lg' : 'text-sm'}`}>
        <span className="font-semibold">Ouver</span> <span className="font-normal text-navy-500">Estúdio</span>
      </span>
    </span>
  );
}
