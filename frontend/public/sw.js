const SHELL_CACHE = "islamic-companion-shell-v2";
const QURAN_CACHE = "islamic-companion-quran-v1";
const DEVELOPMENT_HOST = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

async function cacheResponse(cache, url, required) {
  try {
    const response = await fetch(new Request(url, { cache: "reload" }));
    if (!response.ok) throw new Error(`Request failed with ${response.status}.`);
    await cache.put(url, response.clone());
    return response;
  } catch (error) {
    if (required) throw error;
    console.warn(`Optional offline asset could not be cached: ${url}`, error);
    return null;
  }
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const indexResponse = await cacheResponse(cache, "/", true);
  await cache.put("/index.html", indexResponse.clone());

  const html = await indexResponse.text();
  const localAssets = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], self.location.origin))
    .filter(url => url.origin === self.location.origin)
    .map(url => `${url.pathname}${url.search}`);
  const requiredAssets = [...new Set(localAssets.filter(url => url.startsWith("/assets/")))];
  const optionalAssets = [...new Set([
    ...localAssets.filter(url => !url.startsWith("/assets/")),
    "/manifest.webmanifest",
    "/icon-192.png",
    "/icon-512.png",
  ])];

  await Promise.all(requiredAssets.map(url => cacheResponse(cache, url, true)));
  await Promise.all(optionalAssets.map(url => cacheResponse(cache, url, false)));
}

self.addEventListener("install", event => {
  if (DEVELOPMENT_HOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  if (DEVELOPMENT_HOST) {
    event.waitUntil(Promise.all([
      caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith("islamic-companion-"))
        .map(key => caches.delete(key)))),
      self.registration.unregister(),
      self.clients.matchAll({ type: "window" }).then(clients =>
        Promise.all(clients.map(client => client.navigate(client.url)))),
    ]));
    return;
  }
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys
      .filter(key => (key.startsWith("islamic-companion-shell-") && key !== SHELL_CACHE) ||
        (key.startsWith("islamic-companion-quran-") && key !== QURAN_CACHE))
      .map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const fallbackResponse = await cache.match(fallback);
      if (fallbackResponse) return fallbackResponse;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  if (DEVELOPMENT_HOST) return;
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isQuranData = /\/quran\/(?:directory|page\/\d+|verse\/\d+\/\d+\/page|tafseer\/\d+\/\d+)/.test(url.pathname);
  if (isQuranData) {
    event.respondWith(networkFirst(request, QURAN_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
    return;
  }

  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});
