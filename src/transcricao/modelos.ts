/**
 * Modelos do Whisper (formato ggml do whisper.cpp), baixados sob demanda do
 * repositório oficial no Hugging Face e conferidos por SHA-256 antes do uso.
 * Ficam no computador (pasta de dados do app), não no instalador.
 *
 * Tamanhos e somas: API do Hugging Face (ggerganov/whisper.cpp, árvore main).
 */
export interface ModeloWhisper {
  id: string;
  rotulo: string;
  descricao: string;
  arquivo: string;
  bytes: number;
  sha256: string;
  /** só para testes automatizados: não aparece na interface */
  teste?: boolean;
}

export const MODELOS_WHISPER: ModeloWhisper[] = [
  {
    id: 'turbo',
    rotulo: 'Turbo (recomendado)',
    descricao: 'large-v3-turbo, quantizado: quase a precisão do maior, bem mais rápido.',
    arquivo: 'ggml-large-v3-turbo-q5_0.bin',
    bytes: 574041195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
  },
  {
    id: 'large-v3',
    rotulo: 'Máxima precisão',
    descricao: 'large-v3 completo: o mais preciso e o mais lento; vale com placa de vídeo ou Apple Silicon.',
    arquivo: 'ggml-large-v3.bin',
    bytes: 3095033483,
    sha256: '64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2',
  },
  {
    id: 'tiny',
    rotulo: 'Tiny (testes)',
    descricao: 'Só para testes automatizados.',
    arquivo: 'ggml-tiny.bin',
    bytes: 77691713,
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    teste: true,
  },
];

export const MODELO_WHISPER_PADRAO = 'turbo';
export const URL_MODELOS_WHISPER = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

export function modeloWhisper(id: string): ModeloWhisper | undefined {
  return MODELOS_WHISPER.find((m) => m.id === id);
}
