// Offline support: the whole app is cached on first load and served from cache after that.
// Bump VERSION whenever any file changes so phones pick up the new version.
// The personal copy registers this same file as sw.js?app=me with scope me/.
const APP = new URL(location).searchParams.get('app') === 'me' ? 'me' : 'public';
const VERSION = '1.3.0';
const CACHE = `skill-issue-${APP}-v${VERSION}`;
const SHARED = [
  'css/app.css',
  'js/main.js', 'js/config.js', 'js/constants.js', 'js/util.js', 'js/store.js', 'js/nav.js', 'js/files.js',
  'js/entry.js', 'js/record.js', 'js/graph.js', 'js/settings.js', 'js/filters.js', 'js/stats.js', 'js/demo.js', 'js/rs.js',
  'vendor/chart.umd.min.js', 'vendor/xlsx.full.min.js', 'vendor/html2canvas.min.js',
];
const OWN = APP === 'me'
  ? ['me/', 'me/index.html', 'me/manifest.webmanifest', 'icons/me-192.png', 'icons/me-512.png', 'icons/me-apple-touch-icon.png']
  : ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const HOME = APP === 'me' ? 'me/index.html' : 'index.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...SHARED, ...OWN])).then(() => self.skipWaiting()));
});

// Only clear this copy's old caches (and pre-1.3 unprefixed ones), never the other copy's
self.addEventListener('activate', e => {
  const mine = k => k.startsWith(`skill-issue-${APP}-`) || (APP === 'public' && /^skill-issue-v/.test(k));
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => mine(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match(HOME) : Response.error()))
  );
});
