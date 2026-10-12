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

// The page a tapped alert is for, kept for a couple of minutes: an iPhone often
// opens (or brings back) the app on its last page whatever it's asked, so the
// app looks here itself when it opens or comes back on screen (NotificationNav).
const OPEN_CACHE = 'hub-open';
const OPEN_KEY = '/__hub-open';
async function rememberOpen(url) {
  try {
    const c = await caches.open(OPEN_CACHE);
    await c.put(OPEN_KEY, new Response(JSON.stringify({ url, at: Date.now() }), { headers: { 'content-type': 'application/json' } }));
  } catch {}
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/members';
  event.waitUntil((async () => {
    await rememberOpen(url);
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // the window on screen if there is one, else any of the app's
    const c = list.find((w) => w.focused) || list.find((w) => w.visibilityState === 'visible') || list[0];
    if (!c) { if (self.clients.openWindow) await self.clients.openWindow(url); return; }
    // the app's already open: bring it forward, then take it to the page. An iPhone can't
    // move a window itself (navigate), so the page is also asked to go there (NotificationNav).
    try { await c.focus(); } catch {}
    let moved = null;
    if ('navigate' in c) { try { moved = await c.navigate(url); } catch { moved = null; } }
    if (!moved) c.postMessage({ type: 'hub-open', url });
  })());
});
