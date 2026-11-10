import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Chaves de API lembradas neste computador, uma por provedor.
 *
 * Guardadas cifradas pelo sistema operacional (Electron safeStorage: DPAPI no
 * Windows, Keychain no macOS, libsecret/kwallet no Linux), num arquivo em
 * userData. Nunca vão para o projeto, para o localStorage nem para o
 * instalador: cada máquina da equipe digita a sua uma vez.
 *
 * Sem cifra disponível (Linux sem chaveiro, por exemplo), a gravação é
 * recusada: guardar em texto claro não é opção.
 */

const PROVEDORES = new Set(['maritaca', 'anthropic']);
const arquivo = () => join(app.getPath('userData'), 'chaves.json');

function ler(): Record<string, string> {
  try {
    return existsSync(arquivo()) ? (JSON.parse(readFileSync(arquivo(), 'utf-8')) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function gravar(dados: Record<string, string>) {
  mkdirSync(dirname(arquivo()), { recursive: true });
  writeFileSync(arquivo(), JSON.stringify(dados), { mode: 0o600 });
}

export function cifraDisponivel(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  // Linux sem chaveiro: o Electron cai num modo com senha fixa, que não protege nada
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') return false;
  return true;
}

export function lerChave(provedor: string): string | null {
  if (!PROVEDORES.has(provedor)) return null;
  const c = ler()[provedor];
  if (!c || !cifraDisponivel()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(c, 'base64'));
  } catch {
    return null; // cifrada por outro usuário ou outra máquina
  }
}

export function salvarChave(provedor: string, chave: string) {
  if (!PROVEDORES.has(provedor)) throw new Error('Provedor desconhecido.');
  if (!cifraDisponivel()) throw new Error('Este sistema não oferece armazenamento seguro; a chave não foi guardada.');
  const limpa = chave.trim();
  if (!limpa) return esquecerChave(provedor);
  gravar({ ...ler(), [provedor]: safeStorage.encryptString(limpa).toString('base64') });
}

export function esquecerChave(provedor: string) {
  const d = ler();
  if (!(provedor in d)) return;
  delete d[provedor];
  gravar(d);
}

export function provedoresLembrados(): string[] {
  return Object.keys(ler()).filter((p) => PROVEDORES.has(p));
}
