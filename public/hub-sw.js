/* Service worker for the hub (scope /): shows club admins' and coaches' alerts —
   someone asking to join, a parent asking for kit — and opens the right page
   when one is tapped. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const url = data.url || '/admin/members';
  event.waitUntil(self.registration.showNotification(data.title || 'New request to join', {
    body: data.body || 'Someone has asked to join. Tap to approve or decline.',
    icon: '/hub-icon-512.png',
    badge: '/hub-icon-180.png',
    // one per kind of alert, so a kit request doesn't replace a join request
    tag: url.split('?')[0],
    renotify: true,
    data: { url }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/members';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const c = list[0];
      if (!c) return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
      // the app's already open: bring it forward, then take it to the page. An iPhone can't
      // move a window itself (navigate), so the page is also asked to go there (NotificationNav).
      try { await c.focus(); } catch {}
      let moved = null;
      if ('navigate' in c) { try { moved = await c.navigate(url); } catch { moved = null; } }
      if (!moved) c.postMessage({ type: 'hub-open', url });
    })
  );
});
