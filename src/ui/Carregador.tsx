import { useCallback, useId, useRef, useState } from 'react';
import { decodeBuffer } from '../parser/encoding';
import { parseSubtitle } from '../parser/srt';
import { useDespachar, type Acao } from '../state/store';
import { ponte } from '../desktop/ponte';
import { Icone } from './icones';

/** Lê .srt/.vtt (qualquer codificação comum) e devolve a ação de carregar; lança se não der. */
export function acaoDeLegenda(nome: string, buffer: ArrayBuffer): Acao {
  if (!/\.(srt|vtt|txt)$/i.test(nome)) throw new Error('Formato não reconhecido. Use um arquivo .srt ou .vtt.');
  const { texto, encoding, avisos } = decodeBuffer(buffer);
  const r = parseSubtitle(texto);
  return { tipo: 'carregar', nome, encoding, cues: r.cues, erros: r.erros, avisos: [...avisos, ...r.avisos] };
}

/**
 * Importa uma legenda pelo diálogo do sistema (desktop). Se já houver uma, pede
 * confirmação: trocar a legenda descarta as decisões de revisão dela.
 * Devolve false se o usuário desistiu; lança com a mensagem se o arquivo não serve.
 */
export function useImportarLegenda() {
  const despachar = useDespachar();
  return useCallback(
    async (jaCarregada: boolean): Promise<boolean> => {
      const desktop = ponte();
      if (!desktop?.escolherLegenda) return false;
      if (jaCarregada && !window.confirm('Substituir a legenda atual? As decisões de revisão dela serão descartadas.'))
        return false;
      const r = await desktop.escolherLegenda();
      if (!r) return false;
      const b = r.bytes;
      despachar(acaoDeLegenda(r.nome, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
      return true;
    },
    [despachar],
  );
}

/** Tela inicial: carregamento do arquivo. Nada sai do navegador. */
export function Carregador() {
  const despachar = useDespachar();
  const inputId = useId();
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const processar = useCallback(
    async (arquivo: File) => {
      setErro(null);
      try {
        despachar(acaoDeLegenda(arquivo.name, await arquivo.arrayBuffer()));
      } catch (e) {
        setErro(`Não foi possível ler o arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
      }
    },
    [despachar],
  );

  return (
    <section aria-labelledby="titulo-carregar" className="flex h-full flex-col p-3">
      <h2 id="titulo-carregar" className="sr-only-focusable">
        Importar legenda
      </h2>
      <div
        className={`flex flex-1 flex-col items-center justify-center gap-3 rounded border border-dashed p-6 text-center transition-colors ${
          arrastando ? 'border-terra bg-paper-200' : 'border-paper-400'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void processar(f);
        }}
      >
        <Icone nome="legendas" tamanho={36} className="text-navy-500" />
        <p className="text-xs text-navy-700">Arraste a legenda (.srt ou .vtt) para cá</p>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept=".srt,.vtt,text/plain"
          aria-label="Arquivo de legenda (.srt ou .vtt)"
          className="peer sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void processar(f);
          }}
        />
        <label
          htmlFor={inputId}
          className="btn-secundario cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-terra"
        >
          Importar legenda…
        </label>
        <p className="text-2xs text-navy-500">Lida e analisada só nesta máquina.</p>
      </div>

      {erro ? (
        <p role="alert" className="mt-3 rounded border border-bad bg-bad-100 px-3 py-2 text-xs text-bad">
          <Icone nome="erro" tamanho={14} /> 
          {erro}
        </p>
      ) : null}
    </section>
  );
}
