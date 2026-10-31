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

# Clipe sintético de intérprete de Libras: fundo verde (chroma), uma figura com
# "mãos" em movimento e, como som-guia, o áudio da obra a partir de 2 s — isto
# é, o clipe começa 2 s depois da obra (a sincronização deve encontrar +2,0 s).
interprete="$(dirname "$saida")/exemplo-interprete.webm"
ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x00B140:s=640x360:r=24:d=26" \
  -ss 2 -i "$saida" \
  -filter_complex "\
[0:v]drawbox=x=270:y=90:w=100:h=270:color=0x2B2B33:t=fill,\
drawbox=x=290:y=30:w=60:h=70:color=0xC68B6B:t=fill,\
drawbox=x='230+40*sin(t*4)':y='150+30*cos(t*3)':w=34:h=34:color=0xC68B6B:t=fill,\
drawbox=x='376+40*cos(t*3.5)':y='160+30*sin(t*4.5)':w=34:h=34:color=0xC68B6B:t=fill[v];\
[1:a]volume=0.5[a]" \
  -map "[v]" -map "[a]" -t 26 -c:v libvpx -b:v 200k -c:a libopus -b:a 32k "$interprete"
echo "$interprete"
