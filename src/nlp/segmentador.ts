import type { MotorSegmentacao, PropostaQuebra } from './tipos';
import { classificar, normalizar, type Classe } from './lexico';

/**
 * Segmentador de superfície para o pt-BR.
 *
 * O que ele faz: identifica, entre duas palavras, se a quebra de linha separa
 * um regente de seu regido (determinante–núcleo, preposição–complemento,
 * conjunção–oração, auxiliar–principal, advérbio–verbo) e, quando separa,
 * procura o ponto de quebra de nível sintático mais alto disponível.
 *
 * O que ele NÃO faz: análise sintática completa. Não há parser de constituintes
 * nem etiquetagem morfossintática probabilística; a decisão vem da pertença a
 * classes fechadas. Por isso toda saída é uma sugestão com `confianca` < 1,
 * apresentada ao revisor, jamais aplicada automaticamente.
 *
 * Referências: os 14 tipos de erro de segmentação descritos pelo grupo LEAD/UECE
 * (sintagmas nominal, verbal, preposicional, adjetival, adverbial e orações
 * coordenada e subordinada), retomados no Guia MinC/SAv (2016);
 * KARAMITROGLOU (1998) para a hierarquia de pontos de quebra.
 */

/** Classes que, ao encerrarem uma linha, deixam seu regido órfão. */
const CLASSES_REGENTES: Record<string, { nivel: number; confianca: number; rotulo: string }> = {
  contracao: { nivel: 0, confianca: 0.85, rotulo: 'a contração (preposição + determinante)' },
  preposicao: { nivel: 0, confianca: 0.85, rotulo: 'a preposição' },
  determinante: { nivel: 0, confianca: 0.85, rotulo: 'o determinante' },
  conjuncao: { nivel: 0, confianca: 0.8, rotulo: 'a conjunção' },
  relativo: { nivel: 0, confianca: 0.8, rotulo: 'o pronome relativo' },
  pronome: { nivel: 0, confianca: 0.7, rotulo: 'o pronome' },
  auxiliar: { nivel: 0, confianca: 0.7, rotulo: 'o verbo auxiliar' },
  adverbio: { nivel: 0, confianca: 0.7, rotulo: 'o advérbio' },
};

const NOME_SINTAGMA: Record<string, string> = {
  contracao: 'sintagma preposicional',
  preposicao: 'sintagma preposicional',
  determinante: 'sintagma nominal',
  conjuncao: 'oração coordenada ou subordinada',
  relativo: 'oração subordinada adjetiva',
  pronome: 'sintagma verbal',
  auxiliar: 'sintagma verbal',
  adverbio: 'sintagma adverbial',
};

export /** Pronomes enclíticos: "-me", "-lo", "-se"… nunca abrem uma linha. */
const CLITICOS = /^-(me|te|se|lhe|lhes|nos|vos|o|a|os|as|lo|la|los|las|no|na|nos|nas)\b/i;

export interface Palavra {
  texto: string;
  classe: Classe;
  /** pontuação forte no fim da palavra */
  pontuacao: '' | 'forte' | 'media' | 'fraca';
}

function pontuacaoFinal(t: string): Palavra['pontuacao'] {
  const s = t.replace(/<\/?[^>]+>/g, '').trimEnd();
  if (/[.!?…]["'”’)\]]?$/.test(s)) return 'forte';
  if (/[;:]["'”’)\]]?$/.test(s)) return 'media';
  if (/,["'”’)\]]?$/.test(s)) return 'fraca';
  return '';
}

function tokenizar(texto: string): Palavra[] {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ texto: t, classe: classificar(t), pontuacao: pontuacaoFinal(t) }));
}

/** Comprimento visível (sem markup) de uma sequência de palavras. */
function comprimento(palavras: Palavra[]): number {
  return palavras
    .map((p) => p.texto)
    .join(' ')
    .replace(/<\/?[^>]+>/g, '').length;
}

/**
 * Nível sintático do ponto de quebra imediatamente antes de `palavras[k]`.
 * Retorna null quando a quebra é proibida (separa regente de regido).
 */
export function nivelDaQuebra(palavras: Palavra[], k: number): number | null {
  if (k <= 0 || k >= palavras.length) return null;
  const anterior = palavras[k - 1];
  const seguinte = palavras[k];

  // Palavra hifenizada partida ao meio, ou pronome enclítico solto.
  if (/[-–—]$/.test(anterior.texto)) return null;
  if (CLITICOS.test(seguinte.texto)) return null;

  // Pontuação encerra constituinte: a quebra é sempre legítima e de nível alto.
  if (anterior.pontuacao === 'forte') return 100;
  if (anterior.pontuacao === 'media') return 95;
  if (anterior.pontuacao === 'fraca') return 90;

  if (anterior.classe in CLASSES_REGENTES) return null;

  // Ponto de quebra antes do início de um novo constituinte.
  if (seguinte.classe === 'conjuncao') return 80;
  if (seguinte.classe === 'relativo') return 78;
  if (seguinte.classe === 'preposicao' || seguinte.classe === 'contracao') return 65;
  if (seguinte.classe === 'determinante') return 60;
  if (seguinte.classe === 'auxiliar' || seguinte.classe === 'pronome') return 55;
  if (seguinte.classe === 'adverbio') return 45;

  // Entre duas palavras de classe aberta: legítimo, porém de nível baixo
  // (pode partir núcleo + adjunto adjetival).
  return 25;
}

export class SegmentadorPtBr implements MotorSegmentacao {
  readonly nome = 'Chunking léxico-sintático de superfície (pt-BR)';
  readonly disponivel = true;

  avaliarQuebra(linhas: string[], maxCaracteresPorLinha: number): PropostaQuebra | null {
    if (linhas.length !== 2) return null;
    const primeira = linhas[0].trim();
    const segunda = linhas[1].trim();
    if (!primeira || !segunda) return null;

    // Legenda com dois falantes: as linhas são turnos distintos, não um
    // enunciado partido — a segmentação sintática não se aplica.
    if (/^\s*[-–—]/.test(linhas[0]) && /^\s*[-–—]/.test(linhas[1])) return null;

    const palavras = tokenizar(`${primeira} ${segunda}`);
    const kAtual = tokenizar(primeira).length;
    if (palavras.length < 3) return null;

    const nivelAtual = nivelDaQuebra(palavras, kAtual);
    if (nivelAtual !== null) return null; // quebra aceitável: nada a propor

    const regente = palavras[kAtual - 1];
    const infoRegente = CLASSES_REGENTES[regente.classe];

    // Procura o melhor ponto alternativo.
    interface Candidato { k: number; nivel: number; pontuacao: number; cabe: boolean }
    const candidatos: Candidato[] = [];
    for (let k = 1; k < palavras.length; k++) {
      if (k === kAtual) continue;
      const nivel = nivelDaQuebra(palavras, k);
      if (nivel === null) continue;
      const a = comprimento(palavras.slice(0, k));
      const b = comprimento(palavras.slice(k));
      const cabe = a <= maxCaracteresPorLinha && b <= maxCaracteresPorLinha;
      candidatos.push({ k, nivel, cabe, pontuacao: nivel * 10 - Math.abs(a - b) });
    }
    if (candidatos.length === 0) return null;

    const cabem = candidatos.filter((c) => c.cabe);
    const universo = cabem.length > 0 ? cabem : candidatos;
    universo.sort((x, y) => y.pontuacao - x.pontuacao);
    const escolhido = universo[0];

    const novas = [
      palavras.slice(0, escolhido.k).map((p) => p.texto).join(' '),
      palavras.slice(escolhido.k).map((p) => p.texto).join(' '),
    ];

    let confianca = infoRegente?.confianca ?? 0.6;
    if (escolhido.nivel < 40) confianca = Math.min(confianca, 0.5);
    if (cabem.length === 0) confianca = Math.min(confianca, 0.45);

    const sintagma = NOME_SINTAGMA[regente.classe] ?? 'sintagma';
    const rotulo = infoRegente?.rotulo ?? 'o termo';
    const diagnostico =
      `A quebra separa ${rotulo} "${normalizar(regente.texto) || regente.texto}" do termo que ele rege ` +
      `("${normalizar(palavras[kAtual].texto) || palavras[kAtual].texto}"), partindo um ${sintagma}; ` +
      'o Guia pede quebra no mais alto nível sintático possível.';

    return { linhas: novas, confianca: Number(confianca.toFixed(2)), diagnostico };
  }
}

/** Motor inerte: usado quando o módulo NLP está desligado na configuração. */
export class SegmentadorIndisponivel implements MotorSegmentacao {
  readonly nome = 'módulo de segmentação desligado';
  readonly disponivel = false;
  avaliarQuebra(): PropostaQuebra | null {
    return null;
  }
}
