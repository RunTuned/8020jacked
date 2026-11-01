/* 8020jacked service worker.
   - Install: precache every app route's HTML, the Next.js chunks those pages load, fonts and icons.
   - Pages (navigations): stale-while-revalidate. A cached page opens at once (online or offline) and is
     refreshed in the background; a page never seen before comes from the network, then /offline.html.
   - /_next/static, /fonts, /icons, /media: stale-while-revalidate too (hashed files never change).
   - Client-side navigations fetch an RSC payload. Offline that fetch fails and Next.js falls back to a
     normal page load, which the cached page answers; so tapping through the tabs works offline.
   Bump VERSION to drop old caches. */
const VERSION = "v2";
const STATIC_CACHE = `8020-static-${VERSION}`;
const PAGE_CACHE = `8020-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** Every route that has a fixed URL. Dynamic ones (a meal, a move) are cached when visited. */
const ROUTES = [
  "/",
  "/today",
  "/today/week",
  "/today/weigh-in",
  "/today/away",
  "/today/welcome-back",
  "/food",
  "/food/list",
  "/food/cook",
  "/food/other",
  "/food/pickup",
  "/train",
  "/train/workout",
  "/train/set-aside",
  "/progress",
  "/progress/weight",
  "/progress/photos",
  "/progress/check-ins",
  "/progress/wins",
  "/check-in",
  "/check-in/done",
  "/plan-updated",
  "/you",
  "/you/goal",
  "/you/body",
  "/you/home",
  "/you/food",
  "/you/reminders",
  "/you/display",
  "/you/subscription",
  "/you/data",
  "/start",
  "/start/setup",
  "/start/back",
  "/start/browser",
  "/start/save",
  "/start/install",
  "/start/shared-phone",
  "/start/reminders",
  "/start/free-week",
  "/start/under-18",
];
const ASSETS = [OFFLINE_URL, "/manifest.webmanifest", "/fonts/PlusJakartaSans-Variable.ttf", "/icons/icon-192.png"];

/** The /_next/static files a page's HTML points at (scripts, styles, preloads). */
function staticUrls(html) {
  const out = new Set();
  const re = /["'(](\/_next\/static\/[^"'()\s\\]+)/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

async function precache() {
  const pages = await caches.open(PAGE_CACHE);
  const assets = await caches.open(STATIC_CACHE);
  await Promise.all(ASSETS.map((u) => assets.add(new Request(u, { cache: "reload" })).catch(() => undefined)));
  const chunks = new Set();
  await Promise.all(
    ROUTES.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: "reload", credentials: "same-origin" }));
        if (!res.ok || res.redirected) return;
        await pages.put(u, res.clone());
        staticUrls(await res.text()).forEach((c) => chunks.add(c));
      } catch {
        // Offline during install: this page is cached the first time it's opened instead.
      }
    }),
  );
  await Promise.all(
    [...chunks].map(async (u) => {
      if (await assets.match(u)) return;
      await assets.add(u).catch(() => undefined);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
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

/** Answer from the cache when we can, and refresh the cached copy from the network either way. */
async function staleWhileRevalidate(event, cacheName, key, fallback) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(key)) || (await cache.match(key, { ignoreSearch: true }));
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok && !res.redirected) return cache.put(key, res.clone()).then(() => res);
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  const res = await refresh;
  if (res) return res;
  return fallback ? fallback() : Response.error();
}

async function offlinePage() {
  return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // One cached copy per page: ?view= and ?from= only change what the page shows on the phone.
    event.respondWith(staleWhileRevalidate(event, PAGE_CACHE, url.pathname, offlinePage));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE, request, null));
  }
});
