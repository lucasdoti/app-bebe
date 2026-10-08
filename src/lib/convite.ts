import { lerPref, salvarPref } from './storage';

const CHAVE = 'convite_pendente';

// Guarda o código de um link de convite para usar depois do login.
export function guardarConvite(codigo: string) {
  salvarPref(CHAVE, formatarCodigo(codigo));
}

export function conviteGuardado() {
  return lerPref(CHAVE);
}

export function esquecerConvite() {
  salvarPref(CHAVE, null);
}

export function formatarCodigo(texto: string) {
  let codigo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (codigo.startsWith('BEBE')) codigo = codigo.slice(4);
  return codigo ? `BEBE-${codigo.slice(0, 6)}` : '';
}

export function linkDoConvite(codigo: string) {
  const origem = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  return `${origem}/convite/${codigo}`;
}
