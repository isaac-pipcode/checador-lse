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
| `navy-300` reprovava como texto (3,0:1 sobre paper) | rótulos sutis | Escurecido no tema claro (#5D6880); no escuro, #8D94A3 (≥ 4,5:1) |
| Sem padrões de painel, inspetor, transporte | — | Criados (abaixo) |

## 2. Tokens

### Cor (por papel)

Fonte única: `src/ui/tema/tokens.ts` → variáveis `--c-*` → Tailwind (`tailwind.config.js`).
**Todos os pares são verificados em `test/contraste.test.ts`, nos dois temas.**

| Token | Papel | Escuro (padrão) | Claro |
|---|---|---|---|
| `fundo` | fundo do app, atrás dos painéis; campos | #101216 | #EDE8DC |
| `paper` | superfície de painel | #1A1D23 | #FAF8F3 |
| `paper-200` | superfície elevada, cabeçalho de painel, hover | #23272F | #F2EEE4 |
| `paper-400` | separadores (decorativos, < 3:1 de propósito) | #343945 | #E3DDCD |
| `navy` | tinta principal | #E8EAF0 | #1B2230 |
| `navy-700` | tinta secundária | #C5CAD4 | #2C3547 |
| `navy-500` | tinta terciária; borda de controle (≥ 3:1) | #9EA5B3 | #4A566E |
| `navy-300` | tinta sutil (≥ 4,5:1) | #8D94A3 | #5D6880 |
| `terra` | acento: cursor de reprodução, foco, ação primária | #E37B51 | #B85F3E |
| `terra-700` | acento como texto (timecode) | #F2A383 | #8E4227 |
| `ok` / `ok-100` | sucesso: texto / fundo | #62CC95 / #14302A | #1F6B4A / #E4F1EA |
| `warn` / `warn-100` | aviso | #E8B54C / #322A13 | #8A5B00 / #FBF0DA |
| `bad` / `bad-100` | erro | #F4797F / #3A1B20 | #A3242B / #FBE6E7 |

Os nomes `navy` e `paper` foram herdados e são **papéis**: no tema escuro, `navy` é claro. Para
código novo, leia `navy` como "tinta" e `paper` como "superfície".

**Fixas** (não mudam com o tema): `preto` (#0A0B0D, fundo do monitor: a imagem é sempre o
elemento mais claro) e a paleta `cabine` do teleprompter (o locutor lê em ambiente escuro, em
outro monitor): `cabine`, `cabine-texto`, `cabine-suave`, `cabine-faixa`, `cabine-gravando`,
`cabine-preparo`/`-texto`, `cabine-ok`, `cabine-erro`.

### Tipografia

Escala densa de editor: 11 px (`text-2xs`) para metadados, 12–13 px para painéis e controles,
14 px ou mais para conteúdo editável (roteiro, legenda). Timecode e medidas em monoespaçada com
`tabular-nums`. Cabeçalhos de painel em caixa-alta, 12 px, `tracking-wide`.

### Espaço, raio, elevação

Painéis com raio de 6 px e intervalo de 6 px entre painéis (`gap-1.5`). Controles com 28 a
32 px de altura. Elevação só por superfície (`paper` → `paper-200`), sem sombras, exceto em
diálogos modais.

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
| Seção de inspetor | `Secao` | título em caixa-alta | `aria-labelledby` |
| Deslizante | `Deslizante` | valor formatado; **marca de referência** (mínimo da norma) | `label` associado; a marca também vem em texto |
| Chip de estado | `.chip` | ok, aviso, erro, pendente | **sempre ícone + texto**, nunca só cor |
| Cartão de projeto | `Dashboard.tsx` | miniatura, data, estado por etapa | um botão por cartão, com nome acessível |

## 4. Padrões

**Espaço de trabalho (editor).** Grade com barra superior (projeto, salvar, tema), três
colunas (painel da etapa, **monitor**, **inspetor**), **linha do tempo multipista** em largura
total e **barra de páginas** embaixo (Projetos · Legendas · Audiodescrição · Libras · Entrega).
O monitor e a linha do tempo são compartilhados: trocar de página não recarrega o vídeo. A
largura das colunas varia por página: Libras privilegia o monitor; Legendas, a lista.

**Monitor.** Vídeo sobre `preto`, com camadas alternáveis no transporte (LSE, Libras e AD
audível) e timecode SMPTE (HH:MM:SS:QQ) no acento. Botões de quadro a quadro.

**Linha do tempo.** Trilhas: Som (forma de onda, limiar, atividade, curva de ducking), Legendas
(pior severidade pendente), Audiodescrição (janela do bloco + take), Libras (trecho do clipe) e
Lacunas. Cortes de plano em traço vertical. O trecho além do fim da obra fica sombreado. Ao
clicar num item de outra etapa, o app navega para a página dela.

**Um assunto por aba.** Painel com mais de um assunto usa abas internas, e cada aba responde a uma
pergunta: na lista de LSE, "o que revisar" (Legendas · Obra inteira · Lote e métricas); no
inspetor, "o que ajustar" (Vídeo · Regras · Assistente; Janela · Enquadramento · Fundo). O que
precisa ficar sempre visível (os contadores da revisão) fica numa faixa fixa acima do conteúdo,
não dentro de uma aba. Ações raras saem da superfície: os ajustes de janela de um bloco de AD
ficam em "Janela e opções", recolhido.

**Proxy de edição.** O monitor mostra o que está tocando ("(proxy)" no nome), a descrição técnica
do original e a escolha Proxy/Original. Quando o original não é reproduzível, um aviso sobre a
imagem diz por que e oferece a saída. A entrega nunca usa o proxy.

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

- Painéis redimensionáveis (arrastar divisórias) e layouts salvos por usuário, como nos editores
  de referência.
- Atalhos configuráveis: no macOS, `Ctrl/⌘+Espaço` colide com o sistema.
- Alto contraste (`prefers-contrast: more`) como terceiro tema.
