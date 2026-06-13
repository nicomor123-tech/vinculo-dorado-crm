// Service worker del CRM Vínculo Dorado (PWA).
// Estrategia conservadora para no pelear con el deploy por zip de cPanel:
//  - Navegaciones (HTML): network-first SIEMPRE -> un deploy nuevo se ve de una;
//    el cache solo responde si no hay red (modo offline básico).
//  - /assets/ (bundles con hash en el nombre): cache-first (inmutables).
//  - Supabase y cualquier API: red directa, NUNCA se cachean (datos en vivo).
// Subir VERSION en cada deploy del frontend invalida los caches viejos.

const VERSION = 'vd-crm-v1-20260612';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(['/'])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Datos (Supabase, Telegram, APIs externas): siempre red, sin cache.
  if (url.origin !== self.location.origin) return;

  // Navegación (SPA): network-first con fallback al shell cacheado.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Bundles hasheados e íconos: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          }),
      ),
    );
  }
});
