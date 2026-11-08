<img src="docs/marca/logotipo.svg" alt="Ouver Estúdio" width="260">

# Ouver Estúdio

*Ouver* junta **ouvir** e **ver**. Antes chamado Estúdio de Acessibilidade e, na origem, Checador de LSE. Marca e uso em [docs/marca](docs/marca/README.md).

Programa unificado para as três camadas de acessibilidade audiovisual — **legendagem para surdos
e ensurdecidos (LSE)**, **audiodescrição (AD)** e **janela de Libras** — sobre uma mesma linha do
tempo, com interface de editor de vídeo (ver [docs/design-system.md](docs/design-system.md)).
Aplicativo desktop (Electron); o módulo de LSE também roda no navegador.

**Fluxo:** *Projetos* (dashboard) → *Legendas* → *Audiodescrição* → *Libras* → *Entrega*, em
páginas na barra inferior. A *Entrega* gera um **pacote acessível**: um único arquivo com vídeo (com
a janela de Libras queimada), faixa de áudio original, faixa com AD e LSE como legenda selecionável.

O núcleo de LSE é um validador, revisor assistido e exportador de legendas para **Surdos e Ensurdecidos (LSE)** em
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

O padrão inclui espaços e o conteúdo entre colchetes, fiel ao Guia, cujo exemplo de manchete de uma
linha conta **48 caracteres** com os espaços. Os testes usam uma frase inventada de mesmo tamanho e mesma
estrutura (*"Cantor lança o disco inédito no centro de Recife"*). Casas de legendagem
divergem nesse ponto, então há dois *toggles* (`contarEspacos`, `contarColchetes`); o critério usado
fica registrado no relatório de QA.

`cps = caracteres / ((endMs − startMs) / 1000)`.

## Mapa temporal e linha do tempo (passo 1)

Primeiro passo do programa unificado. O monitor e a linha do tempo são compartilhados por todas
as páginas.

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
**ffmpeg** instalado para desenvolver (no `PATH`, ou indicado em `OUVER_FFMPEG`; os locais usuais de instalação também são procurados). Os instaladores já trazem o ffmpeg embutido.

```bash
npm install
npm run desktop        # build da interface + processo desktop, e abre o app
```

Para desenvolver com recarga: `npm run dev` num terminal e `npm run desktop:dev` em outro.

### Instaladores

`npm run dist` gera o instalador da plataforma atual em `release/` (electron-builder): `.exe` (NSIS)
no Windows, `.dmg` (Apple Silicon e Intel) no macOS, AppImage e `.deb` no Linux. O fluxo
[`.github/workflows/release.yml`](.github/workflows/release.yml) testa em todo pull request e, numa
tag `v*`, gera os instaladores nas três plataformas e publica uma release com eles. Para lançar uma
versão: atualizar `version` no `package.json`, criar a tag (`git tag v0.2.0`) e enviá-la.

**ffmpeg embutido.** Cada instalador leva o ffmpeg e o ffprobe 9.0.2 da sua plataforma e arquitetura
(compilações estáticas GPL: Martin Riedl para macOS — assinadas pela Apple — e Linux; Gyan Doshi para
Windows). `npm run ffmpeg:baixar` baixa as compilações fixadas em
[`desktop/ffmpeg-embutido.json`](desktop/ffmpeg-embutido.json), confere o SHA-256 (aborta se não bater)
e as deixa em `vendor/ffmpeg/`, de onde o electron-builder as copia para `resources/ffmpeg` com a
licença e um LEIA-ME de procedência. No CI, depois de empacotar, `npm run ffmpeg:verificar` executa o
ffmpeg **de dentro do app empacotado** nos três sistemas e codifica cada formato que o app usa (H.264 +
AAC + mov_text, ProRes 4444 com alfa, WAV 24 bits, VP8 + Opus, filtros da cadeia de Libras). A release
anexa o código-fonte do FFmpeg. Ordem de busca no app: `OUVER_FFMPEG` → embutido → locais usuais do
sistema → PATH. Para trocar de versão, atualizar o manifesto com URLs e somas novas.

Licença: o ffmpeg é executado como programa separado, e a leitura usual é que isso constitui
agregação, não obra derivada; o código do Ouver Estúdio não passa a ser GPL. É interpretação jurídica:
para distribuição comercial, vale um parecer. Patentes de H.264/AAC: não avaliadas.

**Atualização automática** ([`desktop/atualizacao.ts`](desktop/atualizacao.ts)). Ao abrir (preferência
em *Metodologia*, ligada por padrão), o app consulta as releases deste repositório. No Windows (.exe) e
no AppImage, o electron-updater baixa a versão nova em segundo plano (SHA-512 conferido contra o
`latest*.yml` da release) e a instala ao fechar o app; no macOS (recusa atualização de app não assinado)
e no .deb (é do gerenciador de pacotes), o app avisa e abre a página da release. O CI anexa os
`latest*.yml` e `.blockmap` à release. Testado com uma atualização real 0.1.2 → 0.1.3 a partir de um
servidor local (`OUVER_ATUALIZACAO_URL`; para o modo aviso, `OUVER_ATUALIZACAO_API`). Exige o repositório
**público** (o app lê as releases sem credencial).

Limite atual: instaladores **sem assinatura** (o macOS e o Windows avisam na primeira abertura). As notas de
instalação para o usuário final estão em [`docs/release-notas.md`](docs/release-notas.md). Testado
empacotado no Linux (fluxo completo, incluindo a exportação para editores); Windows e macOS são
gerados e verificados no CI, sem teste manual.

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
   (*cabe / sai da janela*), as teclas e o próximo bloco.
   **Ajustes da legenda** (console da operadora, salvos no projeto): cor **branca ou amarela**,
   tamanho da letra (60–200%, também com `+`/`−` na cabine, durante a sessão) e **altura máxima
   da caixa** (20–50% da imagem; padrão 33%). Se o roteiro não couber, a letra diminui sozinha
   até 60% do tamanho escolhido, e o teleprompter informa a redução. Se nem assim couber, o texto
   é cortado na borda da caixa e um aviso aparece sobre ela. A janela principal é a única dona do estado; o teleprompter exibe e devolve
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

## Janela de Libras (passo 3, protótipo)

Página **Libras**. O intérprete é gravado à parte, com fundo verde e com a trilha do filme como
som-guia. O clipe é sincronizado pelo som-guia, enquadrado, recortado, tratado e composto sobre a
obra.

### Sincronização pelo som-guia

A sincronização funciona como um plugin de sincronia por áudio (à maneira do PluralEyes), mas
integrada ao projeto:

1. **Cadência.** Testa as razões de velocidade típicas de conversão (1000/1001, 24↔25,
   25↔23,976…) reamostrando o envelope do som-guia, e fica com a de maior correlação. A "mesma
   cadência" vence quando está a até 0,05 da melhor, para não inventar conversão.
2. **Início.** Correlação de Pearson entre os envelopes de energia (banda de voz, 10 ms), com
   sobreposição mínima, em duas resoluções.
3. **Deriva.** A defasagem é medida em trechos de 20 s ao longo de todo o clipe; uma reta, com
   rejeição de discrepantes, dá a deriva. O relógio de câmeras e gravadores diferentes deriva
   dezenas de ppm: 100 ppm somam 0,7 s num filme de duas horas. Se a deriva acumulada passa de
   meio quadro, é corrigida pela **velocidade** do clipe (tObra = início + tClipe × velocidade),
   aplicada na prévia (taxa de reprodução) e na entrega (`setpts`).
4. **Conferência.** Dois gráficos: as formas de onda do filme e do som-guia, espelhadas, numa
   janela de ±4 s em torno do cursor (picos alinhados = sincronia), com a correlação do trecho em
   texto; e o resíduo de cada trecho depois da correção, com uma faixa de ±½ quadro e uma tabela
   de dados. **De ouvido:** filme à esquerda e som-guia à direita, nos fones (descompasso soa
   como eco), ou cada um isolado. Ajuste fino por quadro, por segundo ou por velocidade.

Testado: sem deriva; deriva de relógio de +150 ppm em 20 min (medida entre 400 e 680 ms/h,
residual ≤ 15 ms); conversão 25↔23,976 qd/s em sinal sintético e **em mídia real** (som-guia
gerado pelo ffmpeg com 4,27% de aceleração: razão identificada, velocidade com erro < 0,001,
início com erro ≤ 40 ms).

### Proporção, espaço e enquadramento

- **Proporção:** NBR (no quadro 16:9, os mínimos de 1/4 × 1/2 dão 8:9), 3:4, 1:1 ou livre. Com
  uma proporção escolhida, a altura arrasta a largura, sempre respeitando os mínimos. A medida em
  pixels do master é mostrada.
- **Posição:** cantos e margem, com indicação de **área segura** (5% das bordas, convenção de
  broadcast), botão para encaixar e guia no monitor. A margem padrão (9% do lado menor) já fica
  dentro da área segura em 16:9 e 4:3. A margem anterior, de 2%, ficava fora; a verificação J7 o
  acusou.
- **Enquadramento automático:** em 16 quadros espalhados pelo clipe, recorta o fundo e une as
  silhuetas, medindo o **espaço de sinalização** (as mãos se movem). Calcula então zoom e
  deslocamento horizontal e vertical para caber na janela com folga. Objetos separados do corpo
  por um vão (tripé, refletor, borda do pano) ficam de fora e são reportados. Ajuste manual de
  zoom, horizontal e vertical.

### Recorte do fundo e tratamento

Cadeia única, na mesma ordem na prévia (CPU, `src/libras/tratamento.ts`) e na entrega (ffmpeg):

**chromakey → encolher matte → suavizar borda → cor → despill → recorte das bordas → escala**

- **Cor-chave:** detecção automática (mediana das bordas de 6 quadros, onde costuma haver só
  pano), conta-gotas no monitor (média 5×5) ou predefinições verde/azul.
- **Tolerância ajustada à cor do pano.** Tons neutros (a roupa preta do intérprete, cabelo, pele
  escura) ficam todos à mesma distância da chave: a saturação do verde. Um pano real é menos
  saturado que o verde puro. Com a tolerância padrão, a roupa preta ficava 35% transparente,
  achado do teste com clipe realista. A detecção e o conta-gotas ajustam tolerância e transição
  a 75% dessa distância, e a interface mostra a folga restante. **J8** aponta quando a tolerância
  alcança os neutros.
- **Borda:** encolher (erosão do matte, em px do clipe) tira a franja verde em volta do corpo;
  suavizar (desfoque gaussiano do matte) evita o serrilhado.
- **Recortar bordas do quadro:** para o que o verde não cobre (refletores, tripé).
- **Despill:** neutraliza o verde refletido na pele e na roupa (mistura e expansão, como no
  filtro do ffmpeg).
- **Correção do intérprete:** brilho, contraste e saturação, aplicados depois do recorte (não
  alteram a chave).
- **Visualização:** composição, **matte** (branco = intérprete; buracos e sobras de verde
  aparecem) e **sobre cinza** (revela franjas).

**Fidelidade prévia × entrega**, medida num quadro real com todos os controles ativos: 99,99% dos
pixels com o mesmo alfa e diferença média de cor de 2,9 níveis em 255 (conversões YUV/RGB). Num
clipe realista (verde irregular com ruído, tripé, mãos esverdeadas), o quadro entregue não tem
nenhum pixel verde remanescente. A prévia processa até 480 px de altura; o custo por quadro
aparece no rótulo da janela.

### Verificações

J1/J2 altura e largura mínimas · J3 sem clipe · J4 a janela não cobre a obra inteira · J5 invade a
faixa da LSE (heurística) · J6 sincronia não verificada ou de baixa confiança · J7 fora da área
segura · J8 tolerância do recorte alcança tons neutros.

**Norma.** ABNT NBR 15290:2005, com altura mínima de 1/2 e largura mínima de 1/4 da tela,
segundo fontes secundárias (INES, Câmara dos Deputados, MPF). **O texto integral da norma não foi
consultado.** Com 1/4 da largura, uma janela no canto já invade a faixa central em que a LSE
costuma aparecer (J5): a legenda precisa ser deslocada, ou isso deve ser aceito conscientemente.

**Limites.** O som-guia precisa existir no clipe: gravação muda não sincroniza sozinha (a
confiança sai baixa e o ajuste é manual). Clipes gravados em vários trechos, com cortes no meio,
ainda são tratados como um só (a análise por trechos mostra os pontos discrepantes, mas não
divide o clipe). O ProRes 4444 com canal alfa dispensaria o chroma, e isso ainda não é
aproveitado. Ainda não há exportação da sincronia para Premiere ou Resolve (XML).

## Entrega

Página **Entrega**: prontidão por etapa (em texto, com atalho para a página), arquivos avulsos
(LSE e relatório de QA; roteiro de AD em texto, VTT e CSV; mixagem e trilha de AD em WAV) e o
**pacote acessível**:

- **Com Libras:** MP4 (H.264 recodificado, CRF 18), janela queimada no vídeo.
- **Sem Libras:** MKV, com o vídeo copiado sem recompressão.
- **Faixas de áudio:** *Original* e *Audiodescrição* (AAC, `por`). O nome vai em `title` e em
  `handler_name`, porque MP4 lê o segundo.
- **Legenda:** *LSE*, com as decisões aprovadas na revisão (`mov_text` no MP4, SRT no MKV).

Testado com ffmpeg real: as faixas e os nomes são conferidos, e os pixels na região da janela
também, antes, durante e depois do clipe.

## Exportação para editores (Premiere e Resolve)

Quando a finalização acontece no editor do cliente, a sincronia da Libras sai como projeto de
intercâmbio, não queimada no vídeo. Página **Libras** (seção "Exportar para editores") ou
**Entrega** (aba "Editores"). A pasta escolhida recebe:

| Arquivo | Conteúdo |
|---|---|
| `<nome>-libras-alfa.mov` | janela de Libras já tratada (chroma, recorte, posição, escala), ProRes 4444 com alfa, quadro inteiro da obra, alinhada ao quadro 0 |
| `<nome>-premiere.xml` | FCP7 XML (xmeml v5): Premiere Pro e DaVinci Resolve |
| `<nome>-resolve.fcpxml` | FCPXML 1.8: DaVinci Resolve e Final Cut Pro |
| `LEIA-ME.txt` | como importar, cadência, avisos |

Sequência nos dois formatos: **V1** obra (com A1/A2), **V2** Libras com alfa, **V3** clipe bruto
do intérprete no ponto sincronizado, **desativado** (referência para quem quiser refazer o chroma
com as ferramentas do editor). O efeito não é traduzido para o keyer de cada programa: os
parâmetros não têm equivalência e o resultado divergiria da prévia; o pré-render garante
identidade com a entrega.

Limites conhecidos:

- **Velocidade ≠ 1** (deriva corrigida): o clipe bruto fica fora da sequência, com aviso. O
  arquivo com alfa já sai na velocidade certa.
- O som-guia do intérprete não entra na sequência.
- Obras com mais de dois canais: só A1/A2 são mapeados; o app avisa.
- Tamanho: ProRes 4444 de quadro inteiro, quase todo transparente, ocupa ~11 Mbit/s em 1080p
  (~10 GB para 2 h).

**Validação:** os dois XMLs são lidos pelo OpenTimelineIO (`otio-fcp-adapter` e
`otio-fcpx-xml-adapter`, via `desktop/validar_otio.py`) em `desktop/intercambio.test.ts`, que
confere trilhas, início, entrada e duração de cada clipe; o `.mov` é conferido por pixel (alfa
transparente antes do clipe e fora da janela, opaco no corpo). Os adaptadores não leem
`<enabled>` nem a cadência NTSC exata (truncam 23,976 para 23): esses pontos são conferidos no
texto do XML. **Não testado no Premiere nem no Resolve**: é a próxima verificação necessária.

## Proxy de edição

Masters de finalização chegam em formatos que o motor de vídeo do app não toca (ProRes, DNxHD/HR,
CineForm, MPEG-2, H.264 de 10 bits) ou que tocam mal (4K, mais de 50 Mb/s, 50/60 qd/s em alta
resolução). O estúdio sonda o arquivo (ffprobe) e decide:

- **Obrigatório** (formato não reproduzível): o proxy é gerado assim que o vídeo é aberto, em
  paralelo à análise do áudio. Até ficar pronto, um aviso sobre o monitor explica o motivo.
- **Recomendado** (HEVC, que depende de hardware; arquivos pesados): botão *Gerar proxy* no
  cabeçalho do monitor.
- **Dispensável:** nada a fazer.

O proxy é H.264 8 bits 4:2:0, no máximo 720p, com quadro-chave a cada 12 quadros (busca quadro a
quadro instantânea), AAC estéreo e mesma linha do tempo do original. Fica em `proxies/`, ao lado
do projeto, com nome derivado do caminho, do tamanho e da data do original; se já existir, é
reaproveitado. A geração é cancelável e escreve num arquivo provisório, renomeado ao fim.

O monitor, a detecção de cortes e a prévia de Libras usam o proxy. **A entrega usa sempre o
original:** a mixagem lê o áudio do master, e a composição da janela de Libras e a codificação
partem do vídeo original. O clipe do intérprete tem o mesmo tratamento (o ProRes 4444 é comum).

Testado com um master ProRes 422 Proxy de 10 bits, 1080p, 23,976 qd/s e áudio PCM de 24 bits:
o proxy sai em 1280×720 com a mesma duração; a entrega sai em 1920×1080 a 23,976 qd/s; ao
reabrir, o proxy é reaproveitado sem nova geração.

**Limites.** A trilha de timecode do master (por exemplo, 01:00:00:00) não é lida: a linha do
tempo começa em zero, no início do arquivo. No proxy, o áudio é a primeira faixa reduzida a
estéreo; masters com várias faixas mono (M&E, idiomas) precisam de escolha de faixa, ainda não
implementada. O ProRes 4444 com canal alfa dispensaria o chroma key, mas isso ainda não é
aproveitado.

## Interface

Tema escuro por padrão, com tema claro alternativo; layout de editor de vídeo com dashboard de
projetos, painéis, monitor, inspetor, linha do tempo multipista e páginas por etapa. Tokens,
componentes, padrões e a auditoria de partida estão em
[docs/design-system.md](docs/design-system.md).

Painéis com mais de um assunto usam **abas internas** (padrão WAI-ARIA), e o que precisa ficar
sempre à vista fica numa faixa fixa: na página de Legendas, a lista revisável, os apontamentos da
obra inteira e o lote com as métricas ficam em abas, com os contadores acima delas.

Os **painéis são redimensionáveis**: arraste as divisórias entre painel esquerdo, monitor e inspetor,
ou a do topo da linha do tempo (também pelo teclado, com foco na divisória: setas, Home/End; Enter
ou duplo clique restauram). As larguras ficam salvas por página; a altura da linha do tempo, para
todas.
**Edição na linha do tempo.** Legendas (ST) e blocos de AD (A2) se arrastam: o corpo move, as bordas
(6 px) aparam a entrada ou a saída, com encaixe no quadro e no cursor e sem invadir os vizinhos; mover um
bloco leva as gravações junto. Entrada e saída também são campos editáveis nos itens das listas
(`00:01:02,500`, `1:02,5` ou `00:01:02:12`). Editar o tempo de uma legenda reanalisa as regras e mantém
as decisões de apontamentos que não mudaram. Os takes ativos aparecem na trilha **A3 Locução**, com
forma de onda. A linha do tempo abre ajustada à obra (**Ajustar**, tecla 0); a **barra de espaço**
reproduz e pausa (exceto em campos de texto, caixas de seleção e botões focados pelo teclado; na sessão
de gravação, o espaço é do gravador).

Os botões à esquerda da barra superior **recolhem** o painel esquerdo, a linha do tempo e o
inspetor, e o menu **Layout** salva o arranjo com um nome e alterna entre layouts (prontos: "Padrão"
e "Foco no monitor").

O **dashboard** lista os projetos recentes, com miniatura gerada pelo ffmpeg a 10% da obra e o
estado de cada etapa, e permite filtrar, criar (o estúdio cria uma subpasta com o projeto e as
gravações) e abrir. O processo desktop só grava projetos em caminhos escolhidos pelo usuário em
diálogos do sistema ou já abertos por ele.

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
  libras/     janela de Libras: modelo, geometria e verificações, sincronia, chroma (puro)
  mapa/       mapa temporal: envelope de áudio, atividade, cortes, lacunas (puro) + camada de navegador
  nlp/        léxico de classes fechadas do pt-BR + segmentador, atrás de uma interface
  llm/        cliente opcional (Anthropic), atrás de feature flag
  export/     aplicação dos diffs aprovados, serialização, relatório de QA
  state/      estado da revisão (useReducer + contexto)
  ui/         interface: shell/ (dashboard, espaço de trabalho, barras), paginas/ (uma por
              etapa), ad/, libras/, tema/ (tokens), componentes de LSE
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
- Contraste dos tokens verificado em teste automatizado nos dois temas
  (`test/contraste.test.ts`). O acento (terra) é cor de componente; como texto, usa-se
  `terra-700`.

**Verificação feita:** axe-core (regras WCAG 2.0/2.1/2.2 A e AA + *best practices*) sem violações
no app desktop reformulado: dashboard e as quatro páginas no tema escuro, incluindo o modo de
gravação; dashboard, Legendas, Libras e Entrega no tema claro. Contraste de todos os tokens dos dois
temas verificado em `test/contraste.test.ts`. Diálogos modais tornam o fundo `inert`.

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

O Ouver Estúdio é **software livre**, sob a [GNU General Public License v3.0 ou posterior](LICENSE)
(GPL-3.0-or-later): pode ser usado, estudado, modificado e redistribuído; quem distribuir versões
modificadas precisa distribuí-las sob a mesma licença, com o código-fonte. © 2026 Ouver e
colaboradores. Componentes de terceiros mantêm as suas licenças: FFmpeg (GPL-3.0, embutido nos
instaladores; ver `resources/ffmpeg` e [`desktop/ffmpeg-embutido.json`](desktop/ffmpeg-embutido.json)),
Lucide (ISC), React (MIT) e demais dependências listadas no `package.json`.

Implementação independente dos parâmetros publicados pelo MinC/SAv e pelo grupo LEAD/UECE. Não é
produto oficial dessas instituições.
