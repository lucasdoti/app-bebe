// No web o navegador já tem localStorage. No celular nativo, ver storage.native.ts.
export const armazenamento = globalThis.localStorage;

export function lerPref(chave: string): string | null {
  try {
    return armazenamento?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

export function salvarPref(chave: string, valor: string | null) {
  try {
    if (valor === null) armazenamento?.removeItem(chave);
    else armazenamento?.setItem(chave, valor);
  } catch {
    // Modo privado ou armazenamento bloqueado: segue sem lembrar.
  }
}
