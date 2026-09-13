const CACHE = "bez-tyagi-v2";
const APP_SHELL = [
  "/",
  "/app.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });

      if (cached) {
        // Обновляем кеш в фоне, но отвечаем мгновенно — приложение открывается офлайн.
        event.waitUntil(
          (async () => {
            try {
              const fresh = await fetch(request);
              if (fresh && fresh.ok) await cache.put(request, fresh.clone());
            } catch {
              /* офлайн — оставляем кеш */
            }
          })()
        );
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const fallback = await cache.match("/");
        if (fallback) return fallback;
        return new Response("Офлайн", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});
