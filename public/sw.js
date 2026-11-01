/* 8020jacked service worker.
   - App-shell static assets (/_next/static, /fonts, /icons, /media): cache first.
   - Pages (navigations): network first, cached copy when offline, then /offline.html.
   Bump VERSION to drop old caches. */
const VERSION = "v1";
const STATIC_CACHE = `8020-static-${VERSION}`;
const PAGE_CACHE = `8020-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/",
  "/manifest.webmanifest",
  "/fonts/PlusJakartaSans-Variable.ttf",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("8020-") && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = (await cache.match(request)) || (await caches.match(request));
    if (hit) return hit;
    return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
