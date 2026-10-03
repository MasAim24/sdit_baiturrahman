const SHELL = "sdit-shell-v3";
const PRECACHE = [
  "/",
  "/index.html",
  "/styles.css?v=26",
  "/app.js?v=26",
  "/logo.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/fonts/source-sans-400.woff2",
  "/fonts/source-sans-600.woff2",
  "/fonts/source-sans-700.woff2",
  "/fonts/source-serif-600.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && isShellAsset(url.pathname)) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

function isShellAsset(pathname) {
  return pathname.startsWith("/fonts/")
    || pathname.endsWith(".css")
    || pathname.endsWith(".js")
    || pathname.endsWith(".png")
    || pathname.endsWith(".webmanifest");
}
