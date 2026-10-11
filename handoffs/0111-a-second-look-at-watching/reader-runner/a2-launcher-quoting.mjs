// A2. The launcher's quoting. Every path it is given is put through names a shell would read as its own: a single
// quote, a double quote, a space, a line break, $, a backtick, a backslash, *, ;, &, a leading dash, $(…). The launcher
// is then run with a tool and a harness that only write down what they were handed, and what they were handed is held
// to what was meant, to the byte. Also: what the launcher hands the harness beyond what it was given (its environment).
//
//   sh with-fake-home.sh a2-launcher-quoting.mjs
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OWNER, filesUnder, lib, say } from "./lib.mjs";

const { launcherText, STARTED } = await import(join(lib, "watching-second-look-paid.mjs"));
const top = realpathSync(mkdtempSync(join(tmpdir(), "a2-")));
const NASTY = ["it's", 'a "quoted" one', "two  spaces", "a\nline break", "$HOME", "`id`", "back\\slash", "*", "a;b", "a&b", "-dash", "$(touch pwned)", "tab\there", "'; touch pwned; '", "trailing'"];
let wrong = 0;
for (const [n, nasty] of NASTY.entries()) {
  const base = join(top, String(n), nasty);
  const [groophHome, configDir, folder, harnessDir, bin] = [join(base, "home", ".grooph"), join(base, "profile"), join(base, "work", "packages"), join(base, "work", "harness"), join(base, "bin")];
  for (const dir of [configDir, folder, harnessDir, bin]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(configDir, "settings.json"), "{}\n");
  // A tool and a harness that write down their arguments, the three places, and where they were run.
  const dump = join(top, `${n}-seen`);
  mkdirSync(dump);
  // The tool's own file is kept out of the names: node itself refuses to load a module whose path holds a backslash,
  // which is node's and not the launcher's.
  const tool = join(top, `${n}-tool.mjs`);
  writeFileSync(tool, `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(join(dump, "tool.jsonl"))}, JSON.stringify({ args: process.argv.slice(2), GROOPH_HOME: process.env.GROOPH_HOME, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, CODEX_HOME: process.env.CODEX_HOME, cwd: process.cwd() }) + "\\n");\n`);
  const harness = join(bin, "harness");
  writeFileSync(harness, `#!${process.execPath}\nrequire("node:fs").writeFileSync(${JSON.stringify(join(dump, "harness.json"))}, JSON.stringify({ args: process.argv.slice(2), env: Object.keys(process.env).sort(), cwd: process.cwd() }));\n`);
  chmodSync(harness, 0o755);
  // The folder the launcher keeps its own files in was `harnessDir` at commit fa4ea32a and is `dir` in the edits after it: both are given.
  const text = launcherText({ harness, node: process.execPath, cli: tool, groophHome, configDir, folder, harnessDir, dir: harnessDir });
  const launcher = join(base, "work", "launch-outside.sh");
  writeFileSync(launcher, text, { mode: 0o755 });
  const args = ["-p", `a prompt with ${nasty} in it`, "--model", nasty, "--session-id", "a-session"];
  const env = { PATH: "/usr/bin:/bin", HOME: OWNER, CLAUDE_CONFIG_DIR: configDir };
  const out = spawnSync(launcher, args, { cwd: folder, env, encoding: "utf8" });
  const seen = existsSync(join(dump, "tool.jsonl")) ? readFileSync(join(dump, "tool.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  const ran = existsSync(join(dump, "harness.json")) ? JSON.parse(readFileSync(join(dump, "harness.json"), "utf8")) : null;
  const problems = [];
  if (out.status !== 0) problems.push(`the launcher exited ${out.status}: ${out.stderr.slice(0, 200)}${existsSync(join(harnessDir, "outside-install.txt")) ? ` | outside-install.txt: ${readFileSync(join(harnessDir, "outside-install.txt"), "utf8").replaceAll(top, "<top>").slice(0, 300)}` : ""}`);
  if (seen.length !== 2) problems.push(`the tool was run ${seen.length} times`);
  else {
    if (JSON.stringify(seen[0].args) !== JSON.stringify(["hooks", "install", "--user", "--harness", "claude-code"])) problems.push(`install was handed ${JSON.stringify(seen[0].args)}`);
    if (JSON.stringify(seen[1].args) !== JSON.stringify(["hooks", "watch", folder])) problems.push(`watch was handed ${JSON.stringify(seen[1].args)}`);
    for (const call of seen) {
      if (call.GROOPH_HOME !== groophHome || call.CLAUDE_CONFIG_DIR !== configDir || call.CODEX_HOME !== join(base, "home", ".codex-is-not-used")) problems.push(`the places were ${JSON.stringify([call.GROOPH_HOME, call.CLAUDE_CONFIG_DIR, call.CODEX_HOME])}`);
      if (realpathSync(call.cwd) !== realpathSync(harnessDir)) problems.push(`the tool was run in ${call.cwd}`);
    }
  }
  if (!ran) problems.push("the harness was not started");
  else if (JSON.stringify(ran.args) !== JSON.stringify(args)) problems.push(`the harness was handed ${JSON.stringify(ran.args)}`);
  if (!existsSync(join(harnessDir, STARTED)) || !existsSync(join(harnessDir, "settings-with-the-recorder.json"))) problems.push("the marker or the copy of the settings is missing");
  const strays = [...filesUnder(top), ...filesUnder(OWNER)].filter((path) => path.split("/").at(-1) === "pwned");
  if (strays.length > 0) problems.push(`A COMMAND IN A NAME WAS RUN: ${strays.join(", ")}`);
  wrong += problems.length;
  say(problems.length === 0 ? "HELD" : "SHOWN", `a name with ${JSON.stringify(nasty)}`, problems.join("\n"));
  if (n === 0 && ran) {
    const extra = ran.env.filter((name) => !Object.keys(env).includes(name));
    say(extra.length === 0 ? "HELD" : "SHOWN", `the harness's environment is what the launcher was given${extra.length === 0 ? "" : `, AND ${extra.join(", ")}`}`, `given: ${Object.keys(env).sort().join(", ")}\n got: ${ran.env.join(", ")}`);
  }
}
// Whether the two variables the launcher's shell adds can be taken off again before it becomes the harness.
const tried = spawnSync("/usr/bin/env", ["-i", "A=1", "/bin/sh", "-c", "unset PWD SHLVL OLDPWD; exec /usr/bin/env"], { encoding: "utf8" });
console.log(`\nwith "unset PWD SHLVL OLDPWD" before the exec, a program started from an environment of A=1 alone gets: ${tried.stdout.trim().split("\n").join(", ")}`);
console.log(wrong === 0 ? "\nno name got out of its quotes" : `\n${wrong} thing(s) went wrong`);
