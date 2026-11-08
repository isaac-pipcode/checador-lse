import { useId } from 'react';
import type { SessaoGravacao } from './useSessaoGravacao';

/**
 * Escolha do microfone + medidor de nível. A escolha fica salva no computador e
 * a lista se atualiza ao conectar/desconectar. Compacto (uma linha) no topo da
 * lista de blocos; completo na aba Microfone do modo Gravação.
 */
export function SeletorMicrofone({ sessao, compacto = false }: { sessao: SessaoGravacao; compacto?: boolean }) {
  const id = useId();
  const semNomes = sessao.microfones.length > 0 && sessao.microfones.every((m) => !m.label);
  const conhecidos = sessao.microfones.filter((m) => m.deviceId && m.deviceId !== 'default');
  const salvoAusente =
    sessao.micId !== '' && conhecidos.length > 0 && !conhecidos.some((m) => m.deviceId === sessao.micId);
  const nivelPct = Number.isFinite(sessao.nivel) ? Math.max(0, Math.min(100, ((sessao.nivel + 60) / 60) * 100)) : 0;

  const seletor = (
    <select
      id={`${id}-mic`}
      className={`campo ${compacto ? 'h-7 min-w-0 flex-1' : ''}`}
      value={salvoAusente ? '' : sessao.micId}
      disabled={sessao.ativa}
      onChange={(e) => sessao.setMicId(e.target.value)}
    >
      <option value="">Padrão do sistema</option>
      {conhecidos.map((m, i) => (
        <option key={m.deviceId} value={m.deviceId}>
          {m.label || `Microfone ${i + 1}`}
        </option>
      ))}
    </select>
  );
  const medidor = sessao.micAberto ? (
    <div
      className={`${compacto ? 'w-20' : 'mt-2 w-full'} h-1.5 shrink-0 rounded bg-fundo`}
      role="meter"
      aria-label="Nível do microfone"
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={Number.isFinite(sessao.nivel) ? Math.round(sessao.nivel) : -60}
      aria-valuetext={Number.isFinite(sessao.nivel) ? `${sessao.nivel.toFixed(0)} dBFS` : 'silêncio'}
    >
      <div
        className={`h-1.5 rounded ${sessao.nivel > -3 ? 'bg-bad' : sessao.nivel > -12 ? 'bg-warn' : 'bg-ok'}`}
        style={{ width: `${nivelPct}%` }}
      />
    </div>
  ) : (
    <button type="button" className="btn-secundario h-7 shrink-0 px-2" onClick={() => void sessao.abrirMic()}>
      {compacto ? 'Testar' : 'Abrir microfone'}
    </button>
  );
  const emUso = sessao.entradaEmUso?.nome;

  if (compacto)
    return (
      <div className="flex items-center gap-2 border-b border-fundo bg-paper-200 px-3 py-1.5 text-xs">
        <label htmlFor={`${id}-mic`} className="shrink-0 font-medium text-navy-700">
          Microfone
        </label>
        {seletor}
        {medidor}
      </div>
    );

  return (
    <>
      <label className="rotulo" htmlFor={`${id}-mic`}>
        Entrada
      </label>
      {seletor}
      {semNomes ? (
        <p className="mt-1 text-2xs text-navy-500">Abra o microfone para ver os nomes dos aparelhos.</p>
      ) : null}
      {salvoAusente ? (
        <p className="mt-1 text-2xs text-warn">O microfone escolhido antes não está conectado; usando o padrão.</p>
      ) : null}
      {medidor}
      {sessao.micAberto ? (
        <p className="mt-1 text-2xs text-navy-500">
          Pico: {Number.isFinite(sessao.nivel) ? `${sessao.nivel.toFixed(0)} dBFS` : '—'}
          {emUso ? ` · em uso: ${emUso}` : ''}
        </p>
      ) : null}
    </>
  );
}
