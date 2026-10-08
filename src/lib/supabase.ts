import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { armazenamento } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const chavePublica = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(url, chavePublica, {
  auth: {
    storage: armazenamento,
    autoRefreshToken: true,
    persistSession: true,
    // No web o login com Google volta para o app com a sessão na URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Papel = 'mae' | 'pai' | 'outro';

export type Familia = {
  id: string;
  nome: string;
  codigo_convite: string;
};

export type Membro = {
  familia_id: string;
  user_id: string;
  nome: string;
  papel: Papel;
};

export const nomePapel: Record<Papel, string> = { mae: 'Mãe', pai: 'Pai', outro: 'Outro' };

// Traduz as mensagens de erro mais comuns do Supabase Auth.
export function mensagemDeErro(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro);
  const traducoes: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/user already registered/i, 'Este e-mail já tem conta. Toque em "Já tenho conta".'],
    [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/unable to validate email|invalid email/i, 'E-mail inválido.'],
    [/rate limit|too many requests/i, 'Muitas tentativas. Espere um pouco e tente de novo.'],
    [/failed to fetch|network/i, 'Sem conexão com a internet.'],
  ];
  return traducoes.find(([re]) => re.test(msg))?.[1] ?? msg;
}
