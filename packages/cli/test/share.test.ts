/**
 * `grooph share | pick | shape` (docs/executive.md §4). Links are decoded with
 * core's own decoder and this package's zlib codec, so what is asserted is
 * what the app will receive. No browser is opened: `openUrl` is replaced.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { SHARE_LINK_WARN, canonicalize, decodeSharePayload, parseGraphText, sharePayloadFrom, type Graph, type ProposalSet } from "@grooph/core";

import { run } from "../src/index.js";
import type { Output } from "../src/print.js";
import { inflateRaw } from "../src/share-io.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const reviewLoopPath = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");
const csvDir = join(repoRoot, "fixtures", "proposals", "valid", "csv-export");
const csvSet = join(csvDir, "csv-export.grooph-proposals.json");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");

const withScratch = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-share-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const opened: string[] = [];
const grooph = (argv: string[], io = capture()) =>
  run(argv, io, () => "", {
    openUrl: async (url) => {
      opened.push(url);
    },
  });

/** The link is the last line of stdout, the only one starting with a scheme. */
const linkOf = (io: Capture): string => io.stdout.filter((line) => /^(https?|file):\/\//.test(line)).at(-1)!;

const decode = (link: string) => {
  const result = decodeSharePayload(sharePayloadFrom(link)!, inflateRaw);
  assert.ok(result.ok, result.ok ? "" : result.message);
  return result;
};

// ─── share ────────────────────────────────────────────────────────────────

test("share a graph: the shape, the warnings, and a link that opens to the same graph without its run notes", async () => {
  await withScratch(async (dir) => {
    const doc = JSON.parse(readFileSync(reviewLoopPath, "utf8")) as Graph;
    doc.notes = [{ id: "n-0001", run: "r1", at: "graph", text: "run started" }];
    doc.layout = { builder: { x: 0, y: 0 } };
    const file = join(dir, "g.grooph.json");
    writeFileSync(file, JSON.stringify(doc));

    const io = capture();
    assert.equal(await grooph(["share", file, "--base", "http://localhost:4173/grooph/"], io), 0);
    const out = text(io.stdout);
    assert.match(out, /review-loop · Review loop\n {2}2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns/);
    assert.match(out, /W_HOMOGENEOUS_CRITICS/);
    const link = linkOf(io);
    assert.ok(link.startsWith("http://localhost:4173/grooph/#/open?d="));
    assert.match(out, new RegExp(`link \\(${link.length.toLocaleString("en")} characters\\):`));
    assert.deepEqual(io.stderr, []);

    const result = decode(link);
    assert.equal(result.envelope.kind, "graph");
    const { notes: _notes, ...expected } = doc;
    assert.equal(canonicalize(result.envelope.doc as Graph), canonicalize(expected as Graph), "layout kept, notes dropped");
  });
});

test("share a proposal set: files inlined, shapes computed, the comparison printed, and --out writes the self-contained set", async () => {
  await withScratch(async (dir) => {
    const io = capture();
    const out = join(dir, "shared.grooph-proposals.json");
    assert.equal(await grooph(["share", csvSet, "--out", out], io), 0);
    const printed = text(io.stdout);
    assert.match(printed, /^csv-export · CSV export for the orders list · 3 candidates$/m);
    assert.match(printed, /^ {2}Lean {6}lean {6}1 agent · 1 check · 1 loop · up to 5 rounds · 30 minutes {2}\(recommended\)$/m);
    assert.match(printed, /^ {2}Reviewed {2}reviewed {2}2 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns {2}\(1 warning: W_HOMOGENEOUS_CRITICS\)$/m);
    assert.match(printed, /^recommended: Lean\. /m);

    const link = linkOf(io);
    assert.ok(link.startsWith("https://ryanjosephkamp.github.io/grooph/#/open?d="), "the published app by default");
    assert.ok(link.length < SHARE_LINK_WARN);
    const result = decode(link);
    assert.equal(result.envelope.kind, "proposals");
    const set = result.envelope.doc as ProposalSet;
    assert.deepEqual(set.candidates.map((c) => (c.graph as Graph).id), ["csv-export-lean", "csv-export-reviewed", "csv-export-rigorous"]);
    assert.deepEqual(set.candidates.map((c) => c.shape!.agents), [1, 2, 3]);

    const written = JSON.parse(readFileSync(out, "utf8")) as ProposalSet;
    assert.deepEqual(written, JSON.parse(JSON.stringify(set)), "the --out file is the set the link carries");
    assert.equal(await grooph(["validate", out], capture()), 1, "a proposal set is not a graph document");
  });
});

test("share refuses what cannot be shared, and says why", async () => {
  await withScratch(async (dir) => {
    const noGoal = JSON.parse(readFileSync(reviewLoopPath, "utf8")) as Graph;
    delete noGoal.goal;
    writeFileSync(join(dir, "no-goal.grooph.json"), JSON.stringify(noGoal));
    let io = capture();
    assert.equal(await grooph(["share", join(dir, "no-goal.grooph.json")], io), 1);
    assert.match(text(io.stderr), /cannot share .*: fix these first\nerror {2}E_NO_GOAL/);
    assert.equal(linkOf(io), undefined, "no link");

    // A candidate whose graph has errors.
    cpSync(csvDir, join(dir, "set"), { recursive: true });
    const lean = JSON.parse(readFileSync(join(dir, "set", "lean.grooph.json"), "utf8")) as Graph;
    delete lean.target;
    writeFileSync(join(dir, "set", "lean.grooph.json"), JSON.stringify(lean));
    io = capture();
    assert.equal(await grooph(["share", join(dir, "set", "csv-export.grooph-proposals.json")], io), 1);
    assert.match(text(io.stderr), /E_CANDIDATE_INVALID {2}candidate "lean" \(Lean\) has errors that block export: E_NO_TARGET/);

    // A file that is not there.
    rmSync(join(dir, "set", "lean.grooph.json"));
    io = capture();
    assert.equal(await grooph(["share", join(dir, "set", "csv-export.grooph-proposals.json")], io), 1);
    assert.match(text(io.stderr), /candidate "lean" points at lean\.grooph\.json, which is not in .*set\/ or the working directory\. Paths in \{ "file" \} are relative to the proposal set's folder\./);

    writeFileSync(join(dir, "junk.json"), "{ nope");
    io = capture();
    assert.equal(await grooph(["share", join(dir, "junk.json")], io), 1);
    assert.match(text(io.stderr), /is not JSON/);

    io = capture();
    assert.equal(await grooph(["share", reviewLoopPath, "--out", reviewLoopPath], io), 1, "never over its own input");
    assert.match(text(io.stderr), /is the file being shared/);

    io = capture();
    assert.equal(await grooph(["share", reviewLoopPath, "--base", "localhost:4173"], io), 1);
    assert.match(text(io.stderr), /--base must be an http\(s\) or file URL/);
  });
});

test("share warns above 32,000 characters and points at --out", async () => {
  await withScratch(async (dir) => {
    const doc = JSON.parse(readFileSync(reviewLoopPath, "utf8")) as Graph;
    // Random text barely compresses, which is what makes a link long.
    for (const node of doc.nodes) if (node.kind === "agent") node.description = randomBytes(14_000).toString("hex");
    writeFileSync(join(dir, "big.grooph.json"), JSON.stringify(doc));
    const io = capture();
    assert.equal(await grooph(["share", join(dir, "big.grooph.json")], io), 0, "still a link, and still exit 0");
    assert.ok(linkOf(io).length > SHARE_LINK_WARN);
    assert.match(text(io.stderr), /warning: the link is [\d,]+ characters; messengers often cut links over 32,000\. The graphs are too big for a link/);
  });
});

test("share --open hands the link to the browser opener, and a failing opener is not a failure", async () => {
  opened.length = 0;
  const io = capture();
  assert.equal(await grooph(["share", reviewLoopPath, "--open", "--base", "http://127.0.0.1:4173/grooph"], io), 0);
  assert.deepEqual(opened, [linkOf(io)]);
  assert.ok(opened[0]!.startsWith("http://127.0.0.1:4173/grooph/#/open?d="), "the base gains its slash");
  assert.match(text(io.stdout), /opened in the default browser/);

  const failing = capture();
  const code = await run(["share", reviewLoopPath, "--open"], failing, () => "", {
    openUrl: async () => {
      throw new Error("spawn xdg-open ENOENT");
    },
  });
  assert.equal(code, 0);
  assert.match(text(failing.stderr), /could not open a browser \(spawn xdg-open ENOENT\); open the link above by hand/);
});

// ─── pick ─────────────────────────────────────────────────────────────────

test("pick by id or by label, any case, writes the candidate's graph in canonical form and says what to run next", async () => {
  await withScratch(async (dir) => {
    for (const [query, id] of [["reviewed", "reviewed"], ["RIGOROUS", "rigorous"], ["Lean", "lean"]] as const) {
      const out = join(dir, ".grooph", "graphs", `${id}.grooph.json`);
      const io = capture();
      assert.equal(await grooph(["pick", csvSet, query, "--out", out], io), 0, query);
      assert.equal(readFileSync(out, "utf8"), readFileSync(join(csvDir, `${id}.grooph.json`), "utf8"));
      assert.match(text(io.stdout), new RegExp(`^picked "\\w+" \\(${id}\\) from csv-export → `, "m"));
      assert.match(text(io.stdout), /^next: grooph export .* --target claude-code --into \.$/m);
    }
  });
});

test("pick refuses an unknown name, an ambiguous one, a graph with errors, and a different file in the way", async () => {
  await withScratch(async (dir) => {
    const out = join(dir, "picked.grooph.json");
    let io = capture();
    assert.equal(await grooph(["pick", csvSet, "fastest", "--out", out], io), 1);
    assert.match(text(io.stderr), /no candidate "fastest" in csv-export; its candidates are lean \("Lean"\), reviewed \("Reviewed"\), rigorous \("Rigorous"\)/);

    // One candidate's id is another's label.
    const set = JSON.parse(readFileSync(csvSet, "utf8")) as ProposalSet;
    set.candidates[1]!.label = "Rigorous";
    set.candidates[2]!.label = "Thorough";
    for (const c of set.candidates) c.graph = { file: join(csvDir, (c.graph as { file: string }).file) };
    const ambiguousSet = join(dir, "ambiguous.grooph-proposals.json");
    writeFileSync(ambiguousSet, JSON.stringify(set));
    io = capture();
    assert.equal(await grooph(["pick", ambiguousSet, "rigorous", "--out", out], io), 1);
    assert.match(text(io.stderr), /"rigorous" is ambiguous in csv-export: it is the id of "rigorous" and the label of "reviewed"/);
    assert.equal(await grooph(["pick", ambiguousSet, "Thorough", "--out", out], capture()), 0, "the other name still works");
    rmSync(out);
    assert.equal(existsSync(out), false);

    // A candidate whose graph has errors is not written.
    mkdirSync(join(dir, "set"));
    for (const name of ["csv-export.grooph-proposals.json", "lean.grooph.json", "reviewed.grooph.json", "rigorous.grooph.json"]) {
      copyFileSync(join(csvDir, name), join(dir, "set", name));
    }
    const lean = JSON.parse(readFileSync(join(dir, "set", "lean.grooph.json"), "utf8")) as Graph;
    lean.goal = " ";
    writeFileSync(join(dir, "set", "lean.grooph.json"), JSON.stringify(lean));
    io = capture();
    assert.equal(await grooph(["pick", join(dir, "set", "csv-export.grooph-proposals.json"), "lean", "--out", out], io), 1);
    assert.match(text(io.stderr), /cannot pick "Lean" \(lean\): its graph has errors/);
    assert.match(text(io.stderr), /E_NO_GOAL/);
    assert.equal(existsSync(out), false);

    // Something else at --out needs --force; the same graph does not.
    writeFileSync(out, "{}\n");
    io = capture();
    assert.equal(await grooph(["pick", csvSet, "reviewed", "--out", out], io), 1);
    assert.match(text(io.stderr), /already exists and holds something else; pass --force/);
    assert.equal(await grooph(["pick", csvSet, "reviewed", "--out", out, "--force"], capture()), 0);
    assert.equal(await grooph(["pick", csvSet, "reviewed", "--out", out], capture()), 0, "same content, nothing to lose");
    assert.equal(parseGraphText(readFileSync(out, "utf8")).doc?.id, "csv-export-reviewed");

    io = capture();
    assert.equal(await grooph(["pick", csvSet, "lean"], io), 1);
    assert.match(text(io.stderr), /pick needs --out <graph file>/);
  });
});

// ─── shape and help ───────────────────────────────────────────────────────

test("shape prints the line and the tiers, or the shape as JSON", async () => {
  let io = capture();
  assert.equal(await grooph(["shape", join(csvDir, "rigorous.grooph.json")], io), 0);
  assert.deepEqual(io.stdout, ["csv-export-rigorous: 3 agents · 1 gate · 1 loop · up to 4 rounds · 40 turns", "tiers: 1 frontier · 2 strong"]);

  io = capture();
  assert.equal(await grooph(["shape", reviewLoopPath, "--json"], io), 0);
  assert.deepEqual(JSON.parse(text(io.stdout)), {
    agents: 2,
    checks: 0,
    gates: 1,
    loops: 1,
    tiers: { frontier: 0, strong: 2, fast: 0, unset: 0 },
    worstCaseRounds: 4,
    budgets: ["40 turns"],
  });

  io = capture();
  assert.equal(await grooph(["shape", csvSet], io), 1);
  assert.match(text(io.stderr), /is not a graph document/);
});

test("every command answers --help with exit 0; share's page carries the proposal set format", async () => {
  let io = capture();
  assert.equal(await grooph(["share", "--help"], io), 0);
  assert.match(text(io.stdout), /"groophProposals": 0/);
  assert.match(text(io.stdout), /Leave "shape" out: share computes it\./);
  for (const command of ["pick", "shape", "validate", "export", "new", "apply"]) {
    io = capture();
    assert.equal(await grooph([command, "--help"], io), 0, command);
    assert.ok(io.stdout.length > 0 && io.stderr.length === 0, command);
  }
});
