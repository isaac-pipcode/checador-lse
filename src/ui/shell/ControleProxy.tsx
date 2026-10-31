import { useDespachar, useEstado } from '../../state/store';
import { ponte } from '../../desktop/ponte';
import { avaliarMidia } from '../../midia/avaliacao';
import { gerarProxyDe } from '../proxy';

/**
 * Controle de proxy no cabeçalho do monitor: o que é o original, se há proxy,
 * qual está em uso, e a geração com progresso e cancelamento.
 */
export function ControleProxy() {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const desktop = ponte();
  const v = estado.video;
  if (!v) return null;
  const aval = v.info ? avaliarMidia(v.info) : null;
  const trabalho = v.caminho ? estado.proxies[v.caminho] : undefined;

  async function gerar() {
    if (!v?.caminho) return;
    const px = await gerarProxyDe(despachar, v.caminho, estado.projeto.caminho);
    if (px) despachar({ tipo: 'videoProxy', proxy: px, usar: true });
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 normal-case tracking-normal">
      {aval ? (
        <span className="hidden truncate font-mono text-2xs font-normal text-navy-500 2xl:inline" title={aval.motivos.join(' ')}>
          {aval.descricao}
        </span>
      ) : null}
      {v.proxy ? (
        <span className="flex rounded bg-fundo p-0.5" role="group" aria-label="Mídia no monitor">
          <button type="button" className="segmento h-6 px-2 text-2xs" aria-pressed={v.usarProxy} onClick={() => despachar({ tipo: 'videoUsarProxy', usar: true })}>
            Proxy
          </button>
          <button
            type="button"
            className="segmento h-6 px-2 text-2xs"
            aria-pressed={!v.usarProxy}
            onClick={() => despachar({ tipo: 'videoUsarProxy', usar: false })}
            title={aval?.reproduzivel === 'nao' ? 'O original não é reproduzível no monitor' : undefined}
          >
            Original
          </button>
        </span>
      ) : trabalho && !trabalho.erro ? (
        <span className="flex items-center gap-1 text-2xs font-normal text-navy-700" role="status">
          <progress max={1} value={trabalho.progresso} className="w-16" aria-label="Progresso do proxy" />
          proxy {Math.round(trabalho.progresso * 100)}%
          <button type="button" className="btn-fantasma h-6 px-1.5 text-2xs" onClick={() => v.caminho && void desktop?.cancelarProxy(v.caminho)}>
            Cancelar
          </button>
        </span>
      ) : desktop && v.caminho && aval && aval.necessidade !== 'dispensavel' ? (
        <button type="button" className="btn-secundario h-6 px-2 text-2xs" onClick={() => void gerar()} title={aval.motivos.join(' ')}>
          Gerar proxy
        </button>
      ) : null}
    </span>
  );
}

/**
 * Aviso sobre a imagem quando o monitor está no original e o original não toca
 * (formato de finalização, ou erro de decodificação do motor de vídeo).
 */
export function AvisoOriginal({ erroDeReproducao }: { erroDeReproducao: boolean }) {
  const { estado } = useEstado();
  const despachar = useDespachar();
  const desktop = ponte();
  const v = estado.video;
  if (!v || v.usarProxy) return null;
  const aval = v.info ? avaliarMidia(v.info) : null;
  if (!(aval?.reproduzivel === 'nao' || erroDeReproducao)) return null;
  const trabalho = v.caminho ? estado.proxies[v.caminho] : undefined;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-preto/85 p-6" role="status">
      <div className="max-w-md text-center text-sm text-cabine-texto">
        <p className="font-semibold">
          {aval ? aval.descricao : 'Formato não reproduzível'}
          {aval?.reproduzivel === 'nao' ? ' — não reproduzível no monitor' : ''}
        </p>
        <p className="mt-1 text-xs text-cabine-suave">
          {aval?.motivos[0] ?? 'O motor de vídeo do app não conseguiu decodificar este arquivo.'} O trabalho segue num proxy
          leve (H.264, 720p); a entrega é feita sempre a partir do original.
        </p>
        {trabalho && !trabalho.erro ? (
          <div className="mt-3">
            <progress max={1} value={trabalho.progresso} className="w-56" aria-label="Progresso do proxy" />
            <p className="text-xs text-cabine-suave">Gerando proxy… {Math.round(trabalho.progresso * 100)}%</p>
          </div>
        ) : v.proxy ? (
          <button type="button" className="btn-primario mt-3" onClick={() => despachar({ tipo: 'videoUsarProxy', usar: true })}>
            Usar o proxy
          </button>
        ) : desktop && v.caminho ? (
          <button
            type="button"
            className="btn-primario mt-3"
            onClick={async () => {
              const px = await gerarProxyDe(despachar, v.caminho!, estado.projeto.caminho);
              if (px) despachar({ tipo: 'videoProxy', proxy: px, usar: true });
            }}
          >
            Gerar proxy
          </button>
        ) : null}
        {trabalho?.erro ? <p className="mt-2 text-xs text-cabine-erro">{trabalho.erro}</p> : null}
      </div>
    </div>
  );
}
