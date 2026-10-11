/**
 * Second reader, slice 0108. "Safe to run again": install --user, then install --user again with something
 * different about grooph's own entries (--tools added or dropped, GROOPH_HOME moved), in a settings file where
 * grooph's entries are the only hooks and "hooks" is not the last key of the file.
 *
 *   node 10-reinstall.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { g, person, row, summary, S } from "../reader/lib.mjs";

let n = 0;
const fresh = () => person(`p${(n += 1)}`);
const put = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const first = (r) => r.all.split("\n").find((l) => l.startsWith("grooph:")) ?? r.all.split("\n")[0];

/** One case: a starting file, a first install, a change to the file a person or a harness might make, a second install. */
function reinstall(what, { start, firstArgs = [], between = (t) => t, secondArgs = [], secondEnv = (e) => e, harness = "claude-code" }) {
  const env = fresh();
  const file = harness === "claude-code" ? join(env.CLAUDE_CONFIG_DIR, "settings.json") : join(env.CODEX_HOME, "hooks.json");
  if (start !== undefined) put(file, start);
  const a = g(env, ["hooks", "install", "--user", "--harness", harness, ...firstArgs]);
  if (a.status !== 0) return row(what, 1, `the FIRST install failed: ${first(a)}`, "broke");
  const mid = between(readFileSync(file, "utf8"));
  writeFileSync(file, mid);
  const b = g(secondEnv(env), ["hooks", "install", "--user", "--harness", harness, ...secondArgs]);
  const after = readFileSync(file, "utf8");
  const tools = (t) => JSON.stringify(JSON.parse(t).hooks?.PostToolUse ?? null);
  if (b.status !== 0) row(what, 1, `second install exit ${b.status}: "${first(b).replaceAll(S, "<S>")}"; file ${after === mid ? "unchanged" : "CHANGED"}; PostToolUse still ${tools(after).slice(0, 60)}…`, "broke");
  else row(what, 1, `second install exit 0; file ${after === mid ? "unchanged" : "changed"}`, "held");
  return b;
}

// A harness, or a person, adds a key after "hooks": the file `install --user` itself made, with one more member at its end.
const keyAfter = (t) => {
  const j = JSON.parse(t);
  return `${JSON.stringify({ ...j, model: "opus" }, null, 2)}\n`;
};
// The file as a harness that writes its settings sorted by key would leave it.
const sorted = (t) => {
  const j = JSON.parse(t);
  return `${JSON.stringify(Object.fromEntries(Object.keys(j).sort().map((k) => [k, j[k]])), null, 2)}\n`;
};

reinstall("install --user, a key is added after hooks, install --user --tools", { between: keyAfter, secondArgs: ["--tools"] });
reinstall("install --user --tools, a key is added after hooks, install --user (no --tools)", { firstArgs: ["--tools"], between: keyAfter });
reinstall("install --user, a key is added after hooks, install --user again unchanged (control)", { between: keyAfter });
reinstall("hooks first of three keys from the start; install; install --tools", { start: '{\n  "hooks": {},\n  "model": "opus",\n  "theme": "dark"\n}\n', secondArgs: ["--tools"] });
reinstall("hooks in the middle, already holding only grooph's from another GROOPH_HOME; install", {
  start: undefined,
  between: (t) => sorted(JSON.stringify({ ...JSON.parse(t), apiKeyHelper: "x", zebra: 1 })),
  secondEnv: (e) => ({ ...e, GROOPH_HOME: `${e.GROOPH_HOME}-moved` }),
});
reinstall("the same, codex", { harness: "codex", between: keyAfter, secondArgs: ["--tools"] });
reinstall("hooks last (control): install; install --tools", { start: '{\n  "model": "opus"\n}\n', secondArgs: ["--tools"] });
reinstall("hooks not last but somebody else's entry is in it too (control): install; install --tools", {
  start: '{\n  "hooks": {\n    "Stop": [\n      {\n        "hooks": [\n          {\n            "type": "command",\n            "command": "echo mine"\n          }\n        ]\n      }\n    ]\n  },\n  "model": "opus"\n}\n',
  secondArgs: ["--tools"],
});

// And the way out a person would then try: remove --user, install --user --tools.
{
  const env = fresh();
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  g(env, ["hooks", "install", "--user"]);
  writeFileSync(file, keyAfter(readFileSync(file, "utf8")));
  const stuck = g(env, ["hooks", "install", "--user", "--tools"]);
  const rm = g(env, ["hooks", "remove", "--user"]);
  const again = g(env, ["hooks", "install", "--user", "--tools"]);
  row("the way out: remove --user, then install --user --tools", 1, `stuck install exit ${stuck.status}; remove exit ${rm.status}; install after it exit ${again.status}; hooks is now the ${Object.keys(JSON.parse(readFileSync(file, "utf8"))).indexOf("hooks") + 1}. of ${Object.keys(JSON.parse(readFileSync(file, "utf8"))).length} keys`, again.status === 0 ? "limit" : "broke");
}
summary();
