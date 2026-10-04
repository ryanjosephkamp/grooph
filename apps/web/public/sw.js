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
 *   the page and other unhashed files   network first, the cached copy when offline or when the host answers that it
 *                                       cannot (a 5xx; a redirect or a "not found" is an answer, and is passed on),
 *                                       so a new deploy is picked up on the next visit;
 *                                       a page that names files not held yet has them fetched then, and becomes the
 *                                       page to open with no network only once every one of them is held: until
 *                                       then the page kept before, whose files are all here, stays (handoff 0083)
 *   /assets/ (hashed by the build)      the cached copy first: a name never changes its content
 *   /api/ (grooph watch's endpoints)    never touched: they are live
 *   /docs/ (the documents, static pages beside the app, handoff 0060)
 *                                       never touched: not the app, and a page of them must not become the app's cached index
 *   a navigation to any other file or folder beside the app (patterns/, experiments/, ...)
 *                                       never touched: only the app's own address, "./", is the app
 *   other origins, anything not a GET   never touched
 *
 * Old files go when no page that can still be open names them (handoff 0083). The worker keeps the page it holds
 * and the page it held before that one, and the hashed files either names. When a visit brings a page and the page
 * that visit made is the only window there is, every other hashed file is dropped. A tab left open on an older
 * version is another window, and while there is one nothing is dropped. A page that is no window (one a browser
 * keeps for the Back button) is at most one page old, since the visit that made it the worker's page was a window.
 *
 * It stores nothing but grooph's own files, and sends nothing anywhere.
 */
const CACHE = "grooph-app-v1";
/** Where the page held before the one held now is kept. No address of the app is asked for with this query. */
const BEFORE = "./?the-page-before";

/** The files of the app a page names: in a tag, or as a quoted path under assets/ in its first script. */
function named(html) {
  const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g), ...html.matchAll(/"([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  return [...new Set(found)]
    .map((path) => new URL(path, self.registration.scope))
    .filter((u) => u.origin === self.location.origin && u.href.startsWith(self.registration.scope));
}

/**
 * Fetch and keep each named file that is not held yet. One that fails is left for the page to ask for.
 * Says whether, after that, every hashed file the page names is held. A page that names none is not the app's
 * (a sign-in page a network puts in front of everything, say), and is never whole.
 */
async function hold(cache, html) {
  const files = named(html);
  await Promise.all(
    files.map(async (u) => {
      if (await cache.match(u.href, { ignoreVary: true })) return;
      await cache.add(u.href).catch(() => undefined);
    }),
  );
  const hashed = files.filter((u) => u.pathname.includes("/assets/"));
  if (hashed.length === 0) return false;
  for (const u of hashed) if (!(await cache.match(u.href, { ignoreVary: true }))) return false;
  return true;
}

/**
 * Make a page that came from the network the page to open with no network: once it is whole, and not before. A page
 * whose files have not all arrived (a deploy still reaching the host, a visit cut short) must not take the place of
 * one whose files are all here. Only when there is no page to fall back on is it kept as it is.
 * The page it replaces is kept beside it. `visit`: the id of the page a visit made of this one, when a visit brought
 * it, so the cache may be tidied after; `undefined` when the worker fetched it for itself.
 */
async function keep(cache, page, visit) {
  const html = await page.clone().text();
  const whole = await hold(cache, html);
  const held = await cache.match("./", { ignoreVary: true });
  if (!whole && held) return;
  const before = held ? await held.text() : undefined;
  if (before !== undefined && before !== html) await cache.put(BEFORE, new Response(before, { headers: { "content-type": "text/html; charset=utf-8" } }));
  await cache.put("./", page);
  if (whole && visit !== undefined) await tidy(cache, html, visit);
}

/**
 * Drop the hashed files that neither the page held now nor the page held before it names. Not until a page has
 * been replaced under this worker (before that, nothing says which files are old), and not while there is any
 * window but the page this visit made: another tab, the page this tab is still leaving, or the tab that was open
 * all along when the visiting one has been closed already. Any of them may be on an older page still. Where a
 * browser does not say which page a visit made, every window is one of those, and nothing is dropped.
 */
async function tidy(cache, html, visit) {
  const before = await cache.match(BEFORE);
  if (!before) return;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (windows.some((client) => !visit || client.id !== visit)) return;
  const wanted = new Set([...named(html), ...named(await before.text())].map((u) => u.href));
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname.includes("/assets/") && !wanted.has(request.url)) await cache.delete(request);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch("./", { cache: "no-store" });
      // No tidying here: a worker installs while tabs are open, and none of them is on its way to this page.
      if (page.ok) await keep(cache, page, undefined);
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
          // A new deploy's page names new files. They are fetched now, whether or not the visit lasts long enough to
          // ask, and the page is kept once they are all here.
          if (request.mode === "navigate") event.waitUntil(keep(cache, fresh.clone(), event.resultingClientId || "").catch(() => undefined));
          else await cache.put(key, fresh.clone());
          return fresh;
        }
        // The host answered that it cannot (it is down, a deploy is half-way): the copy held, if there is one.
        // Anything else is an answer: a redirect to where the site has moved, a "not found" for a file that is gone.
        return fresh.status >= 500 ? ((await cached()) ?? fresh) : fresh;
      } catch (err) {
        const hit = await cached();
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
