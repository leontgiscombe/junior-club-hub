/* Service worker for Financial Admin (/finance) — shows the monthly subs reminder notifications. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Subs reminder';
  const options = {
    body: data.body || "Time to check this month's subs and chase anyone who hasn't paid.",
    icon: '/finance/icon-192.png',
    badge: '/finance/icon-192.png',
    tag: 'subs-reminder',
    data: { url: data.url || '/finance' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/finance';
  event.waitUntil((async () => {
    // kept for the app to open itself when it comes on screen, as the hub's
    // alerts are (public/hub-sw.js, NotificationNav): an iPhone often reopens
    // the app on its last page whatever it's asked
    try {
      const cache = await caches.open('hub-open');
      await cache.put('/__hub-open', new Response(JSON.stringify({ url, at: Date.now() }), { headers: { 'content-type': 'application/json' } }));
    } catch {}
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = list.find((w) => w.focused) || list.find((w) => w.visibilityState === 'visible') || list[0];
    if (!c) { if (self.clients.openWindow) await self.clients.openWindow(url); return; }
    try { await c.focus(); } catch {}
    let moved = null;
    if ('navigate' in c) { try { moved = await c.navigate(url); } catch { moved = null; } }
    if (!moved) c.postMessage({ type: 'hub-open', url });
  })());
});
