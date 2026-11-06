/* Service worker: makes the app installable and usable offline,
   and handles clicks on prayer notifications. */
const CACHE = 'namaz-v1';
const SHELL = ['/', '/index.html', '/style.css', '/script.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png', '/icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* App files: network first (always fresh when online), cache as offline fallback.
   Prayer-time API calls are left to the page, which keeps its own saved copy. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});

/* Tapping a notification opens (or focuses) the app. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (action === 'stop') c.postMessage({ type: 'stop-alarm' });
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow('/');
  }));
});
