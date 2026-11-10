/**
 * Leitura da saída JSON completa do whisper.cpp (`whisper-cli -ojf`):
 * `transcription[]` com segmentos e, em cada um, `tokens[]` com texto, tempos
 * (`offsets` em ms, quando há) e probabilidade `p`.
 *
 * Devolve palavras com tempo próprio. Tokens especiais (`[_BEG_]`, `[_TT_150]`)
 * saem; um token que começa com espaço abre palavra nova, os demais continuam a
 * anterior. Segmento sem tempos por token reparte o próprio tempo entre as
 * palavras, na proporção dos caracteres.
 */

export interface PalavraTranscrita {
  texto: string;
  inicioMs: number;
  fimMs: number;
  /** probabilidade média dos tokens (0..1) */
  p: number;
}

interface TokenJson {
  text?: string;
  offsets?: { from?: number; to?: number };
  p?: number;
}
interface SegmentoJson {
  offsets?: { from?: number; to?: number };
  text?: string;
  tokens?: TokenJson[];
}

const ESPECIAL = /^\s*\[_[A-Z_0-9]+\]\s*$|^\s*<\|[^|]*\|>\s*$/;

/**
 * Frases que o Whisper inventa em silêncio ou música, aprendidas de créditos de
 * legendas da internet. Saem só quando são o segmento inteiro.
 */
const ALUCINACOES = [
  /legendas? (pela|por) (comunidade|equipe)/i,
  /amara\.org/i,
  /^\s*(obrigad[oa] por assistir|inscreva-se( no canal)?|deixe (seu|o) like)[.!]?\s*$/i,
  /^\s*(\[?m[úu]sica\]?|♪+)\s*$/i,
];

export function ehAlucinacaoConhecida(texto: string): boolean {
  return ALUCINACOES.some((r) => r.test(texto.trim()));
}

export function palavrasDoWhisper(json: unknown): {
  palavras: PalavraTranscrita[];
  idioma: string | null;
  descartados: number;
} {
  const d = json as { transcription?: SegmentoJson[]; result?: { language?: string } };
  const palavras: PalavraTranscrita[] = [];
  let descartados = 0;
  for (const seg of d.transcription ?? []) {
    const ini = seg.offsets?.from ?? 0;
    const fim = seg.offsets?.to ?? ini;
    if (seg.text && ehAlucinacaoConhecida(seg.text)) {
      descartados++;
      continue;
    }
    const tokens = (seg.tokens ?? []).filter((t) => t.text && !ESPECIAL.test(t.text));
    const comTempo = tokens.length > 0 && tokens.every((t) => typeof t.offsets?.from === 'number');
    if (comTempo) {
      let atual: (PalavraTranscrita & { n: number }) | null = null;
      for (const t of tokens) {
        const txt = t.text!;
        const novo = /^\s/.test(txt) || !atual;
        const a = t.offsets!.from!;
        const b = Math.max(a, t.offsets!.to ?? a);
        if (novo) {
          if (atual && atual.texto.trim()) palavras.push(limpar(atual));
          atual = { texto: txt.trim(), inicioMs: a, fimMs: b, p: t.p ?? 1, n: 1 };
        } else {
          atual!.texto += txt;
          atual!.fimMs = Math.max(atual!.fimMs, b);
          atual!.p += t.p ?? 1;
          atual!.n++;
        }
      }
      if (atual && atual.texto.trim()) palavras.push(limpar(atual));
    } else {
      // sem tempos por token: reparte o segmento pelas palavras
      const ws = (seg.text ?? '').trim().split(/\s+/).filter(Boolean);
      const total = ws.reduce((s, w) => s + w.length + 1, 0) || 1;
      let t = ini;
      for (const w of ws) {
        const dur = ((fim - ini) * (w.length + 1)) / total;
        palavras.push({ texto: w, inicioMs: Math.round(t), fimMs: Math.round(t + dur), p: 1 });
        t += dur;
      }
    }
  }
  return { palavras, idioma: d.result?.language ?? null, descartados };
}

function limpar(w: PalavraTranscrita & { n: number }): PalavraTranscrita {
  return { texto: w.texto.trim(), inicioMs: w.inicioMs, fimMs: w.fimMs, p: Number((w.p / w.n).toFixed(3)) };
}
