// Offline support: the whole app is cached on first load and served from cache after that.
// Bump VERSION whenever any file changes so phones pick up the new version.
const VERSION = 'skill-issue-v1.1.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/constants.js', 'js/util.js', 'js/store.js', 'js/nav.js', 'js/files.js',
  'js/entry.js', 'js/record.js', 'js/graph.js', 'js/settings.js', 'js/filters.js', 'js/stats.js', 'js/demo.js',
  'vendor/chart.umd.min.js', 'vendor/xlsx.full.min.js', 'vendor/html2canvas.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});
