// Service worker del Modo Visita: guarda la página /visita.html y las demos de la ruta para usarlas sin internet.
// Lo que se anota se guarda en el celular (localStorage) y se sube desde la página al volver al Wi-Fi.
// v2 (2026-11-05): v1 servía JS viejo del panel en modo desarrollo; al activarse, la v2 borra esa caché.
const CACHE = "visita-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

const cacheFirst = async (req) => {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

const networkFirst = async (req) => {
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    // ignoreVary: Next agrega Vary (rsc, router...) y con eso la copia guardada no aparecería.
    const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    throw new Error("Sin conexión y sin copia guardada");
  }
};

// Solo atiende a la página de visitas y a las demos. El panel no se toca: pasa directo al servidor.
const offlinePage = (path) => path === "/visita.html" || /^\/demo\/[a-z0-9]{10}(\/|$)/.test(path);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode !== "navigate") e.respondWith(fromOfflinePage(e).then((ok) => (ok ? route(req, url) : fetch(req))));
  else if (offlinePage(url.pathname)) e.respondWith(route(req, url));
});

// ¿El pedido viene de la página de visitas o de una demo? (los archivos que pide el panel no pasan por la caché)
async function fromOfflinePage(e) {
  const client = e.clientId ? await self.clients.get(e.clientId) : null;
  return !!client && offlinePage(new URL(client.url).pathname);
}

function route(req, url) {
  // Fotos de las demos e íconos no cambian: si ya están, no se piden.
  if (/^\/demo\/[a-z0-9]{10}\/media\//.test(url.pathname) || url.pathname.startsWith("/icon")) return cacheFirst(req);
  // Código de Next (JS, CSS), la página de visitas y las demos: la versión nueva si hay conexión; si no, la guardada.
  // El código no va "caché primero": en modo desarrollo los archivos cambian sin cambiar de nombre y se servía una versión vieja.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/visita.html" || /^\/demo\/[a-z0-9]{10}$/.test(url.pathname)) return networkFirst(req);
  return fetch(req); // el resto (por ejemplo /api/visita/*) va directo, como antes
}
