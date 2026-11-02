"""Lê um XML do Final Cut 7 ou um FCPXML com o OpenTimelineIO e imprime um resumo
em JSON (trilhas, clipes, tempos em quadros, mídia referenciada). Usado nos testes
de desktop/intercambio.test.ts como validação independente dos arquivos gerados."""
import json
import sys

import opentimelineio as otio

caminho, adaptador = sys.argv[1], sys.argv[2]
obj = otio.adapters.read_from_file(caminho, adapter_name=adaptador)
tl = obj if isinstance(obj, otio.schema.Timeline) else obj.find_children(descended_from_type=otio.schema.Timeline)[0]
fps = tl.global_start_time.rate if tl.global_start_time else None
saida = {"nome": tl.name, "trilhas": []}
for trilha in tl.tracks:
    clipes = []
    for item in trilha:
        if not isinstance(item, otio.schema.Clip):
            continue
        rng = item.range_in_parent()
        ref = item.media_reference
        clipes.append({
            "nome": item.name,
            "inicio": round(rng.start_time.to_frames()),
            "duracao": round(rng.duration.to_frames()),
            "entrada": round(item.source_range.start_time.to_frames()) if item.source_range else None,
            "taxa": rng.start_time.rate,
            # segundos: o adaptador de FCPXML trunca a cadência NTSC para 23 ao converter,
            # então em NTSC os testes comparam segundos com tolerância de 1/23 s
            "inicio_s": round(rng.start_time.to_seconds(), 3),
            "duracao_s": round(rng.duration.to_seconds(), 3),
            "entrada_s": round(item.source_range.start_time.to_seconds(), 3) if item.source_range else None,
            "ativo": getattr(item, "enabled", True),
            "url": getattr(ref, "target_url", None),
        })
    saida["trilhas"].append({"tipo": trilha.kind, "clipes": clipes})
print(json.dumps(saida))
