import type { RuleConfig } from '../model/types';
import { contarCaracteres, semMarcacao } from '../core/texto';

/**
 * Régua de caracteres: mostra a linha como apareceria na tela e marca o
 * excedente ao limite de CPL. O ponto de corte respeita os toggles de contagem
 * (espaços e colchetes), para não divergir do número exibido ao lado — que
 * também é declarado em texto, sem depender de cor.
 */
export function Regua({ linha, config }: { linha: string; config: RuleConfig }) {
  const visivel = semMarcacao(linha);
  const n = contarCaracteres(linha, config);
  const limite = config.maxCaracteresPorLinha;
  const excede = n > limite;

  let corte = visivel.length;
  if (excede) {
    let acumulado = 0;
    let dentroDeColchetes = false;
    const chars = [...visivel];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '[') dentroDeColchetes = true;
      const contabiliza =
        (config.contarEspacos || !/\s/.test(ch)) &&
        (config.contarColchetes || !(dentroDeColchetes || ch === ']'));
      if (ch === ']') dentroDeColchetes = false;
      if (contabiliza) acumulado++;
      if (acumulado > limite) {
        corte = i;
        break;
      }
    }
  }

  const dentro = [...visivel].slice(0, corte).join('');
  const fora = [...visivel].slice(corte).join('');

  return (
    <div className="font-mono text-sm leading-relaxed">
      <span className="whitespace-pre-wrap">{dentro}</span>
      {fora ? (
        <span className="whitespace-pre-wrap bg-bad-100 text-bad underline decoration-bad decoration-wavy">
          {fora}
        </span>
      ) : null}
      <span
        className={`ml-2 align-middle text-xs ${excede ? 'font-semibold text-bad' : 'text-navy-500'}`}
      >
        {excede ? <span aria-hidden="true">✕ </span> : null}
        {n} de {limite}
      </span>
    </div>
  );
}
