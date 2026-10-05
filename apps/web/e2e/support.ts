import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import {
  buildRunBundle,
  buildShareEnvelope,
  canonicalizeRunBundle,
  encodeSharePayload,
  isCandidateFile,
  parseGraphText,
  parseProposalSetText,
  type Graph,
  type ProposalSet,
  type RunBundle,
} from "@grooph/core";
import { expect, type Download, type Locator, type Page, type Request } from "@playwright/test";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const fixturePath = join(repoRoot, "fixtures/valid/review-loop.grooph.json");
export const goldenDir = join(repoRoot, "fixtures/golden/claude-code/review-loop");

export function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out[relative(dir, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
}

/** Import a document through the library's file control, as the owner would. */
export async function importDocument(page: Page, name: string, text: string): Promise<void> {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
}

export const status = (page: Page): Locator => page.getByRole("button", { name: /^Validation:/ });
export const toolbar = (page: Page): Locator => page.getByRole("toolbar", { name: "Canvas" });
export const sheet = (page: Page): Locator => page.locator("aside.sheet");
export const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`);
export const edgeLabel = (page: Page, id: string): Locator => page.locator(`.gedge-label[data-edge-id="${id}"]`);

/**
 * A canvas has everything it asks for once the switch between its views is there. The piece behind the switch is the
 * last file a canvas fetches, some milliseconds after its nodes are drawn (slice 0092). A test that counts failed
 * requests waits for this before it reloads or leaves a page with a canvas on it: a fetch cut short by the page going
 * away is reported as failed, by Firefox every time it happens.
 */
export const canvasIsQuiet = (page: Page): Promise<void> => expect(page.getByRole("radiogroup", { name: "View of the graph" })).toBeVisible();

/**
 * A graph's change of view is seen to move for about a third of a second (`ui/become.ts`), and until it has ended
 * the browser shows a picture of the page over the page: a point of the screen is under that picture, and takes no
 * pointer. A test that reads what is under a point, or sends a pointer where Playwright is not asked to wait for the
 * element to take it, waits for this first. An engine that does not know the selector is asked for the moving
 * pictures themselves.
 */
export const viewIsStill = (page: Page): Promise<void> =>
  expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return document.documentElement.matches(":active-view-transition");
        } catch {
          return document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
        }
      }),
    )
    .toBe(false);

/**
 * The requests a page has sent that have not come back, by their addresses. To be set up before the page goes
 * anywhere. (Playwright's "network idle" never comes with a service worker in control.)
 */
export function requestsOut(page: Page): () => string[] {
  const out = new Set<Request>();
  page.on("request", (request) => out.add(request));
  page.on("requestfinished", (request) => out.delete(request));
  page.on("requestfailed", (request) => out.delete(request));
  // A `fetch` whose answer the page does not read is never finished, only answered: the app asks the worker again
  // for each file it had fetched before the worker was there, to have it kept, and drops what comes back (main.tsx).
  page.on("response", (response) => {
    if (response.request().resourceType() === "fetch") out.delete(response.request());
  });
  return () => [...out].map((request) => request.url());
}

/**
 * Wait for a first visit to be over, so that the network can be taken away as it is after a visit and not in the
 * middle of one: the worker in control; every file the page it kept names held by it, whole; and nothing the page
 * itself asked for still on its way.
 *
 * The files are read from the page the worker kept, as the worker reads them (`named` in public/sw.js), and from
 * no list in a test: a piece added to the app tomorrow is waited for without this being looked at again. A test
 * that waited for three of them by name passed until a screen it then opened with no network needed a fourth
 * (the offline visit in Safari's engine, 2026-10-05). Each is read back in full and measured against the built
 * file: an engine may list a file in its cache before the whole of it has come.
 *
 * `out` is `requestsOut(page)`. The page fetches pieces for itself once its first screen is up, beside the
 * worker's own fetch of the same files; a network that goes while one of those is half-way is another event than
 * "no network after a visit", and an engine may say so in the page's console.
 */
export async function visitIsOver(page: Page, out: () => string[], { dist = join(repoRoot, "apps/web/dist"), within = 30_000 }: { dist?: string; within?: number } = {}): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const notWhole = async (): Promise<string[]> => {
    const read = await page.evaluate(async () => {
      const cache = await caches.open("grooph-app-v1");
      const scope = (await navigator.serviceWorker.ready).scope;
      const kept = await cache.match(scope, { ignoreVary: true });
      if (!kept) return undefined;
      const html = await kept.text();
      const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g), ...html.matchAll(/"([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
      const files = [...new Set(found)].map((path) => new URL(path, scope)).filter((u) => u.origin === location.origin && u.href.startsWith(scope));
      return Promise.all(
        files.map(async (u) => {
          const hit = await cache.match(u.href, { ignoreVary: true });
          // The whole body, as a page with no network would be handed it.
          const bytes = hit ? await hit.arrayBuffer().then((body) => body.byteLength, () => -1) : undefined;
          return { path: u.pathname.slice(new URL(scope).pathname.length), bytes };
        }),
      );
    });
    if (!read) return ["the page itself is not kept yet"];
    if (read.filter((file) => file.path.startsWith("assets/")).length < 10) return [`the kept page names only ${read.length} files`];
    return read.flatMap((file) => {
      const built = statSync(join(dist, file.path || "index.html")).size;
      return file.bytes === built ? [] : [`${file.path || "the page"}: ${file.bytes === undefined ? "not held" : `${file.bytes} of ${built} bytes`}`];
    });
  };
  await expect.poll(notWhole, { message: "files the page names that the worker does not hold whole", timeout: within }).toEqual([]);
  // And the page's own requests are back, and stay back for a moment: what it starts once it is in the worker's
  // hands (it asks again, through the worker, for what it had fetched before) has started and ended by then.
  await expect
    .poll(
      async () => {
        if (out().length > 0) return out();
        await page.waitForTimeout(300);
        return out();
      },
      { message: "requests the page has sent that have not come back", timeout: within },
    )
    .toEqual([]);
}

export async function closeSheet(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close panel" });
  if (await close.isVisible()) await close.tap();
}

export async function fit(page: Page): Promise<void> {
  await toolbar(page).getByRole("button", { name: "Fit" }).tap();
  await page.waitForTimeout(350);
}

export async function downloadText(download: Download): Promise<string> {
  return readFileSync((await download.path())!, "utf8");
}

export async function downloadBytes(download: Download): Promise<Uint8Array> {
  return new Uint8Array(readFileSync((await download.path())!));
}

/* ─── share links (slice 0006) ──────────────────────────────────────────── */

export const csvSetDir = join(repoRoot, "fixtures/proposals/valid/csv-export");

/** The three-candidate rehearsal set with its `{ file }` candidates inlined, as `grooph share` sends it. */
export function csvSet(): ProposalSet {
  const set = parseProposalSetText(readFileSync(join(csvSetDir, "csv-export.grooph-proposals.json"), "utf8")).set!;
  return {
    ...set,
    candidates: set.candidates.map((c) =>
      isCandidateFile(c.graph) ? { ...c, graph: parseGraphText(readFileSync(join(csvSetDir, c.graph.file), "utf8")).doc! } : c,
    ),
  };
}

export const reviewLoop = (): Graph => parseGraphText(readFileSync(fixturePath, "utf8")).doc!;

/** The app-relative link `grooph share` would print: core's envelope, zlib raw DEFLATE, as the CLI does it. */
export const linkFor = (doc: Graph | ProposalSet | RunBundle): string =>
  `./#/open?d=${encodeSharePayload(buildShareEnvelope(doc), (bytes) => deflateRawSync(bytes, { level: 9 }))}`;

export const pager = (page: Page): Locator => page.locator(".pager-count");

/* ─── runs (slice 0008) ─────────────────────────────────────────────────── */

export const runsDir = join(repoRoot, "fixtures/runs");
export const REAL_RUN = "20260919-0057-66c8";

/**
 * A run in fixtures/runs/ as `grooph runs bundle` builds it: the graph folder's
 * source, the run's working copy, notes and progress. `notes` trims or extends
 * the notes, to show a run at an earlier or later moment.
 */
export function runBundle(graphId: string, options: { notes?: (lines: string[]) => string[] } = {}): RunBundle {
  const graphDir = join(runsDir, graphId);
  const run = readdirSync(join(graphDir, "runs"))[0]!;
  const runDir = join(graphDir, "runs", run);
  const graph = (path: string): Graph => parseGraphText(readFileSync(path, "utf8")).doc!;
  const lines = readFileSync(join(runDir, "notes.jsonl"), "utf8").split("\n").filter((l) => l !== "");
  let progress: string | undefined;
  try {
    progress = readFileSync(join(runDir, "PROGRESS.md"), "utf8");
  } catch {
    progress = undefined;
  }
  return buildRunBundle({
    source: graph(join(graphDir, "graph.grooph.json")),
    working: graph(join(runDir, "graph.grooph.json")),
    notesText: (options.notes ? options.notes(lines) : lines).join("\n"),
    run,
    ...(progress !== undefined ? { progress } : {}),
  });
}

export const bundleText = (bundle: RunBundle): string => canonicalizeRunBundle(bundle);

/** The graph documents in this browser's library, read straight from IndexedDB. */
export async function libraryDocs(page: Page): Promise<Graph[]> {
  return page.evaluate(
    () =>
      new Promise<Graph[]>((resolve, reject) => {
        const req = indexedDB.open("grooph");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("graphs")) return resolve([]);
          const all = db.transaction("graphs").objectStore("graphs").getAll();
          all.onsuccess = () => {
            resolve((all.result as { doc: Graph; createdAt: number }[]).sort((a, b) => a.createdAt - b.createdAt).map((r) => r.doc));
            db.close();
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

export const runNode = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"] .gnode`);
export const runBadge = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"] .run-badge`);
export const noteItem = (page: Page, id: string): Locator => page.locator(`.tl-item[data-note-id="${id}"]`);
export const runTab = (page: Page, name: string): Locator => page.getByRole("tab", { name: new RegExp(`^${name}`) });
