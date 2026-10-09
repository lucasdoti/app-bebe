// Service worker do Colinho: recebe os lembretes (Web Push) e abre o app no lugar certo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let aviso = { titulo: 'Colinho', corpo: '', tag: 'colinho', url: '/' };
  try {
    aviso = { ...aviso, ...evento.data.json() };
  } catch {
    // Mensagem sem JSON: mostra o aviso padrão.
  }
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo,
      tag: aviso.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('focus' in j) {
          j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
