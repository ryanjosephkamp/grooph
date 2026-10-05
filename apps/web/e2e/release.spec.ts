import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { canvasIsQuiet, fixturePath, node } from "./support.js";
import { builtApp, expectWhole, held, makeRelease, namedBy, removeReleases, seen, serveSite, settled, twoReleases, watchVisits, type Release, type Site, type WorkerOf } from "./support-release.js";

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

// When one of these fails in an engine nobody has on their desk, the log has to say what the tab was: which release
// its page and scripts were, what the worker held, and what the page complained of.
const complaints: string[] = [];
test.beforeEach(({ context }) => {
  // So that `settled` can tell when a page has nothing still arriving (support-release.ts).
  watchVisits(context);
  complaints.length = 0;
  const began = Date.now();
  const at = (): string => `${String(Date.now() - began).padStart(5)} ms`;
  const file = (address: string): string => address.replace(/^https?:\/\/[^/]+\/grooph\//, "") || "(the page)";
  context.on("weberror", (error) => complaints.push(`${at()} uncaught: ${error.error().message}`));
  context.on("console", (message) => {
    if (message.type() === "error") complaints.push(`${at()} console: ${message.text()}`);
  });
  // Every script and page the tab asked for, in order, and how each ended: answered (by the worker or not), or failed.
  context.on("request", (request) => {
    if (/\.js$|\/grooph\/(#.*)?$/.test(request.url())) complaints.push(`${at()} asked ${request.isNavigationRequest() ? "NAVIGATION " : ""}${file(request.url())}`);
  });
  context.on("response", (response) => {
    if (/\.js$|\/grooph\/(#.*)?$/.test(response.url())) complaints.push(`${at()} answered ${response.status()}${response.fromServiceWorker() ? " by the worker" : ""} ${file(response.url())}`);
  });
  context.on("requestfailed", (request) => complaints.push(`${at()} FAILED: ${request.failure()?.errorText ?? ""} ${file(request.url())}`));
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const tab = await seen(page).catch((error: Error) => `(could not be read: ${error.message})`);
  const cache = await held(page).catch((error: Error) => `(could not be read: ${error.message})`);
  const kept = await page
    .evaluate(async () => {
      const cache = await caches.open("grooph-app-v1");
      const stamp = async (key: string): Promise<string> => /data-release="([^"]*)"/.exec((await (await cache.match(key))?.text()) ?? "")?.[1] ?? "(none)";
      // What the page shows, and whether each script it has asked for can be had again now, by asking and by importing.
      const again: Record<string, string> = {};
      for (const entry of performance.getEntriesByType("resource")) {
        if (!/\/assets\/[^/]*\.js$/.test(entry.name)) continue;
        const name = entry.name.split("/").pop()!;
        const asked = await fetch(entry.name).then(async (r) => `${r.status}, ${(await r.text()).length} characters`, (error: Error) => `fetch failed: ${error.message}`);
        const imported = await import(/* @vite-ignore */ entry.name).then(() => "imports", (error: Error) => `import failed: ${error.message}`);
        again[name] = `${asked}; ${imported}`;
      }
      return {
        page: await stamp("./"),
        before: await stamp("./?the-page-before"),
        controlled: navigator.serviceWorker.controller !== null,
        address: location.href,
        shows: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
        again,
      };
    })
    .catch((error: Error) => `(could not be read: ${error.message})`);
  console.log(`DIAGNOSIS ${testInfo.project.name} | ${testInfo.title}\n  the tab: ${JSON.stringify(tab)}\n  the worker keeps: ${JSON.stringify(kept)}\n  its cache: ${JSON.stringify(cache)}\n  complaints: ${JSON.stringify(complaints)}`);
});

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
  await canvasIsQuiet(page);
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download package (.zip)" }).tap()]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");
}

/** A built-in template on the canvas, at an address typed in and loaded from nothing. */
async function openTemplate(page: Page, site: Site): Promise<void> {
  // An address that differs only after the # is drawn and not loaded, so the template is on the canvas before the
  // reload: wait for all it fetches, or the reload cuts a fetch short and the tests that count failures count it.
  await page.goto(`${site.url}#/templates/built-in/review-gate`);
  await canvasIsQuiet(page);
  await page.reload();
  await expect(node(page, "builder")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(5);
  await canvasIsQuiet(page);
}

/** A visitor who has the older release: one visit, with the worker in control and holding all of it. */
async function visitorOf(older: Release, page: Page): Promise<Site> {
  const site = await serveSite(older);
  await page.goto(site.url);
  await settled(page, older);
  await expectWhole(page, older);
  return site;
}

/**
 * The hashed files a release's page names, and those of them the cache holds.
 *
 * `stillKept`: the releases the worker still keeps, for asking what is left of an older one. A file whose name
 * carries a version of its own and not the build's hash (a font, the footer's icons: handoff 0077) has the same
 * name in every release. The kept releases name it too, so it is theirs and is rightly held: it is not something
 * left behind by the older release.
 */
const hashedOf = (release: Release): string[] => release.named.filter((path) => path.includes("/assets/")).sort();
const heldOf = async (page: Page, release: Release, stillKept: Release[] = []): Promise<string[]> =>
  (await held(page)).paths.filter((path) => release.assets.includes(path) && !stillKept.some((kept) => kept.named.includes(path)));

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

    for (const late of [
      { file: /\/assets\/compile-[^/]*\.js$/, what: "the compiler, which no page asks for until someone exports", where: {} },
      { file: /\/assets\/screens-[^/]*\.js$/, what: "the canvas screens, which the page itself asked for and was refused", where: {} },
    ]) {
      test(`once the rest of the new version arrives, the next visit takes it, and it opens with no network: ${late.what}`, late.where, async ({ page }) => {
        // WebKit remembers a script whose load failed, for the tab's later loads: after the canvas screens were
        // refused once, the pages that followed in that tab never asked for them again, though the site had them and
        // the worker held them, and the canvas said "This screen could not be fetched". Seen in CI on 2026-10-04
        // (Playwright 1.63's WebKit), with the request log; asking for the file with fetch() and then importing it
        // worked. The app now does that itself when an import fails (`src/piece.ts`), and this run, which was set
        // aside for WebKit until then, holds it to it.
        const [older, newer] = twoReleases(visitor);
        const site = await visitorOf(older, page);
        try {
          site.deploy(newer);
          site.failing(late.file);
          await page.goto(site.url);
          await frontPageIsUp(page);
          // The worker has asked for every file of the new version and been refused the one.
          await expect.poll(() => site.asked.filter((asked) => asked.status === 503 && late.file.test(asked.path)).length).toBeGreaterThan(0);
          site.failing(undefined);
          await page.goto(site.url);
          await settled(page, newer);
        } finally {
          await site.stop();
        }
        await openTemplate(page, site);
        await expectWhole(page, newer);
        await page.goto(site.url);
        await importAndExport(page);
        await expectWhole(page, newer);
      });
    }
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

test("a first visit that loses one request still leaves everything a visit with no network needs: the worker tries a file again", async ({ page }) => {
  // A first visit has no page to fall back on, so its page is kept with whatever came. The pieces no first screen
  // asks for (the graph's views are one) are fetched by the worker alone, and it used to try each once: a request
  // lost on the way left that piece out until the next visit with a network. It tries a second time now.
  const release = makeRelease("only");
  const lost = /\/assets\/graph-views-[^/]*\.js$/;
  expect(release.named.filter((path) => lost.test(path))).toHaveLength(1);
  const site = await serveSite(release);
  try {
    site.failingOnce(lost);
    await page.goto(site.url);
    await frontPageIsUp(page);
    // The worker in control and holding every file the page names: the one it was refused among them.
    await settled(page, release);
    // Asked for twice, by the worker alone: refused, then answered. The front page itself never asks for it.
    expect(site.asked.filter((asked) => lost.test(asked.path)).map((asked) => asked.status)).toEqual([503, 200]);
    expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => /\/assets\/graph-views-/.test(entry.name)))).toBe(false);
  } finally {
    await site.stop();
  }
  // No network: a template on the canvas, with the switch between its views, which is that piece.
  await openTemplate(page, site);
  await expect(page.getByRole("radiogroup", { name: "View of the graph" })).toBeVisible();
  await expectWhole(page, release);
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
      expect(await heldOf(page, first, [second, third]), "a release two back, which no page that can still be open names").toEqual([]);
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
      await expect.poll(() => heldOf(page, first, [second, third]), { message: "the first release's files, once no window can be on it" }).toEqual([]);
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

  test("the embed's files are held though no one watched the run: an open tab has its own after a deploy, and the next visit the new ones with no network", async ({ page, context }) => {
    // The front page's recorded run is drawn by the embed, in a frame. The page names the embed's script and its
    // style sheet, so the worker fetches them as it installs. They were once kept only after someone had watched the
    // run with a network, and a tab left open across a deploy could not fetch them at all (handback 0083).
    const [older, newer] = twoReleases();
    const embedOf = (release: Release): string[] => release.assets.filter((path) => /\/assets\/EmbedApp-/.test(path)).sort();
    const [was, now] = [embedOf(older), embedOf(newer)];
    expect(now, "the embed's script and its style sheet").toHaveLength(2);
    expect(newer.named.filter((path) => now.includes(path)).sort(), "the page names both").toEqual(now);
    const site = await visitorOf(older, page);
    const ask = (tab: Page, paths: string[]): Promise<number[]> => tab.evaluate((list) => Promise.all(list.map(async (path) => (await fetch(path)).status)), paths);
    let next: Page;
    try {
      // Nobody watched the run, and the worker holds the embed all the same.
      expect((await held(page)).paths.filter((path) => was.includes(path))).toEqual(was);
      // A deploy: the site no longer has the older files. The tab left open asks for its own and is answered.
      site.deploy(newer);
      expect(await ask(page, was), "the open tab's own, after the deploy").toEqual([200, 200]);

      next = await context.newPage();
      await next.goto(site.url);
      await settled(next, newer);
      expect((await held(next)).paths.filter((path) => now.includes(path))).toEqual(now);
    } finally {
      await site.stop();
    }
    expect(await ask(next, now), "the new version's, with no network").toEqual([200, 200]);
  });

  test("a file the page does not name, a font's license, is still there after the next visit, and with no network", async ({ page, context }) => {
    // The page names every file the app asks for. A file a person opens by its address, such as the license beside a
    // font, it does not name: nothing says it is old, so the tidying must leave it.
    const [older, newer] = twoReleases();
    const license = newer.assets.filter((path) => path.endsWith(".txt")).sort().slice(0, 1);
    expect(license, "a license beside a font").toHaveLength(1);
    expect(newer.named.filter((path) => license.includes(path)), "the page does not name it").toEqual([]);
    const site = await visitorOf(older, page);
    const ask = (tab: Page): Promise<number[]> => tab.evaluate((paths) => Promise.all(paths.map(async (path) => (await fetch(path)).status)), license);
    let next: Page;
    try {
      site.deploy(newer);
      await page.goto(site.url);
      await settled(page, newer);
      expect(await ask(page), "opened once, with a network").toEqual([200]);
      await page.close();

      // An ordinary visit in a tab of its own: the only window there is, with a page before the one kept. That is
      // everything tidying waits for. (A reload in one tab seldom tidies: the page being left is a window still.)
      next = await context.newPage();
      await next.goto(site.url);
      await settled(next, newer);
      await next.waitForTimeout(600);
      expect((await held(next)).paths.filter((path) => license.includes(path))).toEqual(license);
      // (The license has one name in every release, so it counts as the older one's as well.)
      expect((await heldOf(next, older)).filter((path) => !license.includes(path)), "the page before is kept whole, as ever").toEqual(hashedOf(older));
    } finally {
      await site.stop();
    }
    expect(await ask(next), "opened again, with no network").toEqual([200]);
  });

  test("a script that asks for the page's own address does not replace either page the worker keeps", CHROMIUM, async ({ page }) => {
    const [older, newer] = twoReleases();
    const site = await visitorOf(older, page);
    const kept = (): Promise<{ now: string | undefined; before: string | undefined }> =>
      page.evaluate(async () => {
        const cache = await caches.open("grooph-app-v1");
        const stamp = async (key: string): Promise<string | undefined> => /data-release="([^"]*)"/.exec((await (await cache.match(key))?.text()) ?? "")?.[1];
        return { now: await stamp("./"), before: await stamp("./?the-page-before") };
      });
    try {
      site.deploy(newer);
      await page.goto(site.url);
      await settled(page, newer);
      await expect.poll(kept).toEqual({ now: "newer", before: "older" });

      // The site answers any query with the page it has now. Neither answer may be kept as a page.
      const third = makeRelease("third");
      site.deploy(third);
      await page.evaluate(async () => {
        await fetch("./");
        await fetch("./?the-page-before");
      });
      expect(await kept()).toEqual({ now: "newer", before: "older" });
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
      await expect.poll(async () => (await Promise.all(kept.map((release) => heldOf(page, release, [arriving, after])))).flat(), { message: "the three versions 0.3.0's worker had kept" }).toEqual([]);
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

test("the page names every file the app can ask for under assets/, and every file it names is there", CHROMIUM, () => {
  // The worker fetches what the page names when it installs. A file the app loads from code and the page does not
  // name is kept only if the page happens to have finished fetching it when the worker takes control: the race the
  // site lane met with its fonts.
  //
  // That holds for the embed's own two files as for the rest: the app asks for them in the frame that plays the
  // front page's recorded run. They were the one exception until `vite.config.ts` named them (handback 0083).
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
  // Source maps are for a debugger, and a license beside a font is a document a person opens: neither is asked for by the app.
  const files = walk(join(builtApp, "assets"))
    .filter((file) => !file.endsWith(".map") && !file.endsWith(".txt"))
    .map((file) => `/grooph/assets/${file.slice(join(builtApp, "assets").length + 1).split("\\").join("/")}`);
  const named = namedBy(readFileSync(join(builtApp, "index.html"), "utf8"));
  expect(files.length, "files under the built app's assets/").toBeGreaterThan(5);
  expect(files.filter((file) => !named.includes(file)).sort()).toEqual([]);
  // And the other way: a page that names a hashed file the build does not have is never whole to the worker, which
  // then keeps the page before it for good, and stops tidying.
  expect(named.filter((path) => path.includes("/assets/") && !files.includes(path)), "named by the page and not in the build").toEqual([]);
});
