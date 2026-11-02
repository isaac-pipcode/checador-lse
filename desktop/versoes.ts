/** Funções puras da atualização (testáveis sem o Electron). */

export const REPO = 'isaac-pipcode/checador-lse';

/** Como esta instalação se atualiza. */
export function modoDeAtualizacao(plataforma: NodeJS.Platform, env: NodeJS.ProcessEnv): 'automatica' | 'aviso' {
  if (plataforma === 'win32') return 'automatica';
  if (plataforma === 'linux' && env.APPIMAGE) return 'automatica';
  return 'aviso';
}

/** a > b em versão semântica (x.y.z); pré-lançamento (x.y.z-beta) vale menos que a versão final. */
export function maisNova(a: string, b: string): boolean {
  const ler = (v: string) => {
    const [nucleo, pre] = v.replace(/^v/, '').split('-', 2);
    const n = nucleo.split('.').map((x) => Number.parseInt(x, 10) || 0);
    return { n: [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0], pre: pre ?? null };
  };
  const x = ler(a);
  const y = ler(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] > y.n[i];
  if (x.pre === y.pre) return false;
  if (x.pre === null) return true;
  if (y.pre === null) return false;
  return x.pre > y.pre;
}

export const paginaDaVersao = (versao: string) => `https://github.com/${REPO}/releases/tag/v${versao.replace(/^v/, '')}`;

/** só abre páginas de release deste repositório */
export function urlPermitida(url: string): boolean {
  return url.startsWith(`https://github.com/${REPO}/releases`);
}

