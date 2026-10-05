import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRunBundle, canonicalize, parseGraphText, type Graph, type Loop, type Node, type RunBundle } from "@grooph/core";
import { expect, test, type Page } from "@playwright/test";

import { libraryDocs, linkFor, repoRoot, runBundle, runTab } from "./support.js";

/**
 * "Adopt as version N" on a run's page is held to the graph's brakes, as `grooph adopt` is (docs/runs.md §5;
 * amendment A-008, decision 0008). A working copy that loosens one is not saved: each such change is named with its
 * reasons, in the command's words, with the command that adopts it on purpose. The comparison is a piece of the app
 * fetched when Adopt is pressed, and the two doors are held to the same answer on the same working copies.
 */
const brakes = /\/assets\/brakes-[^/]*\.js$/;
const SANDWICH = "slice-0007-sandwich";
const stopsOf = (doc: Graph): Loop["stops"] => doc.loops[0]!.stops;
/** The real run, with its working copy changed as a run might have left it. */
const sandwich = (change: (working: Graph) => void): RunBundle => {
  const bundle = runBundle(SANDWICH);
  change(bundle.working);
  return bundle;
};
const changes = async (page: Page, bundle: RunBundle): Promise<void> => {
  // (From a blank page: an address that differs only after its `#` is the same document to the browser.)
  await page.goto("about:blank");
  await page.goto(linkFor(bundle));
  await runTab(page, "Changes").tap();
};
const press = async (page: Page, bundle: RunBundle): Promise<void> => {
  await changes(page, bundle);
  await page.getByRole("button", { name: /^Adopt as version/ }).tap();
};

test("a working copy that loosens a brake is not saved: each change is named with its reasons, and the command to adopt it on purpose", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => void (brakes.test(request.url()) && asked.push(request.url())));
  const bundle = sandwich((working) => {
    working.loops[0]!.stops = stopsOf(working).map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 50 } : stop.kind === "budget" ? { ...stop, limit: 800 } : stop));
  });
  await page.goto(linkFor(bundle));
  await runTab(page, "Changes").tap();
  await expect(page.getByRole("button", { name: "Adopt as version 2" })).toBeVisible();
  // The comparison is not fetched to open a run, or to read what it changed: only to adopt.
  expect(asked).toEqual([]);

  await page.getByRole("button", { name: "Adopt as version 2" }).tap();
  const refused = page.locator('[data-brakes="refused"]');
  await expect(refused).toContainText("Not adopted: this working copy loosens a brake. A run may tighten a brake and never loosen one. Nothing was saved.");
  await expect(refused.locator('[data-brakes="loosens"] li')).toHaveText(["loop:sandwich.stops raises the round cap from 5 to 50; raises the budget from 80 to 800 turns"]);
  await expect(refused.locator('[data-brakes="command"]')).toHaveText(`grooph adopt .grooph/${SANDWICH}/runs/${bundle.run} --write --allow loop:sandwich.stops`);
  await expect(refused.getByRole("button", { name: "Copy the command" })).toBeVisible();
  expect(asked).toHaveLength(1);

  // Nothing was saved, and the page does not say it was. The way to say yes is the command; Adopt is still there,
  // and pressing it again gives the same answer and saves nothing.
  await expect(page.locator(".adopt-done")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adopt as version 2" })).toBeEnabled();
  await page.getByRole("button", { name: "Adopt as version 2" }).tap();
  await expect(refused.locator('[data-brakes="loosens"] li')).toHaveCount(1);
  await expect(page.locator(".adopt-done")).toHaveCount(0);
  expect(await libraryDocs(page)).toEqual([]);
});

test("a working copy that tightens a brake is adopted, and the page says which; a way round a person newly opens is noted", async ({ page }) => {
  await press(page, sandwich((working) => {
    working.loops[0]!.stops = stopsOf(working).map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 3 } : stop));
  }));
  await expect(page.locator(".adopt-done")).toContainText("Saved version 2 of Slice 0007 sandwich to this device as a new graph.");
  const said = page.locator('[data-brakes="said"]');
  await expect(said).toContainText("It tightens a brake:");
  await expect(said.locator('[data-change-name="loop:sandwich.stops"]')).toContainText("undoing it: raises the round cap from 3 to 5");
  expect((await libraryDocs(page)).map((doc) => doc.version)).toEqual([2]);

  // Not refused, and said by name: a stop where a person is asked, that continues inside the loop.
  await press(page, sandwich((working) => void stopsOf(working).push({ kind: "human", every: 2, then: "builder" })));
  await expect(page.locator(".adopt-done")).toBeVisible();
  await expect(page.locator('[data-brakes="note"]')).toHaveText(
    'Note: the loop "sandwich": the round cap (5) and the budget (80 turns) would count the rounds between two of a person\'s decisions, and no longer the whole run. A way round its nodes that they do not count is opened each time by the stop where a person is asked, which continues at "builder"',
  );
});

// ─── the two doors give one answer ────────────────────────────────────────────────────────────────────────────

const valid = (file: string, change: (doc: Graph) => void = () => {}): Graph => {
  const doc = parseGraphText(readFileSync(join(repoRoot, "fixtures/valid", file), "utf8")).doc!;
  change(doc);
  return doc;
};
const agent = (id: string): Node => ({ id, kind: "agent", name: id, role: "builder", brief: `${id}: do the work.`, outputs: [`${id}.md`], allow: ["read-files", "write-outputs"] }) as Node;
const edge = (doc: Graph, id: string): Graph["edges"][number] => doc.edges.find((e) => e.id === id)!;
const loop = (doc: Graph, id: string): Loop => doc.loops.find((l) => l.id === id)!;
const SUB = "subgrooph-in-a-graph.grooph.json";
const review = (doc: Graph): Loop => loop(doc, "review-review");

/**
 * Working copies the command and the app must agree on: the audit's probe, what two fresh readers got through the
 * first versions of the comparison (now refused), what is noted and not refused, and honest changes.
 */
const CASES: [string, () => Graph, (working: Graph) => void][] = [
  ["nothing changed", () => valid(SUB), () => {}],
  ["a brief reworded", () => valid(SUB), (w) => void ((w.nodes.find((n) => n.id === "review-builder") as { brief: string }).brief = "Build it, and say what you tried.")],
  ["the audit's probe: the cap and the budget raised", () => valid(SUB), (w) => void (review(w).stops = review(w).stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop.kind === "budget" ? { ...stop, limit: 400 } : stop)))],
  ["a cap lowered", () => valid(SUB), (w) => void (review(w).stops = review(w).stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 2 } : stop)))],
  ["the gate offers fewer answers, and the cap is raised: two names", () => valid(SUB), (w) => {
    (w.nodes.find((n) => n.id === "review-merge-gate") as { options?: string[] }).options = ["approve"];
    review(w).stops = review(w).stops.map((stop) => (stop.kind === "max-iterations" ? { ...stop, n: 40 } : stop));
  }],
  ["a loop put around the capped loop", () => valid(SUB), (w) => {
    w.edges.push({ id: "e-replan", from: "review-critic", to: "plan", when: { verdict: "replan" } });
    w.loops.push({ id: "replan", name: "Replan", members: ["plan", "review-builder", "review-critic", "review-merge-gate"], back: ["e-replan"], mode: "judgment", bar: structuredClone(review(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  }],
  ["a second way round through a new step", () => valid(SUB), (w) => {
    w.nodes.push(agent("fixer"));
    w.edges.push({ id: "e-critic-fixer", from: "review-critic", to: "fixer", when: { verdict: "revise" } }, { id: "e-fixer-builder", from: "fixer", to: "review-builder", evidence: ["REVIEW.md"] });
    w.loops.push({ id: "revise", name: "Revise", members: ["review-builder", "review-critic", "fixer"], back: ["e-fixer-builder"], mode: "judgment", bar: structuredClone(review(w).bar!), stops: [{ kind: "bar-passed" }, { kind: "max-iterations", n: 1000 }] });
  }],
  ["a stop that leads back in, before the stops that halt", () => valid(SUB), (w) => void review(w).stops.splice(1, 0, { kind: "budget", measure: "minutes", limit: 0, then: "review-builder" })],
  ["a second edge beside one that needs approval", () => valid(SUB, (doc) => void (edge(doc, "review-e-critic-fail").approval = true)), (w) => {
    w.edges.push({ id: "e-critic-fail-again", from: "review-critic", to: "review-builder", when: "fail", evidence: ["REVIEW.md"] });
    review(w).back.push("e-critic-fail-again");
  }],
  ["a loop left as a shell, its work under other names", () => valid("wrap-up-after-the-cap.grooph.json"), (w) => {
    const twin = (id: string, as: string): Node => ({ ...structuredClone(w.nodes.find((n) => n.id === id)!), id: as }) as Node;
    const [fixer2, suite2] = [twin("fixer", "fixer2"), twin("suite", "suite2")];
    w.nodes = w.nodes.filter((n) => n.id !== "fixer");
    w.nodes.push(agent("stub"), fixer2, suite2);
    w.edges = w.edges.filter((e) => e.id !== "e-fix-suite");
    edge(w, "e-suite-fail").to = "stub";
    w.edges.push({ id: "e-stub-suite", from: "stub", to: "suite" }, { id: "e-fix2-suite2", from: "fixer2", to: "suite2" }, { id: "e-suite2-fail", from: "suite2", to: "fixer2", when: "fail" }, { id: "e-suite2-pass", from: "suite2", to: "green", when: "pass" });
    w.loops[0]!.members = ["stub", "suite"];
    w.loops.push({ id: "fix-cycle-2", name: "Again", members: ["fixer2", "suite2"], back: ["e-suite2-fail"], mode: "grind", stops: [{ kind: "max-iterations", n: 1000 }] });
  }],
  ["an approval gone around by a stop that leads on", () => valid("glyph-vocabulary.grooph.json", (doc) => {
    edge(doc, "e-critic-merge").approval = true;
    doc.nodes = doc.nodes.filter((n) => n.id !== "done");
    doc.edges = doc.edges.filter((e) => e.id !== "e-ship-done");
  }), (w) => void ((loop(w, "review").stops[0] as { then?: string }).then = "merge")],
  ["a way round a person newly opens: noted, not refused", () => valid(SUB), (w) => void review(w).stops.push({ kind: "human", every: 2, then: "review-builder" })],
  // Amendment A-019: a check is a brake. The audit lane's two cases, and a tightening on an edge that leaves a check.
  ["a check made to pass always", () => valid("fix-until-green.grooph.json"), (w) => {
    const suite = w.nodes.find((n) => n.id === "suite") as Extract<Node, { kind: "check" }>;
    suite.check = { ...suite.check, run: "true" };
  }],
  ["a check's two verdicts swapped", () => valid("fix-until-green.grooph.json"), (w) => {
    for (const e of w.edges) if (e.from === "suite") e.when = e.when === "pass" ? "fail" : "pass";
  }],
  ["an approval asked on a check's pass: a tightening, saved", () => valid("fix-until-green.grooph.json"), (w) => void (edge(w, "e-suite-pass").approval = true)],
  // What the reader of A-019 got through its first cut: neither is a tightening, whatever is asked beside it.
  ["a failure led to a second stop that ends in success, with an approval asked beside it", () => valid("fix-until-green.grooph.json"), (w) => {
    w.nodes.push({ id: "green-too", kind: "stop", name: "Green too", outcome: "success" });
    Object.assign(edge(w, "e-suite-pass"), { when: "fail", to: "green-too" });
    w.edges.push({ id: "e-suite-passed", from: "suite", to: "green", when: "pass", approval: true });
  }],
  ["a loop a check judges, given a bar and a stop on it", () => valid("fix-until-green.grooph.json"), (w) => {
    loop(w, "fix-cycle").bar = { name: "Fixer says so", inspects: [{ kind: "file", ref: "CHANGES.md" }], acceptance: "CHANGES.md says the change is made." };
    loop(w, "fix-cycle").stops.unshift({ kind: "bar-passed", then: "green" });
  }],
];

test("the app and the command agree on every working copy, the readers' attacks among them; and the command the app shows is one the command takes", async ({ page }) => {
  test.setTimeout(120_000);
  const bin = join(repoRoot, "packages/cli/bin/grooph.js");
  expect(existsSync(join(repoRoot, "packages/cli/dist/src/index.js")), "the command is built (pnpm -r build)").toBe(true);
  const root = mkdtempSync(join(tmpdir(), "grooph-two-doors-"));
  try {
    for (const [index, [what, from, change]] of CASES.entries()) {
      const source = from();
      const working = structuredClone(source);
      change(working);
      // The command, on a run folder that holds this source and this working copy.
      const project = join(root, String(index));
      const run = `.grooph/${source.id}/runs/r1`;
      mkdirSync(join(project, run), { recursive: true });
      writeFileSync(join(project, ".grooph", source.id, "graph.grooph.json"), canonicalize(source));
      writeFileSync(join(project, run, "graph.grooph.json"), canonicalize(working));
      writeFileSync(join(project, run, "notes.jsonl"), "");
      const grooph = (args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd: project, encoding: "utf8" });
      const dry = grooph(["adopt", run]);
      const lines = dry.stdout.split("\n");
      const start = lines.findIndex((line) => line.startsWith("loosens a brake: "));
      const end = start < 0 ? -1 : lines.findIndex((line, i) => i > start && !/^ {2}\S+:\S/.test(line));
      const byCommand = start < 0 ? [] : lines.slice(start + 1, end < 0 ? undefined : end).map((line) => line.trim().split(/\s+/)[0]!);
      const commandNotes = lines.filter((line) => line.startsWith("note: ")).map((line) => line.slice("note: ".length));

      // The app, on the same two documents as a run's bundle.
      await changes(page, buildRunBundle({ source, working, notesText: "", run: "r1" }));
      if (JSON.stringify(source) === JSON.stringify(working)) {
        await expect(page.getByText("Nothing to adopt: the working copy is the source.")).toBeVisible();
        expect(byCommand, what).toEqual([]);
        continue;
      }
      await page.getByRole("button", { name: /^Adopt as version/ }).tap();
      const refused = page.locator('[data-brakes="refused"]');
      await expect(refused.or(page.locator(".adopt-done")), what).toBeVisible();
      const byApp = await refused.locator('[data-brakes="loosens"] [data-change-name]').evaluateAll((items) => items.map((item) => item.getAttribute("data-change-name")!));
      expect(byApp, `${what}: the same changes refused, in the same order`).toEqual(byCommand);
      expect(await page.locator('[data-brakes="note"]').allTextContents(), `${what}: the same notes`).toEqual(commandNotes.map((note) => `Note: ${note}`));
      // Saved by the app exactly when --write would write.
      const saved = (await page.locator(".adopt-done").count()) > 0;
      expect(saved, `${what}: saved`).toBe(byCommand.length === 0);
      expect(grooph(["adopt", run, "--write"]).status, `${what}: --write`).toBe(saved ? 0 : 1);
      if (saved) continue;

      // What the app shows to copy is the command's own line, and the command takes it, as it is, in the project's folder.
      const shown = (await refused.locator('[data-brakes="command"]').textContent())!;
      expect(dry.stdout, what).toContain(`all of them, on purpose: ${shown}`);
      const words = shown.split(" ");
      expect(words.slice(0, 2), what).toEqual(["grooph", "adopt"]);
      expect(existsSync(join(project, ".grooph", "graphs", `${source.id}.grooph.json`)), `${what}: not written before`).toBe(false);
      const taken = grooph(words.slice(1));
      expect(taken.status, `${what}: ${shown}\n${taken.stdout}${taken.stderr}`).toBe(0);
      expect(parseGraphText(readFileSync(join(project, ".grooph", "graphs", `${source.id}.grooph.json`), "utf8")).doc!.version, what).toBe(2);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
