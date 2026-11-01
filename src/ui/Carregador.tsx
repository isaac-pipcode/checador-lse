import { useCallback, useId, useRef, useState } from 'react';
import { decodeBuffer } from '../parser/encoding';
import { parseSubtitle } from '../parser/srt';
import { useDespachar } from '../state/store';
import { Icone } from './icones';

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
      if (!/\.(srt|vtt|txt)$/i.test(arquivo.name)) {
        setErro('Formato não reconhecido. Envie um arquivo .srt ou .vtt.');
        return;
      }
      try {
        const buffer = await arquivo.arrayBuffer();
        const { texto, encoding, avisos } = decodeBuffer(buffer);
        const r = parseSubtitle(texto);
        despachar({
          tipo: 'carregar',
          nome: arquivo.name,
          encoding,
          cues: r.cues,
          erros: r.erros,
          avisos: [...avisos, ...r.avisos],
        });
      } catch (e) {
        setErro(
          `Não foi possível ler o arquivo: ${e instanceof Error ? e.message : 'erro desconhecido'}.`,
        );
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
