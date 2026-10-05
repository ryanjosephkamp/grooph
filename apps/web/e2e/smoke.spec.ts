import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { downloadBytes, fixturePath, goldenDir, importDocument, node, readTree, repoRoot, status } from "./support.js";

/**
 * Handoff 0081, item 4: the smoke set. Five visits a stranger makes, short enough to run in Safari's engine
 * (WebKit) and in Firefox as well as in Chromium:
 *
 *   GROOPH_BROWSERS=1 pnpm --filter @grooph/web test:e2e
 *
 * Each is drawn from a longer spec that runs in Chromium only (landing, templates, roundtrip, map, offline), and
 * checks what an engine could get wrong on its own: the page starts, the canvas measures and draws, a file goes in
 * and a package comes out byte for byte, a link decodes, and the service worker answers with no network.
 *
 * Every visit also fails on an uncaught error in the page, and on a request to any host but the one that served
 * the app: that is docs/privacy.md's promise, watched where a script would break it.
 *
 * A test that cannot pass in one engine for a reason that is the engine's says which and why where it stands, and
 * stays in the file.
 */

// An uncaught error in the page fails the visit that raised it: syntax or an API one engine lacks shows here first.
let pageErrors: string[] = [];
// What docs/privacy.md promises, seen where it happens: on these visits the app asks no host but the one that served
// it. scripts/check-outside-addresses.mjs reads the built files for the same promise and cannot see what a script
// asks for at run time; this can.
let outsideRequests: string[] = [];
const THIS_MACHINE = new Set(["localhost", "127.0.0.1", "[::1]"]);
const outside = (address: string): boolean => {
  const url = new URL(address);
  return /^(https?|wss?):$/.test(url.protocol) && !THIS_MACHINE.has(url.hostname);
};
test.beforeEach(({ page, context }) => {
  pageErrors = [];
  outsideRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // The context hears every page's requests, and in Chromium the service worker's own.
  context.on("request", (request) => {
    if (outside(request.url())) outsideRequests.push(request.url());
  });
  page.on("websocket", (socket) => {
    if (outside(socket.url())) outsideRequests.push(socket.url());
  });
});
test.afterEach(() => {
  expect(pageErrors, "uncaught errors in the page").toEqual([]);
  expect(outsideRequests, "requests to another host").toEqual([]);
});

/**
 * The front page has drawn itself: the page is grooph's and its top heading is up. Which words that heading holds
 * is the landing spec's to say, and changes with the design; an engine either draws it or does not.
 */
async function frontPageIsUp(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/grooph/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

test("the watch on outside requests is awake: a page that asks another host is seen to", async ({ page }) => {
  // Answered here, so nothing leaves this machine: the request is still made, and that is what is watched.
  await page.route("https://outside.example/**", (route) => route.fulfill({ body: "" }));
  await page.goto("./");
  await page.evaluate(() => fetch("https://outside.example/beacon", { mode: "no-cors" }).catch(() => undefined));
  expect(outsideRequests).toEqual(["https://outside.example/beacon"]);
  outsideRequests = [];
});

test("the front page opens: its heading, a drawn loop graph, the way in, nothing scrolling sideways", async ({ page }) => {
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await frontPageIsUp(page);

  // Core's picture, drawn in the page: four nodes with their words measured by this engine's own text layout.
  const picture = page.locator("svg.grooph-picture").first();
  await expect(picture).toBeVisible();
  expect(await picture.locator("[data-node]").count()).toBe(4);
  const box = (await picture.boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(100);

  await expect(page.getByRole("button", { name: "New graph" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("a template opens from the list on the canvas, read-only, every node inside the screen", async ({ page }) => {
  await page.goto("./#/templates");
  await expect(page.getByRole("heading", { name: "Templates", level: 1 })).toBeVisible();
  const row = page.locator('.template-row[data-template="review-gate"]');
  await expect(row.locator(".template-glyph svg")).toBeVisible();

  await row.tap();
  await expect(page.locator(".title-sub")).toHaveText("built-in template · read-only");
  for (const id of ["builder", "critic", "merge-gate", "done"]) await expect(node(page, id)).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(5);

  // The canvas fitted the graph to this screen: a node measured as zero, or laid out off it, shows here.
  const viewport = page.viewportSize()!;
  for (const id of ["builder", "critic", "merge-gate", "done"]) {
    const box = (await node(page, id).boundingBox())!;
    expect(box.width, id).toBeGreaterThan(20);
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, id).toBeLessThanOrEqual(viewport.height);
  }
});

test("a graph is imported and its export panel gives the golden package, byte for byte", async ({ page }) => {
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await expect(status(page)).toHaveText("1 warning");
  await expect(node(page, "builder")).toBeVisible();

  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download package (.zip)" }).tap(),
  ]);
  expect(zip.suggestedFilename()).toBe("review-loop-claude-code.zip");

  // The compiler ran in this engine: the same files as the CLI writes, to the byte.
  const files = Object.fromEntries(Object.entries(unzipSync(await downloadBytes(zip))).map(([path, bytes]) => [path, strFromU8(bytes)]));
  const golden = readTree(goldenDir);
  expect(Object.keys(files).sort()).toEqual(Object.keys(golden).sort());
  for (const path of Object.keys(golden)) expect(files[path], path).toBe(golden[path]);
});

test("an operation map opens from a link as its picture, every session and handoff drawn", async ({ page }) => {
  const map = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json"), "utf8")).map!;
  // The link `grooph share` makes: the document deflated into the address, inflated again by the page.
  await page.goto(`./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`);
  await expect(page.locator(".title-name")).toHaveText(map.name);
  await expect(page.getByRole("button", { name: "Validation: Valid" })).toBeVisible();

  const picture = page.locator(".map-picture svg");
  await expect(picture).toBeVisible();
  for (const session of map.sessions) await expect(page.locator(`[data-session="${session.id}"]`)).toHaveCount(1);
  for (const handoff of map.handoffs) await expect(page.locator(`[data-handoff-row="${handoff.id}"]`)).toHaveCount(1);
  expect((await picture.boundingBox())!.width).toBeGreaterThan(300);

  // A session opens what the map says about it.
  await page.locator('[data-session="operator"]').tap();
  await expect(page.locator("aside.sheet").getByRole("heading", { name: "Session" })).toBeVisible();
});

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/**
 * The built app on a server of this test's own, at an address the system picks, so the test can take the network
 * away for real by closing it. Nothing it serves may be kept by the browser's own cache (`no-store`): whatever
 * answers once it is gone is the service worker.
 */
async function serveBuiltApp(): Promise<{ url: string; stop: () => Promise<void> }> {
  const dist = join(repoRoot, "apps/web/dist");
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    let file = normalize(join(dist, path.replace(/^\/grooph\//, "")));
    if (path.endsWith("/")) file = join(file, "index.html");
    if (!path.startsWith("/grooph/") || !(file + sep).startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(readFileSync(file));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const stop = (): Promise<void> =>
    new Promise((resolve) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    });
  return { url: `http://127.0.0.1:${port}/grooph/`, stop };
}

/* ─── a piece that could not be fetched is asked for again (handback 0083, `src/piece.ts`) ─── */

/**
 * WebKit's fault as it was seen in CI, made to happen in any engine: a script's load fails, and goes on failing,
 * until its file has been asked for with `fetch`. Says how often the file was asked for as a script and with fetch.
 */
async function failsUntilFetched(page: Page, file: RegExp): Promise<{ scripts: number; fetches: number }> {
  const asked = { scripts: 0, fetches: 0 };
  await page.route(file, (route) => {
    if (route.request().resourceType() === "fetch") {
      asked.fetches += 1;
      return route.continue();
    }
    asked.scripts += 1;
    return asked.fetches > 0 ? route.continue() : route.abort();
  });
  return asked;
}

test("a piece whose load fails until its file has been fetched still arrives: the canvas screens, a map's views, the compiler", async ({ page }) => {
  // The canvas screens, at an address that opens on the canvas: without the second try this says "This screen could not be fetched".
  const screens = await failsUntilFetched(page, /\/assets\/screens-[^/]*\.js$/);
  await page.goto("./#/templates/built-in/review-gate");
  await expect(node(page, "builder")).toBeVisible();
  expect(screens.fetches).toBe(1);

  // A map's views: without them a map has no switch.
  const views = await failsUntilFetched(page, /\/assets\/views-[^/]*\.js$/);
  const map = parseMapText(readFileSync(join(repoRoot, "fixtures/maps/valid/two-sessions.grooph-map.json"), "utf8")).map!;
  await page.goto(`./#/open?d=${encodeSharePayload(buildShareEnvelope(map), (bytes) => deflateRawSync(bytes, { level: 9 }))}`);
  await expect(page.getByRole("radio", { name: "Sequence" })).toBeVisible();
  expect(views.fetches).toBe(1);

  // The compiler, which nothing asks for until someone exports.
  const compiler = await failsUntilFetched(page, /\/assets\/compile-[^/]*\.js$/);
  await importDocument(page, "review-loop.grooph.json", readFileSync(fixturePath, "utf8"));
  await page.getByRole("button", { name: "Export", exact: true }).tap();
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download package (.zip)" }).tap()]);
  expect(compiler.fetches).toBe(1);
  // However it came (an engine that remembers a failed module is given the file at another address, `piece.ts`),
  // the compiler that came is the compiler: the package is the golden one, byte for byte.
  const files = Object.fromEntries(Object.entries(unzipSync(await downloadBytes(zip))).map(([path, bytes]) => [path, strFromU8(bytes)]));
  const golden = readTree(goldenDir);
  expect(Object.keys(files).sort()).toEqual(Object.keys(golden).sort());
  for (const path of Object.keys(golden)) expect(files[path], path).toBe(golden[path]);
  // Each was asked for as a script once and refused, and once more after the fetch.
  for (const asked of [screens, views, compiler]) expect(asked.scripts).toBeGreaterThanOrEqual(2);
});

test("a screen that could not be fetched is asked for again when the next one is opened, with no reload", async ({ page }) => {
  // No connection for the canvas screens, however they are asked for.
  let refused = 0;
  await page.route(/\/assets\/screens-[^/]*\.js$/, (route) => {
    refused += 1;
    return route.abort();
  });
  // The address of a screen that needs them. The page asks before it draws and the app asks again as it opens, and
  // only then does the screen say so: nothing is asking any more when it does, so the connection can be given back
  // without a try that was already on its way using it. (This test once opened the screen from the list, where the
  // words show for a moment before the next try starts; on a slow machine the connection came back in that moment,
  // the try succeeded, and the test looked for a way out of a screen that had opened.)
  await page.goto("./#/templates/built-in/review-gate");
  await expect(page.getByText("This screen could not be fetched.")).toBeVisible();
  await page.evaluate(() => ((window as unknown as { sameTab: boolean }).sameTab = true));
  expect(refused).toBeGreaterThan(1);

  // The connection is back. The way out the screen offers, and the same template again: it opens, in the same page.
  await page.unroute(/\/assets\/screens-[^/]*\.js$/);
  await page.getByRole("link", { name: "Back to the library" }).tap();
  await page.evaluate(() => (location.hash = "#/templates/built-in/review-gate"));
  await expect(node(page, "builder")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { sameTab?: boolean }).sameTab)).toBe(true);
});

test.describe("with the service worker running", () => {
  // Every other spec blocks service workers so it tests the files as built; the offline visit needs the worker.
  test.use({ serviceWorkers: "allow" });

  /*
   * No network here means no server. Playwright's own offline switch cannot test this outside Chromium, for reasons
   * that are each engine's (seen in CI on 2026-10-04, Playwright 1.63):
   *
   *   WebKit   with `context.setOffline(true)` a navigation fails inside the engine ("WebKit encountered an
   *            internal error") before the worker is asked: the same error with the worker in control and with
   *            it blocked. A route that aborts every request also takes the navigation before the worker does.
   *   Firefox  `setOffline(true)` does not stop a navigation to localhost: a page with the worker blocked still
   *            loaded, with status 200. A test that passes there says nothing about the worker.
   *
   * Closing the server is the same in all three: the worker's own fetch fails, as it does on a phone in a tunnel.
   * `e2e/offline.spec.ts` keeps the longer account, in Chromium, with the switch.
   */
  test("the offline visit: after one visit with a network, the app and a template open with none", async ({ page }) => {
    const app = await serveBuiltApp();
    try {
      await page.goto(app.url);
      await frontPageIsUp(page);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      // The worker has finished keeping what the page names, the screens that draw on the canvas among them; and
      // the built-in templates and the front page's own picture, which are files of their own since slice 0093.
      for (const piece of ["screens", "builtins", "front"]) {
        await expect
          .poll(() => page.evaluate(async (name) => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => new RegExp(`/assets/${name}-[^/]*\\.js$`).test(r.url)).length, piece), { message: piece })
          .toBe(1);
      }
    } finally {
      await app.stop();
    }
    // Gone: a request that does not pass through the worker is refused.
    await expect(page.request.get(app.url)).rejects.toThrow();

    // The address typed again with no network, then addresses the first visit never asked for: the list of
    // templates, every one of them there, and a template on the canvas.
    await page.goto(app.url);
    await frontPageIsUp(page);
    await expect(page.locator(".land-picture svg.grooph-picture")).toBeVisible();
    await page.goto(`${app.url}#/templates`);
    await page.reload();
    await expect(page.locator(".template-row")).toHaveCount(readdirSync(join(repoRoot, "patterns")).filter((name) => name.endsWith(".grooph.json")).length);
    await page.goto(`${app.url}#/templates/built-in/review-gate`);
    await page.reload();
    await expect(node(page, "builder")).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);
  });
});
