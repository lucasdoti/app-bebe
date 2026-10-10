// Web Push no PWA. No iPhone só funciona com o app instalado na tela inicial (iOS 16.4+).
import { Platform } from 'react-native';

import { supabase } from './supabase';

const CHAVE_PUBLICA = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type EstadoNotificacoes =
  | 'sem-suporte'
  | 'instalar-no-iphone'
  | 'bloqueadas'
  | 'desativadas'
  | 'ativadas';

const naWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

export function ehIPhone() {
  return naWeb() && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function instaladoNaTelaInicial() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function registrarServiceWorker() {
  if (!naWeb() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  if (!naWeb()) return 'sem-suporte';
  if (ehIPhone() && !instaladoNaTelaInicial()) return 'instalar-no-iphone';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueadas';
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao && Notification.permission === 'granted' ? 'ativadas' : 'desativadas';
}

function chaveParaBytes(base64: string) {
  const preenchido = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

// Precisa ser chamado a partir de um toque do usuário (exigência dos navegadores).
export async function ativarNotificacoes(): Promise<string | null> {
  if (!CHAVE_PUBLICA) return 'Chave de notificações não configurada.';
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return 'Permissão negada. Dá para liberar nos ajustes do navegador ou do celular.';
  const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
  const inscricao =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(CHAVE_PUBLICA) }));
  const json = inscricao.toJSON();
  const { error } = await supabase.rpc('salvar_inscricao_push', {
    p_endpoint: inscricao.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_dispositivo: navigator.userAgent,
  });
  return error ? error.message : null;
}

export async function desativarNotificacoes() {
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  if (!inscricao) return;
  await supabase.from('push_inscricoes').delete().eq('endpoint', inscricao.endpoint);
  await inscricao.unsubscribe();
}

export async function enviarTeste(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('enviar-lembretes', { body: { teste: true } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    return status
      ? `O servidor de lembretes respondeu com erro ${status}. Confira os Logs da função no Supabase.`
      : 'Não deu para falar com o servidor de lembretes (internet ou configuração da função).';
  }
  return data?.enviados ? null : 'Nenhum aparelho inscrito recebeu. Tente ativar de novo.';
}

// Quando alguém registra a dose ou a mamada, o aviso que estava na tela deste aparelho some.
export async function fecharNotificacoes(tag: string) {
  if (!naWeb() || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  for (const n of (await reg?.getNotifications({ tag })) ?? []) n.close();
}
