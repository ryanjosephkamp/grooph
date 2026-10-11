/**
 * The recorder outside the project (slice 0108): `grooph hooks install --user`, the list of folders it records,
 * where the events go, and the three commands that read them. `hooks.test.ts` holds the hook's own promises, in
 * both layouts; this file holds what is new with the second one.
 *
 * Every folder here is a scratch one. Grooph's own folder and the two harnesses' settings folders are named
 * through the environment for each command, and are never the ones of the machine the tests run on.
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, linkSync, lstatSync, mkdirSync, renameSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { LiveView } from "@grooph/core";

import { hookEntries, hookSource, storeName } from "../src/commands/hooks.js";
import { LIVE_ENDPOINT, projectRoot, startWatch } from "../src/commands/watch.js";
import { STORE_NAME, ownSources, readList, storeLine } from "../src/events-io.js";
import { run } from "../src/index.js";
import type { Output } from "../src/print.js";
import { scratchEnv, scratchPlaces } from "./scratch-home.js";

type Capture = Output & { stdout: string[]; stderr: string[] };
const capture = (): Capture => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (t) => void stdout.push(t), err: (t) => void stderr.push(t) };
};
const text = (lines: string[]): string => lines.join("\n");
const literally = (path: string): string => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A person's own places, made for one test: grooph's folder, the harnesses' settings, and somewhere to keep projects. */
type Home = {
  root: string;
  env: { GROOPH_HOME: string; CLAUDE_CONFIG_DIR: string; CODEX_HOME: string };
  hook: string;
  list: string;
  events: string;
  claude: string;
  codex: string;
  /** a project folder under this home's own scratch folder, made now */
  project: (name: string) => string;
  /** run a command with this home's places, from `cwd` when one is given */
  grooph: (argv: string[], more?: { env?: Record<string, string>; cwd?: string; signal?: AbortSignal }) => Promise<{ code: number; out: string; err: string }>;
  /** the folder a listed folder's events are kept in */
  store: (project: string) => string;
};

async function withHome(fn: (home: Home) => Promise<void>): Promise<void> {
  // A space in the name: a person's home folder may have one, and the hook's whole path goes into a command a shell runs.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph user home ")));
  const env = scratchPlaces(root);
  const home: Home = {
    root,
    env,
    hook: join(env.GROOPH_HOME, "hooks", "grooph-event.mjs"),
    list: join(env.GROOPH_HOME, "watched.json"),
    events: join(env.GROOPH_HOME, "events"),
    claude: join(env.CLAUDE_CONFIG_DIR, "settings.json"),
    codex: join(env.CODEX_HOME, "hooks.json"),
    project: (name) => {
      mkdirSync(join(root, "work", name), { recursive: true });
      return join(root, "work", name);
    },
    grooph: async (argv, more = {}) => {
      const io = capture();
      const code = await run(argv, io, () => "", { openUrl: async () => {}, env: { ...scratchEnv, ...env, ...more.env }, ...(more.cwd !== undefined ? { cwd: more.cwd } : {}), ...(more.signal ? { signal: more.signal } : {}) });
      return { code, out: text(io.stdout), err: text(io.stderr) };
    },
    store: (project) => {
      const listed = readList(join(env.GROOPH_HOME, "watched.json")).folders.find((f) => f.path === project);
      assert.ok(listed, `${project} is not on the list`);
      return join(env.GROOPH_HOME, "events", listed.events);
    },
  };
  try {
    await fn(home);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Run a hook's file as a harness does, in the layout a user-level settings entry names. */
function fire(hook: string, payload: Record<string, unknown>, options: { harness?: string; env?: Record<string, string>; cwd?: string } = {}) {
  return spawnSync(process.execPath, [hook, options.harness ?? "claude-code", "--user"], {
    input: JSON.stringify(payload),
    cwd: options.cwd ?? (typeof payload["cwd"] === "string" ? payload["cwd"] : tmpdir()),
    env: { PATH: process.env["PATH"] ?? "", ...options.env },
    encoding: "utf8",
  });
}
const quiet = (r: ReturnType<typeof fire>, what: string): void => assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], what);
const start = (hook: string, session: string, cwd: string, env: Record<string, string> = {}) => fire(hook, { hook_event_name: "SessionStart", session_id: session, cwd }, { env });
const sessionsIn = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const linesIn = (file: string): Record<string, unknown>[] => readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
/** Every file and folder under a folder, by its path from it, with what each file holds. A project's own `.git` is git's to change. */
function everything(dir: string, from = dir): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(dir).sort()) {
    if (dir === from && name === ".git") continue;
    const path = join(dir, name);
    const is = lstatSync(path);
    if (is.isDirectory()) Object.assign(found, { [`${relative(from, path)}/`]: "" }, everything(path, from));
    else found[relative(from, path)] = is.isFile() ? readFileSync(path, "utf8") : "(not a file)";
  }
  return found;
}

test("install --user writes the hook and its entries into the person's own settings, leaves every other setting as it was and where it was, and is safe to run twice; remove --user undoes it and keeps the events", async () => {
  await withHome(async (h) => {
    const mine = {
      model: "opus",
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./mine.sh" }] }], Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }], PreCompact: [] },
      permissions: { allow: ["Bash(npm test:*)"] },
    };
    // Laid out the person's own way: four spaces, no line break at its end, and readable by them alone.
    const before = JSON.stringify(mine, null, 4);
    mkdirSync(dirname(h.claude), { recursive: true });
    writeFileSync(h.claude, before, { mode: 0o600 });

    const installed = await h.grooph(["hooks", "install", "--user", "--harness", "claude-code,codex"]);
    assert.equal(installed.code, 0, installed.err);
    assert.match(installed.out, /it records, it cannot steer/);
    assert.match(installed.out, /No folder is listed yet, so nothing is recorded yet/);
    assert.match(installed.out, /Codex runs a hook only after you have reviewed it/);
    assert.match(installed.out, /a watched project holds nothing of grooph's/);
    assert.equal(readFileSync(h.hook, "utf8"), readFileSync(hookSource(), "utf8"));

    const after = readFileSync(h.claude, "utf8");
    const settings = JSON.parse(after) as { model: string; permissions: unknown; hooks: Record<string, { matcher?: string; hooks: { command: string; async?: boolean; timeout?: number }[] }[]> };
    assert.deepEqual(Object.keys(settings), ["model", "hooks", "permissions"], "the settings' own keys changed places");
    assert.equal(settings.model, "opus");
    assert.deepEqual(settings.permissions, mine.permissions);
    assert.deepEqual(settings.hooks["PreToolUse"], mine.hooks.PreToolUse);
    assert.deepEqual(settings.hooks["PreCompact"], [], "an event's list that was empty was taken out");
    assert.equal(settings.hooks["Stop"]!.length, 2);
    assert.equal(settings.hooks["Stop"]![0]!.hooks[0]!.command, "./notify.sh");
    // The entry says the layout, and names the hook by its whole path.
    const command = `node "${h.hook}" claude-code --user`;
    assert.equal(settings.hooks["SubagentStart"]![0]!.hooks[0]!.command, command);
    // The same entries an install in a project writes, but for what they run.
    for (const event of ["SessionStart", "SessionEnd", "UserPromptSubmit", "SubagentStart", "SubagentStop", "PostToolUse"]) assert.deepEqual(settings.hooks[event], hookEntries("claude-code", false, undefined, command)[event]);
    assert.deepEqual(settings.hooks["Stop"]![1], hookEntries("claude-code", false, undefined, command)["Stop"]![0]);
    assert.match(after, /^\{\n {4}"model"/, "the file's own indentation was not kept");
    assert.ok(!after.endsWith("\n"), "a line break was added at the file's end");
    if (process.platform !== "win32") assert.equal(statSync(h.claude).mode & 0o777, 0o600, "the file's permissions changed");
    assert.deepEqual((JSON.parse(readFileSync(h.codex, "utf8")) as { hooks: unknown }).hooks, hookEntries("codex", false, undefined, `node "${h.hook}" codex --user`));

    // Twice: nothing is written again.
    const again = await h.grooph(["hooks", "install", "--user", "--harness", "claude-code,codex"]);
    assert.equal(again.code, 0);
    assert.equal((again.out.match(/^as it was: /gm) ?? []).length, 3, again.out);
    assert.equal(readFileSync(h.claude, "utf8"), after, "a second install changed the settings");

    // The entry, run as a shell runs it: grooph's folder has a space in its name.
    const project = h.project("one");
    assert.equal((await h.grooph(["hooks", "watch", project])).code, 0);
    const ran = spawnSync("sh", ["-c", command], { input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "by-the-entry", cwd: project }), cwd: project, env: { PATH: process.env["PATH"] ?? "" }, encoding: "utf8" });
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.deepEqual(sessionsIn(h.store(project)), ["by-the-entry.jsonl"]);

    const status = await h.grooph(["hooks", "status", "--dir", project]);
    assert.match(status.out, new RegExp(`outside the project \\(grooph hooks install --user\\), in ${literally(h.env.GROOPH_HOME)}:\\n  installed: ${literally(h.hook)}\\n  claude-code: 7 hook entries in ${literally(h.claude)}\\n  codex: 6 hook entries in ${literally(h.codex)}\\n  1 folder listed`));
    assert.doesNotMatch(status.out, /is not this grooph's version/);

    const removed = await h.grooph(["hooks", "remove", "--user", "--harness", "claude-code,codex"]);
    assert.equal(removed.code, 0, removed.err);
    assert.equal(readFileSync(h.claude, "utf8"), before, "the person's settings are not what they were, to the letter");
    assert.deepEqual(JSON.parse(readFileSync(h.codex, "utf8")), {});
    assert.equal(existsSync(h.hook), false);
    assert.match(removed.out, /The list of folders .* and the events in .* are kept/);
    assert.deepEqual(sessionsIn(h.store(project)), ["by-the-entry.jsonl"]);
  });
});

test("install --user changes nothing when it cannot read a settings file, or is asked for what belongs to a project; a settings file that is a link stays one", async () => {
  await withHome(async (h) => {
    mkdirSync(dirname(h.claude), { recursive: true });
    mkdirSync(dirname(h.codex), { recursive: true });
    const fine = `${JSON.stringify({ model: "opus" }, null, 2)}\n`;
    writeFileSync(h.claude, fine);
    const refused = async (argv: string[], said: RegExp, env?: Record<string, string>): Promise<void> => {
      const r = await h.grooph(argv, env ? { env } : {});
      assert.equal(r.code, 1, `${argv.join(" ")} was not refused`);
      assert.match(r.err, said);
      assert.match(r.err, /Nothing was changed/);
      assert.equal(readFileSync(h.claude, "utf8"), fine, `${argv.join(" ")} changed the settings`);
      assert.equal(existsSync(h.env.GROOPH_HOME), false, `${argv.join(" ")} wrote in grooph's folder`);
    };
    // One of the two cannot be read: neither is changed, and the hook is not put in place.
    for (const unreadable of ["{ not json", "[]", '{"hooks": []}', '{"hooks": {"Stop": {}}}', '// a comment\n{"hooks": {}}']) {
      writeFileSync(h.codex, unreadable);
      await refused(["hooks", "install", "--user", "--harness", "claude-code,codex"], /cannot read .*hooks\.json/);
      assert.equal(readFileSync(h.codex, "utf8"), unreadable);
    }
    rmSync(h.codex);
    symlinkSync(join(h.root, "not-there.json"), h.codex);
    await refused(["hooks", "install", "--user", "--harness", "codex"], /cannot read .*hooks\.json: it is a link to a file that is not there/);
    rmSync(h.codex);

    // What belongs to an install in a project.
    for (const flags of [["--push"], ["--push-branch", "events"], ["--local"], ["--dir", h.root]]) await refused(["hooks", "install", "--user", ...flags], /are for an install in a project/);
    // A folder whose name a shell would read: the entry names the hook by its path.
    await refused(["hooks", "install", "--user"], /a character in its name that a shell reads as its own/, { GROOPH_HOME: join(h.root, "$HOME") });

    // A settings file kept somewhere else and linked into place stays a link, and the file it names gets the entries.
    const kept = join(h.root, "dotfiles", "claude-settings.json");
    mkdirSync(dirname(kept));
    writeFileSync(kept, fine);
    rmSync(h.claude);
    symlinkSync(kept, h.claude);
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    assert.ok(lstatSync(h.claude).isSymbolicLink(), "the link was replaced by a file");
    assert.equal((JSON.parse(readFileSync(kept, "utf8")) as { hooks: Record<string, unknown[]> }).hooks["Stop"]!.length, 1);
    assert.deepEqual(readdirSync(dirname(kept)), ["claude-settings.json"], "something was left beside the settings file");

    // remove leaves a file it cannot read as it is, says so, and keeps the hook such a file may still run.
    writeFileSync(h.codex, "{ not json");
    const removed = await h.grooph(["hooks", "remove", "--user", "--harness", "claude-code,codex"]);
    assert.equal(removed.code, 1);
    assert.match(removed.err, /cannot read .*hooks\.json.*Left as it is/);
    assert.equal(readFileSync(kept, "utf8"), fine);
    assert.equal(existsSync(h.hook), true);
  });
});

test("remove --user takes grooph's entries out whatever folder they were installed into, and leaves a project's kind alone", async () => {
  await withHome(async (h) => {
    // Somebody's own copy of a project's entry, at the user's level: not one this install wrote.
    const byHand = { hooks: { Stop: [{ hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code' }] }] } };
    mkdirSync(dirname(h.claude), { recursive: true });
    writeFileSync(h.claude, JSON.stringify(byHand, null, 2));
    assert.equal((await h.grooph(["hooks", "install", "--user", "--tools"])).code, 0);
    const first = JSON.parse(readFileSync(h.claude, "utf8")) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
    assert.deepEqual(first.hooks["Stop"]!.map((e) => e.hooks[0]!.command), [byHand.hooks.Stop[0]!.hooks[0]!.command, `node "${h.hook}" claude-code --user`]);

    // GROOPH_HOME names another folder now: an install replaces the entries, and status said whose hook they ran.
    const other = { GROOPH_HOME: join(h.root, "another grooph") };
    const status = await h.grooph(["hooks", "status", "--dir", h.root], { env: other });
    assert.match(status.out, new RegExp(`they run the hook at ${literally(h.hook)}: its list and its events are in that folder, not in this one`));
    assert.equal((await h.grooph(["hooks", "install", "--user"], { env: other })).code, 0);
    const second = JSON.parse(readFileSync(h.claude, "utf8")) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
    assert.deepEqual(second.hooks["Stop"]!.map((e) => e.hooks[0]!.command), [byHand.hooks.Stop[0]!.hooks[0]!.command, `node "${join(other.GROOPH_HOME, "hooks", "grooph-event.mjs")}" claude-code --user`]);
    assert.equal(second.hooks["PostToolUse"]![0]!.hooks.length, 1);

    // And removed with the first folder named again: the entries go all the same, and the other folder's hook is said and left.
    const removed = await h.grooph(["hooks", "remove", "--user"]);
    assert.equal(removed.code, 0);
    assert.deepEqual(JSON.parse(readFileSync(h.claude, "utf8")), byHand);
    assert.match(removed.out, new RegExp(`Those entries ran the hook at ${literally(join(other.GROOPH_HOME, "hooks", "grooph-event.mjs"))}`));
    assert.equal(existsSync(join(other.GROOPH_HOME, "hooks", "grooph-event.mjs")), true);
    // The hook's file stays while any entry there still names it, grooph's or not: with it gone, that entry would be heard from at every event.
    assert.match(removed.out, new RegExp(`kept ${literally(h.hook)}: ${literally(h.claude)} still names it`));
    assert.equal(existsSync(h.hook), true);
    const said = await h.grooph(["hooks", "status", "--dir", h.root]);
    assert.match(said.out, /claude-code: no entries in .*\n {4}and 1 entry there that names grooph's hook and is not as install --user writes them: grooph leaves it alone/);
    writeFileSync(h.claude, "{}");
    assert.match((await h.grooph(["hooks", "remove", "--user"])).out, new RegExp(`removed ${literally(h.hook)}`));
    assert.equal(readFileSync(h.claude, "utf8"), "{}");

    // Commands that only look like grooph's are somebody's own: another file whose name ends the same way, words that end the same way, grooph's file run another way.
    const theirs = [
      `node "/opt/tools/my-own-grooph-event.mjs" claude-code --user`,
      `echo "remember: grooph-event.mjs" claude-code --user`,
      `node '${h.hook}' claude-code --user`,
      `node "${h.hook}" claude-code --user || true`,
      `sh -c 'node "${h.hook}" claude-code --user'`,
      // And ones that begin and end as grooph's does, with something else between the quotes.
      `node "/opt/tools/notify.js" && echo "/hooks/grooph-event.mjs" claude-code --user`,
      `node "/opt/tools/wrap.mjs" "${h.hook}" claude-code --user`,
      `node "--no-warnings" "${h.hook}" claude-code --user`,
      `node "/Users/a"b/hooks/grooph-event.mjs" claude-code --user`,
    ];
    const lookAlikes = { hooks: { Stop: theirs.map((command) => ({ hooks: [{ type: "command", command }] })) } };
    writeFileSync(h.claude, JSON.stringify(lookAlikes, null, 2));
    const beside = await h.grooph(["hooks", "install", "--user"]);
    assert.match(beside.out, /9 entries in .* name grooph's hook and are not as this command writes them: left as they are\. If they run this hook too, an event is recorded twice\./);
    assert.deepEqual((JSON.parse(readFileSync(h.claude, "utf8")) as typeof lookAlikes).hooks.Stop.map((e) => e.hooks[0]!.command), [...theirs, `node "${h.hook}" claude-code --user`]);
    assert.equal((await h.grooph(["hooks", "remove", "--user"])).code, 0);
    assert.equal(readFileSync(h.claude, "utf8"), JSON.stringify(lookAlikes, null, 2));
    assert.equal(existsSync(h.hook), true, "the hook's file was removed while somebody's own entry still runs it");

    // An entry somebody joined grooph's command into keeps its other command, and a file keeps its tabs and its line endings.
    const notify = { type: "command", command: "./notify.sh" };
    const joined = { hooks: { Stop: [{ hooks: [notify, { type: "command", command: `node "${h.hook}" claude-code --user`, timeout: 5 }] }] } };
    writeFileSync(h.claude, JSON.stringify(joined, null, "\t").replace(/\n/g, "\r\n"));
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const text = readFileSync(h.claude, "utf8");
    assert.match(text, /^\{\r\n\t"hooks"/);
    assert.doesNotMatch(text, /[^\r]\n/, "a line of the file lost its ending");
    const kept = JSON.parse(text) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
    assert.deepEqual(kept.hooks["Stop"]!.map((e) => e.hooks.map((x) => x.command)), [["./notify.sh"], [`node "${h.hook}" claude-code --user`]]);
    assert.equal((await h.grooph(["hooks", "remove", "--user"])).code, 0);
    assert.deepEqual(JSON.parse(readFileSync(h.claude, "utf8")), { hooks: { Stop: [{ hooks: [notify] }] } });
  });
});

test("several folders are listed by one command, and commands run at the same moment each keep their folder on the list", async () => {
  await withHome(async (h) => {
    const [a, b] = [h.project("a"), h.project("b")];
    const both = await h.grooph(["hooks", "watch", a, b]);
    assert.equal(both.code, 0, both.err);
    assert.deepEqual(readList(h.list).folders.map((f) => f.path), [a, b]);
    // One that cannot be listed does not stop the others, and is what the command ends on.
    const mixed = await h.grooph(["hooks", "unwatch", a, join(h.root, "nowhere"), b]);
    assert.equal(mixed.code, 0);
    assert.deepEqual(readList(h.list).folders, []);
    const refused = await h.grooph(["hooks", "watch", join(h.root, "nowhere"), a]);
    assert.equal(refused.code, 1);
    assert.deepEqual(readList(h.list).folders.map((f) => f.path), [a]);

    // The command itself, as many processes at once, each with a folder of its own.
    const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "grooph.js");
    const AT_ONCE = 12;
    const folders = Array.from({ length: AT_ONCE }, (_, i) => h.project(`many/p${i}`));
    const exits = await Promise.all(
      folders.map(
        (folder) =>
          new Promise<number | null>((done) => {
            const child = spawn(process.execPath, [cli, "hooks", "watch", folder], { env: { PATH: process.env["PATH"] ?? "", ...scratchEnv, ...h.env }, stdio: "ignore" });
            child.on("close", done);
          }),
      ),
    );
    assert.deepEqual(exits, folders.map(() => 0));
    const listed = readList(h.list);
    assert.equal(listed.problem, undefined);
    assert.deepEqual(listed.folders.map((f) => f.path).sort(), [a, ...folders].sort(), "a folder listed at the same moment as another was lost");
    assert.equal(new Set(listed.folders.map((f) => f.events)).size, AT_ONCE + 1);
    assert.deepEqual(readdirSync(h.env.GROOPH_HOME), ["watched.json"], "something was left beside the list");
  });
});

test("the list starts empty and the hook then writes nothing; watch and unwatch change it; a session in a listed folder or inside one leaves a line, and a session anywhere else leaves none", async () => {
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const a = h.project("a");
    const inner = join(a, "packages", "app");
    mkdirSync(inner, { recursive: true });
    const outside = h.project("c");

    // Nothing listed: no session leaves anything, and nothing is made.
    for (const [session, cwd] of [["s-a", a], ["s-inner", inner], ["s-out", outside]] as const) quiet(start(h.hook, session, cwd, { CLAUDE_PROJECT_DIR: cwd }), `nothing listed, a session in ${cwd}`);
    quiet(spawnSync(process.execPath, [h.hook, "claude-code", "--user"], { input: "{ not json", env: { PATH: process.env["PATH"] ?? "" }, encoding: "utf8" }) as ReturnType<typeof fire>, "nothing listed, and nothing it can read");
    assert.equal(existsSync(h.events), false);
    const empty = await h.grooph(["hooks", "status", "--dir", a]);
    assert.match(empty.out, /no folder is listed, so nothing is recorded: grooph hooks watch <folder>/);

    const listed = await h.grooph(["hooks", "watch", "."], { cwd: a });
    assert.equal(listed.code, 0, listed.err);
    assert.match(listed.out, new RegExp(`^listed: ${literally(a)}\\nA session working in it, or in a folder inside it, is recorded from its next event on, in ${literally(h.store(a))}/`));
    const twice = await h.grooph(["hooks", "watch", a]);
    assert.match(twice.out, new RegExp(`^already listed: ${literally(a)}`));
    assert.equal(readList(h.list).folders.length, 1);
    assert.match(h.store(a), /\/events\/a-[0-9a-f]{8}$/);

    quiet(start(h.hook, "s-a", a), "a session in a listed folder");
    quiet(start(h.hook, "s-inner", inner), "a session in a folder inside a listed one");
    quiet(start(h.hook, "s-out", outside), "a session in a folder outside every listed one");
    assert.deepEqual(readdirSync(h.events), [h.store(a).split("/").pop()]);
    assert.deepEqual(sessionsIn(h.store(a)), ["s-a.jsonl", "s-inner.jsonl"]);
    assert.deepEqual(linesIn(join(h.store(a), "s-inner.jsonl")).map((l) => [l["event"], l["cwd"]]), [["session-start", inner]]);

    // The folder a session was started in is asked first: its lines stay in one place when its shell is somewhere else.
    quiet(start(h.hook, "s-moved", outside, { CLAUDE_PROJECT_DIR: a }), "started in a listed folder, working outside it");
    quiet(start(h.hook, "s-came", inner, { CLAUDE_PROJECT_DIR: outside }), "started outside, working in a listed folder");
    quiet(start(h.hook, "s-neither", outside, { CLAUDE_PROJECT_DIR: outside }), "started and working outside");
    assert.deepEqual(sessionsIn(h.store(a)), ["s-a.jsonl", "s-came.jsonl", "s-inner.jsonl", "s-moved.jsonl"]);

    const status = await h.grooph(["hooks", "status", "--dir", inner]);
    assert.match(status.out, new RegExp(`  1 folder listed \\(grooph hooks watch <folder>, grooph hooks unwatch <folder>\\):\\n    ${literally(a)}: 4 session files in ${literally(h.store(a))}/\\n  this folder is in ${literally(a)}, which is listed`));
    assert.match((await h.grooph(["hooks", "status", "--dir", outside])).out, /this folder is not listed: a session working here is not recorded/);

    // A listed folder inside a listed folder: a session there is the inner one's.
    const nested = await h.grooph(["hooks", "watch", inner]);
    assert.match(nested.out, new RegExp(`It is inside ${literally(a)}, and both are listed\\. A session is recorded under the inner of the two that holds the folder it was started in, where its harness says which that is \\(Claude Code does\\), and otherwise the folder it is working in\\.`));
    // So a session started in the outer one stays the outer one's, working in the inner; and status, run in that session, finds its line there.
    quiet(start(h.hook, "s-stays", inner, { CLAUDE_PROJECT_DIR: a }), "started in the outer of two listed folders, working in the inner");
    assert.equal(existsSync(join(h.store(a), "s-stays.jsonl")), true);
    assert.match((await h.grooph(["hooks", "status", "--dir", inner], { cwd: inner, env: { CLAUDE_CODE_SESSION_ID: "s-stays" } })).out, /this session \(s-stays\): 1 line recorded/);
    rmSync(join(h.store(a), "s-stays.jsonl"));
    quiet(start(h.hook, "s-nested", inner), "a session in the inner of two listed folders");
    assert.deepEqual(sessionsIn(h.store(inner)), ["s-nested.jsonl"]);
    assert.equal(existsSync(join(h.store(a), "s-nested.jsonl")), false);
    // Taken off while the folder that holds it is listed still: what is said is what happens.
    const innerOff = await h.grooph(["hooks", "unwatch", inner]);
    assert.match(innerOff.out, new RegExp(`A session working there is still recorded, under ${literally(a)}, which holds it and is listed\\.`));
    quiet(start(h.hook, "s-back", inner), "a session in a folder taken off the list, inside one still on it");
    assert.equal(existsSync(join(h.store(a), "s-back.jsonl")), true);
    rmSync(join(h.store(a), "s-back.jsonl"));

    // Two projects with one name do not share a record, and a folder listed again finds the one it left.
    const same = [h.project("x/same"), h.project("y/same")];
    for (const folder of same) assert.equal((await h.grooph(["hooks", "watch", folder])).code, 0);
    assert.notEqual(h.store(same[0]!), h.store(same[1]!));
    assert.equal(storeName(a, []), h.store(a).split("/").pop());
    assert.notEqual(storeName(a, [{ path: "/somewhere/else", events: storeName(a, []).toUpperCase() }]), storeName(a, []));
    assert.match(storeName("/a/…/ 名前 ", []), STORE_NAME);
    assert.match(storeName("/", []), STORE_NAME);

    // Off the list: from then on nothing is added, and what was recorded stays.
    const off = await h.grooph(["hooks", "unwatch", a]);
    assert.match(off.out, new RegExp(`^no longer listed: ${literally(a)}\\n.*What was recorded is kept: `));
    quiet(start(h.hook, "s-after", a), "a session in a folder taken off the list");
    assert.equal(sessionsIn(join(h.events, storeName(a, []))).length, 4);
    const gone = await h.grooph(["hooks", "unwatch", a]);
    assert.equal(gone.code, 0);
    assert.match(gone.out, /^not on the list: .*Nothing was changed/);

    // A listed folder that has since been deleted is said, and is taken off by the path it had.
    rmSync(same[1]!, { recursive: true });
    assert.match((await h.grooph(["hooks", "status", "--dir", a])).out, new RegExp(`${literally(same[1]!)} \\(no such folder now\\)`));
    assert.match((await h.grooph(["hooks", "unwatch", same[1]!])).out, /^no longer listed/);

    // What is refused, with nothing changed.
    const before = readFileSync(h.list, "utf8");
    for (const [argv, said] of [
      [["hooks", "watch"], /hooks watch needs a folder/],
      [["hooks", "unwatch"], /hooks unwatch needs a folder/],
      [["hooks", "watch", h.hook], /is not a folder/],
      [["hooks", "watch", join(h.root, "nowhere")], /is not a folder/],
      [["hooks", "watch", h.root], /holds grooph's own folder/],
      [["hooks", "watch", h.env.GROOPH_HOME], /holds grooph's own folder/],
      [["hooks", "watch", h.events], /is in grooph's own folder/],
      [["hooks", "watch", dirname(h.hook)], /is in grooph's own folder/],
      [["hooks", "watch", join(h.events, storeName(a, []))], /is in grooph's own folder/],
      [["hooks", "watch", homedir()], /holds your whole home folder/],
      [["hooks", "watch", "/"], /holds grooph's own folder/],
    ] as const) {
      const r = await h.grooph([...argv]);
      assert.equal(r.code, 1, argv.join(" "));
      assert.match(r.err, said);
      assert.equal(readFileSync(h.list, "utf8"), before, `${argv.join(" ")} changed the list`);
    }
    if (process.platform !== "win32") assert.equal(statSync(h.list).mode & 0o777, 0o600, "the list of a person's projects is open to others");
  });
});

test("grooph's own folder is found where it really is, before it is made: named through a link, in other letters, or by part of a path", async () => {
  await withHome(async (h) => {
    const project = h.project("p");
    // Named through a link, and not there yet: the folder that will hold it cannot be listed.
    symlinkSync(project, join(h.root, "link-to-p"));
    const through = { GROOPH_HOME: join(h.root, "link-to-p", "kept", "grooph") };
    const refused = await h.grooph(["hooks", "watch", project], { env: through });
    assert.equal(refused.code, 1);
    assert.match(refused.err, /holds grooph's own folder/);
    assert.deepEqual(readdirSync(project), [], "something was made in the folder that was refused");
    // A name that is not a whole path would be a different folder from every folder a command is run in.
    for (const argv of [["hooks", "watch", project], ["hooks", "unwatch", project], ["hooks", "install", "--user"], ["hooks", "remove", "--user"]]) {
      const relative = await h.grooph(argv, { env: { GROOPH_HOME: "my-grooph" }, cwd: h.root });
      assert.equal(relative.code, 1, argv.join(" "));
      assert.match(relative.err, /GROOPH_HOME is "my-grooph", which is not a whole path.*Nothing was changed/);
    }
    assert.equal(existsSync(h.env.GROOPH_HOME), false);
    assert.equal(existsSync(h.claude), false);
  });
});

test("a settings file is changed where it stands: every character that is not grooph's stays, and install then remove gives the file back to the letter", async () => {
  await withHome(async (h) => {
    mkdirSync(dirname(h.claude), { recursive: true });
    const other = { matcher: "Bash", hooks: [{ type: "command", command: "./mine.sh" }] };
    const files: Record<string, string> = {
      "no hooks, four spaces, no line break at the end": JSON.stringify({ model: "opus", permissions: { allow: ["Bash(ls:*)"] } }, null, 4),
      "hooks of the person's own, two spaces": `${JSON.stringify({ hooks: { PreToolUse: [other], Stop: [{ hooks: [{ type: "command", command: "./notify.sh" }] }], PreCompact: [] }, model: "opus" }, null, 2)}\n`,
      "all on one line": JSON.stringify({ model: "opus", hooks: { Stop: [other] } }),
      "one line, with spaces": '{ "model": "opus", "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "./notify.sh" }] }] } }\n',
      "tabs and Windows line endings": JSON.stringify({ model: "opus", hooks: { SessionStart: [other] } }, null, "\t").replace(/\n/g, "\r\n"),
      "an empty object": "{}",
      "an empty hooks": '{\n  "hooks": {}\n}\n',
      // What reading into an object and writing out again would change: a number too large to hold, one too long to
      // hold exactly, a key written twice, a key that is a number, a list on one line, letters written as escapes.
      "what a second writing would change": '{\n  "z": 1e400,\n  "big": 9007199254740993,\n  "twice": 1,\n  "twice": 2,\n  "10": "a number for a key",\n  "list": [1, 2,   3],\n  "escaped": "caf\\u00e9 \\/ ok",\n  "__proto__": { "kept": true }\n}\n',
      "the same, with hooks in the middle": '{\n  "z": 1e400,\n  "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "./notify.sh" } ] } ] },\n  "twice": 1,\n  "twice": 2,\n  "list": [1, 2,   3]\n}\n',
    };
    for (const [what, before] of Object.entries(files)) {
      writeFileSync(h.claude, before);
      const installed = await h.grooph(["hooks", "install", "--user", "--tools"]);
      assert.equal(installed.code, 0, `${what}: ${installed.err}`);
      const after = readFileSync(h.claude, "utf8");
      const command = `node "${h.hook}" claude-code --user`;
      const parsed = JSON.parse(after) as { hooks: Record<string, { hooks: { command: string }[] }[]> };
      for (const event of ["SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop", "PostToolUse"]) assert.equal(parsed.hooks[event]!.at(-1)!.hooks[0]!.command, command, `${what}: ${event}`);
      // Every line of the file as it was is still in it, whole and in order: nothing of the person's was written again.
      // (A file kept on one line is one line, into which grooph's entries go, and so is a "hooks" written on one line:
      // giving the file back to the letter, below, is the check of those.)
      let from = 0;
      for (const piece of before.split(/\r?\n/).length < 3 ? [] : before.split(/\r?\n/).map((l) => l.replace(/[,{[\]}]*$/, "").trim()).filter((l) => l.length > 3 && !l.startsWith('"hooks": { "'))) {
        const at = after.indexOf(piece, from);
        assert.ok(at >= 0, `${what}: "${piece}" is no longer in the file as it was written`);
        from = at + piece.length;
      }
      assert.equal(after.includes("\r\n"), before.includes("\r\n"), `${what}: the line endings changed`);
      assert.equal(after.includes("\n"), before.includes("\n") || before === "{}", `${what}: a file on one line was spread out`);
      // A second install writes nothing; remove gives back what was there.
      assert.match((await h.grooph(["hooks", "install", "--user", "--tools"])).out, new RegExp(`as it was: ${literally(h.claude)}`), what);
      assert.equal((await h.grooph(["hooks", "remove", "--user"])).code, 0, what);
      // The one case that does not come back to the letter: a "hooks" that was there and empty goes with grooph's entries, which filled it.
      assert.equal(readFileSync(h.claude, "utf8"), what === "an empty hooks" ? "{}\n" : before, `${what}: install and then remove did not give the file back`);
    }

    // An install run again, whatever stands after "hooks" in the file and whatever its options were the time before:
    // the entries go where the old ones were, and the same command twice writes nothing the second time.
    const again: Record<string, string> = {
      "an empty list for an event, and a key after hooks": '{"hooks": {"Stop": []}, "model": "opus"}',
      "an empty hooks first": '{"hooks":{},"a":1}',
      "hooks in the middle": `${JSON.stringify({ a: 1, hooks: { PreCompact: [] }, z: 2 }, null, 2)}\n`,
    };
    for (const [what, before] of Object.entries(again)) {
      writeFileSync(h.claude, before);
      const texts: string[] = [];
      for (const [argv, env] of [[["--tools"], {}], [["--tools"], {}], [[], {}], [[], {}], [[], { GROOPH_HOME: join(h.root, "another grooph") }], [["--tools"], {}]] as const) {
        const r = await h.grooph(["hooks", "install", "--user", ...argv], { env });
        assert.equal(r.code, 0, `${what}, install ${argv.join(" ")}: ${r.err}`);
        texts.push(readFileSync(h.claude, "utf8"));
        const parsed = JSON.parse(texts.at(-1)!) as Record<string, unknown> & { hooks: Record<string, { hooks: { command: string }[] }[]> };
        assert.deepEqual(Object.keys(parsed), Object.keys(JSON.parse(before) as object), `${what}: the file's keys changed places`);
        assert.equal(parsed.hooks["Stop"]!.length, 1, `${what}: grooph's entry is there more than once, or not at all`);
        assert.equal(parsed.hooks["PostToolUse"]![0]!.hooks.length, 1);
      }
      assert.equal(texts[1], texts[0], `${what}: the same install twice wrote the file again`);
      assert.equal(texts[3], texts[2], `${what}: the same install twice wrote the file again`);
      assert.equal((await h.grooph(["hooks", "remove", "--user"])).code, 0);
    }

    // A command of somebody's own, joined into one entry with grooph's: theirs keeps every character.
    const joined = `{\n  "hooks": {\n    "Stop": [\n      { "hooks": [ { "type": "command", "command": "./mine.sh", "timeout": 10.0, "big": 9007199254740993, "far": 1e400 }, { "type": "command", "command": "node \\"${h.hook}\\" claude-code --user", "timeout": 5 } ] }\n    ]\n  }\n}\n`;
    writeFileSync(h.claude, joined);
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const theirs = '{ "type": "command", "command": "./mine.sh", "timeout": 10.0, "big": 9007199254740993, "far": 1e400 }';
    assert.ok(readFileSync(h.claude, "utf8").includes(`{ "hooks": [ ${theirs} ] }`), "somebody's own command, joined with grooph's, was written again");
    assert.equal((await h.grooph(["hooks", "remove", "--user"])).code, 0);
    assert.ok(readFileSync(h.claude, "utf8").includes(`"Stop": [\n      { "hooks": [ ${theirs} ] }\n    ]`));

    // Text that is not UTF-8 would be read wrongly and written back changed: it is not changed.
    const latin = Buffer.concat([Buffer.from('{"name":"caf'), Buffer.from([0xe9]), Buffer.from('"}')]);
    writeFileSync(h.claude, latin);
    const notText = await h.grooph(["hooks", "install", "--user"]);
    assert.equal(notText.code, 1);
    assert.match(notText.err, /cannot read .*settings\.json: it is not UTF-8 text\. Nothing was changed\./);
    assert.ok(readFileSync(h.claude).equals(latin));

    // What cannot be put back whole is not changed: a read-only file, a file with a second name, a folder that takes no new file.
    const fine = `${JSON.stringify({ model: "opus" }, null, 2)}\n`;
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      const refused = async (said: RegExp): Promise<void> => {
        for (const argv of [["hooks", "install", "--user"]]) {
          const r = await h.grooph(argv);
          assert.equal(r.code, 1, said.source);
          assert.match(r.err, said);
          assert.match(r.err, /Nothing was changed/);
          assert.equal(readFileSync(h.claude, "utf8"), fine);
          assert.equal(existsSync(h.hook), false);
        }
      };
      writeFileSync(h.claude, fine);
      chmodSync(h.claude, 0o444);
      await refused(/cannot change .*settings\.json: it is read-only/);
      chmodSync(h.claude, 0o644);
      linkSync(h.claude, join(h.root, "second-name.json"));
      await refused(/it has a second name \(a hard link\)/);
      assert.equal(readFileSync(join(h.root, "second-name.json"), "utf8"), fine);
      rmSync(join(h.root, "second-name.json"));
      chmodSync(dirname(h.claude), 0o555);
      try {
        await refused(/its folder takes no new file, so it cannot be replaced whole/);
      } finally {
        chmodSync(dirname(h.claude), 0o755);
      }
    }
  });
});

test("commands that change grooph's own folder take turns: a lock left by a command that is gone is taken at once, and one held by a command that is there is never taken", async () => {
  await withHome(async (h) => {
    const [a, b] = [h.project("a"), h.project("b")];
    assert.equal((await h.grooph(["hooks", "watch", a])).code, 0);
    const lock = join(h.env.GROOPH_HOME, "grooph.lock");
    // Left by a process that is gone (no process has this number): nobody's.
    writeFileSync(lock, "2147483646 left-behind");
    const started = Date.now();
    assert.equal((await h.grooph(["hooks", "watch", b])).code, 0);
    assert.ok(Date.now() - started < 3000, "a lock nobody holds was waited for");
    assert.deepEqual(readList(h.list).folders.map((f) => f.path), [a, b]);
    assert.equal(existsSync(lock), false);
    // Something by the lock's name that is no file (a link to nothing, a folder an earlier grooph left, a pipe) is no lock: cleared at once.
    const others = [h.project("c"), h.project("d"), h.project("e")];
    symlinkSync(join(h.root, "nowhere"), lock);
    assert.equal((await h.grooph(["hooks", "watch", others[0]!])).code, 0);
    mkdirSync(join(lock, "inside"), { recursive: true });
    assert.equal((await h.grooph(["hooks", "watch", others[1]!])).code, 0);
    if (process.platform !== "win32" && spawnSync("mkfifo", [lock]).status === 0) assert.equal((await h.grooph(["hooks", "watch", others[2]!])).code, 0);
    assert.ok(Date.now() - started < 6000, "something that is no lock was waited for");
    assert.equal(lstatSync(lock, { throwIfNoEntry: false }), undefined);
    assert.equal((await h.grooph(["hooks", "unwatch", ...others])).code, 0);
    // Held by a process that is there (this one): the command waits its ten seconds, says so, and changes nothing.
    writeFileSync(lock, `${process.pid} held`);
    const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "grooph.js");
    const waited = spawnSync(process.execPath, [cli, "hooks", "unwatch", a], { env: { PATH: process.env["PATH"] ?? "", ...scratchEnv, ...h.env }, encoding: "utf8", timeout: 30_000 });
    assert.equal(waited.status, 1);
    assert.match(waited.stderr, new RegExp(`another grooph command \\(process ${process.pid}\\) has been changing .* for ten seconds\\. If none is running, remove .*grooph\\.lock\\. Nothing was changed\\.`));
    assert.deepEqual(readList(h.list).folders.map((f) => f.path), [a, b]);
    assert.equal(readFileSync(lock, "utf8"), `${process.pid} held`, "a lock that is held was taken away");
    rmSync(lock);
  });
});

test("the hook's file is kept while any settings that could run it still name it: a project's remove in the folder that holds grooph's own, and remove --user", async () => {
  // A second account's settings folder, and grooph's folder where it is by default: in the home folder.
  const home = realpathSync(mkdtempSync(join(tmpdir(), "grooph-two-accounts-")));
  try {
    const env = { ...scratchEnv, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, "second-account"), CODEX_HOME: join(home, "second-codex") };
    const grooph = async (argv: string[]) => {
      const io = capture();
      const code = await run(argv, io, () => "", { openUrl: async () => {}, env });
      return { code, out: text(io.stdout), err: text(io.stderr) };
    };
    const hook = join(home, ".grooph", "hooks", "grooph-event.mjs");
    assert.equal((await grooph(["hooks", "install", "--user"])).code, 0);
    // The home folder's own settings are not that account's, so it can be installed in as a project; the two then run one hook file.
    assert.equal((await grooph(["hooks", "install", "--dir", home, "--local"])).code, 0);
    const removedUser = await grooph(["hooks", "remove", "--user"]);
    assert.match(removedUser.out, /kept .*grooph-event\.mjs: .*settings\.local\.json still names it/);
    assert.equal(existsSync(hook), true, "remove --user took the hook a project's entries still run");
    assert.equal((await grooph(["hooks", "install", "--user"])).code, 0);
    const removedProject = await grooph(["hooks", "remove", "--dir", home]);
    assert.match(removedProject.out, /kept \.grooph\/hooks\/grooph-event\.mjs: the install outside the project runs it/);
    assert.equal(existsSync(hook), true, "a project's remove took the hook the install outside the project runs");
    // With both taken out, it goes.
    assert.match((await grooph(["hooks", "remove", "--user"])).out, /removed .*grooph-event\.mjs/);
    assert.equal(existsSync(hook), false);

    // Two accounts' settings, each named by CLAUDE_CONFIG_DIR in its turn, and one grooph folder: taking grooph out
    // of one leaves the hook the other still runs. grooph's folder keeps a note of the settings an install was made into.
    const first = async (argv: string[]) => {
      const io = capture();
      const code = await run(argv, io, () => "", { openUrl: async () => {}, env: { ...env, CLAUDE_CONFIG_DIR: join(home, "first-account") } });
      return { code, out: text(io.stdout), err: text(io.stderr) };
    };
    assert.equal((await first(["hooks", "install", "--user"])).code, 0);
    assert.equal((await grooph(["hooks", "install", "--user"])).code, 0);
    assert.deepEqual((JSON.parse(readFileSync(join(home, ".grooph", "installed.json"), "utf8")) as { settings: string[] }).settings, [join(home, "first-account", "settings.json"), join(home, "second-account", "settings.json")]);
    const one = await first(["hooks", "remove", "--user"]);
    assert.match(one.out, new RegExp(`kept .*grooph-event\\.mjs: ${literally(join(home, "second-account", "settings.json"))} still names it`));
    assert.equal(existsSync(hook), true, "taking grooph out of one account's settings took the hook the other account runs");
    assert.equal((JSON.parse(readFileSync(join(home, "second-account", "settings.json"), "utf8")) as { hooks: Record<string, unknown[]> }).hooks["Stop"]!.length, 1);
    assert.match((await grooph(["hooks", "remove", "--user"])).out, /removed .*grooph-event\.mjs/);
    assert.equal(existsSync(join(home, ".grooph", "installed.json")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("a person's home folder is no project to install in: an install there is refused, and a project's remove leaves the install outside the project alone", async () => {
  // With nothing named, a project install in the home folder and the install outside the project have one hook
  // file (~/.grooph/hooks/) and one settings file (~/.claude/settings.json).
  const home = realpathSync(mkdtempSync(join(tmpdir(), "grooph-home-as-project-")));
  try {
    const env = { ...scratchEnv, GROOPH_HOME: join(home, ".grooph"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex") };
    const grooph = async (argv: string[]) => {
      const io = capture();
      const code = await run(argv, io, () => "", { openUrl: async () => {}, env });
      return { code, out: text(io.stdout), err: text(io.stderr) };
    };
    assert.equal((await grooph(["hooks", "install", "--user", "--harness", "claude-code,codex"])).code, 0);
    const settings = readFileSync(join(home, ".claude", "settings.json"), "utf8");
    const codex = readFileSync(join(home, ".codex", "hooks.json"), "utf8");
    for (const harness of ["claude-code", "codex", "claude-code,codex"]) {
      const refused = await grooph(["hooks", "install", "--dir", home, "--harness", harness]);
      assert.equal(refused.code, 1, harness);
      assert.match(refused.err, /own settings for every project on this machine, so this folder is no project to install in.*grooph hooks install --user\. Nothing was changed\./);
    }
    // An older grooph did install there. Its entries are a project's kind; removing them leaves the other install whole.
    const projectKind = { type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-event.mjs" claude-code' };
    const both = JSON.parse(settings) as { hooks: Record<string, { hooks: unknown[] }[]> };
    both.hooks["Stop"]!.push({ hooks: [projectKind] });
    writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify(both, null, 2));
    const status = await grooph(["hooks", "status", "--dir", home]);
    assert.match(status.out, /^installed: \.grooph\/hooks\/grooph-event\.mjs\nclaude-code: 1 hook entry in \.claude\/settings\.json\n/);
    assert.match(status.out, /\n {2}claude-code: 7 hook entries in /);
    const removed = await grooph(["hooks", "remove", "--dir", home, "--harness", "claude-code,codex"]);
    assert.equal(removed.code, 0, removed.err);
    assert.match(removed.out, /\.claude\/settings\.json here is Claude Code's own settings for every project, and the install outside the project is in it still: grooph hooks remove --user takes that one out\./);
    assert.deepEqual(JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8")), JSON.parse(settings));
    assert.equal(readFileSync(join(home, ".codex", "hooks.json"), "utf8"), codex);
    assert.equal(existsSync(join(home, ".grooph", "hooks", "grooph-event.mjs")), true, "a project's remove took the hook the install outside the project runs");
    assert.match((await grooph(["hooks", "status", "--dir", home])).out, /\n {2}claude-code: 7 hook entries in /);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the hook and the commands hold one rule for the list: an entry with no whole path, or whose name is not one plain folder's, records nothing and is said", async () => {
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const a = h.project("a");
    assert.ok(readFileSync(hookSource(), "utf8").includes(`const NAME = ${String(STORE_NAME)};`), "the hook and the commands no longer agree on the name a listed folder's events are kept under");
    const bad = [{ path: a, events: "../../escape" }, { path: a, events: ".hidden" }, { path: a, events: "a/b" }, { path: a, events: "" }, { path: a, events: 7 }, { path: a }, { path: "work/a", events: "ok" }, { events: "ok" }, null, "a"];
    for (const entry of bad) {
      writeFileSync(h.list, JSON.stringify({ folders: [entry] }));
      quiet(start(h.hook, "s1", a, { CLAUDE_PROJECT_DIR: a }), `a list whose entry is ${JSON.stringify(entry)}`);
      assert.deepEqual(readList(h.list).folders, []);
    }
    for (const whole of ["{ not json", "[]", '{"folders": {}}', "null", ""]) {
      writeFileSync(h.list, whole);
      quiet(start(h.hook, "s1", a), `a list that is ${JSON.stringify(whole)}`);
      assert.ok(readList(h.list).problem !== undefined, `nothing is said of a list that is ${JSON.stringify(whole)}`);
    }
    assert.equal(existsSync(h.events), false);
    assert.deepEqual(readdirSync(h.root).sort(), ["claude", "grooph", "work"]);
    assert.deepEqual(readdirSync(h.env.GROOPH_HOME).sort(), ["hooks", "installed.json", "watched.json"]);

    // The commands say so, and do not write over a list they cannot read.
    const status = await h.grooph(["hooks", "status", "--dir", a]);
    assert.match(status.out, /the list \(.*watched\.json\) could not be read, so nothing is recorded: /);
    const refused = await h.grooph(["hooks", "watch", a]);
    assert.equal(refused.code, 1);
    assert.match(refused.err, /cannot use the list in .*watched\.json: .*Nothing was changed/);
    assert.equal(readFileSync(h.list, "utf8"), "");

    // One good entry beside a bad one: the good one is recorded, and the other is counted.
    writeFileSync(h.list, JSON.stringify({ folders: [{ path: a, events: "kept-here" }, { path: a, events: "../no" }] }));
    quiet(start(h.hook, "s2", a), "a list with one entry that can be used");
    assert.deepEqual(sessionsIn(join(h.events, "kept-here")), ["s2.jsonl"]);
    assert.match((await h.grooph(["hooks", "status", "--dir", a])).out, /the list \(.*\) is read in part: 1 of its 2 entries cannot be used/);

    // A list written by hand in which two folders share a name for their events: said, since their sessions land together.
    writeFileSync(h.list, JSON.stringify({ folders: [{ path: a, events: "one-name" }, { path: h.project("b"), events: "One-Name" }] }));
    assert.match((await h.grooph(["hooks", "status", "--dir", a])).out, /two of its folders keep their events under one name \(one-name\)/i);
    // The readers say that the list could not be read, and do not call the folder's record empty without it.
    writeFileSync(h.list, "{ not json");
    const unread = await h.grooph(["sessions"], { cwd: a });
    assert.match(unread.err, /the list of folders recorded outside their projects \(.*watched\.json\) could not be read whole: /);
    // Something that is no file where the list should be does not hold the hook.
    if (process.platform !== "win32") {
      rmSync(h.list);
      if (spawnSync("mkfifo", [h.list]).status === 0) {
        const held = spawnSync(process.execPath, [h.hook, "claude-code", "--user"], { input: JSON.stringify({ hook_event_name: "SessionStart", session_id: "s3", cwd: a }), env: { PATH: process.env["PATH"] ?? "" }, encoding: "utf8", timeout: 10_000 });
        assert.deepEqual([held.status, held.signal, held.stdout, held.stderr], [0, null, "", ""], "a pipe where the list should be held the hook");
      }
    }
  });
});

test("the hook reads no variable for grooph's folder: an install's lines go to that install's record, whatever the session's environment names", async () => {
  await withHome(async (one) => {
    await withHome(async (two) => {
      for (const h of [one, two]) assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
      const a = one.project("a");
      assert.equal((await one.grooph(["hooks", "watch", a])).code, 0);
      // The first install's hook, in a session whose environment names the second's folders: the first's list is the one read.
      quiet(start(one.hook, "s1", a, { ...two.env, HOME: two.root }), "one install's hook with another's folder named");
      assert.deepEqual(sessionsIn(one.store(a)), ["s1.jsonl"]);
      assert.equal(existsSync(two.events), false);
      // And the second's hook, whose own list is empty, records nothing though the first's folder is named and lists the session's.
      quiet(start(two.hook, "s2", a, { ...one.env, HOME: one.root }), "an install with nothing listed, with another's folder named");
      assert.deepEqual(sessionsIn(one.store(a)), ["s1.jsonl"]);
      assert.equal(existsSync(two.events), false);
    });
  });
});

test("with GROOPH_EVENTS_DIR set, the recorder outside the project does what it does without it: the record stays in grooph's own folder, one folder to a listed folder, the person's alone, and the readers find it", async () => {
  // The variable moves a project's events. Out here it is not read: what a session's environment names does not move the record.
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const [a, b] = [h.project("a"), h.project("b")];
    assert.equal((await h.grooph(["hooks", "watch", a, b])).code, 0);
    const named = join(h.root, "named-by-the-variable");

    // A name that is not a whole path, with the hook started in the project: nothing is made in the project.
    quiet(fire(h.hook, { hook_event_name: "SessionStart", session_id: "s-rel", cwd: a }, { cwd: a, env: { GROOPH_EVENTS_DIR: "rel-events", CLAUDE_PROJECT_DIR: a } }), "a relative GROOPH_EVENTS_DIR");
    assert.deepEqual(readdirSync(a), [], "the hook made something in the watched project");
    assert.deepEqual(sessionsIn(h.store(a)), ["s-rel.jsonl"]);

    // Two listed folders, one variable: each session is in its own folder's record, and the named folder is not made.
    quiet(start(h.hook, "s-a", a, { GROOPH_EVENTS_DIR: named }), "a session in the first listed folder");
    quiet(start(h.hook, "s-b", b, { GROOPH_EVENTS_DIR: named }), "a session in the second listed folder");
    assert.deepEqual(sessionsIn(h.store(a)), ["s-a.jsonl", "s-rel.jsonl"]);
    assert.deepEqual(sessionsIn(h.store(b)), ["s-b.jsonl"]);
    assert.equal(existsSync(named), false, "the folder the variable named was made");

    // The folders and the files made with the variable set are the person's alone, as without it.
    if (process.platform !== "win32") {
      for (const folder of [h.events, h.store(a), h.store(b)]) assert.equal(statSync(folder).mode & 0o777, 0o700, folder);
      for (const file of [join(h.store(a), "s-a.jsonl"), join(h.store(b), "s-b.jsonl")]) assert.equal(statSync(file).mode & 0o777, 0o600, file);
    }

    // The readers, with the same variable in their own environment, find the events where they are; status says why.
    const read = await h.grooph(["sessions", "--json"], { cwd: a, env: { GROOPH_EVENTS_DIR: named } });
    assert.deepEqual((JSON.parse(read.out) as LiveView).sessions.map((s) => s.id).sort(), ["s-a", "s-rel"]);
    assert.equal(read.err, storeLine({ dir: h.store(a), listed: a }));
    const status = await h.grooph(["hooks", "status", "--dir", b], { env: { GROOPH_EVENTS_DIR: named } });
    assert.match(status.out, new RegExp(`\\n1 session file in ${literally(h.store(b))}/, outside the project: this folder is listed`));
    assert.match(status.out, new RegExp(`\\n  GROOPH_EVENTS_DIR is set \\(${literally(named)}\\): the recorder outside the project does not read it, and its events are in ${literally(h.events)}/\\n`));
    assert.doesNotMatch((await h.grooph(["hooks", "status", "--dir", b])).out, /GROOPH_EVENTS_DIR/);
  });
});

test("a folder is listed in the letters it is really named in, so a session that names it in other letters is still recorded", { skip: !existsSync(tmpdir().toUpperCase()) }, async () => {
  // Where the system does not tell letters' cases apart (macOS, by default), one folder has many spellings.
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const a = h.project("MixedCase");
    const typed = join(dirname(a), "mixedcase");
    const listed = await h.grooph(["hooks", "watch", typed]);
    assert.match(listed.out, new RegExp(`^listed: ${literally(a)}\\n`));
    quiet(start(h.hook, "s1", join(dirname(a), "MIXEDCASE")), "a session that names its folder in capitals");
    assert.deepEqual(sessionsIn(h.store(a)), ["s1.jsonl"]);
    assert.match((await h.grooph(["hooks", "unwatch", typed])).out, /^no longer listed/);
  });
});

test("after a watched session a project holds nothing of grooph's: its folder is as it was, git status shows nothing, and the record is the person's alone", async () => {
  await withHome(async (h) => {
    const a = h.project("a");
    const git = (...args: string[]) => spawnSync("git", ["-C", a, "-c", "user.name=t", "-c", "user.email=t@example.test", ...args], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    mkdirSync(join(a, "src"));
    writeFileSync(join(a, "src", "index.js"), "console.log(1)\n");
    writeFileSync(join(a, ".gitignore"), "node_modules/\n");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
    const before = everything(a);
    assert.deepEqual(Object.keys(before), [".gitignore", "src/", "src/index.js"]);

    assert.equal((await h.grooph(["hooks", "install", "--user", "--harness", "claude-code,codex", "--tools"], { cwd: a })).code, 0);
    assert.equal((await h.grooph(["hooks", "watch", "."], { cwd: a })).code, 0);
    const base = { session_id: "sess-1", transcript_path: "/secret/path/main.jsonl", cwd: a };
    const env = { CLAUDE_PROJECT_DIR: a };
    for (const [harness, payload] of [
      ["claude-code", { hook_event_name: "SessionStart" }],
      ["claude-code", { hook_event_name: "UserPromptSubmit", prompt: "THE PROMPT TEXT" }],
      ["claude-code", { hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "Explore" }],
      ["claude-code", { hook_event_name: "PostToolUse", agent_id: "a1", agent_type: "Explore", tool_name: "Bash", tool_input: { command: "cat SECRET" }, tool_response: { stdout: "THE TOOL OUTPUT" } }],
      ["claude-code", { hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "Explore", agent_transcript_path: "/t/agent-a1.jsonl", last_assistant_message: "THE LAST MESSAGE" }],
      ["claude-code", { hook_event_name: "Stop", last_assistant_message: "THE FINAL REPLY" }],
      ["claude-code", { hook_event_name: "SessionEnd" }],
      ["codex", { hook_event_name: "SessionStart", session_id: "codex-1", cwd: join(a, "src"), model: "gpt-6-luna" }],
    ] as const) quiet(fire(h.hook, { ...base, ...payload }, { harness, env: harness === "claude-code" ? env : {} }), `${harness} ${payload.hook_event_name}`);

    // Read from inside the project, as a person would, by all three commands that read.
    for (const argv of [["sessions"], ["hooks", "status", "--dir", a], ["sessions", "--json"]]) assert.equal((await h.grooph(argv, { cwd: a })).code, 0);

    assert.deepEqual(everything(a), before, "the project's folder is not as it was");
    assert.equal(git("status", "--porcelain", "--ignored").stdout, "", "git status shows something new");
    assert.deepEqual(sessionsIn(h.store(a)), ["codex-1.jsonl", "sess-1.jsonl"]);
    const lines = linesIn(join(h.store(a), "sess-1.jsonl"));
    assert.deepEqual(lines.map((l) => l["event"]), ["session-start", "turn-start", "subagent-start", "tool", "subagent-stop", "turn-end", "session-end"]);
    const kept = readFileSync(join(h.store(a), "sess-1.jsonl"), "utf8");
    for (const said of ["THE PROMPT TEXT", "SECRET", "THE TOOL OUTPUT", "THE LAST MESSAGE", "THE FINAL REPLY", "/secret/path"]) assert.ok(!kept.includes(said), `the record holds "${said}"`);
    // A record of every listed project on the machine is the person's alone to read.
    if (process.platform !== "win32") {
      assert.equal(statSync(h.events).mode & 0o777, 0o700);
      assert.equal(statSync(h.store(a)).mode & 0o777, 0o700);
      assert.equal(statSync(join(h.store(a), "sess-1.jsonl")).mode & 0o777, 0o600);
    }

    // Taking it all out again changes nothing in the project either.
    assert.equal((await h.grooph(["hooks", "unwatch", "."], { cwd: a })).code, 0);
    assert.equal((await h.grooph(["hooks", "remove", "--user", "--harness", "claude-code,codex"], { cwd: a })).code, 0);
    assert.deepEqual(everything(a), before);
    assert.equal(git("status", "--porcelain", "--ignored").stdout, "");
  });
});

test("in a listed folder with no events of its own, sessions, hooks status and watch read its record outside the project and say where; with both, a session is read once", async () => {
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const a = h.project("a");
    const inner = join(a, "src");
    mkdirSync(inner);
    const b = h.project("b");
    assert.equal((await h.grooph(["hooks", "watch", a])).code, 0);
    const said = () => storeLine({ dir: h.store(a), listed: a });

    // Listed, and nothing recorded yet.
    const none = await h.grooph(["sessions"], { cwd: a });
    assert.equal(none.code, 0, none.err);
    assert.match(none.out, new RegExp(`^no sessions recorded for ${literally(a)} yet, in ${literally(h.store(a))}/\\. The event hook outside the project writes them`));

    const s1 = { session_id: "s1", cwd: a };
    quiet(fire(h.hook, { ...s1, hook_event_name: "SessionStart" }), "a session starts");
    quiet(fire(h.hook, { ...s1, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "Explore" }), "a subagent starts");
    quiet(fire(h.hook, { ...s1, hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "Explore" }), "a subagent stops");

    // grooph sessions, from the folder and from a folder inside it.
    for (const cwd of [a, inner]) {
      const listed = await h.grooph(["sessions"], { cwd });
      assert.equal(listed.code, 0, listed.err);
      const lines = listed.out.split("\n");
      assert.match(lines[0]!, /^claude-code · .* 0 running, 1 done · session s1 · a$/);
      assert.match(lines[1]!, /^ {2}✓ Explore {2}a1 {2}done in /);
      assert.deepEqual(lines.slice(-2), ["", said()]);
      assert.equal(listed.err, "");
    }
    assert.equal(said(), `read from ${h.store(a)}/: the sessions of ${a} are recorded there, outside the project (grooph hooks status)`);
    // As data, the line is beside the data and not in it.
    const json = await h.grooph(["sessions", "--json"], { cwd: a });
    assert.deepEqual((JSON.parse(json.out) as LiveView).sessions.map((s) => [s.id, s.agents.length]), [["s1", 1]]);
    assert.equal(json.err, said());
    // A folder that is not listed is read as it always was, and a source that is named is read as named.
    const unlisted = await h.grooph(["sessions"], { cwd: b });
    assert.match(unlisted.out, /^no sessions recorded in .*The event hook writes them: grooph hooks install$/);
    assert.match((await h.grooph(["sessions", a], { cwd: a })).out, /^no sessions recorded in /);

    // grooph hooks status: the count is of the record outside the project, and so is this session's own.
    const status = await h.grooph(["hooks", "status", "--dir", a], { cwd: a, env: { CLAUDE_CODE_SESSION_ID: "s1" } });
    assert.match(status.out, new RegExp(`\\n1 session file in ${literally(h.store(a))}/, outside the project: this folder is listed \\(grooph hooks watch\\)\\n`));
    assert.doesNotMatch(status.out, /session files? in \.grooph\/events\//);
    // Run from inside a session, it says whether that session itself has been recorded.
    assert.match(status.out, /this session \(s1\): 3 lines recorded/);
    assert.match((await h.grooph(["hooks", "status", "--dir", inner], { cwd: inner, env: { CLAUDE_CODE_SESSION_ID: "s-none" } })).out, new RegExp(`this folder is in ${literally(a)}, which is listed \\(grooph hooks watch\\)\\nthis session \\(s-none\\): NOTHING recorded`));

    // grooph watch: what it prints, and what its view is served, read again on every request.
    const dist = mkdtempSync(join(tmpdir(), "grooph-dist-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>grooph</title>\n");
    try {
      // Since the lab took the following of a run (slice 0103), watch takes no folder: it is started in the folder,
      // and a listed folder's record is found from the folder it was started in.
      const printed = await h.grooph(["watch", "--sessions", "--port", "0"], { cwd: a, env: { GROOPH_WEB_DIST: dist }, signal: AbortSignal.abort() });
      assert.equal(printed.code, 0, printed.err);
      assert.match(printed.out, new RegExp(`^sessions: 1 recorded, .*\\n${literally(said())}\\nopen http`));
      const live = async (port: number): Promise<string[]> => ((await (await fetch(`http://127.0.0.1:${port}${LIVE_ENDPOINT}`)).json()) as LiveView).sessions.map((s) => s.id).sort();
      for (const folder of [a, inner]) {
        const watcher = await startWatch({ root: folder, webDist: dist, port: 0, host: "127.0.0.1", sessions: true, env: { ...scratchEnv, ...h.env } });
        try {
          assert.deepEqual(await live(watcher.port), ["s1"]);
        } finally {
          await watcher.close();
        }
      }
      // A listed folder whose record does not exist yet: the view is empty, and shows the first session when it comes.
      assert.equal((await h.grooph(["hooks", "watch", b])).code, 0);
      const empty = await h.grooph(["watch", "--sessions", "--port", "0"], { cwd: b, env: { GROOPH_WEB_DIST: dist }, signal: AbortSignal.abort() });
      assert.match(empty.out, new RegExp(`^sessions: none recorded under ${literally(h.store(b))}/ yet \\(grooph hooks install --user records them\\)\\n`));
      const watcher = await startWatch({ root: b, webDist: dist, port: 0, host: "127.0.0.1", sessions: true, env: { ...scratchEnv, ...h.env } });
      try {
        assert.deepEqual(await live(watcher.port), []);
        quiet(start(h.hook, "s-b", b), "the first session in a listed folder");
        assert.deepEqual(await live(watcher.port), ["s-b"]);
      } finally {
        await watcher.close();
      }
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }

    // grooph events push has nothing of the project's to send, and says so.
    const pushed = await h.grooph(["events", "push", "--dir", a]);
    assert.equal(pushed.code, 1);
    assert.equal(pushed.out, "");
    assert.match(pushed.err, new RegExp(`^grooph: the sessions of ${literally(a)} are recorded outside the project, in ${literally(h.store(a))}/, and grooph events push sends only a project's own \\.grooph/events/\\. Nothing was sent\\.`));
    assert.equal(existsSync(join(a, ".grooph")), false);

    // The project gets an install of its own as well. A session both recorded is read once, from the record outside
    // the project, which a session working in the project cannot write; one only the project holds is still read;
    // and status counts each place.
    assert.equal((await h.grooph(["hooks", "install", "--dir", a])).code, 0);
    const own = (payload: Record<string, unknown>) => spawnSync(process.execPath, [join(a, ".grooph", "hooks", "grooph-event.mjs"), "claude-code"], { input: JSON.stringify({ cwd: a, ...payload }), cwd: a, env: { PATH: process.env["PATH"] ?? "" }, encoding: "utf8" });
    for (const session of ["s1", "s-own"]) assert.equal(own({ hook_event_name: "SessionStart", session_id: session }).status, 0);
    const both = await h.grooph(["sessions", "--json"], { cwd: a });
    const view = JSON.parse(both.out) as LiveView;
    // s1 is in both places. The project's copy holds its start alone, and no subagent; the record outside holds the
    // subagent, and is the one read. So a file put in the project under a session's name hides nothing of it.
    assert.deepEqual(view.sessions.map((s) => [s.id, s.agents.length]).sort(), [["s-own", 0], ["s1", 1]]);
    const saidBoth = storeLine({ dir: h.store(a), listed: a, beside: join(a, ".grooph", "events") });
    assert.equal(both.err, saidBoth);
    assert.equal(saidBoth, `read from ${h.store(a)}/, where the sessions of ${a} are recorded outside the project, and from ${join(a, ".grooph", "events")}/ for sessions that record does not hold and for what a session said (grooph hooks status)`);
    // The install in the project is removed and its files stay: a session that goes on is read as it goes on.
    assert.equal((await h.grooph(["hooks", "remove", "--dir", a])).code, 0);
    quiet(fire(h.hook, { ...s1, hook_event_name: "SessionEnd" }), "the session ends, after the project's install is gone");
    assert.deepEqual((JSON.parse((await h.grooph(["sessions", "--json"], { cwd: a })).out) as LiveView).sessions.map((s) => [s.id, s.state, s.agents.length]).sort(), [["s-own", "working", 0], ["s1", "ended", 1]]);
    // A session cannot change what is shown of itself by a file under another name: what a hook saw of a session
    // the record holds is read from the record alone. What the session itself said is still read from the project.
    const forged = (event: string, more: Record<string, unknown> = {}): string => `${JSON.stringify({ v: 1, t: new Date().toISOString(), harness: "claude-code", event, session: "s1", ...more })}\n`;
    writeFileSync(join(a, ".grooph", "events", "notes.jsonl"), forged("session-start", { model: "a-model-it-is-not", cwd: "/somewhere/harmless" }) + forged("subagent-start", { agent: "x9", type: "never-ran" }) + forged("subagent-stop", { agent: "x9", type: "never-ran" }));
    writeFileSync(join(a, ".grooph", "events", "said-s1.jsonl"), forged("note", { text: "what the session itself said" }));
    const seen = (JSON.parse((await h.grooph(["sessions", "--json"], { cwd: a })).out) as LiveView).sessions.find((s) => s.id === "s1")!;
    assert.deepEqual([seen.state, seen.agents.map((x) => x.type), seen.model, seen.cwd], ["ended", ["Explore"], undefined, a]);
    assert.deepEqual((seen.notes ?? []).map((n) => n.text), ["what the session itself said"]);
    rmSync(join(a, ".grooph", "events", "notes.jsonl"));
    rmSync(join(a, ".grooph", "events", "said-s1.jsonl"));
    // A pipe under an event file's name in the project does not hold the readers.
    if (process.platform !== "win32" && spawnSync("mkfifo", [join(a, ".grooph", "events", "pipe.jsonl")]).status === 0) {
      const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "grooph.js");
      const read = spawnSync(process.execPath, [cli, "sessions", "--json"], { cwd: a, env: { PATH: process.env["PATH"] ?? "", ...scratchEnv, ...h.env }, encoding: "utf8", timeout: 20_000 });
      assert.deepEqual([read.status, read.signal], [0, null], "a pipe in the project's events folder held grooph sessions");
      rmSync(join(a, ".grooph", "events", "pipe.jsonl"));
    }
    // Nor is a link there to one file of another folder's record, nor a second name for it: a folder that stands behind a record is read for its own files only.
    symlinkSync(join(h.store(b), "s-b.jsonl"), join(a, ".grooph", "events", "linked.jsonl"));
    linkSync(join(h.store(b), "s-b.jsonl"), join(a, ".grooph", "events", "second-name.jsonl"));
    assert.deepEqual((JSON.parse((await h.grooph(["sessions", "--json"], { cwd: a })).out) as LiveView).sessions.map((s) => s.id).sort(), ["s-own", "s1"], "another folder's session was shown through a link to its file");
    rmSync(join(a, ".grooph", "events", "linked.jsonl"));
    rmSync(join(a, ".grooph", "events", "second-name.jsonl"));
    // A project's events folder that is a link is not read: it may lead to another folder's record.
    renameSync(join(a, ".grooph", "events"), join(a, ".grooph", "events-kept"));
    symlinkSync(h.store(b), join(a, ".grooph", "events"));
    assert.deepEqual((JSON.parse((await h.grooph(["sessions", "--json"], { cwd: a })).out) as LiveView).sessions.map((s) => s.id), ["s1"], "another folder's sessions were shown through a link");
    rmSync(join(a, ".grooph", "events"));
    renameSync(join(a, ".grooph", "events-kept"), join(a, ".grooph", "events"));

    assert.equal((await h.grooph(["hooks", "install", "--dir", a])).code, 0);
    // Run from inside the session, status counts its lines in the record outside, where they go on being added.
    assert.match((await h.grooph(["hooks", "status", "--dir", a], { cwd: a, env: { CLAUDE_CODE_SESSION_ID: "s1" } })).out, /this session \(s1\): 4 lines recorded/);
    const two = await h.grooph(["hooks", "status", "--dir", a]);
    assert.match(two.out, new RegExp(`\\n2 session files in \\.grooph/events/\\n1 session file in ${literally(h.store(a))}/, outside the project: this folder is listed`));
    const again = await h.grooph(["hooks", "watch", a]);
    assert.match(again.out, /This folder also has an install of its own \(\.grooph\/hooks\/grooph-event\.mjs\): its sessions are recorded in the project as well/);
  });
});

test("a person's home folder holds grooph's own folder and is no project: a listed folder under it is read from its record", async () => {
  // `grooph watch` looks upward for a folder that holds .grooph, to find the project a folder is in. A person's
  // home holds one too, and every project of theirs is under it.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-as-home-")));
  try {
    const env = { ...scratchEnv, ...scratchPlaces(root), GROOPH_HOME: join(root, ".grooph") };
    const project = join(root, "work", "p");
    mkdirSync(project, { recursive: true });
    const grooph = (argv: string[]) => run(argv, capture(), () => "", { openUrl: async () => {}, env });
    assert.equal(await grooph(["hooks", "install", "--user"]), 0);
    assert.equal(await grooph(["hooks", "watch", project]), 0);
    quiet(start(join(root, ".grooph", "hooks", "grooph-event.mjs"), "s1", project), "a session in a project under the home");
    assert.equal(projectRoot(project), root);
    const own = ownSources(projectRoot(project), env, project);
    assert.deepEqual(own.sources, [{ path: own.store!.dir }]);
    assert.deepEqual(sessionsIn(own.store!.dir), ["s1.jsonl"]);
    // A folder under the home that is not listed: its own folder is read, not the home's.
    const other = join(root, "work", "q");
    mkdirSync(other);
    assert.deepEqual(ownSources(projectRoot(other), env, other).sources, [{ path: other }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status says what stands in the hook's way outside the project: a hook that is not this grooph's, and a record it cannot be looked into", async () => {
  await withHome(async (h) => {
    assert.equal((await h.grooph(["hooks", "install", "--user"])).code, 0);
    const a = h.project("a");
    assert.equal((await h.grooph(["hooks", "watch", a])).code, 0);
    quiet(start(h.hook, "s1", a), "a session");
    writeFileSync(h.hook, "// an older hook\n");
    assert.match((await h.grooph(["hooks", "status", "--dir", a])).out, /that hook is not this grooph's version: run grooph hooks install --user again/);
    // An install again puts this grooph's in its place, and writes nothing else.
    const again = await h.grooph(["hooks", "install", "--user"]);
    assert.match(again.out, new RegExp(`^wrote ${literally(h.hook)}\\nas it was: ${literally(h.claude)}\\n`));
    assert.equal(readFileSync(h.hook, "utf8"), readFileSync(hookSource(), "utf8"));
    assert.deepEqual(readdirSync(dirname(h.hook)), ["grooph-event.mjs"], "something was left beside the hook");
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      chmodSync(h.store(a), 0o000);
      try {
        const closed = await h.grooph(["hooks", "status", "--dir", a]);
        assert.equal(closed.code, 0, closed.err);
        assert.match(closed.out, /could not be read/);
      } finally {
        chmodSync(h.store(a), 0o700);
      }
      chmodSync(h.env.GROOPH_HOME, 0o000);
      try {
        const closed = await h.grooph(["hooks", "status", "--dir", a]);
        assert.equal(closed.code, 0, closed.err);
        assert.match(closed.out, new RegExp(`outside the project \\(grooph hooks install --user\\): ${literally(h.env.GROOPH_HOME)} could not be read`));
      } finally {
        chmodSync(h.env.GROOPH_HOME, 0o755);
      }
    }
  });
});
