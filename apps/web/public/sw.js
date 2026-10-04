/*
 * grooph's service worker (stage 8): the app opens with no network once it has
 * been opened with one.
 *
 * The app is static files and keeps its documents in the browser, so being
 * offline needs only the files. On install this caches the page and the
 * scripts and styles it names. After that:
 *
 *   the page and other unhashed files   network first, the cached copy when offline,
 *                                       so a new deploy is picked up on the next visit
 *   /assets/ (hashed by the build)      the cached copy first: a name never changes its content
 *   /api/ (grooph watch's endpoints)    never touched: they are live
 *   /docs/ (the documents, static pages beside the app, handoff 0060)
 *                                       never touched: not the app, and a page of them must not become the app's cached index
 *   a navigation to any other file or folder beside the app (patterns/, experiments/, ...)
 *                                       never touched: only the app's own address, "./", is the app
 *   other origins, anything not a GET   never touched
 *
 * It stores nothing but grooph's own files, and sends nothing anywhere.
 */
const CACHE = "grooph-app-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch("./", { cache: "no-store" });
      if (page.ok) {
        const html = await page.clone().text();
        await cache.put("./", page);
        const named = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
          .map((m) => new URL(m[1], self.registration.scope))
          .filter((u) => u.origin === self.location.origin && u.href.startsWith(self.registration.scope));
        await Promise.all(named.map((u) => cache.add(u.href).catch(() => undefined)));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key.startsWith("grooph-app-")) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (url.pathname.includes("/api/")) return;
  // The documents are pages of their own. Answering their navigations with the app's index would show the app, and
  // storing them under "./" would make the app open as a document the next time it is opened with no network.
  const scopePath = new URL(self.registration.scope).pathname;
  if (url.pathname.startsWith(`${scopePath}docs/`)) return;
  if (request.mode === "navigate" && url.pathname !== scopePath && url.pathname !== `${scopePath}index.html`) return;

  const hashed = url.pathname.includes("/assets/");
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // A hash route is one page: every navigation is the app's index.
      // Matched by address alone: a server's Vary header would otherwise hide a file cached at install from the page asking for it.
      const key = request.mode === "navigate" ? "./" : url.href;
      const cached = () => cache.match(key, { ignoreVary: true, ignoreSearch: false });
      if (hashed) {
        const hit = await cached();
        if (hit) return hit;
      }
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(key, fresh.clone());
        return fresh;
      } catch (err) {
        const hit = await cached();
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
