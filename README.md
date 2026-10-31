# Checador de LSE

Validador, revisor assistido e exportador de legendas para **Surdos e Ensurdecidos (LSE)** em
português brasileiro, conforme o *Guia para Produções Audiovisuais Acessíveis* (NAVES; MAUCH;
ALVES; ARAÚJO — MinC/SAv, 2016).

Carrega um `.srt` (ou `.vtt`), aponta cada não-conformidade como uma **sugestão revisável**
(aprovar / rejeitar / editar) e gera um novo arquivo contendo **apenas** as modificações aprovadas,
acompanhado de um relatório de QA que serve de trilha de auditoria.

Não é *closed caption* de transcrição de TV aberta, nem transcritor de áudio, nem tradutor.

## Princípios

1. **Estratificação por verificabilidade.** Cada regra declara se é `deterministica`, `nlp`, `llm`
   ou `manual`. O núcleo determinístico funciona sem rede e sem LLM. Regras assistidas produzem
   sugestões com grau de confiança; regras manuais viram itens de checklist, sem nota automática.
   Nenhuma inferência é apresentada como fato objetivo.
2. **Human-in-the-loop.** Nada entra no arquivo final sem aprovação explícita. Aprovações em lote
   existem, são reversíveis e restritas a auto-correções determinísticas.
3. **Preservação do original.** O arquivo de entrada nunca é mutado; a saída é uma cópia com os
   *diffs* aprovados.
4. **Privacidade.** Todo o processamento acontece no navegador. A única exceção possível é o módulo
   opcional de redução textual (L2), desligado por padrão.
5. **A interface é acessível.** WCAG 2.2 AA (ver *Acessibilidade*, abaixo).

## Uso

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção em dist/
npm run preview  # serve o build
npm test         # suíte de testes (Vitest)
```

Há um arquivo de demonstração com problemas propositais em `exemplos/exemplo-com-problemas.srt`.

O build é estático: `dist/` pode ser servido por qualquer servidor de arquivos, inclusive
`file://` (o `base` está configurado como relativo).

## Catálogo de regras

| ID | Regra | Parâmetro padrão | Severidade | Verificabilidade |
|----|-------|------------------|------------|------------------|
| T1 | Caracteres por linha | ≤ 37 | erro | determinística |
| T2 | Número de linhas | ≤ 2 | erro | determinística (reflow quando cabe) |
| T3 | Duração mínima | ≥ 1000 ms | erro | determinística |
| T4 | Duração máxima | aviso > 4 s; erro > 6 s | aviso/erro | determinística |
| T5 | Velocidade (CPS) | alvo 15; teto 18 | aviso/erro | determinística |
| T6 | Sobreposição temporal | `start[i+1] ≥ end[i]` | erro | determinística (auto-corrige) |
| T7 | Intervalo mínimo | ≥ 83 ms (2 quadros @24 fps) | aviso | determinística (auto-corrige) |
| T8 | Formato retangular | desequilíbrio ≤ 40% | aviso | determinística |
| C1 | Colchetes, não parênteses | — | aviso | determinística (confiança declarada) |
| C2 | Travessão de diálogo colado | — | aviso | determinística (auto-corrige) |
| C3 | Maiúsculas (texto em cena, título) | — | revisão manual | manual |
| C4 | Itálico | markup checável; uso não | aviso / revisão manual | mista |
| C5 | Vírgula final entre legendas | — | aviso | determinística (auto-corrige) |
| C6 | Exclamação em excesso | > 10 na obra | aviso | determinística |
| C7 | Reticências | — | revisão manual | manual |
| C8 | Limpeza tipográfica | — | aviso | determinística (auto-corrige) |
| L1 | Segmentação sintática | — | aviso | NLP local |
| L2 | Redução textual | quando CPS > alvo | aviso | LLM (opcional) |
| X1 | Identificação de falante | janela de 20 legendas | revisão manual | manual (heurística parcial) |
| X2 | Efeitos sonoros | — | revisão manual | manual |
| M1 | Sincronia com o som | tolerância 300 ms | aviso | sinal (exige vídeo) |
| M2 | Corte de plano | margem 500 ms | aviso | sinal (exige vídeo e detecção de cortes) |
| M3 | Som sem legenda | ≥ 1500 ms | revisão manual | sinal (exige vídeo) |

Todos os limiares são configuráveis. Perfis prontos: **Guia MinC 145 / 160 / 180 ppm** e
**Mercado (referência alternativa)** — este último explicitamente sinalizado como *não* aderente ao
Guia.

### Contagem de caracteres

O padrão inclui espaços e o conteúdo entre colchetes, fiel ao Guia — que apresenta
*"Empresário mata ex-mulher no centro de Fortaleza"* como **48 caracteres**. Casas de legendagem
divergem nesse ponto, então há dois *toggles* (`contarEspacos`, `contarColchetes`); o critério usado
fica registrado no relatório de QA.

`cps = caracteres / ((endMs − startMs) / 1000)`.

## Estúdio: vídeo, mapa temporal e linha do tempo (protótipo)

Primeiro passo de um programa unificado de acessibilidade audiovisual (LSE, audiodescrição e
Libras sobre a mesma linha do tempo). Ativado pela caixa *Abrir estúdio* na tela de revisão.

Ao carregar um vídeo local, o estúdio monta um **mapa temporal** da obra:

- **Som**: o áudio é decodificado a 16 kHz, filtrado na banda de voz (150–4000 Hz) e reduzido a
  um envelope de energia em janelas de 10 ms. Um limiar adaptativo (dB acima do piso de ruído,
  ajustável) marca os trechos com som. **Não é reconhecimento de fala**: música e ruído também
  contam.
- **Cortes de plano** (opcional, sob demanda): um quadro a cada 250/500/1000 ms, reduzido a 64×36,
  vira histograma de cor; saltos de distância acima da vizinhança são candidatos, refinados por
  bisseção até ~1 quadro. Cortes mais próximos que o passo de amostragem e fusões lentas escapam.
- **Lacunas para audiodescrição**: intervalos sem legenda de fala acima da duração mínima. A
  própria trilha de LSE serve de mapa de diálogo; legendas só com `[efeito]` ou `♪` não fecham
  lacuna. Cada lacuna informa quanto dela tem som. Exportáveis em CSV.

O mapa alimenta as regras M1–M3, que entram no mesmo fluxo de aprovação das demais (com grau de
confiança, nunca em lote). As propostas de M1 e M2 mexem só nos tempos, e o relatório de QA
registra se havia vídeo, os parâmetros de detecção e se os cortes foram verificados.

A linha do tempo mostra régua, forma de onda, som detectado, cortes, legendas (com a pior
severidade pendente, em ícone e cor) e lacunas. Clicar numa legenda posiciona o vídeo e leva a
lista até ela; o botão *Ver no vídeo* de cada legenda faz o caminho inverso.

Para demonstrar: `exemplos/gerar-video-exemplo.sh` gera `exemplos/exemplo-estudio.webm` (30 s,
três planos, falas sintéticas), que acompanha `exemplos/exemplo-estudio.srt`, com problemas
temporais propositais.

**Limites do protótipo.** `decodeAudioData` decodifica a trilha inteira em memória: obras acima
de ~1 h podem passar de 1 GB (o caminho para produção é demultiplexar em streaming com WebCodecs).
Codecs que o navegador não lê (ProRes, por exemplo) exigem um proxy. A tela do estúdio ainda **não
passou** pela verificação com axe-core nem por leitor de tela.

## Aplicativo desktop

O projeto roda também como aplicativo desktop (Electron), que é o alvo a partir do passo 2. Requer o
**ffmpeg** instalado (no `PATH`, ou indicado em `CHECADOR_FFMPEG`).

```bash
npm install
npm run desktop        # build da interface + processo desktop, e abre o app
```

Para desenvolver com recarga: `npm run dev` num terminal e `npm run desktop:dev` em outro.

O que o desktop acrescenta ao navegador:

- **Análise de áudio pelo ffmpeg, em streaming**: qualquer duração e qualquer codec que o ffmpeg
  leia. No navegador, o limite é a memória de `decodeAudioData`.
- **Vídeo servido do disco** por um protocolo próprio (`midia://`) com suporte a `Range`; só
  arquivos escolhidos em diálogos do sistema ou registrados num projeto aberto são servidos.
- **Projeto em disco**: `nome.estudio.json` (roteiro, parâmetros, legenda, caminho do vídeo) e a
  pasta `takes/` ao lado. As decisões da revisão de LSE ainda **não** são salvas no projeto.
- **Renderização da mixagem** (abaixo).

Segurança: renderer isolado (`contextIsolation`, `sandbox`, sem Node); tudo que toca disco ou
ffmpeg passa pela ponte tipada em `src/desktop/ponte.ts`. O microfone é a única permissão concedida.

## Audiodescrição (passo 2, protótipo)

Aba **Audiodescrição**. Usa o mesmo vídeo, mapa temporal e linha do tempo do estúdio, com uma
trilha a mais.

1. **Blocos a partir das lacunas.** Um clique cria um bloco em cada intervalo sem fala. As lacunas vêm
   da LSE carregada ou, sem ela, dos silêncios do áudio (bem menos confiável). Também é possível
   criar um bloco na posição do vídeo e ajustar a janela em passos de ¼ s.
2. **Roteiro com estimativa de leitura.** Cada bloco mostra palavras, duração estimada e quantas
   palavras cabem na janela. A velocidade parte de 160 ppm, um valor de partida e não uma norma.
   Com três ou mais takes, o estúdio mede a velocidade real do locutor (mediana) e oferece trocá-la.
3. **Dois modos de trabalho.** **Roteiro** (editora): escreve vendo o vídeo, com atalhos que
   valem dentro da caixa de texto (`Ctrl/⌘+Espaço` toca/pausa, `Ctrl+←/→` ±2 s, `Ctrl+B` novo
   bloco na posição, `Ctrl+↑/↓` bloco anterior/seguinte, `Ctrl+Enter` aprova e avança). O
   trecho do bloco em foco se repete enquanto ela escreve (opcional). Cada bloco é **rascunho**
   ou **aprovado para gravação**; mudar o texto de um aprovado revoga a aprovação.
   **Gravação** (operadora): só blocos aprovados. Inclui microfone, pré e pós-rolagem, latência,
   a lista dos aprovados e uma prévia do que o locutor vê.
4. **Teleprompter no monitor do locutor.** No desktop, abre uma segunda janela em tela cheia no
   segundo monitor (com um só, em janela comum). A imagem (vídeo mudo sincronizado) ocupa a
   tela; o roteiro aparece **sobre ela, embaixo, como uma legenda**, com a nota para o locutor.
   Uma faixa fina no topo mostra a fase e o tempo: *Prepare-se · entra em 3,0 s* (com contagem
   regressiva grande 3, 2, 1 no centro) → *GRAVANDO — LEIA · restam 2,0 s* (com barra) →
   *Gravando a pós-rolagem · encerra em 2,0 s*. Uma faixa fina embaixo mostra o resultado do take
   (*cabe / sai da janela*), as teclas e o próximo bloco. A janela principal é a única dona do estado; o teleprompter exibe e devolve
   comandos. No navegador, há um teleprompter em tela cheia na própria janela.
5. **Gravação em sequência.** A operadora inicia a fila (todos os aprovados ou só os sem
   gravação). Para cada bloco, a sessão faz **pré-rolagem de 3 s** → leitura →
   **pós-rolagem de 2 s** (a captura continua, para não cortar o fim da frase) → parada
   automática (ou `Enter` a qualquer momento) → revisão. As duas durações são ajustáveis no
   console; projetos antigos mantêm a pré-rolagem que tinham salvo. Na revisão: `Enter` mantém e segue, `R` regrava (o take
   anterior é descartado), `Espaço` ouve com a mixagem, `Backspace` descarta e segue, `Esc`
   encerra. As teclas valem nas duas janelas, então o locutor pode conduzir sozinho. O take é
   aparado (silêncio de cabeça e cauda; o que foi captado na pré-rolagem é sempre descartado) e
   posicionado onde o locutor de fato falou. Por bloco, há também gravação avulsa, escolha do take
   ativo, deslocamento de 0,1 s e ganho de 1 dB.
6. **Verificações por bloco** (determinísticas, exceto a estimativa de A1):
   A1 texto estimado não cabe na janela · A2 gravação sai da janela · A3 gravação sobre legenda
   de fala (legendas só de `[efeito]` não contam) · A4 sem roteiro · A5 sem gravação ·
   A6 roteiro não aprovado.
7. **Prévia da mixagem** em tempo real: o som original passa por um ganho que segue a curva de
   *ducking* (−10 dB, ataque 250 ms, liberação 500 ms, configuráveis; clipes próximos fundem o
   patamar para evitar bombeamento), desenhada em verde sobre a forma de onda.
8. **Saídas.** Roteiro em texto para o locutor, WebVTT de descrições e CSV. No desktop,
   **renderização** com a mesma curva e os mesmos clipes da prévia: mixagem WAV 24 bits/48 kHz
   estéreo, trilha de AD isolada (para finalizar em outro programa) e MKV com faixa extra
   *Audiodescrição* (`por`), vídeo copiado sem recompressão. O relatório traz loudness integrada e
   pico verdadeiro (EBU R128, filtro `ebur128`), amostras saturadas e avisos. **A loudness é
   medida, não normalizada**: a especificação de entrega varia por cliente.

**Verificado.** Testes unitários do núcleo (estimativa, verificações, curva, aparo); teste da
renderização com ffmpeg real (atenuação medida dentro de ±2 dB do ducking pedido; voz na posição;
faixa titulada no MKV); fluxo completo no Electron sob Xvfb: análise, blocos, duas gravações
com microfone simulado, renderização, salvar e reabrir projeto; e o fluxo editora → locutor com
duas janelas: atalhos de roteiro, aprovação e revogação, teleprompter, sequência de dois blocos
com regravação comandada pela janela do locutor e parada automática no fim do vídeo.

**Não verificado / limites.** Gravação com microfone e locutor reais. O posicionamento num
segundo monitor físico não foi testado: o ambiente de teste tem uma tela só e exercitou o caso
de janela separada. No macOS, `Ctrl+Espaço` e `⌘+Espaço` costumam estar tomados pelo sistema (troca de
idioma, Spotlight), e os atalhos ainda não são configuráveis. O medidor de nível ficou
mudo no ambiente de teste (sem dispositivo de áudio; a gravação em si funcionou), então precisa
ser conferido numa máquina real. A latência de captura varia por máquina: há um campo de
compensação, mas ainda sem calibração automática. A prévia pode divergir alguns milissegundos em
reprodução longa; a renderização, não. Áudio 5.1 é reduzido a estéreo. A tela de AD não passou por
axe-core nem por leitor de tela. Empacotamento (instaladores) ainda não configurado.

## Arquitetura

```
src/
  parser/     leitura de SRT e WebVTT, detecção de codificação (UTF-8, BOM, Latin-1)
  model/      tipos (Cue, Suggestion, ReviewState, RuleConfig) e perfis
  core/       contagem de caracteres, CPS, métricas, contraste
  rules/      uma regra por arquivo, funções puras (cues, config, ctx) => Suggestion[]
  ad/         audiodescrição: modelo, estimativa, verificações, curva de mixagem, roteiro (puro)
              + gravador, prévia (Web Audio) e cache de takes (navegador)
  desktop/    contrato da ponte com o processo desktop
  mapa/       mapa temporal: envelope de áudio, atividade, cortes, lacunas (puro) + camada de navegador
  nlp/        léxico de classes fechadas do pt-BR + segmentador, atrás de uma interface
  llm/        cliente opcional (Anthropic), atrás de feature flag
  export/     aplicação dos diffs aprovados, serialização, relatório de QA
  state/      estado da revisão (useReducer + contexto)
  ui/         interface (revisão de LSE, estúdio, AD)
desktop/      processo principal do Electron: protocolo midia://, IPC, ffmpeg, renderização
```

### Sobre o módulo de segmentação (L1)

`src/nlp/segmentador.ts` faz *chunking* de superfície: identifica, pela pertença a classes fechadas
do português (determinantes, preposições, contrações, conjunções, pronomes, auxiliares), se a quebra
de linha separa um regente do termo que ele rege, e busca o ponto de quebra de nível sintático mais
alto disponível. **Não é um analisador sintático completo** — não há etiquetagem morfossintática
probabilística nem parser de constituintes. Por isso toda saída traz `confidence < 1` e nunca é
aplicada automaticamente. Com o módulo desligado, L1 se declara *não verificada*, em vez de
substituir a análise por heurística frágil.

Referências do critério: os 14 tipos de erro de segmentação descritos pelo grupo LEAD/UECE
(sintagmas nominal, verbal, preposicional, adjetival, adverbial; orações coordenada e subordinada) e
a hierarquia de pontos de quebra de Karamitroglou (1998).

### Módulo LLM (opcional, desligado por padrão)

Usado apenas para L2 (redução textual). Ao ativar, a interface avisa que o texto das legendas
escolhidas será enviado à API da Anthropic. A chave fica somente em memória — não vai para
`localStorage` nem para disco. A saída é estruturada (ferramenta com esquema estrito) e entra no
mesmo fluxo de aprovação das demais sugestões, com grau de confiança. Sem exceção.

## Acessibilidade

- HTML semântico, um `<h1>` por tela, `header`/`nav`/`main`/`section`, *skip link*.
- Operável por teclado; foco visível; atalhos `A` (aprovar), `R` (rejeitar), `E` (editar),
  `J`/`K` ou setas (navegar entre apontamentos).
- Severidade e status nunca sinalizados só por cor: sempre ícone **e** texto.
- `aria-live="polite"` anuncia mudanças de decisão.
- `prefers-reduced-motion` respeitado.
- Contraste dos tokens de marca verificado em teste automatizado (`test/contraste.test.ts`).
  O acento Terra (`#B85F3E`) **reprova** em 4,5:1 sobre o fundo Paper e por isso é usado apenas em
  bordas e realces, nunca em corpo de texto; `terra-700` cobre os casos em que o acento precisa
  virar texto.

**Verificação feita:** axe-core (regras WCAG 2.0/2.1/2.2 A e AA + *best practices*) sem violações
nas telas de carregamento, revisão, parâmetros, módulo assistido e metodologia; navegação e decisões
exercitadas por teclado em Chromium.

**Verificação pendente:** teste com leitor de tela real (NVDA/VoiceOver). Ferramentas automatizadas
cobrem parte das falhas de acessibilidade; a validação com usuários de tecnologia assistiva não foi
feita e é pré-requisito para considerar a interface pronta.

## Testes

`npm test` cobre os casos de aceite da especificação: CPL de 44 caracteres (T1), legenda de três
linhas (T2), a manchete de 48 caracteres em 2,3 s (T5 + candidata a L2 + requebra por L1), traço com
espaço (C2), espaço duplo e espaço antes de pontuação (C8), sobreposição temporal (T6), efeito
sonoro entre parênteses (C1), legenda de 900 ms (T3), SRT malformado (erro amigável com número de
linha, sem *crash*) e o fluxo completo de aprovação/rejeição/edição com verificação do arquivo final
e do relatório de QA.

## Licença e escopo

Implementação independente dos parâmetros publicados pelo MinC/SAv e pelo grupo LEAD/UECE. Não é
produto oficial dessas instituições.
