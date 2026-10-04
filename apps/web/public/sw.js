/*
 * grooph's service worker (stage 8): the app opens with no network once it has
 * been opened with one.
 *
 * The app is static files and keeps its documents in the browser, so being
 * offline needs only the files. On install this caches the page and the
 * scripts and styles it names, in its tags and in the lists its first script
 * hands the browser (vite.config.ts): the app, and the screens it fetches
 * only when an address needs them. After that:
 *
 *   the page and other unhashed files   network first, the cached copy when offline,
 *                                       so a new deploy is picked up on the next visit;
 *                                       a page that names files not held yet has them fetched then,
 *                                       so a visit cut short does not leave a page without its files
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

/** The files of the app a page names: in a tag, or as a quoted path under assets/ in its first script. */
function named(html) {
  const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g), ...html.matchAll(/"([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  return [...new Set(found)]
    .map((path) => new URL(path, self.registration.scope))
    .filter((u) => u.origin === self.location.origin && u.href.startsWith(self.registration.scope));
}

/** Fetch and keep each named file that is not held yet. One that fails is left for the page to ask for. */
async function hold(cache, html) {
  await Promise.all(
    named(html).map(async (u) => {
      if (await cache.match(u.href, { ignoreVary: true })) return;
      await cache.add(u.href).catch(() => undefined);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch("./", { cache: "no-store" });
      if (page.ok) {
        const html = await page.clone().text();
        await cache.put("./", page);
        await hold(cache, html);
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
        if (fresh.ok) {
          await cache.put(key, fresh.clone());
          // A new deploy's page names new files. They are fetched now, whether or not the visit lasts long enough to ask.
          if (request.mode === "navigate") {
            const page = fresh.clone();
            event.waitUntil(page.text().then((html) => hold(cache, html)).catch(() => undefined));
          }
        }
        return fresh;
      } catch (err) {
        const hit = await cached();
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
