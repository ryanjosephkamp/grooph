/**
 * The no-friction toolkit (handoff 0057): a typo gets a suggestion, errors look alike, a person at a
 * terminal gets a file where an agent's pipe gets the document, and every success says what is next.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run } from "../src/index.js";
import type { Output } from "../src/print.js";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (isTTY?: boolean): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t), ...(isTTY !== undefined ? { isTTY } : {}) };
};

/** Runs `body` inside a fresh folder, as the person at the terminal would be. */
async function inFolder(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "grooph-friction-"));
  const before = process.cwd();
  process.chdir(dir);
  try {
    await body(dir);
  } finally {
    process.chdir(before);
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an unknown command suggests the nearest one and does not print the usage", async () => {
  const io = capture();
  assert.equal(await run(["validat", "x"], io), 1);
  assert.deepEqual(io.stderr, ['grooph: unknown command "validat". Did you mean "validate"?', "grooph --help lists the commands."]);
  assert.deepEqual(io.stdout, []);

  const far = capture();
  assert.equal(await run(["zzzzzz"], far), 1);
  assert.match(far.stderr[0]!, /^grooph: unknown command "zzzzzz"\.$/);
  assert.equal(far.stderr.length, 2);
});

test("a missing file is named as typed, after grooph:", async () => {
  const io = capture();
  assert.equal(await run(["validate", "sub/nope.grooph.json"], io), 1);
  assert.deepEqual(io.stderr, ["grooph: no such file: sub/nope.grooph.json"]);
});

test("usage errors say which command and where its page is", async () => {
  const io = capture();
  assert.equal(await run(["validate"], io), 1);
  assert.match(io.stderr[0]!, /^grooph: validate needs a file/);
  assert.match(io.stderr.join("\n"), /More: grooph help validate/);
});

test("the overview fits a screen and every command has its own page with an example", async () => {
  const io = capture();
  assert.equal(await run(["--help"], io), 0);
  assert.ok(io.stdout.join("\n").split("\n").length <= 45);
  for (const command of ["new", "apply", "validate", "canonicalize", "export", "explain", "template"]) {
    const a = capture();
    const b = capture();
    assert.equal(await run(["help", command], a), 0, command);
    assert.equal(await run([command, "--help"], b), 0, command);
    assert.equal(a.stdout.join("\n"), b.stdout.join("\n"));
    assert.match(a.stdout.join("\n"), /Example/, command);
  }
  const bad = capture();
  assert.equal(await run(["help", "nonsense"], bad), 1);
});

test("new writes <id>.grooph.json at a terminal, and prints the document when piped", async () => {
  await inFolder(async (dir) => {
    const tty = capture(true);
    assert.equal(await run(["new", "--name", "Demo graph"], tty), 0);
    assert.ok(existsSync(join(dir, "demo-graph.grooph.json")));
    assert.match(tty.stdout[0]!, /^wrote demo-graph\.grooph\.json/);
    assert.match(tty.stdout[1]!, /^next: grooph apply demo-graph\.grooph\.json/);

    const again = capture(true);
    assert.equal(await run(["new", "--name", "Demo graph"], again), 1);
    assert.match(again.stderr[0]!, /^grooph: demo-graph\.grooph\.json already exists/);

    // Not a terminal: nothing is written, as before.
    const piped = capture();
    assert.equal(await run(["new", "--name", "Other"], piped), 0);
    assert.ok(!existsSync(join(dir, "other.grooph.json")));
  });
});

test("template use writes a file at a terminal, falls back to the template's title, and leaves a pipe alone", async () => {
  await inFolder(async (dir) => {
    const tty = capture(true);
    assert.equal(await run(["template", "use", "grind-loop", "--set", "task=t", "--set", "test-command=c"], tty), 0);
    const wrote = tty.stdout.find((l) => l.startsWith("wrote "));
    assert.ok(wrote, tty.stdout.join("\n"));
    const file = wrote.split(" ")[1]!;
    assert.ok(existsSync(join(dir, file)));
    assert.equal(JSON.parse(readFileSync(join(dir, file), "utf8")).name.length > 0, true);
    assert.ok(tty.stdout.some((l) => l === `next: grooph validate --for-export ${file}`));

    const piped = capture();
    assert.equal(await run(["template", "use", "grind-loop", "--name", "Piped"], piped), 0);
    assert.ok(!existsSync(join(dir, "piped.grooph.json")));
  });
});

test("success says what comes next, at a terminal only", async () => {
  await inFolder(async () => {
    const make = capture(true);
    await run(["template", "use", "grind-loop", "--name", "Flaky", "--set", "task=t", "--set", "test-command=c", "--out", "f.grooph.json"], make);

    const plain = capture(true);
    assert.equal(await run(["validate", "f.grooph.json"], plain), 0);
    assert.ok(plain.stdout.at(-1)!.startsWith("next: grooph validate --for-export f.grooph.json"));

    const forExport = capture(true);
    const code = await run(["validate", "--for-export", "f.grooph.json"], forExport);
    const last = (code === 0 ? forExport.stdout : forExport.stderr).at(-1)!;
    assert.match(last, code === 0 ? /^next: grooph export f\.grooph\.json/ : /^next: fix what is listed/);

    const piped = capture();
    await run(["validate", "f.grooph.json"], piped);
    assert.ok(!piped.stdout.concat(piped.stderr).some((l) => l.startsWith("next:")));

    const out = capture(true);
    assert.equal(await run(["export", "f.grooph.json", "--target", "claude-code", "--into", "pkg"], out), code === 0 ? 0 : 1);
  });
});

test("explain names each loop's rounds, its stops, the gates and the worst case; --json is the same as data", async () => {
  const io = capture();
  assert.equal(await run(["explain", "../../patterns/grind-loop.grooph.json"], io), 0);
  const text = io.stdout.join("\n");
  assert.match(text, /at most 5 rounds/);
  assert.match(text, /Human gates: none/);
  assert.match(text, /Worst case: at most 5 rounds/);

  const json = capture();
  assert.equal(await run(["explain", "../../patterns/grind-loop.grooph.json", "--json"], json), 0);
  const data = JSON.parse(json.stdout.join("\n"));
  assert.equal(data.loops[0].maxRounds, 5);
  assert.equal(data.worstCaseRounds, 5);

  const gated = capture();
  assert.equal(await run(["explain", "../../patterns/human-gated-irreversible.grooph.json"], gated), 0);
  assert.match(gated.stdout.join("\n"), /Human gates:\n {2}Irreversible step approval: .*cannot be undone/);
});

test("explain says what each stop does when it fires: a passed bar leaves the loop, any other stop halts and reports, and `then` goes on at a node", async () => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-explain-"));
  try {
    const file = join(dir, "r.grooph.json");
    let io = capture();
    assert.equal(await run(["template", "use", "review-gate", "--name", "Ship it", "--set", "task=fix the login bug", "--out", file], io), 0);
    io = capture();
    assert.equal(await run(["explain", file], io), 0);
    const said = io.stdout.join("\n");
    assert.match(said, /stops when the acceptance bar is met, the loop is left by its pass edges/);
    assert.match(said, /stops after 4 rounds, the run halts and reports to a person/);
    assert.match(said, /stops at 10 dispatches, the run halts and reports to a person/);
    assert.doesNotMatch(said, /the run ends/);
    // A stop that names where to go on.
    const doc = JSON.parse(readFileSync(file, "utf8")) as { loops: { stops: { kind: string; then?: string }[] }[]; nodes: { id: string; name?: string }[] };
    const gate = doc.nodes.find((n) => n.id.includes("approval") || (n.name ?? "").includes("approval"))!;
    doc.loops[0]!.stops[1]!.then = gate.id;
    writeFileSync(file, JSON.stringify(doc));
    io = capture();
    assert.equal(await run(["explain", file], io), 0);
    assert.match(io.stdout.join("\n"), new RegExp(`stops after 4 rounds, the run goes on at ${gate.name ?? gate.id}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("embed is a command like the others: listed in the overview, with its own help, and it prints the frame", async () => {
  let io = capture();
  assert.equal(await run(["--help"], io), 0);
  assert.match(io.stdout.join("\n"), /^  embed {8}one line of HTML that shows a graph on any page$/m);
  assert.ok(io.stdout.join("\n").split("\n").length <= 45);
  io = capture();
  assert.equal(await run(["embed", "--help"], io), 0);
  assert.match(io.stdout.join("\n"), /^grooph embed <file>/);
  const dir = mkdtempSync(join(tmpdir(), "grooph-embed-"));
  try {
    const file = join(dir, "g.grooph.json");
    assert.equal(await run(["template", "use", "grind-loop", "--set", "task=fix it", "--set", "test-command=pnpm test", "--out", file], capture()), 0);
    io = capture();
    assert.equal(await run(["embed", file, "--theme", "dark", "--height", "480"], io), 0, io.stderr.join("\n"));
    assert.match(io.stdout[0]!, /^<iframe [^>]*src="https:\/\/ryanjosephkamp\.github\.io\/grooph\/#\/embed\?[^"]*theme=dark[^"]*"[^>]*height="480"/);
    io = capture();
    assert.equal(await run(["embed", file, "--theme", "purple"], io), 1);
    assert.match(io.stderr.join("\n"), /--theme is light or dark/);
    io = capture();
    assert.equal(await run(["embd", file], io), 1);
    assert.match(io.stderr.join("\n"), /Did you mean "embed"\?/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

