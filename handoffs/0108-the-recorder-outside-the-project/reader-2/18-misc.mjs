/**
 * Second reader, slice 0108. Smaller things: a project's `remove` in a home folder that holds entries of a
 * project's kind (written there by an earlier grooph), `install --user` and `remove --user` started at the same
 * moment, and a few sentences.
 *
 *   node 18-misc.mjs [--rounds 150]
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { g, gSpawn, made, person, row, summary, S } from "../reader/lib.mjs";

const at = process.argv.indexOf("--rounds");
const ROUNDS = at < 0 ? 150 : Number(process.argv[at + 1]);
const short = (t, n = 260) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").replace(/\n/g, " / ");
const put = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const start = (env, args) =>
  new Promise((done) => {
    const child = gSpawn(env, args);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => done({ status, out }));
  });

// ─── A project's remove in ~, where an earlier grooph left entries of a project's kind in the harness's own file ─
{
  const home = made("legacy", "home");
  const env = { HOME: home, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") };
  const file = join(home, ".claude", "settings.json");
  const text = '{\r\n\t"10": "ten",\r\n\t"budget": 1e400,\r\n\t"id": 9007199254740993,\r\n\t"env": {"A": 1, "A": 2},\r\n\t"hooks": {\r\n\t\t"Stop": [\r\n\t\t\t{"hooks": [{"type": "command", "command": "node \\"$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs\\" claude-code", "timeout": 5}]},\r\n\t\t\t{"hooks": [{"type": "command", "command": "say done"}]}\r\n\t\t]\r\n\t},\r\n\t"model": "opus"\r\n}\r\n';
  put(file, text);
  const r = g(env, ["hooks", "remove"], { cwd: home });
  const now = readFileSync(file, "utf8");
  const lost = [];
  if (!now.includes("1e400")) lost.push(`1e400 is now ${/"budget": (\S+?),?\s/.exec(now)?.[1]}`);
  if (!now.includes("9007199254740993")) lost.push("the long integer was rounded");
  if (!now.includes('"A": 1')) lost.push("the first of a key written twice is gone");
  if (!now.includes("\r\n")) lost.push("CRLF became LF");
  if (!now.includes("\t")) lost.push("tabs became two spaces");
  if (now.indexOf('"10"') > now.indexOf('"budget"') === false && text.indexOf('"10"') < text.indexOf('"budget"')) lost.push("(key order kept)");
  row("`grooph hooks remove` in ~, the harness's own settings holding one entry of a project's kind (from an earlier grooph)", 1, `exit ${r.status}: "${short(r.out.trim())}". The harness's own settings file was laid out anew: ${lost.join("; ") || "nothing lost"}`, lost.filter((l) => !l.startsWith("(")).length === 0 ? "held" : "limit");
}

// ─── install --user and remove --user at the same moment ──────────────────────────────────────────────────────
{
  let orphan = 0;
  let both = 0;
  let neither = 0;
  let unparseable = 0;
  for (let r = 0; r < ROUNDS; r += 1) {
    const env = person(`race${r}`);
    const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
    const hook = join(env.GROOPH_HOME, "hooks", "grooph-event.mjs");
    put(file, '{\n  "model": "opus"\n}\n');
    g(env, ["hooks", "install", "--user"]);
    // The remove is started first on even rounds, the install (with --tools, so that it writes) on odd ones.
    const cmds = [["hooks", "remove", "--user"], ["hooks", "install", "--user", "--tools"]];
    if (r % 2) cmds.reverse();
    await Promise.all(cmds.map((c) => start(env, c)));
    let entries = 0;
    try {
      entries = Object.values(JSON.parse(readFileSync(file, "utf8")).hooks ?? {}).flat().length;
    } catch {
      unparseable += 1;
    }
    const there = existsSync(hook);
    if (entries > 0 && !there) orphan += 1;
    else if (entries > 0) both += 1;
    else neither += 1;
  }
  row("install --user --tools and remove --user started at the same moment, after a good install", ROUNDS, `ended with entries and the hook's file: ${both}; with neither entries nor file (or the file alone): ${neither}; with entries in the settings and the hook's file GONE (every session then hears an error at every event): ${orphan}; settings that did not parse: ${unparseable}`, orphan + unparseable === 0 ? "held" : "broke");
}

// ─── Sentences ────────────────────────────────────────────────────────────────────────────────────────────────
{
  const env = person("words");
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  put(file, '{\n  "hooks": {\n    "Stop": []\n  },\n  "model": "opus"\n}\n');
  const a = g(env, ["hooks", "install", "--user"]);
  const b = g(env, ["hooks", "install", "--user"]);
  row('"Safe to run again" / "A second run writes nothing": a settings file with "Stop": [] and a key after hooks; install --user twice', 2, `first: exit ${a.status}; second, the same command: exit ${b.status}, "${short(b.all.trim().split("\n")[0])}"`, b.status === 0 ? "held" : "broke");
}
{
  const env = person("words2");
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  put(file, '{\n  "hooks": {\n    "Stop": []\n  }\n}\n');
  g(env, ["hooks", "install", "--user"]);
  const one = readFileSync(file, "utf8");
  const b = g(env, ["hooks", "install", "--user"]);
  const two = readFileSync(file, "utf8");
  const c = g(env, ["hooks", "install", "--user"]);
  const three = readFileSync(file, "utf8");
  const d = g(env, ["hooks", "install", "--user"]);
  const four = readFileSync(file, "utf8");
  const order = (t) => Object.keys(JSON.parse(t).hooks).join(",");
  row('"A second run writes nothing": a settings file with "Stop": [] and nothing after hooks; install --user four times', 4, `the second run ${two === one ? "wrote nothing" : `WROTE the file again ("${short(b.out.split("\n").find((l) => l.includes("settings.json")) ?? "")}")`}; the third ${three === two ? "wrote nothing" : "WROTE it again"}; the fourth ${four === three ? "wrote nothing" : "WROTE it again"}. Events after each: [${order(one)}] [${order(two)}] [${order(three)}]. exits ${b.status}, ${c.status}, ${d.status}`, two === one ? "held" : "broke");
}
summary();
