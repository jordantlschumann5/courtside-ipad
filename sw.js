const CACHE = 'courtside-shell-v9';
const ASSETS = ['./', './index.html', './styles.css?v=9', './app.js?v=9', './core.js?v=9', './setup.js?v=9', './overview.js?v=9', './storage.js?v=9', './calculator.js?v=9', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))]));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
