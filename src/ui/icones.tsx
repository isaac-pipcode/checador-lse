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
  LayoutGrid,
  LayoutTemplate,
  Moon,
  Music2,
  PackageCheck,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pause,
  Pencil,
  Play,
  Scissors,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Sun,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import { useId } from 'react';

/*
 * Mãos sinalizando (Libras): desenho próprio, no mesmo quadro 24×24 e traço do
 * conjunto. Duas mãos em profundidade — a da frente aberta, a de trás espelhada
 * e parcialmente encoberta (máscara) — e uma marca de movimento. Uma mão só, como
 * o "hand" genérico, lê como "pare"; duas mãos em movimento leem como sinalização.
 * A mão base deriva do traçado "hand" do Lucide (ISC).
 */
const MAO = [
  'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2',
  'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8',
  'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
];
/** silhueta da mão da frente: o que ela encobre da mão de trás */
const SILHUETA =
  'M6 6a2 2 0 0 1 4-1.5a2 2 0 0 1 4 -1a2 2 0 0 1 4 2a2 2 0 0 1 4 1.5v8a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 14Z';
const FRENTE = { x: 6, y: 6, escala: 0.72 };
const TRAS = { x: 15.2, y: 1, escala: 0.62 };

function MaosLibras({ width, height, strokeWidth = 1.75, className, ...resto }: LucideProps) {
  const mascara = `maos-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const sw = Number(strokeWidth);
  const tracos = (escala: number) => (
    <g strokeWidth={sw / escala}>
      {MAO.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...resto}
    >
      <defs>
        <mask id={mascara} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path
            d={SILHUETA}
            transform={`translate(${FRENTE.x} ${FRENTE.y}) scale(${FRENTE.escala})`}
            fill="black"
            stroke="black"
            strokeWidth={(sw / FRENTE.escala) * 3.2}
          />
        </mask>
      </defs>
      <g mask={`url(#${mascara})`}>
        <g transform={`translate(${TRAS.x} ${TRAS.y}) scale(${-TRAS.escala} ${TRAS.escala})`}>{tracos(TRAS.escala)}</g>
      </g>
      <g transform={`translate(${FRENTE.x} ${FRENTE.y}) scale(${FRENTE.escala})`}>{tracos(FRENTE.escala)}</g>
      <path d="M19.6 2.6a5 5 0 0 1 2.6 3.9" />
    </svg>
  );
}

/**
 * Ícones da interface: vetoriais, de traço único (Lucide, licença ISC, e desenhos
 * próprios no mesmo padrão, como as mãos de Libras), na cor
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
  libras: MaosLibras,
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
  // painéis e layouts
  painelEsquerdo: PanelLeft,
  painelDireito: PanelRight,
  painelInferior: PanelBottom,
  layout: LayoutTemplate,
  excluir: Trash2,
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
} satisfies Record<string, LucideIcon | ((p: LucideProps) => JSX.Element)>;

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
