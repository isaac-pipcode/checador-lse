# Marca — Ouver Estúdio

**Nome.** *Ouver* junta **ouvir** e **ver**: os dois sentidos para os quais o estúdio produz
acessibilidade (legenda e Libras para quem não ouve, audiodescrição para quem não vê). *Estúdio*
diz o que é: lugar de produção. Escreve-se **Ouver Estúdio**, com acento; em nomes de arquivo,
`Ouver-Estudio`.

**Símbolo.** Um olho, arredondado o bastante para também ler como a letra **O**, de onde sai uma
onda de som. O olho fica na cor do texto; a pupila e a onda, no acento terra. Desenhado num quadro de
24 com traço 2,4; a mesma geometria está em `src/ui/shell/Marca.tsx` (constante `SIMBOLO`).

| Arquivo | Uso |
|---|---|
| `simbolo.svg` / `simbolo-negativo.svg` | símbolo sobre fundo claro / escuro |
| `logotipo.svg` / `logotipo-negativo.svg` | símbolo + nome, para documentos e apresentações |
| `icone-app.svg` (= `build/icon.svg`) | ícone do aplicativo: quadro arredondado navy, grade do macOS (824/1024) |
| `public/favicon.svg` | favicon (modo navegador) |

**Cores.** Navy `#1B2230` · terra `#E37B51` · papel `#FAF8F3` (herdadas da paleta Ouver; ver
`src/ui/tema/tokens.ts`).

**Uso.** Tamanho mínimo do símbolo: 16 px (testado em 16, 24, 32 e 64 px, nos dois fundos). Área de
respiro: metade da altura do símbolo em volta. Não trocar as cores entre olho e onda, não girar,
não contornar. O nome no app é texto real (lido por leitores de tela), não imagem; o logotipo em SVG
usa a fonte do sistema e, para material impresso, deve ser convertido em curvas.

**Pendente.** Busca de anterioridade no INPI (classes 9 e 42) antes de registrar; a busca na web não
achou produto homônimo no setor.
