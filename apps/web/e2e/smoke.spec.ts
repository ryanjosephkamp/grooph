import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

import { buildShareEnvelope, encodeSharePayload, parseMapText } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { downloadBytes, fixturePath, goldenDir, importDocument, libraryDocs, linkFor, node, readTree, repoRoot, requestsOut, runBundle, runTab, status, viewIsStill, visitIsOver } from "./support.js";

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
/**
 * One line a browser writes is not an error in the page, and is let through: "ResizeObserver loop completed with
 * undelivered notifications."
 *
 * A ResizeObserver's callback changed the layout, and what that resized is told to its observers on the next frame
 * and not on this one. Nothing is lost and nothing throws. Safari's engine writes the line to the page's console as
 * an error, which Playwright hands on as a page error there and in no other engine; so the same event failed a
 * visit in one engine and was never seen in the other two. It was seen in CI on 2026-10-05, twice in one job on a
 * slow runner and in no other run: on a template's canvas with no network. The first of the two times the graph's
 * own views had not arrived, so no observer of ours was on that screen at all: only the canvas library's. It has
 * two (@xyflow/react 12): one on the pane, and one on every node, whose callback writes the nodes' sizes to the
 * library's store (`updateNodeInternals`), which redraws them there and then. That is the pattern the line is
 * written for. The other observers of ours are on screens these visits do not open: an embed, a map's views, a
 * view in three dimensions.
 *
 * So the line is let through, and not silently. Each page says which elements were being told of a resize in the
 * frame the line was written in (below). The visit prints that, so a run that passes still shows it. And if every
 * one of those elements is ours and none the canvas library's, the loop is ours and the visit fails, naming them:
 * an observer of ours that changes the layout it watches is a fault.
 */
const RESIZE_LOOP = "ResizeObserver loop completed with undelivered notifications.";
type Loop = { at: string; library: string[]; ours: string[] };
let loops: Loop[] = [];
let out: () => string[] = () => [];

test.beforeEach(async ({ page, context }) => {
  pageErrors = [];
  outsideRequests = [];
  loops = [];
  out = requestsOut(page);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.exposeFunction("groophSizedLoop", (loop: Loop) => void loops.push(loop));
  await page.addInitScript(() => {
    // Every ResizeObserver of the page says, as it is called, which elements it was called for and in which frame.
    const Native = window.ResizeObserver;
    if (typeof Native !== "function") return;
    let frame = 0;
    const tick = (): void => {
      frame += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const told: { frame: number; what: string; library: boolean }[] = [];
    const name = (el: Element): string => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`;
    window.ResizeObserver = class extends Native {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          for (const entry of entries) told.push({ frame, what: name(entry.target), library: entry.target.closest(".react-flow") !== null });
          while (told.length > 600) told.shift();
          callback(entries, observer);
        });
      }
    };
    addEventListener("error", (event) => {
      if (!/ResizeObserver loop/.test(event.message ?? "")) return;
      const now = told.filter((one) => one.frame >= frame - 1);
      const list = (library: boolean): string[] => [...new Set(now.filter((one) => one.library === library).map((one) => one.what))];
      void (window as unknown as { groophSizedLoop: (loop: unknown) => Promise<void> }).groophSizedLoop({ at: location.hash || "#/", library: list(true), ours: list(false) });
    });
  });
  // The context hears every page's requests, and in Chromium the service worker's own.
  context.on("request", (request) => {
    if (outside(request.url())) outsideRequests.push(request.url());
  });
  page.on("websocket", (socket) => {
    if (outside(socket.url())) outsideRequests.push(socket.url());
  });
});
test.afterEach(({}, testInfo) => {
  expect(pageErrors.filter((message) => message !== RESIZE_LOOP), "uncaught errors in the page").toEqual([]);
  expect(outsideRequests, "requests to another host").toEqual([]);
  // The one line let through (above): said, so that it is not lost on a run that passes; and ours to answer for
  // when no element of the canvas library's was being told of a resize in that frame.
  const written = pageErrors.filter((message) => message === RESIZE_LOOP).length;
  if (written > 0 || loops.length > 0) {
    const said = loops.map((loop) => `at ${loop.at}: the canvas library's ${loop.library.join(", ") || "(none)"}; ours ${loop.ours.join(", ") || "(none)"}`);
    console.log(`[${testInfo.project.name}] ${testInfo.title}: a ResizeObserver put off notifications to the next frame ${Math.max(written, loops.length)} time(s). ${said.join(" | ") || "The page did not say which elements."}`);
    testInfo.annotations.push({ type: "resize-loop", description: said.join(" | ") || "not said by the page" });
  }
  expect(loops.filter((loop) => loop.ours.length > 0 && loop.library.length === 0).map((loop) => `at ${loop.at}: ${loop.ours.join(", ")}`), "a ResizeObserver of ours that changes the layout it watches").toEqual([]);
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

test("a graph is seen in three dimensions and as its picture again, whichever way this engine changes the view", async ({ page }, testInfo) => {
  // Handoff 0092: where an engine has view transitions each node is seen to go to its card, and back (`ui/become.ts`);
  // where it has none the view is changed in one paint. Either way it ends on the scene, and then on the canvas as
  // it was. Which of the two this engine took is printed, so that a run's log says what was tried in it, with how
  // long each move took from being asked for to its end: an engine left waiting for the change holds the page for
  // seconds, and that would be seen here and nowhere else before a person saw it. Only the end of a move is listened
  // to, which never fails: a move given up that nobody had read is still the page's own error.
  await page.addInitScript(() => {
    const real = document.startViewTransition?.bind(document);
    if (!real) return;
    const took: number[] = [];
    Object.assign(window, { __took: took });
    document.startViewTransition = (update?: unknown) => {
      const from = performance.now();
      const move = real(update as ViewTransitionUpdateCallback);
      const at = took.push(-1) - 1;
      void move.finished.then(() => (took[at] = Math.round(performance.now() - from)));
      return move;
    };
  });
  await page.goto("./#/templates/built-in/review-gate");
  const ids = ["builder", "critic", "merge-gate", "done"];
  for (const id of ids) await expect(node(page, id)).toBeVisible();
  const views = page.getByRole("radiogroup", { name: "View of the graph" });
  await expect(views).toBeVisible();
  const moves = await page.evaluate(() => typeof document.startViewTransition === "function");
  const under = (id: string) =>
    node(page, id).evaluate((el) => {
      const box = el.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest(".react-flow__node") === el;
    });
  expect(await under("builder")).toBe(true);

  await views.getByRole("radio", { name: "3D" }).tap();
  const scene = page.locator(".space-scene");
  await expect(scene).toBeVisible();
  await expect.poll(() => page.locator(".space-world").evaluate((el) => (el as HTMLElement).style.transform)).toContain("scale3d(");
  await viewIsStill(page);
  await expect(views.getByRole("radio", { name: "3D" })).toHaveAttribute("aria-checked", "true");
  // Every node has its card, drawn with a size, and none is left carrying a name for a move that has ended.
  const cards = await scene.locator(".space-card").evaluateAll((els) => els.map((el) => [el.querySelector("[data-node]")?.getAttribute("data-node"), Math.round(el.getBoundingClientRect().width), (el as HTMLElement).style.getPropertyValue("view-transition-name")] as const));
  expect(cards.map(([id]) => id).sort()).toEqual([...ids].sort());
  for (const [id, width, name] of cards) expect([id, width > 10, name]).toEqual([id, true, ""]);

  await views.getByRole("radio", { name: "Picture" }).tap();
  await expect(page.locator(".space")).toHaveCount(0);
  await viewIsStill(page);
  await expect(views.getByRole("radio", { name: "Picture" })).toHaveAttribute("aria-checked", "true");
  for (const id of ids) await expect(node(page, id)).toBeVisible();
  // The canvas is the page's again: a node is what is under its own middle.
  expect(await under("builder")).toBe(true);
  const took = await page.evaluate(() => (window as unknown as { __took?: number[] }).__took ?? []);
  console.log(`SWITCH ${testInfo.project.name} | view transitions: ${moves ? "yes" : "no"} | each move, asked for to ended, ms: ${took.join(", ") || "none"}`);
  // Where the engine moves the view there were two moves, and neither held the page.
  expect(took.length).toBe(moves ? 2 : 0);
  for (const ms of took) expect(ms).toBeGreaterThanOrEqual(0);
  for (const ms of took) expect(ms).toBeLessThan(2500);
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
async function serveBuiltApp({ without }: { without?: RegExp } = {}): Promise<{ url: string; stop: () => Promise<void> }> {
  const dist = join(repoRoot, "apps/web/dist");
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    let file = normalize(join(dist, path.replace(/^\/grooph\//, "")));
    if (path.endsWith("/")) file = join(file, "index.html");
    if (!path.startsWith("/grooph/") || !(file + sep).startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile() || without?.test(path)) {
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

test("Adopt with its check of the brakes refused saves nothing, and adopts once the check can be had", async ({ page }) => {
  // A run's page holds a working copy to its source's brakes before it saves one (docs/runs.md §5), by a piece
  // fetched when Adopt is pressed. No comparison, no save: not an unchecked one.
  let refused = 0;
  await page.route(/\/assets\/brakes-[^/]*\.js$/, (route) => {
    refused += 1;
    return route.abort();
  });
  await page.goto(linkFor(runBundle("slice-0007-sandwich")));
  await runTab(page, "Changes").tap();
  await page.getByRole("button", { name: "Adopt as version 2" }).tap();
  await expect(page.getByText("Could not check this working copy's brakes, so nothing was saved. Press Adopt to try again.")).toBeVisible();
  await expect(page.locator(".adopt-done")).toHaveCount(0);
  expect(refused).toBeGreaterThan(0);

  // The connection is back: the same button, in the same page, checks and saves. One document is in the library
  // then, the one saved now: the refused press had saved none. (Read once, after the app has made its own store.)
  await page.unroute(/\/assets\/brakes-[^/]*\.js$/);
  await page.getByRole("button", { name: "Adopt as version 2" }).tap();
  await expect(page.locator(".adopt-done")).toContainText("Saved version 2 of Slice 0007 sandwich to this device as a new graph.");
  expect((await libraryDocs(page)).map((doc) => doc.version)).toEqual([2]);
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
      // The visit is over before the network goes: the worker holds every file the page names, whole, and nothing
      // the page asked for is still on its way (`visitIsOver`). Not three files by name, as it was: a template on
      // the canvas, opened below with no network, also asks for the graph's views, and whatever is added next.
      await visitIsOver(page, out);
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

  test("with no network, Adopt still checks a working copy's brakes: the worker holds the piece", async ({ page }) => {
    const app = await serveBuiltApp();
    try {
      await page.goto(app.url);
      await frontPageIsUp(page);
      await visitIsOver(page, out);
    } finally {
      await app.stop();
    }
    await expect(page.request.get(app.url)).rejects.toThrow();

    // A run whose working copy raised its round cap, opened from a link with no network: not saved, and named.
    const loosened = runBundle("slice-0007-sandwich");
    loosened.working.loops[0]!.stops = loosened.working.loops[0]!.stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 50 } : stop));
    await page.goto(`${app.url}${linkFor(loosened).slice(2)}`);
    await page.reload();
    await runTab(page, "Changes").tap();
    await page.getByRole("button", { name: "Adopt as version 2" }).tap();
    await expect(page.locator('[data-brakes="refused"]')).toContainText("Not adopted: this working copy loosens a brake.");
    await expect(page.locator('[data-brakes="loosens"] li')).toHaveText(["loop:sandwich.stops raises the round cap from 5 to 50"]);
    await expect(page.locator(".adopt-done")).toHaveCount(0);

    // And the run as it was, which loosens nothing, is checked and saved.
    await page.goto(`${app.url}${linkFor(runBundle("slice-0007-sandwich")).slice(2)}`);
    await page.reload();
    await runTab(page, "Changes").tap();
    await page.getByRole("button", { name: "Adopt as version 2" }).tap();
    await expect(page.locator(".adopt-done")).toContainText("Saved version 2 of Slice 0007 sandwich to this device as a new graph.");
    // One document in the library, the one saved now: the refused press had saved none.
    expect((await libraryDocs(page)).map((doc) => doc.version)).toEqual([2]);
  });

  test("the wait for a visit to be over does not pass while a file the page names is not held: it says which", async ({ page }) => {
    // What the offline visit above leans on, held to its word in each engine. One piece no first screen asks for
    // cannot be had from this server; the worker keeps the rest, takes control, and the page is up.
    const app = await serveBuiltApp({ without: /\/assets\/graph-views-[^/]*\.js$/ });
    try {
      await page.goto(app.url);
      await frontPageIsUp(page);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      // Three files by name, as the wait once was, are all there: it would have let the network go.
      for (const piece of ["screens", "builtins", "front"]) {
        await expect.poll(() => page.evaluate(async (name) => (await (await caches.open("grooph-app-v1")).keys()).filter((r) => new RegExp(`/assets/${name}-[^/]*\\.js$`).test(r.url)).length, piece), { message: piece }).toBe(1);
      }
      const waited = await visitIsOver(page, out, { within: 3000 }).then(
        () => "the visit was called over",
        (error: Error) => error.message,
      );
      expect(waited).toMatch(/files the page names that the worker does not hold whole/);
      expect(waited).toMatch(/assets\/graph-views-[\w-]+\.js: not held/);
      // Only that one: every other file the page names is held, whole.
      expect(waited.match(/: not held|of \d+ bytes/g)).toHaveLength(1);
    } finally {
      await app.stop();
    }
  });
});
