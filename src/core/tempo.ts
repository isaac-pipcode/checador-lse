/**
 * Leitura de tempo digitado pela pessoa, nos formatos que editores usam:
 *   00:01:02,500 · 00:01:02.500 (SRT/VTT, milissegundos)
 *   00:01:02:12 (timecode SMPTE: o último campo são quadros, na cadência da obra)
 *   1:02,5 · 62,5 · 62 (minutos e segundos, ou só segundos, com decimais)
 * Devolve milissegundos, ou null se o texto não for um tempo válido.
 */
export function lerTempo(texto: string, fps = 24): number | null {
  const t = texto.trim().replace(/\s+/g, '');
  if (!t) return null;
  // SMPTE: quatro campos separados por ':' (ou ';' no drop-frame)
  const smpte = /^(\d{1,2})[:;](\d{1,2})[:;](\d{1,2})[:;](\d{1,3})$/.exec(t);
  if (smpte) {
    const [h, m, s, q] = smpte.slice(1).map(Number);
    if (m > 59 || s > 59 || q >= Math.ceil(fps)) return null;
    return Math.round((h * 3600 + m * 60 + s) * 1000 + (q * 1000) / fps);
  }
  const partes = t.split(':');
  if (partes.length > 3) return null;
  const ultimo = partes.pop()!.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(ultimo) || partes.some((p) => !/^\d+$/.test(p))) return null;
  const seg = Number(ultimo);
  const [h, m] = partes.length === 2 ? partes.map(Number) : [0, partes.length === 1 ? Number(partes[0]) : 0];
  if (partes.length >= 1 && seg >= 60) return null;
  if (partes.length === 2 && m > 59) return null;
  return Math.round(((h ?? 0) * 3600 + (m ?? 0) * 60 + seg) * 1000);
}
