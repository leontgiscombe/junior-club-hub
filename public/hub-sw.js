/* Service worker for the hub (scope /): shows club admins' and coaches' alerts when someone asks to join. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'New request to join', {
    body: data.body || 'Someone has asked to join. Tap to approve or decline.',
    icon: '/hub-icon-512.png',
    badge: '/hub-icon-180.png',
    tag: 'join-request',
    renotify: true,
    data: { url: data.url || '/admin/members' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/members';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('navigate' in c && 'focus' in c) return c.navigate(url).then((w) => (w || c).focus());
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
