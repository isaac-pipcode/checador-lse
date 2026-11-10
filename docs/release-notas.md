Versão desktop do **Ouver Estúdio**: legendagem para surdos e ensurdecidos (LSE), audiodescrição e
janela de Libras numa mesma linha do tempo.

**Novo na 0.1.3**:

- **Menu em português** (Arquivo, Editar, Exibir, Reprodução, Ajuda), com salvar, salvar como, ajudas
  (F1), tema, metodologia e atualizações; a barra superior fica mais limpa.
- **Importar legenda** e **importar o vídeo da intérprete de Libras** pelo menu Arquivo, de qualquer
  página; em Legendas, "Trocar legenda…" abre o diálogo direto.
- **Blocos de AD retráteis**: uma linha por bloco, abrindo só o que está em edição ("Abertos" mostra todos).
- **Monitor de gravação acoplado**: sem segundo monitor, o teleprompter divide a janela com a interface,
  com largura ajustável pela divisória.
- **Assistente de LSE pela Maritaca** (modelo S5, processado no Brasil); a Anthropic continua como opção.
  Corrigido: com o assistente ligado, o botão "Gerar proposta de redução" não aparecia.
- Corrigidos os botões de transporte, que se sobrepunham em monitores estreitos.

**Novo na 0.1.2** (correções a partir do primeiro uso real):

- A tela cabe em notebooks com escala de 125–150% (não é mais preciso rolar para os lados).
- A linha do tempo abre mostrando a obra inteira; botão **Ajustar** (tecla 0).
- **Barra de espaço** reproduz e pausa.
- **Gerar proxy** sempre disponível no monitor; vídeos pesados (acima de 20 Mb/s, 4K) mostram a sugestão ao abrir.
- O texto do bloco de AD aparece sobre a imagem.
- Gravação: o botão vira **Aprovar e gravar**; erros de microfone aparecem no topo da lista com o que fazer; os
  takes aparecem como trilha de áudio (**A3 Locução**) com forma de onda.
- **Escolha do microfone** visível no topo da lista de blocos (com botão Testar e medidor), salva no
  computador e atualizada ao conectar ou desconectar um microfone; se o escolhido sumir, usa o padrão e avisa.
- Legendas e blocos de AD podem ser **arrastados** na linha do tempo (corpo move, bordas aparam) e têm
  **entrada e saída editáveis** (aceita `00:01:02,500`, `1:02,5` ou timecode com quadros).
- Corrigida a lista de legendas, que ficava vazia com um vídeo aberto.

- **Atualização automática**: no Windows e no AppImage do Linux, versões novas são baixadas sozinhas e
  instaladas ao fechar o app (ou em "Reiniciar agora"); no macOS e no .deb, o app avisa e abre a página de
  download. Pode ser desligada em *Metodologia → Versão e atualizações*. **Esta é a última versão que
  precisa ser instalada à mão** (no Windows e no AppImage).
- O Ouver Estúdio passa a ser **software livre (GPL-3.0)**.

O ffmpeg continua embutido (desde a 0.1.1).

## Instaladores

| Sistema | Arquivo |
|---|---|
| Windows 10/11 (64 bits) | `Ouver-Estudio-…-win-x64.exe` |
| macOS (Apple Silicon) | `Ouver-Estudio-…-mac-arm64.dmg` |
| macOS (Intel) | `Ouver-Estudio-…-mac-x64.dmg` |
| Linux | `Ouver-Estudio-…-linux-x86_64.AppImage` ou `…-linux-amd64.deb` |

## Antes de instalar

- **O ffmpeg vai embutido** (versão 9.0.2). Para usar outro, defina `OUVER_FFMPEG` com o caminho do
  executável. Qual ffmpeg está em uso aparece em *Metodologia → Componentes de terceiros*.
- **Os instaladores ainda não são assinados.** No macOS, abra pela primeira vez com clique direito →
  Abrir. No Windows, em "O Windows protegeu o computador", clique em "Mais informações" → "Executar
  assim mesmo".

## O que tem

Revisão de LSE com regras do Guia para Produções Audiovisuais Acessíveis; roteiro, teleprompter e
gravação de audiodescrição com mixagem e medição de loudness; janela de Libras com chroma key,
enquadramento e sincronização pelo som-guia; pacote acessível e exportação da sincronia para
Premiere e DaVinci Resolve. Detalhes no README.

## Componentes de terceiros

O FFmpeg embutido é distribuído sob a **GNU GPL v3** (compilações de Martin Riedl para macOS e Linux e
de Gyan Doshi para Windows, com SHA-256 conferido no build). O código-fonte do FFmpeg está anexado a
esta release (`ffmpeg-9.0.2.tar.xz`); a licença, a origem e as somas ficam em `resources/ffmpeg` do
aplicativo instalado.
