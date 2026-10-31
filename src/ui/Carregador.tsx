import { useCallback, useId, useRef, useState } from 'react';
import { decodeBuffer } from '../parser/encoding';
import { parseSubtitle } from '../parser/srt';
import { useDespachar } from '../state/store';

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
    <section aria-labelledby="titulo-carregar" className="p-4">
      <h2 id="titulo-carregar" className="text-base font-semibold">
        Carregar legenda
      </h2>
      <p className="mt-2 text-navy-700">
        O arquivo é lido e analisado <strong>dentro do seu navegador</strong>. Nada é enviado a
        nenhum servidor — nem o texto, nem os tempos, nem o nome do arquivo.
      </p>

      <div
        className={`mt-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          arrastando ? 'border-terra bg-paper-200' : 'border-navy-500 bg-paper-200'
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
        <p className="text-navy-700">Arraste o arquivo aqui ou use o seletor abaixo.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <label className="rotulo" htmlFor={inputId}>
            Arquivo de legenda (.srt ou .vtt)
          </label>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".srt,.vtt,text/plain"
            className="campo max-w-md file:mr-3 file:rounded file:border-0 file:bg-paper-200 file:px-3 file:py-1 file:text-navy"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processar(f);
            }}
          />
        </div>
      </div>

      {erro ? (
        <p role="alert" className="mt-4 rounded border border-bad bg-bad-100 px-3 py-2 text-bad">
          <span aria-hidden="true">✕ </span>
          {erro}
        </p>
      ) : null}

      <div className="mt-8 cartao">
        <h3 className="font-semibold">O que este checador faz</h3>
        <p className="mt-2 text-sm text-navy-700">
          Confere a legenda contra os parâmetros de Legendagem para Surdos e Ensurdecidos do{' '}
          <em>Guia para Produções Audiovisuais Acessíveis</em> (MinC/SAv, 2016) e apresenta cada
          não-conformidade como uma sugestão que você aprova, rejeita ou edita. O arquivo final
          contém <strong>apenas</strong> o que você aprovou.
        </p>
        <p className="mt-2 text-sm text-navy-700">
          Cada apontamento declara como foi obtido: verificação determinística, inferência assistida
          (com grau de confiança) ou pendência que só a revisão humana resolve.
        </p>
      </div>
    </section>
  );
}
