// Instala um localStorage persistente (SQLite) no iOS/Android.
import 'expo-sqlite/localStorage/install';

export const armazenamento = globalThis.localStorage;

export function lerPref(chave: string): string | null {
  try {
    return armazenamento.getItem(chave);
  } catch {
    return null;
  }
}

export function salvarPref(chave: string, valor: string | null) {
  try {
    if (valor === null) armazenamento.removeItem(chave);
    else armazenamento.setItem(chave, valor);
  } catch {
    // Segue sem lembrar.
  }
}
