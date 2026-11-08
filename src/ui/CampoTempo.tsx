import { useEffect, useId, useState } from 'react';
import { formatarTimecode } from '../core/texto';
import { lerTempo } from '../core/tempo';

/**
 * Par de campos "entrada → saída" editáveis. Aceita 00:01:02,500, 1:02.5, 62,5
 * ou timecode com quadros (00:01:02:12). Confirma com Enter ou ao sair do campo;
 * Esc desfaz. Texto inválido, ou saída antes da entrada, não é aplicado e o
 * campo avisa (aria-invalid + mensagem).
 */
export function CampoTempo({
  inicioMs,
  fimMs,
  fps,
  rotulo,
  aoMudar,
}: {
  inicioMs: number;
  fimMs: number;
  fps: number;
  /** nome do item, para os rótulos acessíveis ("Legenda 12") */
  rotulo: string;
  aoMudar: (inicioMs: number, fimMs: number) => void;
}) {
  const id = useId();
  const [ent, setEnt] = useState(formatarTimecode(inicioMs));
  const [sai, setSai] = useState(formatarTimecode(fimMs));
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setEnt(formatarTimecode(inicioMs)), [inicioMs]);
  useEffect(() => setSai(formatarTimecode(fimMs)), [fimMs]);

  function aplicar() {
    const a = lerTempo(ent, fps);
    const b = lerTempo(sai, fps);
    if (a === null || b === null) return setErro('Tempo inválido. Use, por exemplo, 00:01:02,500.');
    if (b <= a) return setErro('A saída precisa ser depois da entrada.');
    setErro(null);
    if (a !== inicioMs || b !== fimMs) aoMudar(a, b);
    setEnt(formatarTimecode(a));
    setSai(formatarTimecode(b));
  }
  function desfazer() {
    setEnt(formatarTimecode(inicioMs));
    setSai(formatarTimecode(fimMs));
    setErro(null);
  }
  const campo = (valor: string, mudar: (v: string) => void, nome: string) => (
    <input
      className="campo h-6 w-[7.6rem] px-1.5 font-mono text-xs tabular-nums"
      value={valor}
      aria-label={`${nome} da ${rotulo}`}
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? `${id}-e` : undefined}
      onChange={(e) => mudar(e.target.value)}
      onBlur={aplicar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          aplicar();
        } else if (e.key === 'Escape') desfazer();
      }}
    />
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {campo(ent, setEnt, 'Entrada')}
      <span aria-hidden="true" className="text-navy-500">
        →
      </span>
      {campo(sai, setSai, 'Saída')}
      {erro ? (
        <span id={`${id}-e`} role="alert" className="basis-full text-2xs text-bad">
          {erro}
        </span>
      ) : null}
    </span>
  );
}
