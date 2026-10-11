/**
 * Promise 2, the paths: GROOPH_HOME with spaces, quotes, $, backticks, unicode and the rest. For each name that
 * install --user accepts, the command string it wrote into the settings is run as a harness would run it
 * (sh -c, bash -c, zsh -c), with an event on standard input, and the whole scratch folder is listed before and
 * after: one line in the right record, and nothing else anywhere (every hostile name tries to make a file
 * called CANARY).
 *   node 03-paths.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { S, changed, g, made, read, row, summary, tree } from "./lib.mjs";

const proj = made("the project");
const cwd = made("run-here");
let k = 0;

/** A person whose GROOPH_HOME is the given text (relative to their own folder unless absolute). */
function someone(homeText, opts = {}) {
  const name = `q${++k}`;
  const base = made(name);
  made(name, "home");
  const env = { GROOPH_HOME: opts.absolute ? homeText : join(base, homeText), CLAUDE_CONFIG_DIR: join(base, "claude"), CODEX_HOME: join(base, "codex"), HOME: join(base, "home") };
  return { env, base, name };
}

const names = [
  ["a space", "my grooph"],
  ["two spaces and a tab", "my  grooph\tfolder"],
  ["a single quote", "o'brien's grooph"],
  ["a semicolon and a command", "gh; touch CANARY; echo"],
  ["an ampersand", "gh && touch CANARY"],
  ["a pipe and redirection", "gh | touch CANARY > CANARY"],
  ["parentheses", "gh (touch CANARY)"],
  ["a star and a question mark", "gh*?"],
  ["braces and brackets", "gh{a,b}[x]"],
  ["a tilde and a hash", "~gh #touch CANARY"],
  ["an exclamation mark", "gh!!"],
  ["a percent and what looks like an escape", "gh%20%2F%00"],
  ["a query and a fragment", "gh?x=1#frag"],
  ["unicode", "グルーフ café"],
  ["emoji", "gh \u{1F600}"],
  ["a leading dash", "-rf"],
  ["a leading dash, an option of node's", "--eval"],
  ["a space at the end", "gh "],
  ["a control character (ESC)", "gh\u001b[31m"],
  ["a bell and a backspace", "gh\u0007\b"],
  ["two hundred letters", "g".repeat(200)],
  // What a shell reads as its own between double quotes: these should be refused.
  ["a double quote", 'gh" ; touch CANARY ; "'],
  ["a dollar", "gh$(touch CANARY)"],
  ["a dollar and a name", "gh$HOME"],
  ["a backtick", "gh`touch CANARY`"],
  ["a backslash", "gh\\"],
  ["a backslash before the closing quote", 'gh\\'],
  ["a line break", "gh\ntouch CANARY\n"],
  ["a carriage return", "gh\rtouch CANARY"],
];

let ranFine = 0;
let refused = 0;
let wrong = 0;
const notes = [];
const shells = ["sh", "bash", "zsh"];
for (const [what, text] of names) {
  const u = someone(text);
  const before = tree(S);
  const a = g(u.env, ["hooks", "install", "--user"]);
  if (a.status !== 0) {
    const nothing = changed(before, tree(S)).length === 0;
    if (/Nothing was changed/.test(a.err) && nothing) refused++;
    else {
      wrong++;
      notes.push(`${what}: refused but ${nothing ? "without saying so" : "something was written"}: ${a.err.slice(0, 120)}`);
    }
    continue;
  }
  const w = g(u.env, ["hooks", "watch", proj]);
  if (w.status !== 0) {
    wrong++;
    notes.push(`${what}: watch failed: ${w.all.slice(0, 200)}`);
    continue;
  }
  const settings = JSON.parse(read(join(u.env.CLAUDE_CONFIG_DIR, "settings.json")));
  const command = settings.hooks.SessionStart[0].hooks[0].command;
  const record = join(u.env.GROOPH_HOME, "events", JSON.parse(read(join(u.env.GROOPH_HOME, "watched.json"))).folders[0].events);
  let ok = true;
  for (const shell of shells) {
    const beforeRun = tree(S);
    const ran = spawnSync(shell, ["-c", command], { cwd, env: { PATH: process.env.PATH, HOME: u.env.HOME, CLAUDE_PROJECT_DIR: proj }, input: JSON.stringify({ hook_event_name: "SessionStart", session_id: `via-${shell}`, cwd: proj }), encoding: "utf8", timeout: 20_000 });
    const diff = changed(beforeRun, tree(S));
    const expected = existsSync(join(record, `via-${shell}.jsonl`));
    const stray = diff.filter((d) => !d.slice(2).startsWith(`${u.name}/`) || /(^|\/)CANARY /.test(d.slice(2)));
    if (ran.status !== 0 || ran.stdout !== "" || ran.stderr !== "" || !expected || stray.length > 0) {
      ok = false;
      notes.push(`${what} under ${shell} -c: exit ${ran.status}, stdout ${JSON.stringify(ran.stdout.slice(0, 80))}, stderr ${JSON.stringify(ran.stderr.slice(0, 160))}, line recorded: ${expected}, stray: ${stray.join("; ")}`);
    }
  }
  // And it is found again by remove.
  const r = g(u.env, ["hooks", "remove", "--user"]);
  const left = read(join(u.env.CLAUDE_CONFIG_DIR, "settings.json"));
  if (r.status !== 0 || left.includes("grooph-event")) {
    ok = false;
    notes.push(`${what}: remove --user left entries behind`);
  }
  if (ok) ranFine++;
  else wrong++;
}
const canary = [...tree(S).keys()].filter((p) => /(^|\/)CANARY$/.test(p));
row("GROOPH_HOME named with characters a shell reads (29 names); the settings entry run under sh -c, bash -c and zsh -c", names.length * 3, `${ranFine} names installed, ran silently under all three shells, recorded one line each in their own record, and were removed again; ${refused} refused with "Nothing was changed" and nothing written; ${wrong} went wrong. Files named CANARY anywhere: ${canary.length}. ${notes.join(" | ")}`, wrong === 0 && canary.length === 0 ? "held" : "broke");

// ── The same folder named in other ways ─────────────────────────────────────
{
  // A slash at the end.
  const u = someone("gh");
  u.env.GROOPH_HOME += "/";
  const a = g(u.env, ["hooks", "install", "--user"]);
  const cmd = JSON.parse(read(join(u.env.CLAUDE_CONFIG_DIR, "settings.json"))).hooks.Stop[0].hooks[0].command;
  row("GROOPH_HOME with a slash at its end", 1, `command: ${cmd.replace(S, "<S>")}`, a.status === 0 && !cmd.includes("//") ? "held" : "broke");

  // A relative name: resolved against the folder the command was run in.
  const v = someone("x");
  v.env.GROOPH_HOME = "rel/gh";
  const from1 = made(v.name, "one");
  const from2 = made(v.name, "two");
  const b = g(v.env, ["hooks", "install", "--user"], { cwd: from1 });
  const cmd2 = JSON.parse(read(join(v.env.CLAUDE_CONFIG_DIR, "settings.json"))).hooks.Stop[0].hooks[0].command;
  const w = g(v.env, ["hooks", "watch", proj], { cwd: from2 });
  const st = g(v.env, ["hooks", "status"], { cwd: from2 });
  const says = st.out.split("\n").filter((l) => /they run the hook at|not installed|its list and its events/.test(l)).map((l) => l.trim().replaceAll(S, "<S>"));
  row("GROOPH_HOME=rel/gh (relative): install run in one folder, watch in another", 2, `the entry runs ${cmd2.replace(S, "<S>").slice(0, 70)}; watch wrote its list in ${existsSync(join(from2, "rel", "gh", "watched.json")) ? "<two>/rel/gh/ (not the one the hook reads)" : "the same place"}; watch said of that: ${/Nothing runs the hook/.test(w.out) ? '"Nothing runs the hook outside a project yet"' : "nothing"}; status there says: ${says.join(" / ")}`, cmd2.includes(`"${from1}/rel/gh/hooks/`) ? "limit" : "broke");

  // A link.
  const l = someone("x");
  const realHome = made(l.name, "real grooph");
  symlinkSync(realHome, join(l.base, "link"));
  l.env.GROOPH_HOME = join(l.base, "link");
  g(l.env, ["hooks", "install", "--user"]);
  g(l.env, ["hooks", "watch", proj]);
  const cmd3 = JSON.parse(read(join(l.env.CLAUDE_CONFIG_DIR, "settings.json"))).hooks.Stop[0].hooks[0].command;
  const ran = spawnSync("sh", ["-c", cmd3], { cwd, env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: proj }, input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "via-link", cwd: proj }), encoding: "utf8" });
  const reader = g(l.env, ["sessions"], { cwd: proj });
  const inReal = [...tree(realHome).keys()].some((p) => p.endsWith("via-link.jsonl"));
  // Can the folder that holds the REAL grooph folder be listed (the refusal is about the folder that holds grooph's own)?
  const hold = g(l.env, ["hooks", "watch", l.base]);
  row("GROOPH_HOME is a link to a folder elsewhere", 3, `the hook wrote in the real folder: ${inReal}; grooph sessions in the project finds it: ${reader.out.includes("via-link")}; listing the folder that holds both is refused: ${hold.status !== 0}`, ran.status === 0 && inReal && reader.out.includes("via-link") && hold.status !== 0 ? "held" : "broke");

  // The hook's file is itself a link to the shipped file (as a person who links their tools into a clone might make it).
  const m = someone("gh");
  g(m.env, ["hooks", "install", "--user"]);
  g(m.env, ["hooks", "watch", proj]);
  const hookFile = join(m.env.GROOPH_HOME, "hooks", "grooph-event.mjs");
  const kept = made(m.name, "kept-elsewhere", "hooks");
  spawnSync("mv", [hookFile, join(kept, "grooph-event.mjs")]);
  symlinkSync(join(kept, "grooph-event.mjs"), hookFile);
  const cmd4 = JSON.parse(read(join(m.env.CLAUDE_CONFIG_DIR, "settings.json"))).hooks.Stop[0].hooks[0].command;
  spawnSync("sh", ["-c", cmd4], { cwd, env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: proj }, input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "hook-is-a-link", cwd: proj }), encoding: "utf8" });
  const recorded = [...tree(m.base).keys()].filter((p) => p.endsWith("hook-is-a-link.jsonl"));
  const status = g(m.env, ["hooks", "status"], { cwd: proj }).out.split("\n").filter((l) => /installed|version/.test(l)).map((l) => l.trim().replaceAll(S, "<S>"));
  row("the installed hook file replaced by a link to a copy kept elsewhere", 1, `recorded: ${recorded.join(", ") || "nothing, silently (the hook takes grooph's folder to be where its real file is)"}; grooph hooks status says: ${status.join(" / ")}`, recorded.length === 0 ? "limit" : "held");
}

summary();
