/* Без Тяги — service worker: офлайн-доступ + условие установки PWA.
 * Пути считаются от папки, из которой отдаётся приложение (/bez-tyagi/ на
 * GitHub Pages), поэтому сборка не привязана к корню домена.
 */
const CACHE = "bez-tyagi-v3";

const SCOPE = self.registration.scope;
const resolve = (path) => new URL(path, SCOPE).toString();

const SHELL = resolve("./");
const SHELL_INDEX = resolve("./index.html");
const APP_SHELL = [
  SHELL,
  SHELL_INDEX,
  resolve("./manifest.json"),
  resolve("./icons/icon-192.png"),
  resolve("./icons/icon-512.png"),
  resolve("./icons/icon-maskable-512.png"),
  resolve("./icons/apple-touch-icon.png"),
  resolve("./icons/favicon.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Один отсутствующий файл не должен срывать всю предзагрузку.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

const isCacheable = (response) =>
  Boolean(response) && response.ok && response.type !== "opaque";

async function putInCache(request, response) {
  if (!isCacheable(response)) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
      await cache.put(SHELL_INDEX, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(SHELL)) || (await caches.match(SHELL_INDEX));
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>Без Тяги</title>" +
        "<body style=\"font-family:system-ui;padding:24px;text-align:center\">" +
        "<h1>Нет подключения</h1><p>Откройте приложение ещё раз, когда появится сеть.</p>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Сборка хеширует имена файлов, поэтому кеш можно отдавать сразу,
    // а обновление подтягивать в фоне.
    fetch(request)
      .then((response) => putInCache(request, response))
      .catch(() => undefined);
    return cached;
  }

  const response = await fetch(request);
  await putInCache(request, response);
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    request.mode === "navigate" ? handleNavigation(request) : handleAsset(request),
  );
});
