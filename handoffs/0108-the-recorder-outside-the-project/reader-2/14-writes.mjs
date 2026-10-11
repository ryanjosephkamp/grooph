/**
 * Second reader, slice 0108. Whole-file writes: where `install --user` and `remove --user` now refuse, what they
 * say, and what a person is left with; leftover *.grooph-tmp files; very deep and very large settings.
 *
 *   node 14-writes.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { g, gSpawn, made, person, row, summary, S } from "../reader/lib.mjs";

const short = (t, n = 200) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").replace(/\n/g, " / ");
const words = (r) => short(r.all.split("\n").filter((l) => l.startsWith("grooph:")).join(" / ") || r.all.trim().split("\n").slice(0, 2).join(" / "), 330);
const START = '{\n  "model": "opus",\n  "hooks": {\n    "Notification": [\n      {\n        "hooks": [\n          {\n            "type": "command",\n            "command": "say done"\n          }\n        ]\n      }\n    ]\n  }\n}\n';
let n = 0;
function someone() {
  const env = person(`w${(n += 1)}`);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  return { env, dir: env.CLAUDE_CONFIG_DIR, file: join(env.CLAUDE_CONFIG_DIR, "settings.json"), hook: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs"), kept: made(`w${n}`, "kept-elsewhere") };
}
const ours = (file) => {
  try {
    return (readFileSync(file, "utf8").match(/grooph-event\.mjs\\" claude-code --user/g) ?? []).length;
  } catch {
    return "unreadable";
  }
};

// ─── Conditions put on the settings file AFTER a good install: can a person still take grooph out? ───────────
// Each: a settings file with one entry of the person's, install --user (must work), then the condition, then
// remove --user. `undo` puts the folder back so the scratch folder can be cleaned.
const conditions = [
  ["nothing (control)", () => {}, () => {}],
  ["the file made read-only (444)", (u) => chmodSync(u.file, 0o444), (u) => chmodSync(u.file, 0o644)],
  ["the file given a second name (a hard link, as a backup tool or `ln` leaves)", (u) => linkSync(u.file, join(u.kept, "settings-backup.json")), () => {}],
  ["its folder made read-only (555)", (u) => chmodSync(u.dir, 0o555), (u) => chmodSync(u.dir, 0o755)],
  [
    "the file moved to a dotfiles folder and linked back (a symlink), that folder writable",
    (u) => {
      writeFileSync(join(u.kept, "claude-settings.json"), readFileSync(u.file));
      rmSync(u.file);
      symlinkSync(join(u.kept, "claude-settings.json"), u.file);
    },
    () => {},
  ],
  [
    "the same, the dotfiles folder read-only (555), the file itself writable",
    (u) => {
      writeFileSync(join(u.kept, "claude-settings.json"), readFileSync(u.file));
      rmSync(u.file);
      symlinkSync(join(u.kept, "claude-settings.json"), u.file);
      chmodSync(u.kept, 0o555);
    },
    (u) => chmodSync(u.kept, 0o755),
  ],
  [
    "a chain of three links to the file",
    (u) => {
      writeFileSync(join(u.kept, "real.json"), readFileSync(u.file));
      rmSync(u.file);
      symlinkSync(join(u.kept, "real.json"), join(u.kept, "b.json"));
      symlinkSync("b.json", join(u.kept, "a.json"));
      symlinkSync(join(u.kept, "a.json"), u.file);
    },
    () => {},
  ],
  [
    "the link's file taken away (a dangling link)",
    (u) => {
      rmSync(u.file);
      symlinkSync(join(u.kept, "gone.json"), u.file);
    },
    () => {},
  ],
  ["the file made unreadable (000)", (u) => chmodSync(u.file, 0o000), (u) => chmodSync(u.file, 0o644)],
];
{
  const said = [];
  let stuck = 0;
  let untrue = 0;
  for (const [what, set, undo] of conditions) {
    const u = someone();
    writeFileSync(u.file, START);
    const i = g(u.env, ["hooks", "install", "--user"]);
    if (i.status !== 0) throw new Error(`the install before "${what}" failed: ${i.all}`);
    set(u);
    const target = () => {
      try {
        return readFileSync(u.file, "utf8");
      } catch {
        return undefined;
      }
    };
    const before = target();
    const r = g(u.env, ["hooks", "remove", "--user"]);
    const after = target();
    const left = ours(u.file);
    const linkStill = lstatSync(u.file, { throwIfNoEntry: false })?.isSymbolicLink() ? `still a link to ${short(readlinkSync(u.file), 40)}` : "";
    const tmp = [u.dir, u.kept].flatMap((d) => { try { return readdirSync(d).filter((f) => f.includes("grooph-tmp")); } catch { return []; } }).length;
    undo(u);
    const out = left === 0 && r.status === 0 ? "taken out" : `NOT taken out (exit ${r.status}; ${left} of grooph's entries left; the hook's file ${existsSync(u.hook) ? "kept" : "REMOVED"}; file ${after === before ? "unchanged" : "changed"})`;
    if (left !== 0 && what !== "nothing (control)") stuck += 1;
    const saysCannotRead = /cannot read/.test(r.all) && before !== undefined;
    if (saysCannotRead) untrue += 1;
    said.push(`[${what}] ${out}${linkStill ? `, ${linkStill}` : ""}${tmp ? `, ${tmp} tmp left` : ""}; said: "${words(r)}"`);
  }
  row("conditions put on the settings file after a good install, then remove --user", conditions.length, `a person cannot take grooph out with the command in ${stuck} of ${conditions.length - 1}; the refusal begins "cannot read" of a file it had just read in ${untrue}. ${said.join(" ||| ")}`, stuck > 0 ? "limit" : "held");
}

// ─── The same conditions BEFORE install: what install says, and whether anything at all was written ─────────
{
  const said = [];
  let wrote = 0;
  for (const [what, set, undo] of conditions.slice(1)) {
    const u = someone();
    writeFileSync(u.file, START);
    set(u);
    const r = g(u.env, ["hooks", "install", "--user"]);
    const hookThere = existsSync(u.hook);
    const left = ours(u.file);
    undo(u);
    if (r.status !== 0 && (hookThere || (typeof left === "number" && left > 0))) wrote += 1;
    said.push(`[${what}] exit ${r.status}, entries ${left}, hook file ${hookThere ? "written" : "not written"}: "${words(r)}"`);
  }
  row("the same conditions before install --user", conditions.length - 1, `refused and yet something written: ${wrote}. ${said.join(" ||| ")}`, wrote === 0 ? "held" : "broke");
}

// ─── A leftover <file>.<pid>.grooph-tmp under the very pid the next command gets ─────────────────────────────
// The pid is known only once the command has started; the leftover is put there in the time node takes to start.
async function withLeftover(what, args, prepare, where, kind = "file") {
  let hit = 0;
  let failed = 0;
  let secondFailed = 0;
  let removedLeftover = 0;
  let wordsOnce = "";
  const tries = 12;
  for (let i = 0; i < tries; i += 1) {
    const u = someone();
    writeFileSync(u.file, START);
    prepare(u);
    const argv = typeof args === "function" ? args(u) : args;
    const child = gSpawn(u.env, argv);
    const tmp = `${where(u)}.${child.pid}.grooph-tmp`;
    mkdirSync(dirname(tmp), { recursive: true });
    if (kind === "file") writeFileSync(tmp, "left by a command that died\n");
    else if (kind === "link") symlinkSync(join(u.kept, "victim.txt"), tmp);
    else mkdirSync(tmp);
    let all = "";
    child.stdout.on("data", (d) => (all += d));
    child.stderr.on("data", (d) => (all += d));
    const status = await new Promise((done) => child.on("close", done));
    // Was the leftover there before the command reached its write? If the command succeeded and the leftover is gone or replaced, the race was lost.
    if (status !== 0) {
      hit += 1;
      failed += 1;
      wordsOnce ||= short(all.split("\n").filter((l) => l.startsWith("grooph:")).join(" / "), 260);
      if (!existsSync(tmp)) removedLeftover += 1;
      const again = g(u.env, argv);
      if (again.status !== 0) secondFailed += 1;
    }
    if (kind === "link" && existsSync(join(u.kept, "victim.txt"))) wordsOnce += " [WROTE THROUGH THE LINK]";
  }
  row(what, tries, `the leftover was in the way in ${hit} of ${tries} (in the others the command was past it first); the command then failed ${failed} times, saying "${wordsOnce}"; it removed the leftover it had not made in ${removedLeftover}; the same command run again failed ${secondFailed} times`, secondFailed > 0 ? "broke" : failed > 0 ? "limit" : "held");
}
await withLeftover("a leftover settings.json.<pid>.grooph-tmp under the pid the next install --user gets", ["hooks", "install", "--user"], () => {}, (u) => u.file);
await withLeftover("the same, the leftover a link to a file elsewhere", ["hooks", "install", "--user"], () => {}, (u) => u.file, "link");
await withLeftover("the same, the leftover a folder", ["hooks", "install", "--user"], () => {}, (u) => u.file, "dir");
await withLeftover("a leftover watched.json.<pid>.grooph-tmp under the pid the next watch gets", (u) => ["hooks", "watch", u.kept], (u) => g(u.env, ["hooks", "install", "--user"]), (u) => join(u.env.GROOPH_HOME, "watched.json"));

// ─── Leftovers under other pids: does anything read or clear them? ───────────────────────────────────────────
{
  const u = someone();
  writeFileSync(u.file, START);
  for (const pid of [1, 99999, 4242]) writeFileSync(`${u.file}.${pid}.grooph-tmp`, '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"echo from-a-leftover"}]}]}}\n');
  g(u.env, ["hooks", "install", "--user"]);
  const st = g(u.env, ["hooks", "status"]);
  g(u.env, ["hooks", "remove", "--user"]);
  const left = readdirSync(u.dir).filter((f) => f.includes("grooph-tmp")).length;
  row("three leftover settings.json.<pid>.grooph-tmp files of dead commands", 3, `after install, status and remove: ${left} still there; status mentions them: ${/grooph-tmp/.test(st.out)}; the settings came back to the letter: ${readFileSync(u.file, "utf8") === START}`, left === 0 ? "held" : "limit");
}

// ─── Deep and large ───────────────────────────────────────────────────────────────────────────────────────────
{
  const said = [];
  let bad = 0;
  for (const depth of [1000, 3000, 6000, 12000, 50000]) {
    const u = someone();
    const text = `{"deep":${"[".repeat(depth)}${"]".repeat(depth)},"hooks":{}}`;
    let parses = true;
    try {
      JSON.parse(text);
    } catch {
      parses = false;
    }
    writeFileSync(u.file, text);
    const r = g(u.env, ["hooks", "install", "--user"]);
    const now = readFileSync(u.file, "utf8");
    const trace = /\n\s+at .*\(|RangeError: Maximum/.test(r.all) && !r.all.startsWith("grooph:");
    if (trace || (r.status !== 0 && now !== text)) bad += 1;
    said.push(`${depth} deep (JSON.parse here ${parses ? "reads it" : "cannot"}): exit ${r.status}${r.status !== 0 ? ` "${words(r)}"` : ""}${now === text ? "" : ", written"}${trace ? " STACK TRACE" : ""}`);
  }
  row("a value nested very deep beside hooks", 5, said.join("; "), bad === 0 ? "limit" : "broke");
}
{
  const u = someone();
  const big = `${JSON.stringify({ permissions: { allow: Array.from({ length: 400_000 }, (_, i) => `Bash(some-command-number-${i}:*)`) }, hooks: { Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }] }, model: "opus" }, null, 2)}\n`;
  writeFileSync(u.file, big);
  const t0 = Date.now();
  const i = g(u.env, ["hooks", "install", "--user"], { timeout: 120_000 });
  const t1 = Date.now();
  const again = g(u.env, ["hooks", "install", "--user"], { timeout: 120_000 });
  const t2 = Date.now();
  const r = g(u.env, ["hooks", "remove", "--user"], { timeout: 120_000 });
  const t3 = Date.now();
  row(`a settings file of ${Math.round(big.length / 1e6)} MB (400,000 permissions)`, 3, `install exit ${i.status} in ${t1 - t0} ms, again exit ${again.status} in ${t2 - t1} ms, remove exit ${r.status} in ${t3 - t2} ms; back to the letter: ${readFileSync(u.file, "utf8") === big}; mode ${(statSync(u.file).mode & 0o777).toString(8)}`, readFileSync(u.file, "utf8") === big ? "held" : "broke");
}
summary();
