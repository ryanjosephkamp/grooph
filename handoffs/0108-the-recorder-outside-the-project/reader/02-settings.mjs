/**
 * Promise 2: install --user and remove --user on a person's own settings.
 *   node 02-settings.mjs
 * Every person here is a scratch one (GROOPH_HOME, CLAUDE_CONFIG_DIR, CODEX_HOME and HOME under the scratch folder).
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readlinkSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";

import { S, changed, g, made, person, read, row, summary, tree } from "./lib.mjs";

let k = 0;
/** A new scratch person whose Claude Code settings hold `text` (undefined: no file). */
function someone(text, file = "settings.json") {
  const name = `u${++k}`;
  const env = person(name);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  mkdirSync(env.CODEX_HOME, { recursive: true });
  const path = file === "settings.json" ? join(env.CLAUDE_CONFIG_DIR, file) : join(env.CODEX_HOME, file);
  if (text !== undefined) writeFileSync(path, text);
  return { env, path, name, harness: file === "settings.json" ? "claude-code" : "codex" };
}
const install = (u, ...more) => g(u.env, ["hooks", "install", "--user", "--harness", u.harness, ...more]);
const remove = (u, ...more) => g(u.env, ["hooks", "remove", "--user", "--harness", u.harness, ...more]);
const isGrooph = (h) => typeof h?.command === "string" && /grooph-event\.mjs" (claude-code|codex) --user$/.test(h.command);
/** The settings as values with what install added taken out again: what a person had. */
function stripped(text) {
  const json = JSON.parse(text);
  if (json.hooks && typeof json.hooks === "object" && !Array.isArray(json.hooks)) {
    for (const event of Object.keys(json.hooks)) {
      if (!Array.isArray(json.hooks[event])) continue;
      json.hooks[event] = json.hooks[event].flatMap((e) => {
        if (!e || !Array.isArray(e.hooks) || !e.hooks.some(isGrooph)) return [e];
        const rest = e.hooks.filter((h) => !isGrooph(h));
        return rest.length ? [{ ...e, hooks: rest }] : [];
      });
    }
  }
  return json;
}
/** Whether what is left when grooph's entries are taken out is what the person had: the same values, in the same order of keys. */
function sameAsBefore(afterText, beforeText) {
  const was = JSON.parse(beforeText);
  const now = stripped(afterText);
  // An event grooph added to, that the person did not have, is left as an empty list by the stripping above: not theirs, not a change.
  if (now.hooks && typeof now.hooks === "object" && !Array.isArray(now.hooks)) {
    for (const event of Object.keys(now.hooks)) if (Array.isArray(now.hooks[event]) && now.hooks[event].length === 0 && !(was.hooks && Object.hasOwn(was.hooks, event))) delete now.hooks[event];
    if (Object.keys(now.hooks).length === 0 && !Object.hasOwn(was, "hooks")) delete now.hooks;
  }
  // As text: the same values in the same order of keys (and -0, which JSON.stringify writes as 0, is not counted a change of value).
  return JSON.stringify(now) === JSON.stringify(was);
}
const short = (s, n = 150) => (s.length > n ? `${s.slice(0, n)}...` : s).replaceAll(S, "<S>").replace(/\n/g, "\\n");

// ── A. Odd but valid JSON: is everything else as it was, in value and in the letters written? ──────────────
const mine = { type: "command", command: "./notify.sh" };
const ordinary = { permissions: { allow: ["Bash(ls:*)", "Read"], deny: [] }, env: { A: "1" }, model: "opus", hooks: { Stop: [{ hooks: [mine] }], PreToolUse: [{ matcher: "Bash", hooks: [mine] }], Notification: [] }, statusLine: { type: "command", command: "x" } };
const valid = [
  ["two spaces, other keys and other hooks", JSON.stringify(ordinary, null, 2) + "\n", []],
  ["four spaces", JSON.stringify(ordinary, null, 4) + "\n", []],
  ["tabs", JSON.stringify(ordinary, null, "\t") + "\n", []],
  ["one line, no line break at the end", JSON.stringify(ordinary), []],
  ["short lists kept on one line, as people write them", '{\n  "permissions": { "allow": ["Bash(ls:*)", "Read"], "deny": [] },\n  "model": "opus"\n}\n', ['"allow": ["Bash(ls:*)", "Read"]']],
  ["CRLF line ends", JSON.stringify(ordinary, null, 2).replace(/\n/g, "\r\n") + "\r\n", ["\r\n"]],
  ["a number past 2^53", '{\n  "big": 12345678901234567890,\n  "model": "opus"\n}\n', ["12345678901234567890"]],
  ["a number past 1e308", '{\n  "huge": 1e400,\n  "model": "opus"\n}\n', ["1e400"]],
  ["1.0, -0, 1E5, 0.10", '{\n  "a": 1.0,\n  "b": -0,\n  "c": 1E5,\n  "d": 0.10\n}\n', ["1.0", "-0", "1E5", "0.10"]],
  ["escapes written out (\\u00e9, \\/, \\u0041)", '{\n  "a": "caf\\u00e9",\n  "b": "a\\/b",\n  "c": "\\u0041"\n}\n', ["\\u00e9", "\\/", "\\u0041"]],
  ["the same key twice", '{\n  "model": "first",\n  "model": "second",\n  "x": 1\n}\n', ['"first"']],
  ["a key named __proto__, at the top and among the hooks", '{\n  "__proto__": { "polluted": true },\n  "hooks": { "__proto__": [ { "hooks": [ { "type": "command", "command": "./mine.sh" } ] } ] },\n  "constructor": { "prototype": 1 }\n}\n', ["__proto__", "polluted", "./mine.sh", "constructor"]],
  ["keys that are numbers, out of order", '{\n  "b": 1,\n  "10": "ten",\n  "2": "two",\n  "a": 2\n}\n', ['"b": 1,\n  "10": "ten",\n  "2": "two"']],
  ["unicode, emoji, a NUL in a string", '{\n  "名前": "値 \u{1F600}",\n  "nul": "a\\u0000b"\n}\n', ["名前", "\u{1F600}", "\\u0000"]],
  ["nested 2,000 deep", `{"deep":${"[".repeat(2000)}${"]".repeat(2000)},"model":"opus"}`, []],
  ['"hooks": {} and nothing else', '{\n  "hooks": {}\n}\n', []],
  ["hook entries that are not objects", '{\n  "hooks": {\n    "Stop": [null, 5, "s", { "hooks": "x" }, { "hooks": [null] }, []]\n  }\n}\n', []],
  ["an empty object", "{}\n", []],
  ["spaces before the brace and after the end", '   {\n  "model": "opus"\n}\n\n\n', []],
];
let valueKept = 0;
let lettersKept = 0;
let twiceSame = 0;
let backToBytes = 0;
let backToValue = 0;
const lost = [];
const notBack = [];
const notBackInValue = [];
for (const [what, text, tokens] of valid) {
  const u = someone(text);
  const a = install(u);
  if (a.status !== 0) {
    lost.push(`${what}: install refused (${short(a.err)})`);
    continue;
  }
  const after = read(u.path);
  let sameValue = false;
  try {
    sameValue = sameAsBefore(after, text);
  } catch (e) {
    lost.push(`${what}: what was written is not JSON (${e.message})`);
  }
  if (sameValue) valueKept++;
  else lost.push(`${what}: a value changed`);
  const missing = tokens.filter((t) => !after.includes(t));
  if (missing.length === 0) lettersKept++;
  else lost.push(`${what}: no longer in the file as written: ${missing.map((m) => JSON.stringify(m)).join(", ")}`);
  const b = install(u);
  if (b.status === 0 && read(u.path) === after) twiceSame++;
  else lost.push(`${what}: a second install changed the file`);
  const c = remove(u);
  const back = read(u.path);
  if (back === text) backToBytes++;
  else notBack.push(what);
  try {
    if (JSON.stringify(JSON.parse(back)) === JSON.stringify(JSON.parse(text))) backToValue++;
    else notBackInValue.push(`${what}: was ${short(text, 60)} is ${short(back, 60)}`);
  } catch (e) {
    notBackInValue.push(`${what}: ${e.message}`);
  }
}
row("install --user on valid settings written in odd ways: every other value as it was", valid.length, `${valueKept} of ${valid.length} kept every value (as JSON.parse reads it)`, valueKept === valid.length ? "held" : "broke");
row("the same: what a person wrote, letter for letter (numbers, escapes, a repeated key, lists on one line, CRLF, key order)", valid.length, `${lettersKept} of ${valid.length} still hold their own text. Lost: ${lost.filter((l) => l.includes("no longer")).map((l) => short(l, 110)).join(" | ") || "nothing"}`, lettersKept === valid.length ? "held" : "limit");
row("install --user run a second time", valid.length, `${twiceSame} of ${valid.length} left the file byte for byte`, twiceSame === valid.length ? "held" : "broke");
row("install then remove: back to what it was", valid.length, `${backToBytes} byte for byte, ${backToValue} in value. Not in value: ${notBackInValue.join(" | ") || "none"}. Not byte for byte: ${notBack.join("; ") || "none"}`, backToValue === valid.length ? (backToBytes === valid.length ? "held" : "limit") : "broke");
if (lost.length) console.log("    details:\n     - " + lost.map((l) => short(l, 300)).join("\n     - "));

// ── B. Settings that cannot be read as settings: nothing may change ─────────
{
  const bad = [
    ["a byte-order mark", "\ufeff" + JSON.stringify(ordinary, null, 2)],
    ["comments (JSONC)", '{\n  // mine\n  "model": "opus"\n}\n'],
    ["a trailing comma", '{\n  "model": "opus",\n}\n'],
    ["an empty file", ""],
    ["spaces only", "  \n"],
    ["null", "null"],
    ["a list", "[]"],
    ["a string", '"x"'],
    ['"hooks" is a list', '{"hooks":[]}'],
    ['"hooks" is null', '{"hooks":null}'],
    ['"hooks" is a string', '{"hooks":"x"}'],
    ["an event's hooks are a string", '{"hooks":{"Stop":"x"}}'],
    ["an event's hooks are an object", '{"hooks":{"Stop":{}}}'],
    ["half a file", '{"model": "op'],
    ["nested 200,000 deep", `{"deep":${"[".repeat(200_000)}${"]".repeat(200_000)}}`],
    ["UTF-16", Buffer.from('\ufeff{"model":"opus"}', "utf16le")],
  ];
  let untouched = 0;
  let saidSo = 0;
  const notes = [];
  for (const [what, text] of bad) {
    const u = someone(text);
    const before = tree(join(S, u.name));
    const bytes = readFileSync(u.path);
    const a = install(u);
    const same = readFileSync(u.path).equals(bytes) && changed(before, tree(join(S, u.name))).length === 0;
    if (same) untouched++;
    else notes.push(`${what}: CHANGED (${changed(before, tree(join(S, u.name))).join("; ")})`);
    if (a.status !== 0 && /Nothing was changed/.test(a.err)) saidSo++;
    else notes.push(`${what}: exit ${a.status}, said: ${short(a.all)}`);
    const r = remove(u);
    if (!readFileSync(u.path).equals(bytes)) notes.push(`${what}: remove changed it`);
  }
  row("settings that are not a JSON object with lists of hooks (a byte-order mark, comments, a trailing comma, empty, null, half a file, 200,000 deep, UTF-16)", bad.length, `${untouched} of ${bad.length} left every file under the person's folders as it was (the hook's file not written either); ${saidSo} said "Nothing was changed" and exited non-zero. ${notes.join(" | ")}`, untouched === bad.length && saidSo === bad.length ? "held" : "broke");
}

// ── C. Entries that look like grooph's, and grooph's written another way ────
{
  const u0 = someone(undefined);
  install(u0);
  const ours = JSON.parse(read(u0.path)).hooks.Stop[0].hooks[0].command;
  const hookPath = /^node "(.+)" claude-code --user$/.exec(ours)[1];
  const cases = [
    ["someone else's script that ends the same way", `node "/opt/tools/my-own-grooph-event.mjs" claude-code --user`, "keep"],
    ["a command of the person's that only mentions it", `echo "remember: grooph-event.mjs" claude-code --user`, "keep"],
    ["a project-style entry in the user's settings", `node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code`, "keep"],
    ["another GROOPH_HOME's entry", `node "/somewhere/else/hooks/grooph-event.mjs" claude-code --user`, "ours"],
    ["grooph's, in single quotes", `node '${hookPath}' claude-code --user`, "ours"],
    ["grooph's, with no quotes", `node ${hookPath} claude-code --user`, "ours"],
    ["grooph's, with two spaces", `node  "${hookPath}"  claude-code  --user`, "ours"],
    ["grooph's, with a full path to node", `/usr/local/bin/node "${hookPath}" claude-code --user`, "ours"],
    ["grooph's, with something after it", `node "${hookPath}" claude-code --user || true`, "ours"],
    ["grooph's, with a variable before it", `NODE_OPTIONS= node "${hookPath}" claude-code --user`, "ours"],
    ["grooph's, inside sh -c", `sh -c 'node "${hookPath}" claude-code --user'`, "ours"],
    ["grooph's, with a comment", `node "${hookPath}" claude-code --user # grooph`, "ours"],
  ];
  const out = [];
  for (const [what, command, kind] of cases) {
    const u = someone(JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command, timeout: 5 }] }] } }, null, 2) + "\n");
    // Same GROOPH_HOME as u0, so that "grooph's" really is this install's hook.
    u.env.GROOPH_HOME = u0.env.GROOPH_HOME;
    install(u);
    const afterInstall = JSON.parse(read(u.path)).hooks.Stop ?? [];
    const cmds = afterInstall.flatMap((e) => e.hooks.map((h) => h.command));
    const stillThere = cmds.includes(command);
    const runs = cmds.filter((c) => c.includes(hookPath) || c === command).length;
    remove(u);
    const afterRemove = (JSON.parse(read(u.path)).hooks?.Stop ?? []).flatMap((e) => e.hooks.map((h) => h.command));
    out.push({ what, kind, afterInstall: stillThere ? (kind === "ours" && command !== ours ? `kept beside the new one (${runs} entries now run the hook at Stop)` : "kept") : "REPLACED/REMOVED", afterRemove: afterRemove.includes(command) ? "still there" : "gone" });
  }
  const falsePos = out.filter((o) => o.kind === "keep" && (o.afterInstall !== "kept" || o.afterRemove !== "still there"));
  const falseNeg = out.filter((o) => o.kind === "ours" && o.afterRemove === "still there");
  row("entries that are NOT grooph's but look like them", out.filter((o) => o.kind === "keep").length, `${falsePos.length} taken out by install or remove: ${falsePos.map((o) => `${o.what} (after install: ${o.afterInstall}; after remove: ${o.afterRemove})`).join(" | ") || "none"}`, falsePos.length === 0 ? "held" : "broke");
  row("grooph's own entry written another way by hand (other quotes, a path to node, a word after it)", out.filter((o) => o.kind === "ours").length, `${falseNeg.length} still run the hook after remove --user, which then reports the hook's file ${existsSync(hookPath) ? "kept" : "removed"}: ${falseNeg.map((o) => o.what).join("; ") || "none"}. After install: ${[...new Set(out.filter((o) => o.kind === "ours").map((o) => o.afterInstall))].join(" / ")}`, falseNeg.length === 0 ? "held" : "limit");

  // A person joined their own command and grooph's in one entry.
  const u = someone(undefined);
  install(u);
  const s = JSON.parse(read(u.path));
  s.hooks.Stop[0].hooks.unshift({ type: "command", command: "./my-own-stop-hook.sh" });
  writeFileSync(u.path, JSON.stringify(s, null, 2) + "\n");
  const again = install(u);
  const afterInstall = read(u.path).includes("my-own-stop-hook.sh");
  writeFileSync(u.path, JSON.stringify(s, null, 2) + "\n");
  remove(u);
  const afterRemove = read(u.path).includes("my-own-stop-hook.sh");
  row("an entry in which a person put their own command beside grooph's", 2, `their command is still there after install --user again: ${afterInstall}; after remove --user: ${afterRemove}`, afterInstall && afterRemove ? "held" : "broke");
}

// ── D. Links, permissions, and files that cannot be replaced ────────────────
{
  // A link to a settings file kept elsewhere (a dotfiles folder).
  const u = someone(undefined);
  const dot = made("dotfiles", u.name);
  const target = join(dot, "claude-settings.json");
  writeFileSync(target, JSON.stringify(ordinary, null, 2) + "\n");
  symlinkSync(target, u.path);
  const a = install(u);
  const stillLink = lstatSync(u.path).isSymbolicLink() && readlinkSync(u.path) === target;
  const left = [...tree(dot).keys()];
  row("settings.json is a link to a file kept elsewhere", 1, `exit ${a.status}; still a link: ${stillLink}; the far file has grooph's entries: ${read(target).includes("--user")}; files in that folder now: ${left.join(", ")}`, a.status === 0 && stillLink && read(target).includes("--user") && left.length === 1 ? "held" : "broke");

  const u2 = someone(undefined);
  symlinkSync(join(S, "nowhere", "x.json"), u2.path);
  const before2 = tree(join(S, u2.name));
  const b = install(u2);
  row("settings.json is a link to nothing", 1, `exit ${b.status}: ${short(b.err)}; changed: ${changed(before2, tree(join(S, u2.name))).join("; ") || "nothing"}`, b.status !== 0 && changed(before2, tree(join(S, u2.name))).length === 0 ? "held" : "broke");

  const u3 = someone(undefined);
  symlinkSync(u3.path, u3.path + ".b");
  symlinkSync(u3.path + ".b", u3.path);
  const c = install(u3);
  row("settings.json is a link that leads back to itself", 1, `exit ${c.status}: ${short(c.err)}`, c.status !== 0 && lstatSync(u3.path).isSymbolicLink() ? "held" : "broke");

  // A second name (a hard link) for a file kept elsewhere.
  const u4 = someone(undefined);
  const dot4 = made("dotfiles", u4.name);
  writeFileSync(join(dot4, "s.json"), "{}\n");
  linkSync(join(dot4, "s.json"), u4.path);
  install(u4);
  row("settings.json is a second name (hard link) for a file kept elsewhere", 1, `the two names are still one file: ${statSync(u4.path).ino === statSync(join(dot4, "s.json")).ino}; the other name's contents: ${short(read(join(dot4, "s.json")), 20)}`, statSync(u4.path).ino === statSync(join(dot4, "s.json")).ino ? "held" : "limit");

  // Permissions.
  const u5 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  chmodSync(u5.path, 0o600);
  install(u5);
  row("a settings file only its owner can read (600)", 1, `mode after: ${(statSync(u5.path).mode & 0o777).toString(8)}`, (statSync(u5.path).mode & 0o777) === 0o600 ? "held" : "broke");

  const u6 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  chmodSync(u6.path, 0o444);
  const text6 = read(u6.path);
  const e = install(u6);
  row("a settings file marked read-only (444) in a folder that can be written", 1, `exit ${e.status}; the file was changed all the same: ${read(u6.path) !== text6}; mode after: ${(statSync(u6.path).mode & 0o777).toString(8)}; said: ${short(e.out.split("\n")[1] ?? "", 60)}`, read(u6.path) !== text6 ? "limit" : "held");

  const u7 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  chmodSync(u7.path, 0o000);
  const before7 = tree(join(S, u7.name));
  const f = install(u7);
  row("a settings file that cannot be read (000)", 1, `exit ${f.status}: ${short(f.err, 120)}; changed: ${changed(before7, tree(join(S, u7.name))).join("; ") || "nothing"}`, f.status !== 0 && changed(before7, tree(join(S, u7.name))).length === 0 ? "held" : "broke");
  chmodSync(u7.path, 0o600);

  const u8 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  chmodSync(u8.env.CLAUDE_CONFIG_DIR, 0o555);
  const h = install(u8);
  let ok8 = false;
  try {
    ok8 = JSON.parse(read(u8.path)).hooks.SessionStart !== undefined;
  } catch {}
  row("the folder takes no new file (555), the settings file itself can be written", 1, `exit ${h.status}; written in place (not beside and renamed): ${ok8}; leftovers: ${[...tree(u8.env.CLAUDE_CONFIG_DIR).keys()].filter((n) => n !== "settings.json").join(", ") || "none"}. A stop in the middle of that write would leave part of a file: reasoned, not caught`, h.status === 0 && ok8 ? "limit" : "held");
  chmodSync(u8.env.CLAUDE_CONFIG_DIR, 0o755);

  const u9 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  chmodSync(u9.path, 0o444);
  chmodSync(u9.env.CLAUDE_CONFIG_DIR, 0o555);
  const text9 = read(u9.path);
  const i = install(u9);
  row("neither the folder nor the file can be written", 1, `exit ${i.status}: ${short(i.err, 220)}; the settings are as they were: ${read(u9.path) === text9}; the hook's file was written before that: ${existsSync(join(u9.env.GROOPH_HOME, "hooks", "grooph-event.mjs"))}`, i.status !== 0 && read(u9.path) === text9 ? "held" : "broke");
  chmodSync(u9.env.CLAUDE_CONFIG_DIR, 0o755);

  const u10 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  execFileSync("chflags", ["uchg", u10.path]);
  const text10 = read(u10.path);
  const j = install(u10);
  execFileSync("chflags", ["nouchg", u10.path]);
  row("a settings file locked in the Finder (chflags uchg)", 1, `exit ${j.status}: ${short(j.err, 200)}; as it was: ${read(u10.path) === text10}; leftovers: ${[...tree(u10.env.CLAUDE_CONFIG_DIR).keys()].filter((n) => n !== "settings.json").join(", ") || "none"}`, j.status !== 0 && read(u10.path) === text10 ? "held" : "broke");

  const u11 = someone(undefined);
  mkdirSync(u11.path);
  const l = install(u11);
  row("settings.json is a folder", 1, `exit ${l.status}: ${short(l.err, 120)}`, l.status !== 0 ? "held" : "broke");

  // Two harnesses, the second's settings unreadable: is the first's left alone?
  const u12 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  writeFileSync(join(u12.env.CODEX_HOME, "hooks.json"), "{ not json");
  const before12 = tree(join(S, u12.name));
  const m = g(u12.env, ["hooks", "install", "--user", "--harness", "claude-code,codex"]);
  row("both harnesses asked for, Codex's hooks.json cannot be read", 1, `exit ${m.status}: ${short(m.err, 120)}; changed: ${changed(before12, tree(join(S, u12.name))).join("; ") || "nothing"}`, m.status !== 0 && changed(before12, tree(join(S, u12.name))).length === 0 ? "held" : "broke");

  // Two harnesses, the second cannot be written: the first is, and that is said.
  const u13 = someone(JSON.stringify(ordinary, null, 2) + "\n");
  writeFileSync(join(u13.env.CODEX_HOME, "hooks.json"), "{}\n");
  chmodSync(join(u13.env.CODEX_HOME, "hooks.json"), 0o444);
  chmodSync(u13.env.CODEX_HOME, 0o555);
  const o = g(u13.env, ["hooks", "install", "--user", "--harness", "claude-code,codex"]);
  chmodSync(u13.env.CODEX_HOME, 0o755);
  row("both harnesses asked for, Codex's hooks.json cannot be written", 1, `exit ${o.status}: ${short(o.err, 330)}`, o.status !== 0 && /Written before that/.test(o.err) ? "held" : "broke");

  // Codex's file, the same checks in brief.
  const u14 = someone(JSON.stringify({ hooks: { Stop: [{ hooks: [mine] }] }, other: [1, 2, 3] }, null, 2) + "\n", "hooks.json");
  const t14 = read(u14.path);
  install(u14);
  const v14 = sameAsBefore(read(u14.path), t14);
  install(u14);
  remove(u14);
  row("Codex's hooks.json: install, install, remove", 3, `other values kept: ${v14}; back byte for byte: ${read(u14.path) === t14}`, v14 && read(u14.path) === t14 ? "held" : "broke");
}

// ── E. remove keeps the events and the list; and the options it refuses ─────
{
  const u = someone(undefined);
  install(u);
  const proj = made("proj-e");
  g(u.env, ["hooks", "watch", proj]);
  mkdirSync(join(u.env.GROOPH_HOME, "events", "x"), { recursive: true });
  writeFileSync(join(u.env.GROOPH_HOME, "events", "x", "s.jsonl"), "kept\n");
  const before = tree(u.env.GROOPH_HOME);
  const r = remove(u);
  const diff = changed(before, tree(u.env.GROOPH_HOME));
  row("remove --user: what is left in grooph's own folder", 1, `changed: ${diff.join("; ")}; settings.json after: ${short(read(u.path), 30)}`, diff.length === 1 && diff[0].startsWith("- hooks/grooph-event.mjs") ? "held" : "broke");
  const r2 = remove(u);
  row("remove --user a second time", 1, `exit ${r2.status}: ${short(r2.all, 100)}`, r2.status === 0 ? "held" : "broke");
  const refused = [["--dir", "."], ["--local"], ["--push"], ["--push-branch", "x"]].map((more) => install(u, ...more)).filter((x) => x.status !== 0 && /Nothing was changed/.test(x.err)).length;
  row("install --user with --dir, --local, --push, --push-branch", 4, `${refused} refused with "Nothing was changed"`, refused === 4 ? "held" : "broke");
}

// ── F. A project install made in the person's home folder, beside the user-level one ──
{
  // The default layout: grooph's folder is ~/.grooph and Claude Code's is ~/.claude, so "the project" ~ and the user level share both.
  const name = `u${++k}`;
  const home = made(name, "home");
  const env = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") };
  const proj = made("proj-f");
  g(env, ["hooks", "install", "--user"]);
  g(env, ["hooks", "watch", proj]);
  const settings = join(home, ".claude", "settings.json");
  const userEntries = () => (read(settings).match(/--user"/g) ?? []).length;
  const had = userEntries();
  const a = g(env, ["hooks", "install"], { cwd: home });
  const status = g(env, ["hooks", "status"], { cwd: proj });
  row("grooph hooks install run in the home folder itself (a project install where the project is ~), after install --user", 1, `user-level entries in ~/.claude/settings.json before: ${had}, after: ${userEntries()}. install said nothing of it (${/user/i.test(a.out) ? "it did" : "no word of the user-level install"}). grooph hooks status in the listed project then says: ${short(status.out.split("\n").filter((l) => /claude-code: .*entr/.test(l)).pop() ?? "", 130)}`, userEntries() === had ? "held" : "broke");
}

// ── G. Options changed between installs; one harness removed and not the other ──
{
  const u = someone(JSON.stringify(ordinary, null, 2) + "\n");
  const n = () => (read(u.path).match(/--user"/g) ?? []).length;
  install(u);
  const plain = n();
  install(u, "--tools");
  const tools = n();
  const matcher = read(u.path).includes('"matcher": "Agent"');
  install(u);
  const back = n();
  row("install --user, then with --tools, then without", 3, `entries of grooph's: ${plain}, ${tools}, ${back}; with --tools the Agent-only entry is ${matcher ? "still there beside the new one" : "replaced"}; the person's own two entries still there: ${read(u.path).split("./notify.sh").length - 1 === 2}`, plain === 7 && tools === 7 && back === 7 && !matcher ? "held" : "broke");
  const both = g(u.env, ["hooks", "install", "--user", "--harness", "claude-code,codex"]);
  const r = g(u.env, ["hooks", "remove", "--user", "--harness", "codex"]);
  const hookFile = join(u.env.GROOPH_HOME, "hooks", "grooph-event.mjs");
  const stillClaude = n();
  const codexLeft = read(join(u.env.CODEX_HOME, "hooks.json"));
  const r2 = g(u.env, ["hooks", "remove", "--user"]);
  row("both harnesses installed; remove --user --harness codex; then remove --user", 2, `after the first: Claude Code's entries ${stillClaude}, Codex's file ${JSON.stringify(codexLeft.trim())}, the hook's file kept: ${r.out.includes("removed " + hookFile) ? "NO" : "yes"}; after the second the hook's file is gone: ${!existsSync(hookFile)}`, stillClaude === 7 && !r.out.includes("removed " + hookFile) && !existsSync(hookFile) ? "held" : "broke");
  // What mode is the list given, and grooph's folder?
  const w = g(u.env, ["hooks", "install", "--user"]);
  g(u.env, ["hooks", "watch", made("proj-g")]);
  row("who can read the list of folders", 1, `watched.json has mode ${(statSync(join(u.env.GROOPH_HOME, "watched.json")).mode & 0o777).toString(8)}, grooph's folder ${(statSync(u.env.GROOPH_HOME).mode & 0o777).toString(8)} (the events folders are 700 and the files 600; the list holds the same folder paths)`, (statSync(join(u.env.GROOPH_HOME, "watched.json")).mode & 0o077) === 0 ? "held" : "limit");
}

summary();
