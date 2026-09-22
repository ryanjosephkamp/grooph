/**
 * `grooph template …` (docs/templates.md §3–4): resolution order, the six
 * commands, and remote registries served by a local static server — never
 * the live site. Every run gets its own project folder, user folder and
 * default registry, so nothing here reads ~/.grooph or the network at large.
 */

import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { run } from "../src/index.js";
import type { Output } from "../src/print.js";
import type { RegistryEnv } from "../src/registry.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();
const patterns = join(repoRoot, "patterns");

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");

// ─── a static registry on 127.0.0.1 ───────────────────────────────────────

let server: Server;
let base = "";
let closedPort = 0;
const requests: string[] = [];
const served = mkdtempSync(join(tmpdir(), "grooph-registry-"));

/** A remote-only template: the grind loop under another id. */
function remoteOnly(): string {
  const doc = JSON.parse(readFileSync(join(patterns, "grind-loop.grooph.json"), "utf8")) as { id: string; template: { title: string } };
  doc.id = "remote-grind";
  doc.template.title = "Remote grind";
  return `${JSON.stringify(doc, null, 2)}\n`;
}

before(async () => {
  mkdirSync(join(served, "lib"));
  copyFileSync(join(patterns, "review-gate.grooph.json"), join(served, "lib", "review-gate.grooph.json"));
  writeFileSync(join(served, "lib", "remote-grind.grooph.json"), remoteOnly());
  const index = JSON.parse(readFileSync(join(patterns, "index.json"), "utf8")) as { templates: { id: string }[] };
  const row = { ...index.templates.find((t) => t.id === "grind-loop")!, id: "remote-grind", title: "Remote grind", file: "remote-grind.grooph.json" };
  writeFileSync(
    join(served, "lib", "index.json"),
    JSON.stringify({ grooph: 0, templates: [index.templates.find((t) => t.id === "review-gate"), row] }),
  );
  server = createServer((req, res) => {
    requests.push(req.url ?? "");
    const path = join(served, (req.url ?? "/").split("?")[0]!);
    if (!path.startsWith(served) || !existsSync(path) || !path.endsWith(".json")) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const closed = createServer();
  await new Promise<void>((done) => closed.listen(0, "127.0.0.1", done));
  closedPort = (closed.address() as AddressInfo).port;
  await new Promise<void>((done) => closed.close(() => done()));
});

after(() => {
  server.close();
  rmSync(served, { recursive: true, force: true });
});

// ─── a sandbox per test ───────────────────────────────────────────────────

type Sandbox = { dir: string; project: string; user: string; env: Partial<RegistryEnv>; cleanup: () => void };

/** A working tree (with .git) and a user folder; the default registry is the local server unless `offline`. */
function sandbox(options: { offline?: boolean } = {}): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "grooph-template-test-"));
  mkdirSync(join(dir, "work", ".git"), { recursive: true });
  mkdirSync(join(dir, "work", "sub"));
  return {
    dir,
    project: join(dir, "work", ".grooph", "templates"),
    user: join(dir, "home", "templates"),
    env: {
      cwd: join(dir, "work", "sub"),
      userDir: join(dir, "home", "templates"),
      defaultRegistry: options.offline ? `http://127.0.0.1:${closedPort}/lib/index.json` : `${base}/lib/index.json`,
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const grooph = (box: Sandbox, argv: string[], io = capture()): Promise<number> => run(argv, io, () => "", box.env);

const saveTemplate = (dir: string, id: string, title: string): void => {
  mkdirSync(dir, { recursive: true });
  const doc = JSON.parse(readFileSync(join(patterns, "grind-loop.grooph.json"), "utf8")) as { id: string; template: { title: string } };
  doc.id = id;
  doc.template.title = title;
  writeFileSync(join(dir, `${id}.grooph.json`), JSON.stringify(doc));
};

// ─── list and show ────────────────────────────────────────────────────────

test("list shows the built-in library without touching the network", async () => {
  const box = sandbox();
  try {
    requests.length = 0;
    const io = capture();
    assert.equal(await grooph(box, ["template", "list"], io), 0);
    assert.match(text(io.stdout), /^built-in \(/);
    assert.match(text(io.stdout), / {2}review-gate {2,}graph {5}medium · medium · standard\n {6}Work, then a separate reviewer/);
    assert.match(text(io.stdout), /20 templates\./);
    assert.deepEqual(requests, [], "no remote unless asked");

    const json = capture();
    assert.equal(await grooph(box, ["template", "list", "--json"], json), 0);
    const listed = JSON.parse(text(json.stdout)) as { templates: { id: string; source: string; kind: string; glyph?: string }[] };
    assert.equal(listed.templates.length, 20);
    assert.ok(listed.templates.every((t) => t.source === "built-in"));
    assert.equal(listed.templates.find((t) => t.id === "human-gated-irreversible")?.kind, "fragment");
    // Every built-in row points at its bundled glyph (slice 0015, criterion 6), the same bytes patterns/glyphs/ holds.
    for (const t of listed.templates) {
      assert.match(t.glyph ?? "", /\/patterns\/glyphs\/[a-z-]+\.svg$/, `${t.id} has a glyph path`);
      assert.equal(readFileSync(t.glyph!, "utf8"), readFileSync(join(patterns, "glyphs", `${t.id}.svg`), "utf8"), `${t.id}: the bundled glyph`);
    }
  } finally {
    box.cleanup();
  }
});

test("project shadows user shadows built-in, and list says so", async () => {
  const box = sandbox();
  try {
    saveTemplate(box.user, "review-gate", "User review gate");
    saveTemplate(box.project, "review-gate", "Project review gate");
    const show = capture();
    assert.equal(await grooph(box, ["template", "show", "review-gate"], show), 0);
    assert.match(text(show.stdout), /^review-gate · Project review gate/);
    assert.match(text(show.stdout), /from project: .*work\/\.grooph\/templates\/review-gate\.grooph\.json/, "found from a subfolder of the working tree");

    const list = capture();
    await grooph(box, ["template", "list", "--json"], list);
    const rows = (JSON.parse(text(list.stdout)) as { templates: { id: string; source: string; shadowedBy?: string; glyph?: string }[] }).templates.filter(
      (t) => t.id === "review-gate",
    );
    assert.deepEqual(rows.map((r) => [r.source, r.shadowedBy]), [["project", undefined], ["user", "project"], ["built-in", "project"]]);
    // A registry without pre-drawn glyphs gives no path (grooph glyph draws one); the built-in one always has it.
    assert.deepEqual(rows.map((r) => r.glyph === undefined), [true, true, false]);
  } finally {
    box.cleanup();
  }
});

test("show prints the when-to-use, the slots with their questions, and how to use it", async () => {
  const box = sandbox();
  try {
    const io = capture();
    assert.equal(await grooph(box, ["template", "show", "spec-then-loop"], io), 0);
    const out = text(io.stdout);
    assert.match(out, /When to use: No external reference product exists/);
    assert.match(out, /Not for: /);
    assert.match(out, /Profile: cost medium · speed medium · rigor high/);
    // decision 0010: the credit, with its link and what was taken, between the profile and the slots.
    assert.match(out, /Inspired by: Answer-key-first Gauntlet, a community modification of Matt Pocock's Wayfinder <https:\/\/github\.com\/mattpocock\/skills\/blob\/main\/docs\/engineering\/wayfinder\.md> — write the spec and a pass\/fail answer key before the loop/);
    assert.match(out, /Slots:\n {2}task {2,}What should be built or changed\?/);
    assert.match(out, /Loop build: builder, critic; stops: bar passed, max iterations: 4, budget: 10 dispatches/);
    assert.match(out, /Use it: grooph template use spec-then-loop --name "<graph name>" --set task="…" --set test-command="…" --out <file>/);

    const json = capture();
    assert.equal(await grooph(box, ["template", "show", "human-gated-irreversible", "--json"], json), 0);
    const shown = JSON.parse(text(json.stdout)) as { source: string; template: { template: { kind: string } } };
    assert.equal(shown.source, "built-in");
    assert.equal(shown.template.template.kind, "fragment");
  } finally {
    box.cleanup();
  }
});

// ─── use ──────────────────────────────────────────────────────────────────

test("use writes an instantiated graph, asks for unfilled slots on stderr, and never overwrites without --force", async () => {
  const box = sandbox();
  try {
    const out = join(box.dir, "try.grooph.json");
    const io = capture();
    assert.equal(await grooph(box, ["template", "use", "review-gate", "--name", "Try it", "--set", "task=Add a slugify function.", "--out", out], io), 0);
    const doc = JSON.parse(readFileSync(out, "utf8")) as Record<string, unknown>;
    assert.equal(doc["id"], "try-it");
    assert.equal(doc["template"], undefined);
    assert.deepEqual(doc["lineage"], { pattern: "review-gate", from: "review-gate@1" });
    assert.equal(doc["goal"], "Add a slugify function. Done when every item in {{checklist}} is shown to hold, `{{test-command}}` passes, and a human approves the merge.");
    assert.match(text(io.stderr), /2 slots still unfilled/);
    assert.match(text(io.stderr), /\{\{test-command\}\} {2,}Which command runs the tests\? {2}\(e\.g\. pnpm test\)\n {2}\{\{checklist\}\}/, "in the template's slot order");
    assert.match(text(io.stdout), /wrote .*try\.grooph\.json \(graph "try-it" from review-gate@1, built-in\)/);

    const exported = capture();
    assert.equal(await grooph(box, ["validate", "--for-export", out], exported), 1, "export refuses unfilled slots");
    assert.match(text(exported.stderr), /E_UNFILLED_SLOT {2}slot \{\{checklist\}\}/);

    const again = capture();
    assert.equal(await grooph(box, ["template", "use", "review-gate", "--name", "Try it", "--out", out], again), 1);
    assert.match(text(again.stderr), /already exists; pass --force/);

    const forced = capture();
    const sets = ["--set", "task=Add a slugify function.", "--set", "test-command=pnpm test", "--set", "checklist=docs/REVIEW-CHECKLIST.md"];
    assert.equal(await grooph(box, ["template", "use", "review-gate", "--name", "Try it", ...sets, "--out", out, "--force"], forced), 0);
    assert.deepEqual(forced.stderr, [], "nothing left to ask");
    assert.equal(await grooph(box, ["validate", "--for-export", out], capture()), 0);
    assert.equal(await grooph(box, ["export", out, "--target", "claude-code", "--into", join(box.dir, "pkg")], capture()), 0);
    assert.ok(existsSync(join(box.dir, "pkg", ".grooph", "try-it", "LEAD.md")));
  } finally {
    box.cleanup();
  }
});

test("use without --out prints only the document on stdout", async () => {
  const box = sandbox();
  const written: string[] = [];
  const write = process.stdout.write.bind(process.stdout);
  try {
    process.stdout.write = ((chunk: string) => (written.push(chunk), true)) as typeof process.stdout.write;
    const io = capture();
    const code = await grooph(box, ["template", "use", "grind-loop", "--name", "Green", "--set", "task=Fix it.", "--set", "test-command=npm test"], io);
    process.stdout.write = write;
    assert.equal(code, 0);
    assert.deepEqual(io.stdout, [], "messages go to stderr when the document is the output");
    const doc = JSON.parse(written.join("")) as { id: string; goal: string };
    assert.equal(doc.id, "green");
    assert.equal(doc.goal, "Fix it. Done when `npm test` passes.");
  } finally {
    process.stdout.write = write;
    box.cleanup();
  }
});

test("use refuses a fragment, a misspelt slot and a missing --name", async () => {
  const box = sandbox();
  try {
    const fragment = capture();
    assert.equal(await grooph(box, ["template", "use", "human-gated-irreversible", "--name", "X"], fragment), 1);
    assert.match(text(fragment.stderr), /is a fragment, not a whole graph; insert it into a graph: grooph template insert human-gated-irreversible/);

    const typo = capture();
    assert.equal(await grooph(box, ["template", "use", "grind-loop", "--name", "X", "--set", "tsak=x", "--out", join(box.dir, "x.json")], typo), 1);
    assert.match(text(typo.stderr), /has no slot "tsak"; did you mean "task"\?/);
    assert.ok(!existsSync(join(box.dir, "x.json")), "nothing written");

    const noName = capture();
    assert.equal(await grooph(box, ["template", "use", "grind-loop"], noName), 1);
    assert.match(text(noName.stderr), /needs --name/);
  } finally {
    box.cleanup();
  }
});

// ─── insert ───────────────────────────────────────────────────────────────

test("insert adds a fragment, renames what collides, prints the id map, and writes only with --write", async () => {
  const box = sandbox();
  try {
    const file = join(box.dir, "graph.grooph.json");
    copyFileSync(join(repoRoot, "fixtures", "valid", "review-loop.grooph.json"), file);
    const before = readFileSync(file, "utf8");
    const sets = ["--set", "action=Merge the change into main.", "--set", "irreversible=merge"];

    const dry = capture();
    assert.equal(await grooph(box, ["template", "insert", "human-gated-irreversible", "--into", file, ...sets], dry), 0);
    assert.match(text(dry.stdout), /inserted human-gated-irreversible@1 \(built-in\): 3 nodes, 2 edges, 0 loops/);
    assert.match(text(dry.stdout), / {2}done → done-2 {3}\(renamed\)/);
    assert.match(text(dry.stdout), /nothing leads into "gate" yet; connect it with grooph apply/);
    assert.match(text(dry.stdout), /not written \(dry run/);
    assert.equal(readFileSync(file, "utf8"), before);

    const wet = capture();
    assert.equal(await grooph(box, ["template", "insert", "human-gated-irreversible", "--into", file, ...sets, "--write"], wet), 0);
    const doc = JSON.parse(readFileSync(file, "utf8")) as { nodes: { id: string; irreversible?: string[] }[]; edges: { id: string }[] };
    assert.deepEqual(doc.nodes.map((n) => n.id), ["builder", "critic", "merge-gate", "done", "gate", "act", "done-2"]);
    assert.deepEqual(doc.nodes.find((n) => n.id === "act")?.irreversible, ["merge"]);
    assert.equal(await grooph(box, ["validate", "--for-export", file], capture()), 0, "the gate covers the irreversible step");

    const prefixed = capture();
    assert.equal(await grooph(box, ["template", "insert", "human-gated-irreversible", "--into", file, ...sets, "--prefix", "ship"], prefixed), 0);
    assert.match(text(prefixed.stdout), / {2}gate → ship-gate/);
    assert.match(text(prefixed.stdout), / {2}e-gate-act → e-ship-gate-ship-act/);
  } finally {
    box.cleanup();
  }
});

// ─── save ─────────────────────────────────────────────────────────────────

test("save writes a template to the project folder with an index, and replacing it needs --force and bumps the version", async () => {
  const box = sandbox();
  try {
    const graph = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");
    const meta = ["--id", "my-review", "--title", "My review", "--summary", "Builder, critic, merge gate.", "--when", "A reviewed change."];

    const tooFew = capture();
    assert.equal(await grooph(box, ["template", "save", graph, ...meta, "--fragment", "--nodes", "builder,critic"], tooFew), 1);
    assert.match(text(tooFew.stderr), /E_CYCLE_NO_STOP/);
    assert.match(text(tooFew.stderr), /loop "review-cycle" stayed behind: a loop comes along only with all its members; add merge-gate to --nodes/);
    assert.ok(!existsSync(box.project), "nothing saved");

    const io = capture();
    assert.equal(await grooph(box, ["template", "save", graph, ...meta, "--fragment", "--nodes", "builder,critic,merge-gate"], io), 0);
    assert.match(text(io.stdout), /saved my-review@1 \(fragment: 3 nodes, 4 edges, 1 loop\) to .*work\/\.grooph\/templates\/my-review\.grooph\.json/);
    const index = JSON.parse(readFileSync(join(box.project, "index.json"), "utf8")) as { templates: { id: string; version: number; kind: string }[] };
    assert.deepEqual(index.templates.map((t) => [t.id, t.version, t.kind]), [["my-review", 1, "fragment"]]);

    assert.equal(await grooph(box, ["template", "save", graph, ...meta], capture()), 1, "an existing template needs --force");
    assert.equal(await grooph(box, ["template", "save", graph, ...meta, "--force"], capture()), 0);
    const saved = JSON.parse(readFileSync(join(box.project, "my-review.grooph.json"), "utf8")) as { version: number; template: { kind: string } };
    assert.equal(saved.version, 2);
    assert.equal(saved.template.kind, "graph");

    const used = capture();
    assert.equal(await grooph(box, ["template", "use", "my-review", "--name", "Again", "--out", join(box.dir, "again.grooph.json")], used), 0);
    assert.match(text(used.stdout), /from my-review@2, project/);

    const user = capture();
    assert.equal(await grooph(box, ["template", "save", graph, ...meta, "--to", "user"], user), 0);
    assert.ok(existsSync(join(box.user, "my-review.grooph.json")));
    assert.ok(existsSync(join(box.user, "index.json")));
  } finally {
    box.cleanup();
  }
});

test("save checks its flags", async () => {
  const box = sandbox();
  try {
    const graph = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");
    const cases: [string[], RegExp][] = [
      [["template", "save", graph, "--id", "x"], /needs --title, --summary, --when/],
      [["template", "save", graph, "--id", "x", "--title", "X", "--summary", "s", "--when", "w", "--fragment"], /--fragment needs --nodes/],
      [["template", "save", graph, "--id", "x", "--title", "X", "--summary", "s", "--when", "w", "--nodes", "builder"], /pass --fragment with it/],
      [["template", "save", graph, "--id", "x", "--title", "X", "--summary", "s", "--when", "w", "--to", "team"], /--to is project or user/],
      [["template", "save", graph, "--id", "Not Kebab", "--title", "X", "--summary", "s", "--when", "w"], /must be kebab-case/],
    ];
    for (const [argv, message] of cases) {
      const io = capture();
      assert.equal(await grooph(box, argv, io), 1, argv.join(" "));
      assert.match(text(io.stderr), message);
    }
  } finally {
    box.cleanup();
  }
});

// ─── remote ───────────────────────────────────────────────────────────────

test("a name found nowhere locally is fetched from the default registry; a local name never is", async () => {
  const box = sandbox();
  try {
    requests.length = 0;
    const local = capture();
    assert.equal(await grooph(box, ["template", "use", "review-gate", "--name", "X", "--out", join(box.dir, "x.grooph.json")], local), 0);
    assert.deepEqual(requests, [], "built-in hit: no request");

    const remote = capture();
    assert.equal(await grooph(box, ["template", "use", "remote-grind", "--name", "Far", "--out", join(box.dir, "far.grooph.json")], remote), 0);
    assert.deepEqual(requests, ["/lib/index.json", "/lib/remote-grind.grooph.json"]);
    assert.match(text(remote.stdout), /from remote-grind@1, remote/);
    assert.deepEqual((JSON.parse(readFileSync(join(box.dir, "far.grooph.json"), "utf8")) as { lineage: unknown }).lineage, {
      pattern: "remote-grind",
      from: "remote-grind@1",
    });

    const missing = capture();
    assert.equal(await grooph(box, ["template", "show", "revew-gate"], missing), 1);
    assert.match(text(missing.stderr), /no template "revew-gate" in .*; did you mean "review-gate"\?/);
  } finally {
    box.cleanup();
  }
});

test("--registry names the remote to use, as an index URL or its folder", async () => {
  const box = sandbox({ offline: true });
  try {
    const io = capture();
    assert.equal(await grooph(box, ["template", "show", "remote-grind", "--registry", `${base}/lib/`], io), 0);
    assert.match(text(io.stdout), /^remote-grind · Remote grind/);
    assert.match(text(io.stdout), new RegExp(`from ${base}/lib/remote-grind\\.grooph\\.json`));

    const list = capture();
    assert.equal(await grooph(box, ["template", "list", "--registry", `${base}/lib/index.json`], list), 0);
    assert.match(text(list.stdout), new RegExp(`remote \\(${base}/lib/index\\.json\\)\\n {2}review-gate .*\\(shadowed by the built-in one\\)`));
    assert.match(text(list.stdout), /21 templates\./);
    // A remote row's glyph is the URL beside its registry (the published library keeps glyphs/ there).
    const json = capture();
    assert.equal(await grooph(box, ["template", "list", "--registry", `${base}/lib/index.json`, "--json"], json), 0);
    const remoteRow = (JSON.parse(text(json.stdout)) as { templates: { id: string; source: string; glyph?: string }[] }).templates.find((t) => t.id === "remote-grind")!;
    assert.equal(remoteRow.glyph, `${base}/lib/glyphs/remote-grind.svg`);
  } finally {
    box.cleanup();
  }
});

test("offline, a local name still resolves and a remote one fails with a clear message", async () => {
  const box = sandbox({ offline: true });
  try {
    assert.equal(await grooph(box, ["template", "show", "grind-loop"], capture()), 0);

    const io = capture();
    assert.equal(await grooph(box, ["template", "use", "remote-grind", "--name", "X"], io), 1);
    const message = text(io.stderr);
    assert.match(message, /no template "remote-grind" in \.grooph\/templates\/, the user folder or the built-in library, and the remote registry http:\/\/127\.0\.0\.1:\d+\/lib\/index\.json could not be reached \(ECONNREFUSED\)/);
    assert.match(message, /If you are offline, local templates still work: grooph template list/);
    assert.doesNotMatch(message, /at .*\.js:\d+/, "no stack trace");

    const list = capture();
    assert.equal(await grooph(box, ["template", "list", "--registry", `http://127.0.0.1:${closedPort}/`], list), 1);
    assert.match(text(list.stdout), /20 templates\./, "the local list still prints");
    assert.match(text(list.stderr), /cannot reach .* \(ECONNREFUSED\); if you are offline/);
  } finally {
    box.cleanup();
  }
});

test("a registry that answers with something else is named, not crashed on", async () => {
  const box = sandbox();
  try {
    const missing = capture();
    assert.equal(await grooph(box, ["template", "use", "x", "--name", "X", "--registry", `${base}/nowhere/`], missing), 1);
    assert.match(text(missing.stderr), /\/nowhere\/index\.json answered 404/);

    const notIndex = capture();
    assert.equal(await grooph(box, ["template", "use", "x", "--name", "X", "--registry", `${base}/lib/review-gate.grooph.json`], notIndex), 1);
    assert.match(text(notIndex.stderr), /is not a template index/);
  } finally {
    box.cleanup();
  }
});

test("add copies a remote template into the project folder, after which it resolves locally", async () => {
  const box = sandbox();
  try {
    const io = capture();
    assert.equal(await grooph(box, ["template", "add", "remote-grind"], io), 0);
    assert.match(text(io.stdout), /added remote-grind@1 from http:\/\/127\.0\.0\.1:\d+\/lib\/remote-grind\.grooph\.json to .*work\/\.grooph\/templates\/remote-grind\.grooph\.json/);
    const index = JSON.parse(readFileSync(join(box.project, "index.json"), "utf8")) as { templates: { id: string }[] };
    assert.deepEqual(index.templates.map((t) => t.id), ["remote-grind"]);

    requests.length = 0;
    const show = capture();
    assert.equal(await grooph(box, ["template", "show", "remote-grind"], show), 0);
    assert.match(text(show.stdout), /from project: /);
    assert.deepEqual(requests, [], "resolved locally");

    assert.equal(await grooph(box, ["template", "add", "remote-grind"], capture()), 1, "already there: needs --force");

    const byUrl = capture();
    assert.equal(await grooph(box, ["template", "add", `${base}/lib/review-gate.grooph.json`, "--to", "user"], byUrl), 0);
    assert.ok(existsSync(join(box.user, "review-gate.grooph.json")));
    const shadow = capture();
    await grooph(box, ["template", "show", "review-gate"], shadow);
    assert.match(text(shadow.stdout), /from user: /, "the user copy now shadows the built-in one");

    const notTemplate = capture();
    assert.equal(await grooph(box, ["template", "add", `${base}/lib/index.json`], notTemplate), 1);
    assert.match(text(notTemplate.stderr), /does not match the schema/);
  } finally {
    box.cleanup();
  }
});

test("template help and unknown subcommands", async () => {
  const box = sandbox();
  try {
    const help = capture();
    assert.equal(await grooph(box, ["template", "help"], help), 0);
    assert.match(text(help.stdout), /grooph template use <name> --name <graph name>/);
    // `grooph <command> --help`, as the overview promises, on every subcommand (0009 handback, D7).
    for (const sub of ["list", "show", "use", "insert", "save", "add"]) {
      for (const flag of ["--help", "-h"]) {
        const io = capture();
        assert.equal(await grooph(box, ["template", sub, flag], io), 0, `template ${sub} ${flag} exits 0`);
        assert.match(text(io.stdout), /grooph template use <name> --name <graph name>/);
        assert.deepEqual(io.stderr, [], `template ${sub} ${flag} prints no error`);
      }
    }
    const unknown = capture();
    assert.equal(await grooph(box, ["template", "fetch"], unknown), 1);
    assert.match(text(unknown.stderr), /unknown template command "fetch"/);
    const top = capture();
    await run(["help"], top);
    assert.match(text(top.stdout), /grooph template list \| show \| use \| insert \| save \| add/);
  } finally {
    box.cleanup();
  }
});
