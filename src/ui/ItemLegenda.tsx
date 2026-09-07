import type { Cue, ReviewState, RuleConfig, Suggestion } from '../model/types';
import { cpsDaLegenda, duracaoMs, faixaCps, formatarDuracao, formatarTimecode, ROTULO_FAIXA } from '../core/texto';
import { Regua } from './Regua';
import { CardSugestao } from './CardSugestao';

const CLASSE_FAIXA = {
  verde: 'border-ok bg-ok-100 text-ok',
  ambar: 'border-warn bg-warn-100 text-warn',
  vermelho: 'border-bad bg-bad-100 text-bad',
} as const;

const ICONE_FAIXA = { verde: '✓', ambar: '!', vermelho: '✕' } as const;

export function BadgeCps({ cue, config }: { cue: Cue; config: RuleConfig }) {
  const cps = cpsDaLegenda(cue, config);
  const faixa = faixaCps(cps, config);
  const texto = Number.isFinite(cps) ? cps.toFixed(1).replace('.', ',') : '∞';
  return (
    <span className={`chip ${CLASSE_FAIXA[faixa]}`}>
      <span aria-hidden="true">{ICONE_FAIXA[faixa]}</span>
      {texto} cps — {ROTULO_FAIXA[faixa]}
    </span>
  );
}

export function ItemLegenda({
  cue,
  sugestoes,
  review,
  config,
  linhasFinais,
  remanescentes,
  mostrarPrevia,
}: {
  cue: Cue;
  sugestoes: Suggestion[];
  review: ReviewState;
  config: RuleConfig;
  linhasFinais?: string[];
  remanescentes: number;
  mostrarPrevia: boolean;
}) {
  const alterada =
    mostrarPrevia && linhasFinais && linhasFinais.join('\n') !== cue.lines.join('\n');
  const linhas = mostrarPrevia && linhasFinais ? linhasFinais : cue.lines;

  return (
    <article
      aria-labelledby={`legenda-${cue.index}`}
      className="border-b border-paper-400 px-4 py-4"
      id={`cue-${cue.index}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={`legenda-${cue.index}`} className="text-sm font-semibold">
          Legenda {cue.index}
        </h3>
        <span className="font-mono text-xs text-navy-700">
          {formatarTimecode(cue.startMs)} → {formatarTimecode(cue.endMs)}
        </span>
        <span className="text-xs text-navy-700">{formatarDuracao(duracaoMs(cue))}</span>
        <BadgeCps cue={cue} config={config} />
        {alterada ? (
          <span className="chip border-ok bg-ok-100 text-ok">
            <span aria-hidden="true">✎</span> alterada na prévia
          </span>
        ) : null}
        {mostrarPrevia && remanescentes > 0 ? (
          <span className="chip border-bad bg-bad-100 text-bad">
            <span aria-hidden="true">✕</span> {remanescentes} violação(ões) permanecem
          </span>
        ) : null}
        {sugestoes.length > 0 ? (
          <span className="ml-auto text-xs text-navy-700">
            {sugestoes.length} apontamento{sugestoes.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </header>

      {/* Renderização aproximada de como a legenda aparece em tela. */}
      <div className="mt-2 rounded border border-paper-400 bg-navy px-3 py-2">
        <div className="mx-auto max-w-[38ch] text-center font-mono text-sm text-paper">
          {linhas.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {l.replace(/<\/?[^>]+>/g, '') || ' '}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {linhas.map((l, i) => (
          <Regua key={i} linha={l} config={config} />
        ))}
      </div>

      {sugestoes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {sugestoes.map((s) => {
            const item = review[s.id];
            if (!item) return null;
            return (
              <li key={s.id}>
                <CardSugestao item={item} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
