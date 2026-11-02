import { openSync, writeSync, closeSync } from 'node:fs';

/** Escritor de WAV PCM 24 bits em streaming; o cabeçalho é corrigido no fim. */
export class EscritorWav {
  private fd: number;
  private bytesDados = 0;
  saturadas = 0;

  constructor(
    caminho: string,
    private canais: number,
    private taxa: number,
  ) {
    this.fd = openSync(caminho, 'w');
    writeSync(this.fd, this.cabecalho(0));
  }

  private cabecalho(dados: number): Buffer {
    const b = Buffer.alloc(44);
    const blocoAlinhado = this.canais * 3;
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + dados, 4);
    b.write('WAVE', 8);
    b.write('fmt ', 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(this.canais, 22);
    b.writeUInt32LE(this.taxa, 24);
    b.writeUInt32LE(this.taxa * blocoAlinhado, 28);
    b.writeUInt16LE(blocoAlinhado, 32);
    b.writeUInt16LE(24, 34);
    b.write('data', 36);
    b.writeUInt32LE(dados, 40);
    return b;
  }

  /** amostras float intercaladas em [-1, 1]; acima disso, satura e conta */
  escrever(amostras: Float32Array) {
    const b = Buffer.alloc(amostras.length * 3);
    for (let i = 0; i < amostras.length; i++) {
      let v = amostras[i];
      if (v > 1 || v < -1) {
        this.saturadas++;
        v = v > 1 ? 1 : -1;
      }
      const int = Math.round(v * 8388607);
      b.writeIntLE(int, i * 3, 3);
    }
    writeSync(this.fd, b);
    this.bytesDados += b.length;
  }

  fechar() {
    writeSync(this.fd, this.cabecalho(this.bytesDados), 0, 44, 0);
    closeSync(this.fd);
  }
}
