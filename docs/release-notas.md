Versão desktop do **Ouver Estúdio**: legendagem para surdos e ensurdecidos (LSE), audiodescrição e
janela de Libras numa mesma linha do tempo.

**Novo na 0.1.1:** o ffmpeg vem embutido. Não é mais preciso instalar nada além do Ouver Estúdio.

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
