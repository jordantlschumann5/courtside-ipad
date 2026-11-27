const CACHE_PREFIX = 'courtside-shell-';
const CACHE = CACHE_PREFIX + 'v27';
const APP_ROOT = new URL('./',self.location.href);
const INDEX = new URL('index.html',APP_ROOT);
const ASSETS = [
  './index.html', './styles.css?v=27', './app.js?v=27', './layout-editor.js?v=27',
  './layout-model.js?v=27', './core.js?v=16', './setup.js?v=18', './overview.js?v=16',
  './storage.js?v=16', './calculator.js?v=16', './manifest.webmanifest', './icon.svg'
];
self.addEventListener('install', event => {
  const requests = ASSETS.map(path => new Request(new URL(path,APP_ROOT),{cache:'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function openApp(request) {
  const response = await fetch(request,{cache:'no-cache'}).catch(() => null);
  if (response && response.status < 500) return response;
  const cached = await caches.match(INDEX.href,{cacheName:CACHE});
  return cached || response || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_ROOT.origin) return;
  if (request.mode === 'navigate' && (url.pathname === APP_ROOT.pathname || url.pathname === INDEX.pathname)) {
    event.respondWith(openApp(request));
    return;
  }
  event.respondWith(caches.match(request,{cacheName:CACHE}).then(cached => cached || fetch(request)));
});
