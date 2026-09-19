import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalize, type Graph, type RunBundle } from "@grooph/core";
import { expect, test, type Page, type Request } from "@playwright/test";

import { REAL_RUN, bundleText, libraryDocs, linkFor, noteItem, runBadge, runBundle, runNode, runTab, runsDir } from "./support.js";

/**
 * Handoff 0008, criteria 6 to 8: the run view at phone size. The real record
 * of slice 0007's run opens from a link and from an imported bundle; node
 * states, the loop round and the timeline render; the change list, Adopt,
 * Discard, Apply to a copy and Pin work on the device's library; a live view
 * polls a stub endpoint; nothing is requested from anywhere but the app.
 */

const real = (): RunBundle => runBundle("slice-0007-sandwich");
const source = (): Graph => real().source;

/** Put the run's source into the library, as the owner who placed the package would have it. */
async function saveSource(page: Page): Promise<void> {
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "slice-0007-sandwich.grooph.json", mimeType: "application/json", buffer: Buffer.from(canonicalize(source())) });
  await expect(page.getByRole("button", { name: /^Validation:/ })).toBeVisible();
}

const status = (page: Page) => page.locator(".run-status");

test("the real run opens from a link: node states, the loop's round, and the timeline in order", async ({ page }) => {
  await page.goto(linkFor(real()));
  await expect(page.locator(".title-name")).toHaveText("Slice 0007 sandwich");
  await expect(page.locator(".title-sub")).toHaveText(`Run ${REAL_RUN} · from a link`);
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Ended · pass");

  for (const id of ["builder", "checks", "critic"]) {
    await expect(runBadge(page, id)).toHaveText("passed×2");
    await expect(runBadge(page, id).locator("svg.state-icon")).toHaveCount(1);
    await expect(runNode(page, id)).toHaveClass(/run-passed/);
  }
  await expect(runBadge(page, "done")).toHaveText("passed");
  await expect(page.locator('.loop-pill[data-loop-id="sandwich"]')).toHaveText("Sandwichround 1· bar passed");
  await expect(page.locator(".run-line")).toHaveText("41 min start to end · cost noted: 26 minutes, 31 turns · 15 notes");

  // The timeline, oldest first for a run that has ended; amendments and proposals are marked.
  const items = page.locator(".tl-item");
  await expect(items).toHaveCount(15);
  await expect(items.first()).toHaveAttribute("data-note-id", "n-0001");
  await expect(items.last()).toHaveAttribute("data-note-id", "n-0015");
  await expect(noteItem(page, "n-0002").locator(".mark-amendment")).toHaveText("Amendment");
  await expect(noteItem(page, "n-0008").locator(".mark-proposal")).toHaveText("Proposal");
  await expect(noteItem(page, "n-0006").locator(".tl-outcome")).toHaveText("fail");
  await expect(noteItem(page, "n-0006").locator(".tl-round")).toHaveText("round 0");

  // Tapping a note lights up its object: a node, an edge, a loop.
  await noteItem(page, "n-0006").locator(".tl-note").tap();
  await expect(runNode(page, "critic")).toHaveClass(/is-highlighted/);
  await expect(runNode(page, "builder")).not.toHaveClass(/is-highlighted/);
  await expect(noteItem(page, "n-0006")).toContainText("storage notice 'Got it' is btn-small");
  await noteItem(page, "n-0008").locator(".tl-note").tap();
  await expect(page.locator('.react-flow__edge[data-id="e-checks-critic"] .gedge')).toHaveClass(/is-highlighted/);
  await expect(runNode(page, "critic")).toHaveClass(/is-highlighted/);
  await noteItem(page, "n-0012").locator(".tl-note").tap();
  await expect(page.locator('.loop-pill[data-loop-id="sandwich"]')).toHaveClass(/is-on/);
  await expect(runNode(page, "checks")).toHaveClass(/in-loop/);
  await expect(runNode(page, "done")).not.toHaveClass(/in-loop/);
  // Tapping it again lets go.
  await noteItem(page, "n-0012").locator(".tl-note").tap();
  await expect(page.locator('.loop-pill[data-loop-id="sandwich"]')).not.toHaveClass(/is-on/);

  // Tapping a node finds its last note.
  await runNode(page, "builder").tap();
  await expect(noteItem(page, "n-0009")).toHaveClass(/is-on/);

  // Nothing is stored until the owner says so.
  await page.getByRole("link", { name: "All graphs" }).tap();
  await expect(page.getByText("No graphs on this device yet.")).toBeVisible();
});

test("the real run opens from an imported bundle file and is listed under its graph", async ({ page }) => {
  await saveSource(page);
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: `${REAL_RUN}.grooph-run.json`, mimeType: "application/json", buffer: Buffer.from(bundleText(real())) });
  await expect(page.locator(".title-sub")).toHaveText(`Run ${REAL_RUN} · on this device`);
  await expect(page).toHaveURL(/#\/run\/slice-0007-sandwich%2F20260919-0057-66c8$/);
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Ended · pass");
  await expect(runBadge(page, "critic")).toHaveText("passed×2");

  await page.getByRole("link", { name: "All graphs" }).tap();
  const row = page.locator(".graph-row", { hasText: "Slice 0007 sandwich" });
  await expect(row.locator(".run-row")).toHaveText(`Run ${REAL_RUN}ended · pass`);
  await row.locator(".run-row").tap();
  await expect(page.locator(".title-sub")).toHaveText(`Run ${REAL_RUN} · on this device`);

  // The same run imported again replaces the stored one rather than adding a second.
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: "again.grooph-run.json", mimeType: "application/json", buffer: Buffer.from(bundleText(real())) });
  await expect(page.locator(".title-sub")).toContainText("on this device");
  await page.getByRole("link", { name: "All graphs" }).tap();
  await expect(page.locator(".run-row")).toHaveCount(1);

  // A broken bundle is refused with the reason, and nothing is stored.
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.grooph-run.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ groophRun: 0, run: "x" })) });
  await expect(page.locator(".refusal")).toContainText("It is a run bundle grooph cannot read.");
  await expect(page.locator(".refusal")).toContainText("/source: missing required property");
});

test("the change list shows the three changes tied to n-0002; Adopt saves version 2 and the source stays", async ({ page }) => {
  await saveSource(page);
  await page.goto(linkFor(real()));
  await runTab(page, "Changes").tap();
  await expect(runTab(page, "Changes")).toHaveAttribute("aria-selected", "true");
  await expect(runTab(page, "Changes").locator(".run-tab-count")).toHaveText("3");
  const changes = page.locator(".change");
  await expect(changes.locator(".change-line")).toHaveText([
    "Changed the graph's other limits (constraints.other)",
    "Changed the outputs of Builder (builder)",
    "Changed the outputs of Critic (critic)",
  ]);
  for (let i = 0; i < 3; i++) await expect(changes.nth(i).locator(".change-why button")).toHaveText("n-0002");
  await expect(changes.nth(0).locator("del")).toContainText("Touch apps/web only.");
  await expect(changes.nth(0).locator("ins")).toContainText("Touch only the paths handoffs/0007-web-templates/HANDOFF.md allows");
  await expect(changes.nth(1).locator("li.ins")).toContainText("CHANGES.md: what changed this round, at .grooph/slice-0007-sandwich/runs/<run-id>/round-<n>/CHANGES.md");
  await expect(changes.nth(1).locator(".field-kept")).toHaveText("2 unchanged");
  await expect(page.locator(".change-why.is-unexplained")).toHaveCount(0);

  // The note that explains a change is one tap away.
  await changes.nth(2).locator(".change-why button").tap();
  await expect(runTab(page, "Timeline")).toHaveAttribute("aria-selected", "true");
  await expect(noteItem(page, "n-0002")).toHaveClass(/is-on/);
  await runTab(page, "Changes").tap();

  const before = await libraryDocs(page);
  expect(before.map((d) => d.version)).toEqual([1]);
  await page.getByRole("button", { name: "Adopt as version 2" }).tap();
  await expect(page.locator(".adopt-done")).toContainText("Saved version 2 of Slice 0007 sandwich to this device as a new graph. The source stays as it was.");

  const after = await libraryDocs(page);
  expect(after.map((d) => d.version)).toEqual([1, 2]);
  expect(canonicalize(after[0]!)).toBe(canonicalize(before[0]!));
  const adopted = after[1]!;
  expect(adopted.id).toBe("slice-0007-sandwich");
  expect(adopted.lineage).toEqual({ pattern: "metric-sandwich", from: "slice-0007-sandwich@1" });
  const byHand = JSON.parse(readFileSync(join(runsDir, "slice-0007-sandwich.adopted-by-hand.grooph.json"), "utf8")) as Graph;
  const aside = (g: Graph) => canonicalize({ ...g, description: undefined, lineage: { ...g.lineage, from: undefined } } as Graph);
  expect(aside(adopted)).toBe(aside(byHand));

  await page.getByRole("link", { name: "Open version 2" }).tap();
  await expect(page.getByRole("button", { name: /^Validation:/ })).toHaveText("Valid");
});

test("Discard leaves everything as it was, and says so", async ({ page }) => {
  await saveSource(page);
  const before = await libraryDocs(page);
  await page.goto(linkFor(real()));
  await runTab(page, "Changes").tap();
  await page.getByRole("button", { name: "Discard" }).tap();
  await expect(page.locator(".adopt-done")).toHaveText(/^Discarded\. Nothing on this device changed, and the source stays at version 1\./);
  await expect(page.getByRole("button", { name: "Adopt as version 2" })).toHaveCount(0);
  expect((await libraryDocs(page)).map(canonicalize)).toEqual(before.map(canonicalize));
  // Discarding is not final: the choice can be taken back until the owner leaves.
  await page.getByRole("button", { name: "Undo" }).tap();
  await expect(page.getByRole("button", { name: "Adopt as version 2" })).toBeVisible();
});

test("a working copy with export errors cannot be adopted, and the view says why", async ({ page }) => {
  await page.goto(linkFor(runBundle("run-broken")));
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Running");
  await runTab(page, "Changes").tap();
  await expect(page.locator(".change-line")).toHaveText(["Added agent node Docs writer (docs)", "Added edge Critic → doc (e-critic-docs)"]);
  await expect(page.locator(".refusal")).toContainText("This working copy cannot be adopted.");
  await expect(page.locator(".refusal .issue-lines")).toContainText("E_DANGLING_REF");
  await expect(page.getByRole("button", { name: /^Adopt/ })).toHaveCount(0);
  await expect(page.getByText("Not every change here is a grooph op")).toBeVisible();
});

test("Apply to a copy applies the real n-0008 op list to a new version; a JSON Patch is explained, not applied", async ({ page }) => {
  await page.goto(linkFor(real()));
  await runTab(page, "Proposals").tap();
  const proposal = page.locator('.proposal[data-proposal="n-0008"]');
  await expect(proposal.locator(".proposal-summary")).toContainText("let the critic also read, at the head commit");
  await expect(proposal.locator(".op-list li")).toHaveText(["updateEdge e-checks-critic: evidence"]);
  await proposal.getByRole("button", { name: "Apply to a copy" }).tap();
  await expect(proposal.locator(".adopt-done")).toContainText("Saved a copy of the working copy with n-0008 applied, as version 2, for you to inspect; it validates. Nothing else changed.");
  const docs = await libraryDocs(page);
  expect(docs).toHaveLength(1);
  const copy = docs[0]!;
  expect(copy.version).toBe(2);
  expect(copy.edges.find((e) => e.id === "e-checks-critic")!.evidence).toEqual([
    "diff of the change",
    "files at the head commit that the diff touches or references, read-only",
    "handoffs/0007-web-templates/HANDOFF.md",
    "screenshots in handoffs/0007-web-templates/",
  ]);

  await page.goto(linkFor(runBundle("run-gate")));
  await runTab(page, "Proposals").tap();
  const gate = page.locator('.proposal[data-proposal="n-0007"]');
  await expect(gate.locator(".proposal-summary")).toHaveText("raise the turn budget from 40 to 60");
  await expect(gate).toContainText("This patch uses index paths (JSON Patch), which grooph does not replay");
  await expect(gate.locator("pre")).toContainText('"path": "/loops/0/stops/1/limit"');
  await expect(gate.getByRole("button", { name: "Apply to a copy" })).toHaveCount(0);
});

test("Pin to graph copies a note into the graph's notes, once", async ({ page }) => {
  await saveSource(page);
  await page.goto(linkFor(real()));
  await noteItem(page, "n-0006").locator(".tl-note").tap();
  await noteItem(page, "n-0006").getByRole("button", { name: "Pin to graph" }).tap();
  await expect(noteItem(page, "n-0006").getByRole("status")).toContainText("Pinned n-0006 to Slice 0007 sandwich on this device.");
  let docs = await libraryDocs(page);
  expect(docs).toHaveLength(1);
  const pinned = docs[0]!.notes!;
  expect(pinned.map((n) => n.id)).toEqual(["n-0006"]);
  expect(pinned[0]!.gaps).toEqual(["storage notice 'Got it' is btn-small, ~33 CSS px tall, under the 44 px floor (criterion 11)"]);

  // Opened again from the link, the same note is not pinned twice.
  await page.goto("./");
  await page.goto(linkFor(real()));
  await noteItem(page, "n-0006").locator(".tl-note").tap();
  await noteItem(page, "n-0006").getByRole("button", { name: "Pin to graph" }).tap();
  await expect(noteItem(page, "n-0006").getByRole("status")).toContainText("Already pinned to Slice 0007 sandwich.");
  docs = await libraryDocs(page);
  expect(docs[0]!.notes).toHaveLength(1);
  await noteItem(page, "n-0006").getByRole("link", { name: "Open the graph" }).tap();
  await expect(page.getByRole("button", { name: /^Validation:/ })).toHaveText("Valid");
});

test("Pin to graph on a device without the graph saves the source with the note on it", async ({ page }) => {
  await page.goto(linkFor(real()));
  await noteItem(page, "n-0014").locator(".tl-note").tap();
  await noteItem(page, "n-0014").getByRole("button", { name: "Pin to graph" }).tap();
  await expect(noteItem(page, "n-0014").getByRole("status")).toContainText("Saved Slice 0007 sandwich to this device with n-0014 pinned to it.");
  const docs = await libraryDocs(page);
  expect(docs.map((d) => [d.version, d.notes?.map((n) => n.id)])).toEqual([[1, ["n-0014"]]]);
});

test("halted, failed, pending: every state has an icon and a label besides its colour", async ({ page }) => {
  await page.goto(linkFor(runBundle("run-gate")));
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Halted");
  await expect(runBadge(page, "merge-gate")).toHaveText("halted");
  await expect(runNode(page, "merge-gate")).toHaveClass(/run-halted/);
  await expect(runBadge(page, "done")).toHaveText("pending");
  await expect(runNode(page, "done")).toHaveClass(/run-pending/);

  // The real run as it stood after round 0: the critic had failed.
  await page.goto(linkFor(runBundle("slice-0007-sandwich", { notes: (lines) => lines.slice(0, 7) })));
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Running");
  await expect(runBadge(page, "critic")).toHaveText("failed");
  for (const state of ["passed", "failed", "pending"]) {
    const icon = page.locator(`.run-badge-${state} svg.state-icon.state-${state}`).first();
    await expect(icon).toBeAttached();
  }
  await expect(page.locator(".run-badge-pending")).toHaveText(["pending"]);

  // A notes file with lines that cannot be read still opens, and says which.
  await page.goto(linkFor(runBundle("run-malformed")));
  await expect(page.locator(".tl-item")).toHaveCount(3);
  await expect(page.locator(".tl-unread")).toContainText("2 lines of notes.jsonl could not be read.");
  await expect(page.locator(".tl-unread")).toContainText("line 3: not JSON");
});

/* ─── live, through a stub of the grooph watch endpoint ──────────────────── */

const liveBundle = (extra: object[] = []): RunBundle =>
  runBundle("run-live", { notes: (lines) => [...lines, ...extra.map((n) => JSON.stringify({ run: "20260919-1100-live", ...n }))] });

const FINISH = [
  { id: "n-0005", at: "node:critic", ended: "2026-09-19T11:12:00Z", outcome: "pass", verdict: "pass", round: 0 },
  { id: "n-0006", at: "loop:review-cycle", ended: "2026-09-19T11:12:00Z", outcome: "pass", round: 0, text: "bar passed fires" },
  { id: "n-0007", at: "node:merge-gate", ended: "2026-09-19T11:13:00Z", outcome: "pass", verdict: "approve", round: 0 },
  { id: "n-0008", at: "node:done", ended: "2026-09-19T11:13:00Z", outcome: "pass" },
  { id: "n-0009", at: "graph", ended: "2026-09-19T11:13:00Z", outcome: "pass", text: "run ended at done" },
];

/** Serve `bundles` in turn from the watch endpoint, the last one for good; count the requests. */
async function stubWatch(page: Page, bundles: RunBundle[]): Promise<{ count: () => number }> {
  let n = 0;
  await page.route("**/grooph/api/run.json", (route) => {
    const bundle = bundles[Math.min(n, bundles.length - 1)]!;
    n += 1;
    return route.fulfill({ status: 200, contentType: "application/json; charset=utf-8", body: bundleText(bundle) });
  });
  return { count: () => n };
}

test("live: the view polls the watch endpoint and follows the run from started to passed, then stops asking", async ({ page }) => {
  const watch = await stubWatch(page, [liveBundle(), liveBundle(), liveBundle(FINISH)]);
  await page.goto("./#/run?live");
  await expect(page.locator(".title-sub")).toHaveText("Run 20260919-1100-live · live");
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Running");
  await expect(runBadge(page, "critic")).toHaveText("running");
  await expect(runNode(page, "critic")).toHaveClass(/run-running/);
  await expect(page.locator("p.run-origin")).toContainText("Live from grooph watch");
  // Newest first while live.
  await expect(page.locator(".tl-item").first()).toHaveAttribute("data-note-id", "n-0004");

  await expect(runBadge(page, "critic")).toHaveText("passed", { timeout: 8_000 });
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Ended · pass");
  await expect(runBadge(page, "done")).toHaveText("passed");
  await expect(page.locator(".tl-item").first()).toHaveAttribute("data-note-id", "n-0001");
  await expect(page.locator("p.run-origin")).toContainText("The run ended");
  const asked = watch.count();
  expect(asked).toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(4_500);
  expect(watch.count()).toBe(asked);

  // A live run can be kept.
  await page.getByRole("button", { name: "Save a copy" }).tap();
  await expect(page.getByText("Saved this run to this device; your graphs list it under its graph.")).toBeVisible();
});

test("live: a server that is not grooph watch, or one that stops answering, is said plainly", async ({ page }) => {
  await page.route("**/grooph/api/run.json", (route) => route.fulfill({ status: 404, contentType: "text/html", body: "<h1>404</h1>" }));
  await page.goto("./#/run?live");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No run to show yet");
  await expect(page.locator("main")).toContainText("There is no grooph watch here.");

  await page.unroute("**/grooph/api/run.json");
  let up = true;
  await page.route("**/grooph/api/run.json", (route) =>
    up ? route.fulfill({ status: 200, contentType: "application/json", body: bundleText(liveBundle()) }) : route.abort("connectionrefused"),
  );
  await page.reload();
  await expect(runBadge(page, "critic")).toHaveText("running");
  up = false;
  await expect(page.locator(".run-origin.is-problem")).toContainText("grooph watch is not answering. Is it still running?", { timeout: 8_000 });
  await expect(runBadge(page, "critic")).toHaveText("running");
});

test("running nodes pulse; with reduced motion they show a static ring instead", async ({ page }) => {
  await stubWatch(page, [liveBundle()]);
  await page.goto("./#/run?live");
  const ring = () =>
    runNode(page, "critic").evaluate((el) => {
      const s = getComputedStyle(el, "::after");
      return { animation: s.animationName, border: s.borderTopWidth, opacity: s.opacity, content: s.content };
    });
  await expect(runNode(page, "critic")).toHaveClass(/run-running/);
  expect(await ring()).toMatchObject({ animation: "run-pulse", border: "2px", content: '""' });

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await ring()).toEqual({ animation: "none", border: "2px", opacity: "1", content: '""' });
  // Not only colour: the badge names the state.
  await expect(runBadge(page, "critic")).toHaveText("running");
});

/* ─── nothing phones home ────────────────────────────────────────────────── */

test("the app requests nothing but its own files and, in a live view, the watch endpoint it was opened from", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on("request", (r: Request) => requests.push(r.url()));
  await stubWatch(page, [liveBundle(), liveBundle(FINISH)]);

  await page.goto("./");
  await page.goto(linkFor(real()));
  await expect(runBadge(page, "critic")).toHaveText("passed×2");
  await runTab(page, "Changes").tap();
  await runTab(page, "Proposals").tap();
  await page.goto(linkFor(runBundle("run-gate")));
  await expect(runBadge(page, "merge-gate")).toHaveText("halted");
  const beforeLive = requests.length;
  expect(requests.filter((u) => u.includes("api/run.json"))).toEqual([]);

  await page.goto("./#/run?live");
  await expect(status(page)).toHaveAttribute("aria-label", "Run state: Ended · pass", { timeout: 8_000 });
  expect(requests.length).toBeGreaterThan(beforeLive);

  const elsewhere = requests.filter((u) => new URL(u).origin !== origin && !u.startsWith("data:"));
  expect(elsewhere).toEqual([]);
  const live = requests.filter((u) => u.includes("api/run.json"));
  expect(new Set(live)).toEqual(new Set([`${origin}/grooph/api/run.json`]));
});
