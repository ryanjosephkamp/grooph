/**
 * Fetch a piece of the app that is loaded when it is first needed (decision 0021): the canvas screens, the
 * compiler, a map's views, the embed. `load` is the piece's `import()`, and `name` is its file's name before the
 * hash, as the build writes it under `assets/`.
 *
 * An import that fails is tried again, here, and not left to the browser, which will not:
 *
 * - WebKit, once a script's load has failed in a tab, does not ask for it again in that tab's later pages, though
 *   the site has it by then and the service worker holds it. Asked for with `fetch` first, it imports (seen in CI
 *   on 2026-10-04, handback 0083). So the file is fetched, and then imported again.
 * - Chromium remembers, for as long as the page lives, that an address failed as a module: importing it again
 *   asks for nothing and fails (seen in the smoke set). So the last try is the same file at an address that
 *   differs after its `#`: the same request, the same copy in the worker's cache, and a module not asked for before.
 *   It is the piece itself, with the piece's own names, because the build gives each piece a file of its own.
 *
 * The file's address is read from the first script in the page's head, where the build wrote the name of every
 * file the app can ask for (`vite.config.ts`; the release tests hold the build to that), and from nowhere else.
 * The rest of the page holds what the app has drawn, a document's own words among it, and the address chosen
 * here is run as a script of the app, beside a person's graphs: so it is not looked for where a document could
 * have put one, and it must be an address of this site. When the page's head does not name the piece, or the
 * file cannot be had, nothing is imported and the first failure is the one reported.
 *
 * A piece that has come is kept, and every later call is given the same one. One that could not be had is
 * forgotten, so the next call asks afresh: the next screen opened, the next export, the page loaded again.
 */
const kept: Record<string, Promise<unknown> | undefined> = {};
let tries = 0;

export function piece<T>(name: string, load: () => Promise<T>): Promise<T> {
  const asked = (kept[name] ??= load().catch(async (failed: unknown) => {
    const file = new RegExp(`"(/[^"]*/assets/${name}-[\\w-]+\\.js)"`).exec(document.head.querySelector("script:not([src])")?.textContent ?? "")?.[1];
    if (!file || new URL(file, location.href).origin !== location.origin) throw failed;
    if (!(await fetch(file).then((answer) => answer.ok && answer.arrayBuffer().then(() => true), () => false))) throw failed;
    return load().catch(() => import(/* @vite-ignore */ `${file}#${++tries}`));
  }));
  asked.catch(() => {
    if (kept[name] === asked) kept[name] = undefined;
  });
  return asked as Promise<T>;
}
