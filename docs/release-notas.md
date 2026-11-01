Primeira versão desktop do **Ouver Estúdio**: legendagem para surdos e ensurdecidos (LSE),
audiodescrição e janela de Libras numa mesma linha do tempo.

## Instaladores

| Sistema | Arquivo |
|---|---|
| Windows 10/11 (64 bits) | `Ouver-Estudio-…-win-x64.exe` |
| macOS (Apple Silicon) | `Ouver-Estudio-…-mac-arm64.dmg` |
| macOS (Intel) | `Ouver-Estudio-…-mac-x64.dmg` |
| Linux | `Ouver-Estudio-…-linux-x86_64.AppImage` ou `…-linux-amd64.deb` |

## Antes de instalar

- **ffmpeg é necessário** e não vem no instalador. macOS: `brew install ffmpeg`. Windows:
  `winget install Gyan.FFmpeg`. Linux: `sudo apt install ffmpeg`. O app procura nos locais usuais e
  no PATH; para outro lugar, defina `OUVER_FFMPEG` com o caminho do executável.
- **Os instaladores ainda não são assinados.** No macOS, abra pela primeira vez com clique direito →
  Abrir. No Windows, em "O Windows protegeu o computador", clique em "Mais informações" → "Executar
  assim mesmo".

## O que tem

Revisão de LSE com regras do Guia para Produções Audiovisuais Acessíveis; roteiro, teleprompter e
gravação de audiodescrição com mixagem e medição de loudness; janela de Libras com chroma key,
enquadramento e sincronização pelo som-guia; pacote acessível e exportação da sincronia para
Premiere e DaVinci Resolve. Detalhes no README.
