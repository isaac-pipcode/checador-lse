# Design system — Estúdio de Acessibilidade

Sistema visual do aplicativo desktop (Electron + React + Tailwind). Referências de interação:
editores de vídeo profissionais. O DaVinci Resolve inspirou as páginas por etapa, com barra
de páginas embaixo; o FilmCraft (suíte ArtCraft) inspirou o monitor sobre a linha do tempo
multipista. As referências são de padrões de interação, não de identidade visual: a marca
continua a do checador (navy, paper, terra).

## 1. Auditoria de partida

Situação antes da reformulação (tema único, claro, layout de página rolável).

**Componentes revisados:** 24 | **Problemas:** 5 | **Nota:** 62/100

| Problema | Onde | Decisão |
|---|---|---|
| Cores usadas pelo nome da marca em papéis semânticos (`text-navy-700` como "texto secundário": 54 usos; `border-paper-400` como "borda": 40) | todos os componentes | Tokens por **papel**, via variáveis CSS geradas de uma fonte única (`src/ui/tema/tokens.ts`) |
| 10 cores em hex soltas no código | linha do tempo (canvas), teleprompter | Canvas lê as variáveis CSS; teleprompter usa a paleta fixa `cabine` |
| 25 valores arbitrários do Tailwind | diversos | Mantidos onde são medidas de layout de componente (alturas de trilha); tipografia ganhou `text-2xs` |
| `navy-300` reprovava como texto (3,0:1 sobre paper) | rótulos sutis | Escurecido no tema claro (#5D6880); no escuro, #93939B (≥ 4,5:1) |
| Sem padrões de painel, inspetor, transporte | — | Criados (abaixo) |

## 2. Tokens

### Cor (por papel)

Fonte única: `src/ui/tema/tokens.ts` → variáveis `--c-*` → Tailwind (`tailwind.config.js`).
**Todos os pares são verificados em `test/contraste.test.ts`, nos dois temas.**

| Token | Papel | Escuro (padrão) | Claro |
|---|---|---|---|
| `fundo` | sulco entre painéis encostados; fundo das trilhas; campos | #0C0C0D | #EDE8DC |
| `paper` | superfície de painel | #1C1C1F | #FAF8F3 |
| `paper-200` | superfície elevada, cabeçalho de painel, hover | #27272B | #F2EEE4 |
| `paper-400` | separadores (decorativos, < 3:1 de propósito) | #3A3A40 | #E3DDCD |
| `navy` | tinta principal | #E6E6E9 | #1B2230 |
| `navy-700` | tinta secundária | #C4C4C9 | #2C3547 |
| `navy-500` | tinta terciária; borda de controle (≥ 3:1) | #A0A0A8 | #4A566E |
| `navy-300` | tinta sutil (≥ 4,5:1) | #8D94A3 | #5D6880 |
| `terra` | acento: cursor de reprodução, foco, ação primária | #E37B51 | #B85F3E |
| `terra-700` | acento como texto (timecode) | #F2A383 | #8E4227 |
| `ok` / `ok-100` | sucesso: texto / fundo | #62CC95 / #143024 | #1F6B4A / #E4F1EA |
| `warn` / `warn-100` | aviso | #E8B54C / #30290F | #8A5B00 / #FBF0DA |
| `bad` / `bad-100` | erro | #F4797F / #3A1B1F | #A3242B / #FBE6E7 |

Os nomes `navy` e `paper` foram herdados e são **papéis**: no tema escuro, `navy` é claro. Para
código novo, leia `navy` como "tinta" e `paper` como "superfície".

**Fixas** (não mudam com o tema): `preto` (#0A0B0D, fundo do monitor: a imagem é sempre o
elemento mais claro) e a paleta `cabine` do teleprompter (o locutor lê em ambiente escuro, em
outro monitor): `cabine`, `cabine-texto`, `cabine-suave`, `cabine-faixa`, `cabine-gravando`,
`cabine-preparo`/`-texto`, `cabine-ok`, `cabine-erro`.

### Tipografia

Escala densa de editor: 11 px (`text-2xs`) para metadados, 12–13 px para painéis e controles,
14 px ou mais para conteúdo editável (roteiro, legenda). Timecode e medidas em monoespaçada com
`tabular-nums`. Cabeçalhos de painel e de seção em caixa normal, 12 px, semibold, como no Resolve.

### Espaço, raio, elevação

Como no DaVinci Resolve: painéis **encostados e de canto reto**, separados por um sulco de 2 px na
cor `fundo`; o tema escuro é grafite **neutro** (sem matiz azul), para não tingir a leitura de cor
da imagem. Controles de 24 a 28 px de altura, raio de 3 px. Elevação só por superfície (`paper` →
`paper-200`), sem sombras, exceto em diálogos modais. O acento (`terra`) fica para o cursor de
reprodução, o timecode, o foco e a ação primária; deslizantes são finos e neutros.

### Ícones

Vetoriais, de traço único, desenhados num quadro de 24 com traço 1,75 e exibidos a 16 px (12–14 px ao
lado de texto pequeno, 18 px na barra de páginas e no botão de reproduzir). Fonte: Lucide (licença
ISC), importada ícone a ícone. O código não usa os nomes da biblioteca: `src/ui/icones.tsx` dá a
cada ícone um nome por **função** (`reproduzir`, `libras`, `aviso`), e trocar um desenho é mudar
uma linha ali. Cor sempre `currentColor`, para seguir o tema e o estado. Todo ícone é decorativo
(`aria-hidden`): o nome vem do rótulo do controle ou do texto ao lado, e estado nunca é só ícone ou
só cor. Gravar, reproduzir e pausar são preenchidos; o resto é contorno. Símbolos que fazem parte do
texto (→ entre timecodes, −¼ s, ≥) continuam texto.

**Libras** tem desenho próprio (`MaosLibras`, em `icones.tsx`): duas mãos em profundidade, a da
frente aberta e a de trás espelhada e encoberta por máscara, mais uma marca de movimento. Uma mão
só (o "hand" genérico) lê como "pare"; duas mãos em movimento leem como sinalização. Derivado do
traçado "hand" do Lucide, no mesmo quadro e com o traço compensado pela escala de cada mão. Testado
em 12, 16 e 18 px em densidade 1× (o caso pior), nos dois temas. **Pendente:** validar com
intérpretes e usuários surdos.

### Foco

Contorno de 2 px no acento (`terra`), com 2 px de folga, em todo elemento focável.

## 3. Componentes

| Componente | Arquivo | Variantes e estados | Acessibilidade |
|---|---|---|---|
| Botão | `index.css` (`.btn-*`) | primário (acento; no claro, navy), secundário, fantasma, ícone; desabilitado com opacidade 40% | ícones com `aria-label`; atalhos no `title` |
| Segmento | `.segmento` | `aria-pressed` = selecionado | estado anunciado pelo `aria-pressed` |
| Aba de página | `.aba` | `aria-current="page"` = barra de acento no topo | dentro de `nav` rotulado |
| Painel | `comum.tsx` (`Painel`) | cabeçalho fino + corpo rolável | `section` com `aria-label` |
| Painel com abas | `comum.tsx` (`PainelAbas`) | abas com marca de contagem (neutra, aviso, erro); faixa fixa opcional entre as abas e o conteúdo; última aba lembrada por painel | padrão WAI-ARIA de abas: `tablist`/`tab`/`tabpanel`, setas ←/→, Home/End, só a aba ativa na ordem de Tab |
| Seção de inspetor | `Secao` | faixa de cabeçalho que **recolhe** (▼/▶; estado lembrado por título); `dica` opcional atrás de "?" | `aria-labelledby`; o título é um botão com `aria-expanded`; o "?" tem `aria-expanded` e nome "Ajuda: <seção>" |
| Cabeçalho de trilha | `LinhaDoTempo.tsx` (`CabecaTrilha`) | faixa de cor, código (A1, ST, A2, V2) e nome | decorativo (`aria-hidden`): cada item da trilha já tem nome próprio |
| Deslizante | `Deslizante` | valor formatado; **marca de referência** (mínimo da norma) | `label` associado; a marca também vem em texto |
| Chip de estado | `.chip` | ok, aviso, erro, pendente | **sempre ícone + texto**, nunca só cor |
| Cartão de projeto | `Dashboard.tsx` | miniatura, data, estado por etapa | um botão por cartão, com nome acessível |

## 4. Padrões

**Espaço de trabalho (editor).** Grade com barra superior (projeto, salvar, tema), três
colunas (painel da etapa, **monitor**, **inspetor**), **linha do tempo multipista** em largura
total e **barra de páginas** embaixo (Projetos · Legendas · Audiodescrição · Libras · Entrega).
O monitor e a linha do tempo são compartilhados: trocar de página não recarrega o vídeo. A
largura das colunas varia por página: Libras privilegia o monitor; Legendas, a lista.

**Painéis redimensionáveis.** Divisórias entre painel esquerdo, monitor e inspetor, e no topo da
linha do tempo (`shell/divisorias.tsx`). O sulco visível tem 2 px e acende no acento ao passar o
mouse ou receber foco; a área de pegar tem 10 px. Padrão WAI-ARIA *window splitter*: `separator`
focável com valor, mínimo e máximo; setas movem 16 px (Shift: 64), Home/End vão aos limites, Enter
ou duplo clique restauram o padrão. Mínimos: painel esquerdo 240 px, inspetor 260, monitor 360,
linha do tempo 120 (abaixo da altura natural, as trilhas rolam). Larguras por página, altura da
linha do tempo global, salvas no armazenamento local; se a janela encolher, os painéis laterais
cedem antes do monitor.

**Recolher painéis e layouts nomeados.** Na barra superior, à esquerda, três botões de alternância
(`aria-pressed`: pressionado = visível) recolhem o painel esquerdo, a linha do tempo e o inspetor;
o monitor ocupa o espaço. Recolher esconde, não desmonta: o que estiver em curso no painel continua.
O menu **Layout** (painel de divulgação, não `role=menu`, porque tem campo de texto) mostra o layout
atual ou "personalizado", aplica os prontos ("Padrão", "Foco no monitor") e os salvos, salva o arranjo
atual com um nome (nomes dos prontos são reservados; nome existente vira "Substituir") e exclui os
salvos. Esc ou clique fora fecham e devolvem o foco ao botão. Um layout guarda larguras e recolhidos
de cada página e a altura e o recolhido da linha do tempo; fica no armazenamento local.

**Barras.** Superior fina (36 px), com o nome do projeto centralizado (o caminho vai na dica do
título). Barra de páginas embaixo com ícone sobre o rótulo e o estado da etapa em texto, centralizada;
"Projetos" à esquerda.

**Monitor.** Vídeo sobre `preto`. Cabeçalho com o nome do clipe ao centro e o timecode SMPTE
(HH:MM:SS:QQ) grande, no acento, à direita. Abaixo da imagem, uma barra de posição (alvo de 24 px) e
o transporte centralizado (início, quadro a quadro, reproduzir, fim); duração à esquerda, camadas
(LSE, Libras e AD audível) à direita.

**Linha do tempo.** Cabeçalho com o timecode à esquerda, "Acompanhar" e zoom (−, deslizante, +)
à direita; atalhos de teclado na ajuda "?". Cursor de reprodução com marcador na régua. Trilhas com
cabeçalho de cor e código, sobre fundo escuro: A1 Som (forma de onda, limiar, atividade, curva de ducking), ST Legendas
(pior severidade pendente), A2 Audiodescrição (janela do bloco + take), V2 Libras (clipe preenchido,
como um clipe de vídeo) e Lacunas. Cortes de plano em traço vertical. O trecho além do fim da obra fica sombreado. Ao
clicar num item de outra etapa, o app navega para a página dela.

**Um assunto por aba.** Painel com mais de um assunto usa abas internas, e cada aba responde a uma
pergunta: na lista de LSE, "o que revisar" (Legendas · Obra inteira · Lote e métricas); no
inspetor, "o que ajustar" (Vídeo · Regras · Assistente; Janela · Enquadramento · Fundo). O que
precisa ficar sempre visível (os contadores da revisão) fica numa faixa fixa acima do conteúdo,
não dentro de uma aba. Ações raras saem da superfície: os ajustes de janela de um bloco de AD
ficam em "Janela e opções", recolhido.

**Explicação sob demanda.** A superfície mostra controles, valores e estado; o porquê fica atrás de
um "?" no cabeçalho da seção (`Secao dica`, `BotaoDica`), fechado por padrão. Fica visível só o que
muda a decisão agora: medidas, avisos, o motivo de um botão estar desabilitado ("Falta o clipe do
intérprete."). Formato técnico vai como etiqueta curta à direita da opção (XML, FCPXML), não em
frase. A legenda da linha do tempo segue o mesmo padrão.

**Mostrar ajudas.** Para quem está começando: o botão "Ajudas" da barra superior (atalho F1) abre
todas as explicações de uma vez (`src/ui/ajudas.ts`). É preferência do usuário, não do projeto, e
fica salva como o tema. Cada "?" continua abrindo e fechando à mão; a escolha manual vale até o
modo mudar de novo. O botão usa `aria-pressed`.

**Proxy de edição.** O monitor mostra o que está tocando ("(proxy)" no nome), a descrição técnica
do original e a escolha Proxy/Original. Quando o original não é reproduzível, um aviso sobre a
imagem diz por que e oferece a saída. A entrega nunca usa o proxy.

**Gráficos.** Feitos com o procedimento da skill de visualização: forma antes da cor, um eixo
só, e cores de série como tokens próprios (`serie-1` azul, `serie-2` laranja), validados com o
script de paleta contra as superfícies dos dois temas (pior caso para daltonismo ΔE 24,7). O par
azul + aqua foi descartado: fraco para tritanopia (ΔE 4,0) e abaixo de 3:1 no tema claro. Texto
sempre em tinta, nunca na cor da série; cursor do gráfico em tinta neutra (o acento é do cursor da
obra); legenda e rótulos diretos para duas séries; dica ao passar o mouse; tabela de dados ou
equivalente textual (a correlação do trecho).

**Indicador de etapa.** Cada aba da barra de páginas traz o estado em texto ("3 erros", "1/4
gravados", "pronta"), com cor de reforço.

**Diálogo modal.** Fundo `inert` enquanto aberto (fora da ordem de foco e da árvore de
acessibilidade), Esc fecha, foco inicial no primeiro campo.

## 5. Verificação

- Contraste: `test/contraste.test.ts` (tokens dos dois temas e paleta fixa).
- axe-core 4 (WCAG 2.0/2.1/2.2 A e AA + *best practices*) no app desktop: dashboard, Legendas,
  Audiodescrição (roteiro e gravação), Libras e Entrega no tema escuro; dashboard, Legendas,
  Libras e Entrega no claro. **Sem violações.**
- **Pendente:** teste com leitor de tela real (NVDA/VoiceOver) e com usuários. A ferramenta
  automática cobre parte das falhas possíveis, não todas.

## 6. Questões em aberto

- Atalhos configuráveis: no macOS, `Ctrl/⌘+Espaço` colide com o sistema.
- Alto contraste (`prefers-contrast: more`) como terceiro tema.
