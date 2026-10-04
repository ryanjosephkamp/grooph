/**
 * `grooph image | outline | page` (slice 0025): the picture as SVG and PNG,
 * the outline as Markdown, and the offline page, for a graph and for a map.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { PICTURE_THEMES, canonicalize, mapPicture, mapSequence, mapWide, offlinePage, outline, outlineMarkdown, parseGraphText, parseMapText, picture, themed, themedPage } from "@grooph/core";

import { VERSION, run } from "../src/index.js";
import type { Output } from "../src/print.js";
import { moved } from "./fresh.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const reviewLoop = join(repoRoot, "fixtures", "valid", "review-loop.grooph.json");
const sampleMap = join(repoRoot, "fixtures", "maps", "valid", "owner-operation-2026-09-30.grooph-map.json");
const doc = parseGraphText(readFileSync(reviewLoop, "utf8")).doc!;

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const grooph = (argv: string[], io = capture()) => run(argv, io, () => "", { openUrl: async () => {} });

const withScratch = async (fn: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "grooph-keep-test-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** A PNG's size, from its header. */
const pngSize = (bytes: Buffer): { width: number; height: number } => {
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "not a PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test("image draws a graph: the SVG core draws, byte for byte, in each theme", async () => {
  for (const theme of ["light", "dark", "auto"] as const) {
    const io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", theme], io), 0);
    assert.equal(`${text(io.stdout)}\n`, picture(doc, { theme }));
  }
  await withScratch(async (dir) => {
    const out = join(dir, "review-loop.light.svg");
    const io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "light", "--out", out], io), 0);
    assert.equal(readFileSync(out, "utf8"), readFileSync(join(repoRoot, "fixtures", "pictures", "review-loop.light.svg"), "utf8"));
  });
});

test("image writes a PNG three pixels to the unit, light unless told dark, and --scale changes the size", async () => {
  await withScratch(async (dir) => {
    const height = Number(/viewBox="0 0 400 ([\d.]+)"/.exec(picture(doc, { theme: "light" }))![1]);
    let io = capture();
    const light = join(dir, "rl.png");
    assert.equal(await grooph(["image", reviewLoop, "--out", light], io), 0, text(io.stderr));
    assert.deepEqual(pngSize(readFileSync(light)), { width: 1200, height: Math.round(height * 3) });

    io = capture();
    const dark = join(dir, "rl-dark.png");
    assert.equal(await grooph(["image", reviewLoop, "--theme", "dark", "--out", dark, "--scale", "2"], io), 0, text(io.stderr));
    assert.equal(pngSize(readFileSync(dark)).width, 800);
    assert.notDeepEqual(readFileSync(dark), readFileSync(light));

    io = capture();
    const map = join(dir, "ops.png");
    assert.equal(await grooph(["image", sampleMap, "--out", map], io), 0, text(io.stderr));
    assert.equal(pngSize(readFileSync(map)).width, 1200);

    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "auto", "--out", join(dir, "x.png")], io), 1);
    assert.match(text(io.stderr), /a PNG is light or dark, not both/);
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--out", join(dir, "x.png"), "--scale", "0"], io), 1);
  });
});

test("image, page and embed take --theme: six names, with light or dark after one; no --theme is the picture as it was", async () => {
  const map = parseMapText(readFileSync(sampleMap, "utf8")).map!;
  assert.deepEqual([...PICTURE_THEMES], ["paper", "blueprint", "ink", "phosphor", "transit", "chalk"]);
  for (const name of PICTURE_THEMES) {
    // What the command must print: Paper as core draws it in that form, and any other theme added to the picture
    // core draws to follow the viewer.
    const want = (draw: (theme: "auto" | "light" | "dark") => string, form: "auto" | "light" | "dark"): string => (name === "paper" ? draw(form) : themed(draw("auto"), name, form));
    // A name alone follows the viewer, as no --theme does; a name and light or dark writes the colors in.
    let io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", name], io), 0, text(io.stderr));
    assert.equal(`${text(io.stdout)}\n`, want((theme) => picture(doc, { theme }), "auto"), name);
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", `${name}-dark`], io), 0, text(io.stderr));
    assert.equal(`${text(io.stdout)}\n`, want((theme) => picture(doc, { theme }), "dark"), `${name}-dark`);
    // A map, and its other two views.
    io = capture();
    assert.equal(await grooph(["image", sampleMap, "--theme", `${name}-light`], io), 0, text(io.stderr));
    assert.equal(`${text(io.stdout)}\n`, want((theme) => mapPicture(map, { theme }), "light"), `${name}-light, a map`);
    io = capture();
    assert.equal(await grooph(["image", sampleMap, "--theme", name, "--layout", "wide"], io), 0, text(io.stderr));
    assert.equal(`${text(io.stdout)}\n`, want((theme) => mapWide(map, { theme }), "auto"), `${name}, lanes side by side`);
    io = capture();
    assert.equal(await grooph(["image", sampleMap, "--theme", name, "--view", "sequence"], io), 0, text(io.stderr));
    assert.equal(`${text(io.stdout)}\n`, want((theme) => mapSequence(map, { theme }), "auto"), `${name}, the sequence`);
  }
  // Paper by name is no theme at all: the same bytes as before there were any.
  let io = capture();
  assert.equal(await grooph(["image", reviewLoop, "--theme", "paper"], io), 0);
  const paper = text(io.stdout);
  io = capture();
  assert.equal(await grooph(["image", reviewLoop], io), 0);
  assert.equal(text(io.stdout), paper);
  assert.ok(!paper.includes("data-look"));

  await withScratch(async (dir) => {
    // A PNG in a theme is light unless told dark, and the size it always was.
    const height = Number(/viewBox="0 0 400 ([\d.]+)"/.exec(picture(doc, { theme: "light" }))![1]);
    const light = join(dir, "bp.png");
    let io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "blueprint", "--out", light], io), 0, text(io.stderr));
    assert.deepEqual(pngSize(readFileSync(light)), { width: 1200, height: Math.round(height * 3) });
    const dark = join(dir, "bp-dark.png");
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "blueprint-dark", "--out", dark], io), 0, text(io.stderr));
    assert.notDeepEqual(readFileSync(dark), readFileSync(light));
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "blueprint-auto", "--out", join(dir, "x.png")], io), 1);
    assert.match(text(io.stderr), /a PNG is light or dark, not both/);

    // The PNG's renderer knows `transform` and not `transform-box`: given Transit's rule for its arrowheads bare, it
    // moves each one across the picture. The rule is behind a condition it does not read, so with the rule or
    // without it the PNG is the same pixels; and bare, it is not, which is what the condition is for.
    const transit = themed(picture(doc), "transit", "light");
    const guarded = /@supports \(transform-box:fill-box\)\{([^{}]*\{[^{}]*\})\}/.exec(transit)!;
    const renderer = "@resvg/resvg-js";
    const { Resvg } = (await import(renderer)) as { Resvg: new (svg: string, options: unknown) => { render(): { asPng(): Uint8Array } } };
    const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { fitTo: { mode: "zoom", value: 1 } }).render().asPng());
    assert.deepEqual(png(transit), png(transit.replace(guarded[0], "")), "the renderer acted on the rule behind the condition");
    assert.notDeepEqual(png(transit), png(transit.replace(guarded[0], guarded[1]!)), "the renderer no longer gets the bare rule wrong: the condition can go");
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", "transit", "--out", join(dir, "transit.png")], io), 0, text(io.stderr));
    assert.deepEqual(pngSize(readFileSync(join(dir, "transit.png"))), { width: 1200, height: Math.round(height * 3) });

    // The offline page: its picture in the theme, everything else the page it was.
    const page = join(dir, "rl.html");
    io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", page, "--theme", "ink"], io), 0, text(io.stderr));
    assert.equal(readFileSync(page, "utf8"), themedPage(offlinePage(doc, { version: VERSION }), "ink"));
    assert.ok(readFileSync(page, "utf8").includes('data-look="ink"'));
    io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", page], io), 0);
    assert.equal(readFileSync(page, "utf8"), offlinePage(doc, { version: VERSION }));
    io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", page, "--theme", "ink-dark"], io), 1);
    assert.match(text(io.stderr), /a page follows the device's light or dark and has its own button for it/);
    io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", page, "--theme", "sepia"], io), 1);
    assert.match(text(io.stderr), /--theme is one of paper, blueprint/);
  });

  // A name that is none of the six is refused by name, and nothing is drawn.
  for (const wrong of ["sepia", "Blueprint", "chalk-", "dark-chalk", "chalk-night", "constructor"]) {
    io = capture();
    assert.equal(await grooph(["image", reviewLoop, "--theme", wrong], io), 1, wrong);
    assert.match(text(io.stderr), /--theme is one of paper, blueprint, ink, phosphor, transit, chalk; or light, dark or auto; or both, as chalk-dark\./);
    assert.equal(text(io.stdout), "");
  }
});

test("outline prints the Markdown core writes, for a graph and for a map, or writes it", async () => {
  let io = capture();
  assert.equal(await grooph(["outline", reviewLoop], io), 0);
  assert.equal(`${text(io.stdout)}\n`, outlineMarkdown(outline(doc)));
  io = capture();
  assert.equal(await grooph(["outline", sampleMap], io), 0);
  assert.match(text(io.stdout), /^# Ryan's operation, September 30, 2026\n/);
  assert.match(text(io.stdout), /\n## Session: Operator\n/);
  await withScratch(async (dir) => {
    const out = join(dir, "notes", "review-loop.md");
    io = capture();
    assert.equal(await grooph(["outline", reviewLoop, "--out", out], io), 0);
    assert.equal(readFileSync(out, "utf8"), outlineMarkdown(outline(doc)));
  });
});

test("page writes the one offline file, stamped with this version, holding the document; --out is required and is HTML", async () => {
  await withScratch(async (dir) => {
    const out = join(dir, "review-loop.html");
    let io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", out], io), 0);
    assert.match(text(io.stdout), /one file, no network needed/);
    const html = readFileSync(out, "utf8");
    assert.equal(html, offlinePage(doc, { version: VERSION }));
    const held = /id="grooph-document"[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!;
    assert.equal(`${JSON.stringify(JSON.parse(held), null, 2)}\n`, canonicalize(doc));

    io = capture();
    assert.equal(await grooph(["page", sampleMap, "--out", join(dir, "ops.html")], io), 0);
    assert.ok(readFileSync(join(dir, "ops.html"), "utf8").includes('data-picture="map"'));

    io = capture();
    assert.equal(await grooph(["page", reviewLoop], io), 1);
    assert.match(text(io.stderr), /page needs --out/);
    io = capture();
    assert.equal(await grooph(["page", reviewLoop, "--out", join(dir, "x.pdf")], io), 1);
    assert.match(text(io.stderr), /page writes an HTML file/);
  });
});

test("a file that is neither a graph nor a map is named, and nothing is written; every new command answers --help", async () => {
  await withScratch(async (dir) => {
    const bad = join(dir, "notes.json");
    writeFileSync(bad, "{ not json");
    for (const argv of [["image", bad], ["outline", bad], ["page", bad, "--out", join(dir, "x.html")]]) {
      const io = capture();
      assert.equal(await grooph(argv, io), 1, argv[0]);
      assert.match(text(io.stderr), /is not JSON/, argv[0]);
    }
    assert.equal(existsSync(join(dir, "x.html")), false);
    writeFileSync(bad, JSON.stringify({ grooph: 0, id: "x" }));
    const io = capture();
    assert.equal(await grooph(["image", bad], io), 1);
    assert.match(text(io.stderr), /neither a graph document nor an operation map/);
  });
  for (const command of ["image", "outline", "page"]) {
    const io = capture();
    assert.equal(await grooph([command, "--help"], io), 0);
    assert.match(text(io.stdout), new RegExp(`^grooph ${command} <graph \\| operation map>`));
  }
});

test("image and page mark a map's sessions with what the event hook has seen, from sources named for them", async () => {
  const events = join(repoRoot, "fixtures", "events");
  await withScratch(async (dir) => {
    let io = capture();
    const out = join(dir, "live.svg");
    // The mid-flight recording, moved to a minute ago: a session at work.
    const fresh = join(dir, "operator-now.jsonl");
    writeFileSync(fresh, moved(readFileSync(join(events, "claude-code-running.jsonl"), "utf8"), Date.now()));
    assert.equal(await grooph(["image", sampleMap, "--theme", "light", "--out", out, "--events", `operator=${fresh}`, "--events", `codex=${join(events, "codex-two-subagents.jsonl")}`], io), 0, text(io.stderr));
    const svg = readFileSync(out, "utf8");
    assert.match(svg, /<g data-session="operator" data-live="working">/);
    assert.match(svg, />working · 1 running, 1 done</);
    // As it was recorded, days ago: not ended, and not heard from since, so it is "last seen", never "working".
    io = capture();
    assert.equal(await grooph(["image", sampleMap, "--theme", "light", "--out", join(dir, "stale.svg"), "--events", `operator=${join(events, "claude-code-running.jsonl")}`], io), 0, text(io.stderr));
    const stale = readFileSync(join(dir, "stale.svg"), "utf8");
    assert.match(stale, /<g data-session="operator" data-live="quiet">/);
    assert.match(stale, />last seen [^<]+ ago</);
    assert.doesNotMatch(stale, />working/);
    assert.match(svg, /<g data-session="codex" data-live="ended">/);
    assert.match(svg, />live at \d{4}-\d\d-\d\d \d\d:\d\d UTC/);

    io = capture();
    assert.equal(await grooph(["page", sampleMap, "--out", join(dir, "live.html"), "--events", `workers=${join(events, "claude-code-nested.jsonl")}`], io), 0, text(io.stderr));
    const html = readFileSync(join(dir, "live.html"), "utf8");
    assert.ok(html.includes('data-session="workers" data-live="ended"') && html.includes("ended · 0 running, 3 done"));

    // A source has to say which session it is; a graph has no sessions to light; a missing source is named.
    for (const [argv, said] of [
      [["image", sampleMap, "--events", join(events, "codex-two-subagents.jsonl")], /name each source for the map session it belongs to.*This map's sessions: operator, workers/],
      [["image", sampleMap, "--events", `nobody=${join(events, "codex-two-subagents.jsonl")}`], /name each source for the map session/],
      [["image", sampleMap, "--events", "operator=/no/such/place"], /no such file or folder/],
      [["image", reviewLoop, "--events", `builder=${join(events, "codex-two-subagents.jsonl")}`], /lights the sessions of an operation map; this file is a graph/],
      [["page", reviewLoop, "--out", join(dir, "x.html"), "--events", `builder=${join(events, "codex-two-subagents.jsonl")}`], /this file is a graph/],
    ] as const) {
      io = capture();
      assert.equal(await grooph([...argv], io), 1, argv.join(" "));
      assert.match(text(io.stderr), said);
    }
    assert.equal(existsSync(join(dir, "x.html")), false);
  });
});
