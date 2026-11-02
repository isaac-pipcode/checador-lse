import { useEffect, useState } from 'react';
import { CATALOGO } from '../rules';
import { ponte } from '../desktop/ponte';
import { SecaoAtualizacao } from './atualizacao';
import { ROTULO_VERIFICABILIDADE } from './primitivos';

export function Sobre() {
  return (
    <section aria-labelledby="titulo-sobre" className="mx-auto max-w-4xl px-4 py-8">
      <h2 id="titulo-sobre" className="text-2xl font-semibold">
        Sobre e metodologia
      </h2>

      <h3 className="mt-6 text-lg font-semibold">O que é verificado, e como</h3>
      <p className="mt-2 text-sm text-navy-700">
        Cada regra declara seu tipo de verificabilidade. Isso não é detalhe de implementação: é a
        diferença entre um fato objetivo extraído do arquivo e uma inferência. O checador nunca
        apresenta a segunda como se fosse a primeira.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Catálogo de regras do checador</caption>
          <thead>
            <tr className="border-b-2 border-navy-500 text-left">
              <th scope="col" className="py-2 pr-3">ID</th>
              <th scope="col" className="py-2 pr-3">Regra</th>
              <th scope="col" className="py-2 pr-3">Verificabilidade</th>
              <th scope="col" className="py-2">Fundamento</th>
            </tr>
          </thead>
          <tbody>
            {CATALOGO.map((r) => (
              <tr key={r.id} className="border-b border-paper-400 align-top">
                <th scope="row" className="py-2 pr-3 font-mono font-normal">{r.id}</th>
                <td className="py-2 pr-3">{r.nome}</td>
                <td className="py-2 pr-3">{ROTULO_VERIFICABILIDADE[r.verificabilidade]}</td>
                <td className="py-2 text-navy-700">{r.fundamento}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-lg font-semibold">Limites declarados</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-700">
        <li>
          O módulo de segmentação (L1) faz <em>chunking</em> de superfície a partir de classes
          fechadas do português — não é um analisador sintático completo. Suas saídas trazem grau de
          confiança e nunca são aplicadas sem aprovação.
        </li>
        <li>
          A redução textual (L2) depende de modelo de linguagem, desligado por padrão. Sem ele, as
          legendas acima do alvo são apenas listadas como candidatas.
        </li>
        <li>
          Regras contextuais (C3, C7, X1, X2) exigem o vídeo e o áudio. O checador as transforma em
          itens de checklist, sem nota automática.
        </li>
        <li>
          As verificações temporais (M1–M3) dependem do vídeo e são inferências sobre o sinal: energia
          de áudio na banda de voz e diferença de histograma entre quadros. Não reconhecem fala, não
          distinguem fala de música e podem perder cortes muito próximos ou fusões lentas. Por isso
          vêm com grau de confiança e nunca são aprovadas em lote. M2 segue convenção de mercado (colar a
          legenda ao corte), não o Guia MinC.
        </li>
        <li>
          A contagem de caracteres segue o Guia (inclui espaços e colchetes). Casas de legendagem
          divergem nesse ponto; por isso os dois <em>toggles</em> de contagem existem, e o relatório
          registra qual critério foi usado.
        </li>
      </ul>

      <h3 className="mt-8 text-lg font-semibold">Privacidade</h3>
      <p className="mt-2 text-sm text-navy-700">
        Análise, revisão e geração do arquivo final acontecem inteiramente no navegador. A única
        exceção possível é o módulo assistido de redução textual (L2): se — e somente se — você o
        ativar e pedir uma proposta, o texto daquela legenda é enviado à API da Anthropic. Nenhum
        arquivo é enviado a servidor em nenhuma outra circunstância.
      </p>

      <h3 className="mt-8 text-lg font-semibold">Referências</h3>
      <ul className="mt-2 space-y-2 text-sm text-navy-700">
        <li>
          NAVES, S. B.; MAUCH, C.; ALVES, S. F.; ARAÚJO, V. L. S. <strong>Guia para Produções
          Audiovisuais Acessíveis.</strong> Brasília: Ministério da Cultura/Secretaria do
          Audiovisual, 2016.
        </li>
        <li>
          ARAÚJO, V. L. S.; NASCIMENTO, A. K. P. Investigando parâmetros de legendas para Surdos e
          Ensurdecidos no Brasil. <strong>Tradução em Revista</strong>, v. 2, p. 1-18, 2011.
        </li>
        <li>
          NASCIMENTO, A. K. P. <strong>Linguística de corpus e legendagem para surdos e
          ensurdecidos (LSE):</strong> uma análise baseada em corpus da tradução de efeitos sonoros
          na legenda de filmes brasileiros em DVD. Dissertação (Mestrado) — UECE, Fortaleza, 2013.
        </li>
        <li>
          DÍAZ CINTAS, J.; REMAEL, A. <strong>Audiovisual Translation: Subtitling.</strong>{' '}
          Manchester: St. Jerome, 2007.
        </li>
        <li>
          D&apos;YDEWALLE, G.; PRAET, C.; VERFAILLIE, K.; VAN RENSBERGEN, J. Reading a message when
          the same message is available auditorily in another language: the case of subtitling.
          In: O&apos;REGAN, J. K.; LÉVY-SCHOEN, A. (org.). <strong>Eye Movements: From Physiology
          to Cognition.</strong> Amsterdam: Elsevier, 1987.
        </li>
        <li>
          KARAMITROGLOU, F. A proposed set of subtitling standards in Europe.{' '}
          <strong>Translation Journal</strong>, v. 2, n. 2, 1998.
        </li>
        <li>
          BRASIL. <strong>Lei nº 13.146, de 6 de julho de 2015</strong> (Lei Brasileira de Inclusão
          da Pessoa com Deficiência).
        </li>
        <li>
          ANCINE. <strong>Instrução Normativa nº 116, de 18 de dezembro de 2014</strong>; e{' '}
          <strong>Instrução Normativa nº 132, de 26 de setembro de 2017.</strong>
        </li>
      </ul>

      <ComponentesTerceiros />

      <p className="mt-6 text-xs text-navy-500">
        Este checador não é produto oficial do Ministério da Cultura, da ANCINE ou do grupo
        LEAD/UECE; é uma implementação independente dos parâmetros publicados por eles.
      </p>
    </section>
  );
}

const ORIGEM: Record<string, string> = {
  embutido: 'embutido no instalador',
  variavel: 'indicado pela variável OUVER_FFMPEG',
  sistema: 'instalado no sistema',
  path: 'encontrado no PATH',
};

/**
 * Componentes de terceiros. O FFmpeg vai embutido nos instaladores e é
 * distribuído sob a GPL: o aviso, a licença e o caminho do código-fonte ficam
 * aqui e na pasta resources/ffmpeg do aplicativo.
 */
function ComponentesTerceiros() {
  const [ff, setFf] = useState<Awaited<ReturnType<NonNullable<ReturnType<typeof ponte>>['ffmpeg']>> | null>(null);
  useEffect(() => {
    void ponte()
      ?.ffmpeg()
      .then(setFf)
      .catch(() => setFf(null));
  }, []);
  return (
    <>
      <SecaoAtualizacao />

      <h3 className="mt-8 text-lg font-semibold">Licença</h3>
      <p className="mt-2 text-sm text-navy-700">
        O Ouver Estúdio é software livre, sob a <strong>GNU GPL versão 3 ou posterior</strong>. O código-fonte está em{' '}
        <a
          className="underline"
          href="https://github.com/isaac-pipcode/checador-lse"
          target="_blank"
          rel="noreferrer"
        >
          github.com/isaac-pipcode/checador-lse
        </a>
        .
      </p>

      <h3 className="mt-8 text-lg font-semibold">Componentes de terceiros</h3>
      <p className="mt-2 text-sm text-navy-700">
        <strong>FFmpeg</strong> lê, analisa e gera o áudio e o vídeo. Ele é executado como programa separado e não faz
        parte do código do Ouver Estúdio. Nos instaladores, vai embutido (versão 9.0.2) e é distribuído sob a{' '}
        <strong>GNU GPL versão 3</strong>; o texto da licença, a origem da compilação e as somas de verificação estão na
        pasta <code>resources/ffmpeg</code> do aplicativo, e o código-fonte em{' '}
        <a className="underline" href="https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz" target="_blank" rel="noreferrer">
          ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
        </a>{' '}
        (também anexado à release no GitHub).
      </p>
      {ff ? (
        <p className="mt-2 text-xs text-navy-500">
          Em uso: {ff.disponivel ? (ff.versao ?? 'ffmpeg') : 'nenhum ffmpeg encontrado'} — {ORIGEM[ff.origem] ?? ff.origem}
          {ff.disponivel ? <span className="block break-all font-mono">{ff.caminho}</span> : null}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-navy-700">
        Ícones: <strong>Lucide</strong> (licença ISC). Mãos de Libras: desenho próprio, derivado do traçado “hand” do
        Lucide.
      </p>
    </>
  );
}
