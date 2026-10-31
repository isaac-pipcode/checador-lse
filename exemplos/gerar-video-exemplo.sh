#!/usr/bin/env bash
# Gera um vídeo sintético (30 s, WebM VP8/Opus) para demonstrar o estúdio:
# três planos de cor (cortes em 8,0 s e 17,5 s), "falas" como tons na banda de
# voz, uma batida de porta e um trecho sonoro final sem legenda.
# Par: exemplos/exemplo-estudio.srt. Requer ffmpeg.
set -euo pipefail
saida="${1:-$(dirname "$0")/exemplo-estudio.webm}"
falas='between(t,1,3)+between(t,4,6.5)+between(t,9,12)+between(t,13,16)+between(t,19,21)+between(t,24,27)'
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x3a6ea5:s=320x180:r=24:d=8" \
  -f lavfi -i "color=c=0xb85f3e:s=320x180:r=24:d=9.5" \
  -f lavfi -i "color=c=0x1f6b4a:s=320x180:r=24:d=12.5" \
  -f lavfi -i "sine=frequency=330:sample_rate=48000:duration=30" \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.4:sample_rate=48000:duration=30" \
  -f lavfi -i "anoisesrc=color=white:amplitude=0.003:sample_rate=48000:duration=30" \
  -filter_complex "\
[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];\
[3:a]volume='0.5*gt(${falas},0)':eval=frame[voz];\
[4:a]volume='gt(between(t,7.2,7.6),0)':eval=frame[porta];\
[voz][porta][5:a]amix=inputs=3:normalize=0[a]" \
  -map "[v]" -map "[a]" -c:v libvpx -b:v 150k -c:a libopus -b:a 48k "$saida"
echo "$saida"
