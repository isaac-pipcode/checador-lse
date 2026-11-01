import {
  ArrowRight,
  AudioLines,
  Captions,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  Ellipsis,
  Hand,
  LayoutGrid,
  Moon,
  Music2,
  PackageCheck,
  Pause,
  Pencil,
  Play,
  Scissors,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Sun,
  TriangleAlert,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ícones da interface: vetoriais, de traço único (Lucide, licença ISC), na cor
 * do texto (`currentColor`), para acompanharem o tema e os estados.
 *
 * O código usa nomes por FUNÇÃO ("reproduzir", "libras"), não pelo desenho:
 * trocar o desenho de uma função é mudar uma linha aqui.
 *
 * São decorativos (`aria-hidden`): o nome acessível vem sempre do rótulo do
 * controle ou do texto ao lado — nunca só do ícone (WCAG 1.1.1 e 1.4.1).
 */
const ICONES = {
  // páginas
  projetos: LayoutGrid,
  legendas: Captions,
  audiodescricao: AudioLines,
  libras: Hand,
  entrega: PackageCheck,
  // transporte
  inicio: SkipBack,
  quadroAnterior: StepBack,
  reproduzir: Play,
  pausar: Pause,
  quadroSeguinte: StepForward,
  fim: SkipForward,
  // barra superior e estrutura
  temaClaro: Sun,
  temaEscuro: Moon,
  ajuda: CircleHelp,
  aberto: ChevronDown,
  recolhido: ChevronRight,
  ir: ArrowRight,
  afastar: ZoomOut,
  aproximar: ZoomIn,
  // estados (sempre ao lado de texto)
  ok: Check,
  erro: X,
  aviso: TriangleAlert,
  pendente: Ellipsis,
  revisao: CircleHelp,
  rascunho: Pencil,
  // estado de etapa (dashboard e entrega)
  etapaVazia: Circle,
  etapaParcial: CircleDashed,
  etapaFeita: CircleCheck,
  som: Music2,
  // ações
  gravar: Circle,
  desfazer: Undo2,
  cortado: Scissors,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof ICONES;

/** Ícones preenchidos (o círculo de gravar é um ponto, como no gravador de qualquer editor). */
const PREENCHIDOS: Partial<Record<NomeIcone, true>> = { gravar: true, reproduzir: true, pausar: true };

export function Icone({
  nome,
  tamanho = 16,
  className = '',
}: {
  nome: NomeIcone;
  /** em px; 16 é o padrão do sistema, 14 dentro de chips e textos de 11–12 px */
  tamanho?: number;
  className?: string;
}) {
  const C = ICONES[nome];
  return (
    <C
      aria-hidden="true"
      focusable="false"
      width={tamanho}
      height={tamanho}
      strokeWidth={1.75}
      fill={PREENCHIDOS[nome] ? 'currentColor' : 'none'}
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    />
  );
}
