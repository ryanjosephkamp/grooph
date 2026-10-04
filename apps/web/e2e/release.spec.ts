import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { fixturePath, node } from "./support.js";
import { builtApp, expectWhole, held, makeRelease, namedBy, removeReleases, seen, serveSite, settled, twoReleases, type Release, type Site, type WorkerOf } from "./support-release.js";

/**
 * Handoff 0083: the service worker across a release.
 *
 * The front page says grooph opens offline after a first visit, and `offline.spec.ts` and the smoke set show that
 * for one build. These show what a visitor who already has grooph sees on the day a new version is deployed: with
 * the old tab still open, on the next visit, and with no network after it; what a first visit on a slow link
 * leaves behind; and what the worker's cache holds after two and three releases.
 *
 * The site is a server of the test's own (`support-release.ts`), so a deploy is a real one: the files the older
 * release named are gone from it, and "no network" is the server closed.
 */
test.use({ serviceWorkers: "allow" });
test.afterAll(() => removeReleases());

/**
 * `GROOPH_BROWSERS=1` runs these in WebKit and Firefox as well (`playwright.config.ts`), all but the ones tagged
 * here: what a worker does with a cache, with windows and with a site that is gone is where engines differ. The
 * tagged ones run in Chromium alone, with the rest of the suite: they repeat a test that does run everywhere with
 * another worker or another address, or they need no browser, and the other engines' job has half a minute for this.
 */
const CHROMIUM = { tag: "@chromium" };

/** The documents are not the app's and the test's site does not serve them (`support-release.ts`). */
const ofTheApp = (address: string): boolean => !new URL(address, "http://site").pathname.startsWith("/grooph/docs/");

/** Every request of the tab, for a file of the app, that failed or was answered with an error. */
function failuresOf(page: Page): string[] {
  const failed: string[] = [];
  page.on("requestfailed", (request) => {
    if (ofTheApp(request.url())) failed.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && ofTheApp(response.url())) failed.push(`${response.status()} ${response.url()}`);
  });
  return failed;
}

/** What the site was asked for since `from` and could not give. */
const refused = (site: Site, from: number): string[] => site.asked.slice(from).filter((asked) => asked.status >= 400 && ofTheApp(asked.path)).map((asked) => `${asked.status} ${asked.path}`);

const frontPageIsUp = (page: Page): Promise<void> => expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

/** Import the review loop and download its package. Exporting fetches the compiler, which no address asks for. */
async function importAndExport(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({ name: "review-loop.grooph.json", mimeType: "application/json", buffer: Buffer.from(readFileSync(fixturePath, "utf8")) });
  await expect(node(page, "builder")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download package (.zip)" }).tap()]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");
}

/** A built-in template on the canvas, at an address typed in and loaded from nothing. */
async function openTemplate(page: Page, site: Site): Promise<void> {
  await page.goto(`${site.url}#/templates/built-in/review-gate`);
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(5);
}

/** A visitor who has the older release: one visit, with the worker in control and holding all of it. */
async function visitorOf(older: Release, page: Page): Promise<Site> {
  const site = await serveSite(older);
  await page.goto(site.url);
  await settled(page, older);
  await expectWhole(page, older);
  return site;
}

/** The hashed files a release's page names, and those of them the cache holds. */
const hashedOf = (release: Release): string[] => release.named.filter((path) => path.includes("/assets/")).sort();
const heldOf = async (page: Page, release: Release): Promise<string[]> => (await held(page)).paths.filter((path) => release.assets.includes(path));

/**
 * The worker the visitor already has, which is the one that answers the first visit after a deploy. Every visitor
 * there is today has the worker 0.3.0 shipped; after this version, they have this one. Two real builds named in the
 * environment (`support-release.ts`) are one pair, each with its own worker.
 */
const real = Boolean(process.env["GROOPH_RELEASE_OLDER"] && process.env["GROOPH_RELEASE_NEWER"]);
const olderIsOld = real && readFileSync(join(process.env["GROOPH_RELEASE_OLDER"]!, "sw.js"), "utf8") === readFileSync(new URL("fixtures/sw-0.3.0.js", import.meta.url), "utf8");
const VISITORS: { has: string; olderWorker: WorkerOf }[] = real
  ? [{ has: `the older build's own worker${olderIsOld ? ", which is the one 0.3.0 shipped" : ""}`, olderWorker: olderIsOld ? "0.3.0" : "same" }]
  : [
      { has: "this version's worker", olderWorker: "same" },
      { has: "the worker 0.3.0 shipped", olderWorker: "0.3.0" },
    ];

for (const visitor of VISITORS) {
  test.describe(`a new version is deployed to a visitor who has the old one, with ${visitor.has}`, visitor.olderWorker === "0.3.0" ? CHROMIUM : {}, () => {
    test("the tab that was open keeps working, even for what it had not fetched yet", async ({ page }) => {
      const [older, newer] = twoReleases(visitor);
      const failed = failuresOf(page);
      const site = await visitorOf(older, page);
      try {
        expect((await seen(page)).assets.filter((path) => /\/assets\/compile-/.test(path)), "the compiler, before anyone exports").toEqual([]);

        site.deploy(newer);
        const before = site.asked.length;
        await importAndExport(page);

        // Still the older release, all of it, and nothing it asked for failed: the worker had the compiler.
        await expectWhole(page, older);
        expect((await seen(page)).assets.filter((path) => /\/assets\/compile-/.test(path))).toHaveLength(1);
        expect(failed).toEqual([]);
        expect(refused(site, before)).toEqual([]);
      } finally {
        await site.stop();
      }
    });

    test("the next visit shows the new version, whole, and nothing it asks for fails", async ({ page }) => {
      const [older, newer] = twoReleases(visitor);
      const failed = failuresOf(page);
      const site = await visitorOf(older, page);
      try {
        site.deploy(newer);
        const before = site.asked.length;

        await page.goto(site.url);
        await frontPageIsUp(page);
        await expectWhole(page, newer);
        await openTemplate(page, site);
        await expectWhole(page, newer);

        expect(failed).toEqual([]);
        expect(refused(site, before)).toEqual([]);
      } finally {
        await site.stop();
      }
    });

    test("after that visit, with no network, the new version opens, a template opens on the canvas and a graph exports", async ({ page }) => {
      const [older, newer] = twoReleases(visitor);
      const site = await visitorOf(older, page);
      try {
        site.deploy(newer);
        await page.goto(site.url);
        await settled(page, newer);
      } finally {
        await site.stop();
      }

      await page.goto(site.url);
      await frontPageIsUp(page);
      await expectWhole(page, newer);
      await openTemplate(page, site);
      await expectWhole(page, newer);
      await page.goto(site.url);
      await importAndExport(page);
      await expectWhole(page, newer);
    });

    test("the old tab still works after another tab has taken the new version, with the network and without", async ({ page, context }) => {
      const [older, newer] = twoReleases(visitor);
      const failed = failuresOf(page);
      const site = await visitorOf(older, page);
      try {
        site.deploy(newer);
        const second = await context.newPage();
        await second.goto(site.url);
        await settled(second, newer);
        await expectWhole(second, newer);
        await second.close();
      } finally {
        await site.stop();
      }

      // The first tab was never reloaded. It is the older release still, and what it now asks for is the older compiler.
      await importAndExport(page);
      await expectWhole(page, older);
      expect(failed).toEqual([]);
    });

    test("a visit that could not fetch all of the new version still leaves one that opens with no network", async ({ page }) => {
      // The first visit after a deploy is answered by the worker the visitor already has. 0.3.0's worker keeps the new
      // page at once, before its files; a fix in the worker that ships now cannot change what that one does on that
      // visit. From the next release on it is this worker that answers, and the other run of this test holds it.
      test.fail(visitor.olderWorker === "0.3.0", "0.3.0's worker answers the first visit after the deploy, and keeps a page before its files");
      const [older, newer] = twoReleases(visitor);
      const site = await visitorOf(older, page);
      const missing = newer.named.find((path) => /\/assets\/screens-[^/]*\.js$/.test(path))!;
      try {
        // The deploy is still arriving: the page is the new one, and one of the files it names cannot be had yet.
        site.deploy(newer);
        site.failing(/\/assets\/screens-[^/]*\.js$/);
        await page.goto(site.url);
        await frontPageIsUp(page);
        // The worker has fetched what it could of the new version.
        await expect
          .poll(
            async () => {
              const { paths } = await held(page);
              return newer.named.filter((path) => !paths.includes(path));
            },
            { timeout: 20_000 },
          )
          .toEqual([missing]);
      } finally {
        await site.stop();
      }

      // No network. Whichever version opens must be one the worker holds all of: the canvas needs the file that never came.
      await page.goto(site.url);
      await frontPageIsUp(page);
      const opened = (await seen(page)).page === newer.name ? newer : older;
      await openTemplate(page, site);
      await expectWhole(page, opened);
    });

    test("once the rest of the new version arrives, the next visit takes it, and it opens with no network", async ({ page }) => {
      const [older, newer] = twoReleases(visitor);
      const site = await visitorOf(older, page);
      try {
        site.deploy(newer);
        site.failing(/\/assets\/screens-[^/]*\.js$/);
        await page.goto(site.url);
        await frontPageIsUp(page);
        site.failing(undefined);
        await page.goto(site.url);
        await settled(page, newer);
      } finally {
        await site.stop();
      }
      await openTemplate(page, site);
      await expectWhole(page, newer);
    });
  });
}

test("a release that changes the worker too: the new worker takes over the open tab, and nothing breaks", CHROMIUM, async ({ page }) => {
  const [older, newer] = twoReleases({ newerWorker: "changed" });
  const failed = failuresOf(page);
  const site = await visitorOf(older, page);
  try {
    site.deploy(newer);
    // A visit is what makes a browser look for a new worker; ask as the browser would on one.
    await page.evaluate(async () => {
      const changed = new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
      await (await navigator.serviceWorker.ready).update();
      await changed;
    });

    // The tab is the older release, now under the newer worker, and the site no longer has its files.
    await importAndExport(page);
    await expectWhole(page, older);
    expect(failed).toEqual([]);

    await page.goto(site.url);
    await settled(page, newer);
    await expectWhole(page, newer);
  } finally {
    await site.stop();
  }
  await openTemplate(page, site);
  await expectWhole(page, newer);
});

test("the site answers with an error where the app was: the app opens from the copy the worker holds", async ({ page }) => {
  const release = makeRelease("only");
  const site = await visitorOf(release, page);
  try {
    // The host is down, or a deploy is half-way: an answer comes, and it is not the app.
    site.failing(/./);
    await page.goto(site.url);
    await frontPageIsUp(page);
    await expectWhole(page, release);
    await openTemplate(page, site);
    await expectWhole(page, release);
  } finally {
    await site.stop();
  }
});

test.describe("what the worker's cache holds", () => {
  test("after two and after three releases: the newest two, not every one there has been", async ({ page }, testInfo) => {
    const releases = ["first", "second", "third"].map((name) => makeRelease(name));
    const [first, second, third] = releases as [Release, Release, Release];
    const site = await serveSite(first);
    const lines: string[] = [];
    try {
      for (const [index, release] of releases.entries()) {
        site.deploy(release);
        await page.goto(site.url);
        await settled(page, release);
        // The worker tidies after the page is kept: the time a person takes to read a line.
        await page.waitForTimeout(600);
        const cache = await held(page);
        const named = hashedOf(release);
        const namedBytes = await page.evaluate(
          async ([name, paths]) => {
            const cache = await caches.open(name as string);
            let bytes = 0;
            for (const path of paths as string[]) bytes += ((await (await cache.match(path))?.blob()) ?? new Blob()).size;
            return bytes;
          },
          ["grooph-app-v1", named] as const,
        );
        lines.push(
          `after release ${index + 1}: ${cache.paths.length} files, ${(cache.bytes / 1024).toFixed(0)} KB held, ${cache.paths.filter((path) => path.includes("/assets/")).length} of them hashed; the newest page names ${named.length} hashed files, ${(namedBytes / 1024).toFixed(0)} KB`,
        );
      }
      testInfo.annotations.push({ type: "the worker's cache", description: lines.join(" | ") });
      console.log(`CACHE ${testInfo.project.name}\n  ${lines.join("\n  ")}`);

      expect(await heldOf(page, third), "the newest release: every hashed file its page names").toEqual(hashedOf(third));
      expect(await heldOf(page, second), "the release before it: kept whole, for a page of it that may still be about").toEqual(hashedOf(second));
      expect(await heldOf(page, first), "a release two back, which no page that can still be open names").toEqual([]);
    } finally {
      await site.stop();
    }

    // What is left is enough: with no network, the newest opens, a template opens on the canvas and a graph exports.
    await openTemplate(page, site);
    await page.goto(site.url);
    await importAndExport(page);
    await expectWhole(page, third);
  });

  test("a tab left open two releases back is never left without its files; when it is the visit itself, they go", async ({ page, context }) => {
    const releases = ["first", "second", "third"].map((name) => makeRelease(name));
    const [first, second, third] = releases as [Release, Release, Release];
    const failed = failuresOf(page);
    const site = await visitorOf(first, page);
    try {
      // Two releases go by. Each is taken by another tab, which is then closed; the first tab stays as it is.
      for (const release of [second, third]) {
        site.deploy(release);
        const other = await context.newPage();
        await other.goto(site.url);
        await settled(other, release);
        await expectWhole(other, release);
        await other.waitForTimeout(600);
        await other.close();
      }
      expect(await heldOf(page, first), "the files of the tab that is still open on the first release").toEqual(hashedOf(first));

      // The site has none of the first release left. The open tab asks for its compiler, for the first time.
      const before = site.asked.length;
      await importAndExport(page);
      await expectWhole(page, first);
      expect(failed).toEqual([]);
      expect(refused(site, before)).toEqual([]);

      // Now that tab makes the visit itself. It is the only window, and it is leaving the first release.
      await page.goto(site.url);
      await settled(page, third);
      await expectWhole(page, third);
      await expect.poll(() => heldOf(page, first), { message: "the first release's files, once no window can be on it" }).toEqual([]);
      expect(await heldOf(page, second), "the release before the newest stays").toEqual(hashedOf(second));
    } finally {
      await site.stop();
    }
  });

  test("a tab left open keeps its files even when the tab that took the new version is closed before the worker has finished", async ({ page, context }) => {
    const releases = ["first", "second", "third"].map((name) => makeRelease(name));
    const [first, second, third] = releases as [Release, Release, Release];
    const site = await visitorOf(first, page);
    try {
      site.deploy(second);
      const other = await context.newPage();
      await other.goto(site.url);
      await settled(other, second);
      await other.close();

      // The third release, on a slow link, in a tab that is closed as soon as its page is up: the worker is still
      // fetching the new files, and when it has them the only window left is the one on the first release.
      site.deploy(third);
      site.slow({ latencyMs: 150, bytesPerSecond: 300_000 });
      const quick = await context.newPage();
      await quick.goto(site.url, { waitUntil: "commit" });
      await quick.close();
      await expect.poll(() => heldOf(page, third), { message: "the worker goes on to hold the third release", timeout: 30_000 }).toEqual(hashedOf(third));
      await page.waitForTimeout(600);
      site.slow(undefined);

      expect(await heldOf(page, first), "the files of the tab that is still open on the first release").toEqual(hashedOf(first));
      await importAndExport(page);
      await expectWhole(page, first);
    } finally {
      await site.stop();
    }
  });

  test("a visitor who came with three versions kept by 0.3.0's worker: nothing goes on the day this worker arrives, and all but two the release after", CHROMIUM, async ({ page }, testInfo) => {
    const kept = ["first", "second", "third"].map((name) => makeRelease(name, { worker: "0.3.0" }));
    const arriving = makeRelease("fourth");
    const after = makeRelease("fifth");
    const site = await serveSite(kept[0]!);
    const lines: string[] = [];
    // Each page counts the times a worker took it over: once on a first visit, and once more when a new worker arrives.
    await page.addInitScript(() => {
      const counts = window as unknown as { __groophTakeovers: number };
      counts.__groophTakeovers = 0;
      navigator.serviceWorker?.addEventListener("controllerchange", () => (counts.__groophTakeovers += 1));
    });
    const visit = async (release: Release): Promise<void> => {
      site.deploy(release);
      await page.goto(site.url);
      await settled(page, release);
      await page.waitForTimeout(600);
      const cache = await held(page);
      lines.push(`${release.name}: ${cache.paths.filter((path) => path.includes("/assets/")).length} hashed files, ${(cache.bytes / 1024).toFixed(0)} KB`);
    };
    try {
      for (const release of kept) await visit(release);
      // The release that brings this worker. The visit is answered by the old one; this one installs after it and
      // takes the open tab over. A browser looks for a new worker a moment after a visit: ask now, and wait for it.
      await visit(arriving);
      await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
      await page.waitForFunction(() => (window as unknown as { __groophTakeovers: number }).__groophTakeovers >= 1);
      for (const release of [...kept, arriving]) expect(await heldOf(page, release), `${release.name}, on the day this worker arrives`).toEqual(hashedOf(release));

      // The next release is the first visit this worker answers. It keeps that page and the one before it.
      await visit(after);
      await expect.poll(async () => (await Promise.all(kept.map((release) => heldOf(page, release)))).flat(), { message: "the three versions 0.3.0's worker had kept" }).toEqual([]);
      expect(await heldOf(page, arriving)).toEqual(hashedOf(arriving));
      expect(await heldOf(page, after)).toEqual(hashedOf(after));
    } finally {
      await site.stop();
      testInfo.annotations.push({ type: "the worker's cache", description: lines.join(" | ") });
      console.log(`CACHE from 0.3.0 ${testInfo.project.name}\n  ${lines.join("\n  ")}`);
    }
  });
});

/**
 * A first visit on a slow link. The page asks again, once the worker is in control, for the hashed files it has
 * finished fetching (`main.tsx`), and a file still arriving at that moment is not among them. The worker also
 * fetches for itself, when it installs, every file the page names. So a file is at risk only if the page loads it
 * from code, the page does not name it, and it is still arriving when the worker takes control. These make the
 * visit slow enough for files to be arriving at that moment, say which were, and hold the visit to what it
 * promises: with no network after it, the app opens, a template opens on the canvas and a graph exports.
 */
for (const first of [
  { address: "", what: "the front page", where: {}, hurry: false },
  { address: "#/templates/built-in/review-gate", what: "a template on the canvas", where: CHROMIUM, hurry: false },
  // A person who does not wait: a graph imported and exported while the worker is still installing, so the canvas
  // screens and the compiler are asked for by the page itself, past the worker, at the worst moment.
  { address: "", what: "the front page, by someone who starts working at once", where: CHROMIUM, hurry: true },
]) {
  test(`a first visit on a slow link, to ${first.what}, leaves everything a visit with no network needs`, first.where, async ({ page }, testInfo) => {
    const release = makeRelease("only");
    const site = await serveSite(release);
    // Slow 4G as scripts/perf-loadtime.mjs has it: 1.6 Mbit a second, 280 ms each way.
    site.slow({ latencyMs: 280, bytesPerSecond: 200_000 });

    // What the tab was still waiting for at the moment the worker took control.
    const arriving = new Set<string>();
    let atControl: string[] | undefined;
    page.on("request", (request) => arriving.add(new URL(request.url()).pathname));
    page.on("requestfinished", (request) => arriving.delete(new URL(request.url()).pathname));
    page.on("requestfailed", (request) => arriving.delete(new URL(request.url()).pathname));
    await page.exposeFunction("__groophControlTaken", () => {
      atControl ??= [...arriving].sort();
    });
    await page.addInitScript(() => {
      navigator.serviceWorker?.addEventListener("controllerchange", () => void (window as unknown as { __groophControlTaken: () => void }).__groophControlTaken(), { once: true });
    });

    try {
      await page.goto(`${site.url}${first.address}`);
      if (first.hurry) {
        expect(await page.evaluate(() => navigator.serviceWorker.controller), "the worker is not in control yet").toBeNull();
        await importAndExport(page);
      }
      await settled(page, release);
      // Everything the page itself asked for under assets/, named in the page or not, is held too.
      await expect
        .poll(
          async () => {
            const { paths } = await held(page);
            return (await seen(page)).assets.filter((path) => !paths.includes(path));
          },
          { message: "every hashed file the page asked for is in the worker's cache", timeout: 20_000 },
        )
        .toEqual([]);
    } finally {
      await site.stop();
    }
    const stillArriving = (atControl ?? ["(the worker never took control)"]).join(", ") || "nothing";
    testInfo.annotations.push({ type: "arriving when the worker took control", description: stillArriving });
    console.log(`ARRIVING ${testInfo.project.name} | ${first.what} | ${stillArriving}`);
    expect(atControl, "the worker took control during the visit").toBeDefined();

    // No network.
    await page.goto(site.url);
    await frontPageIsUp(page);
    await expectWhole(page, release);
    await openTemplate(page, site);
    await page.goto(site.url);
    await importAndExport(page);
    await expectWhole(page, release);
  });
}

test("the page names every file the app can ask for under assets/, so the worker's install leaves none to a race", CHROMIUM, () => {
  // The worker fetches what the page names when it installs. A file the app loads from code and the page does not
  // name is kept only if the page happens to have finished fetching it when the worker takes control: the race the
  // site lane met with its fonts. The embed's own files are the exception: an embed address starts no worker.
  const routes = JSON.parse(readFileSync(join(builtApp, "routes.json"), "utf8")) as { entry: string[]; app: { js: string[]; css: string[] }; canvas: { js: string[]; css: string[] }; later: string[]; embed: { js: string[]; css: string[] } };
  const ofTheApp = new Set([...routes.entry, ...routes.app.js, ...routes.app.css, ...routes.canvas.js, ...routes.canvas.css, ...routes.later]);
  const embedOnly = [...routes.embed.js, ...routes.embed.css].filter((file) => !ofTheApp.has(file)).map((file) => `/grooph/${file}`);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
  // Source maps are for a debugger, and a license beside a font is a document a person opens: neither is asked for by the app.
  const files = walk(join(builtApp, "assets"))
    .filter((file) => !file.endsWith(".map") && !file.endsWith(".txt"))
    .map((file) => `/grooph/assets/${file.slice(join(builtApp, "assets").length + 1).split("\\").join("/")}`);
  const named = namedBy(readFileSync(join(builtApp, "index.html"), "utf8"));
  expect(files.length, "files under the built app's assets/").toBeGreaterThan(5);
  expect(files.filter((file) => !named.includes(file) && !embedOnly.includes(file)).sort()).toEqual([]);
});
