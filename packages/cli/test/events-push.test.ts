/**
 * `grooph events push` and the script it runs (packages/cli/hooks/grooph-events-push.mjs):
 * a project's session events go to a branch that holds nothing else, without the
 * working tree, the index, HEAD or the checked-out branch being touched, and a
 * machine that fetches that branch reads them as a `git:` source.
 */

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { pushSource } from "../src/commands/hooks.js";
import { lastPush, parseSource, readLive } from "../src/events-io.js";
import { run } from "../src/index.js";
import type { Output } from "../src/print.js";

const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("workspace root not found");
})();

const capture = (): Output & { stdout: string[]; stderr: string[] } => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (line) => void stdout.push(line), err: (line) => void stderr.push(line) };
};
const text = (lines: string[]): string => lines.join("\n");
const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, "-c", "user.name=test", "-c", "user.email=test@example.invalid", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const NESTED = join(repoRoot, "fixtures", "events", "claude-code-nested.jsonl");
/** What a branch holds of an event file: a folder's name for its path, no transcript's path, and whole lines only. */
const sent = (text: string): string =>
  text
    .slice(0, text.lastIndexOf("\n") + 1)
    .split("\n")
    .map((line) => {
      if (line === "") return line;
      const e = JSON.parse(line) as Record<string, unknown>;
      if (typeof e["cwd"] === "string") e["cwd"] = (e["cwd"] as string).split("/").filter(Boolean).pop() ?? "";
      delete e["transcript"];
      return JSON.stringify(e);
    })
    .join("\n")
    .trim();
const CODEX = join(repoRoot, "fixtures", "events", "codex-two-subagents.jsonl");

/** A bare remote and a clone of it with one commit on `main`, the hook installed, and `.grooph/events/` ignored. */
async function withRemote(fn: (at: { remote: string; lane: string; root: string }) => Promise<void> | void): Promise<void> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "grooph-push-")));
  try {
    const remote = join(root, "remote.git");
    git(root, "init", "--quiet", "--bare", "-b", "main", remote);
    const lane = join(root, "lane");
    git(root, "clone", "--quiet", remote, lane);
    writeFileSync(join(lane, "README.md"), "work\n");
    writeFileSync(join(lane, ".gitignore"), ".grooph/events/\n");
    git(lane, "checkout", "--quiet", "-b", "main");
    git(lane, "add", "-A");
    git(lane, "commit", "--quiet", "-m", "work");
    git(lane, "push", "--quiet", "origin", "main");
    await fn({ remote, lane, root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const addEvents = (project: string, name: string, from: string): void => {
  mkdirSync(join(project, ".grooph", "events"), { recursive: true });
  copyFileSync(from, join(project, ".grooph", "events", name));
};
/** Everything about a clone that sending events must leave alone. */
const untouched = (cwd: string): string => [git(cwd, "rev-parse", "HEAD"), git(cwd, "rev-parse", "--abbrev-ref", "HEAD"), git(cwd, "status", "--porcelain"), git(cwd, "diff", "--cached", "--name-only"), git(cwd, "branch", "--list")].join("\n--\n");

test("events push sends .grooph/events/ to a branch of its own and touches nothing else; the script grooph hooks install copies does the same without grooph", async () => {
  await withRemote(async ({ remote, lane }) => {
    let io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /wrote \.grooph\/hooks\/grooph-events-push\.mjs/);
    assert.equal(readFileSync(join(lane, ".grooph", "hooks", "grooph-events-push.mjs"), "utf8"), readFileSync(pushSource(), "utf8"));
    git(lane, "add", "-A");
    git(lane, "commit", "--quiet", "-m", "the hook");

    // Nothing recorded yet: said so, and not an error.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^No events in \.grooph\/events\/ yet: nothing to send\./);

    addEvents(lane, "5aac1305.jsonl", NESTED);
    const before = untouched(lane);
    // As a lane with no grooph runs it: the copied script, by node.
    const ran = spawnSync(process.execPath, [join(lane, ".grooph", "hooks", "grooph-events-push.mjs")], { cwd: lane, encoding: "utf8" });
    assert.equal(ran.status, 0, ran.stderr);
    assert.match(ran.stdout, /^Sent 1 event file to origin grooph-events\/main \([0-9a-f]{7}\)\. Read them elsewhere after a fetch: grooph sessions <name>=git:origin\/grooph-events\/main\n$/);
    assert.equal(untouched(lane), before, "the working tree, the index, HEAD or the branches changed");

    // The branch on the remote holds the events and nothing else.
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/main"), ".grooph/events/5aac1305.jsonl");
    assert.equal(git(remote, "show", "grooph-events/main:.grooph/events/5aac1305.jsonl"), sent(readFileSync(NESTED, "utf8")));
    const first = git(remote, "rev-parse", "grooph-events/main");
    assert.equal(git(remote, "rev-list", "--count", "grooph-events/main"), "1");
    // And the work's own branch does not have them.
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "main").includes(".grooph/events"), false);

    // Again with nothing new: said so, no new commit.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^Nothing new: origin grooph-events\/main already holds this 1 event file\./);
    assert.equal(git(remote, "rev-parse", "grooph-events/main"), first);

    // The session goes on: one more line, one more commit on top of the first.
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00.000Z","harness":"claude-code","event":"turn-start","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^Sent 1 event file to origin grooph-events\/main/);
    assert.equal(git(remote, "rev-parse", "grooph-events/main^"), first);
    assert.equal(untouched(lane), before);
  });
});

test("two clones may share one events branch: each keeps the other's files; a third machine reads the branch as a git: source", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    addEvents(lane, "5aac1305.jsonl", NESTED);
    let io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "claude/grooph-events-team"], io), 0);
    assert.match(text(io.stdout), /^Sent 1 event file to origin claude\/grooph-events-team/);

    const other = join(root, "other");
    git(root, "clone", "--quiet", remote, other);
    addEvents(other, "01a0f519.jsonl", CODEX);
    io = capture();
    assert.equal(await run(["events", "push", "--branch", "claude/grooph-events-team", "--dir", other], io), 0);
    assert.match(text(io.stdout), /^Sent 1 event file to origin claude\/grooph-events-team \([0-9a-f]{7}\); the branch holds 2\./);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "claude/grooph-events-team"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");
    assert.equal(git(remote, "rev-list", "--count", "claude/grooph-events-team"), "2");

    // A reader that only fetches: the sessions of both, under the name it gives the source.
    const reader = join(root, "reader");
    git(root, "clone", "--quiet", remote, reader);
    const live = readLive([parseSource("team=git:origin/claude/grooph-events-team")], () => new Date("2026-10-01T03:00:00Z"), reader);
    assert.deepEqual(live.sessions.map((s) => s.harness).sort(), ["claude-code", "codex"]);
    assert.ok(live.sessions.every((s) => s.source === "team"));
    assert.equal(live.sessions.find((s) => s.harness === "claude-code")!.agents.length, 3);
  });
});

test("events push never writes to a branch of work: a branch that holds anything but events is refused, and so is the branch checked out", async () => {
  await withRemote(async ({ remote, lane }) => {
    addEvents(lane, "5aac1305.jsonl", NESTED);
    const mainBefore = git(remote, "rev-parse", "main");
    const before = untouched(lane);

    // The branch checked out here.
    let io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "main"], io), 1);
    assert.match(text(io.stderr), /"main" is the branch checked out here: the events go to a branch of their own, never to a branch of work/);

    // Another branch of work on the remote, not checked out here: it holds files, so it is not an events branch.
    git(lane, "push", "--quiet", "origin", "main:refs/heads/feature");
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "feature"], io), 1);
    assert.match(text(io.stderr), /origin feature is not an events branch: it holds other files \(\.gitignore, README\.md\)\. Nothing was sent\./);

    // From a detached checkout, main is not "the branch checked out", and is still refused for what it holds.
    git(lane, "checkout", "--quiet", "--detach");
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "main"], io), 1);
    assert.match(text(io.stderr), /origin main is not an events branch/);
    // With no branch checked out there is no name to derive one from: the events go to the branch all such checkouts share.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 0, text(io.stderr));
    assert.match(text(io.stdout), /^Sent 1 event file to origin grooph-events-detached \([0-9a-f]{7}\): no branch is checked out here, so they went to the branch every such checkout shares\. Read them elsewhere after a fetch: grooph sessions <name>=git:origin\/grooph-events-detached$/);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/5aac1305.jsonl");
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events-detached-lane"], io), 0);
    git(lane, "checkout", "--quiet", "main");

    // Nothing of the work moved, here or there.
    assert.equal(git(remote, "rev-parse", "main"), mainBefore);
    assert.equal(git(remote, "rev-parse", "feature"), mainBefore);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "main"), ".gitignore\nREADME.md");
    assert.equal(untouched(lane), before);
  });
});

test("events push never shortens a file and keeps odd names whole: a diverged copy is joined line by line, an accented name stays one entry", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    const line = (n: number): string => `{"v":1,"t":"2026-10-01T0${n}:00:00.000Z","harness":"claude-code","event":"turn-start","session":"s1"}\n`;
    mkdirSync(join(lane, ".grooph", "events"), { recursive: true });
    writeFileSync(join(lane, ".grooph", "events", "s1.jsonl"), line(1) + line(2) + line(3));
    writeFileSync(join(lane, ".grooph", "events", "naïve session.jsonl"), line(1));
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], capture()), 0);

    // Another clone has the same session id with a shorter, different file: its container was replaced and the id came back.
    const other = join(root, "other");
    git(root, "clone", "--quiet", remote, other);
    mkdirSync(join(other, ".grooph", "events"), { recursive: true });
    writeFileSync(join(other, ".grooph", "events", "s1.jsonl"), line(1) + line(4));
    assert.equal(await run(["events", "push", "--dir", other, "--branch", "grooph-events/shared"], capture()), 0);
    assert.equal(git(remote, "show", "grooph-events/shared:.grooph/events/s1.jsonl"), (line(1) + line(2) + line(3) + line(4)).trim());

    // The first clone again, with one more line and the accented name pushed a second time: one entry per name, a sound tree.
    appendFileSync(join(lane, ".grooph", "events", "naïve session.jsonl"), line(2));
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], capture()), 0);
    assert.deepEqual(git(remote, "-c", "core.quotepath=false", "ls-tree", "-r", "--name-only", "grooph-events/shared").split("\n"), [".grooph/events/naïve session.jsonl", ".grooph/events/s1.jsonl"]);
    assert.equal(git(remote, "show", "grooph-events/shared:.grooph/events/naïve session.jsonl"), (line(1) + line(2)).trim());
    assert.equal(git(remote, "show", "grooph-events/shared:.grooph/events/s1.jsonl"), (line(1) + line(2) + line(3) + line(4)).trim(), "the first clone's shorter copy must not undo the join");
    assert.doesNotMatch(execFileSync("git", ["-C", remote, "fsck", "--no-dangling"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), /duplicateEntries|error/);
  });
});

test("with --push a second hook sends the events when a turn ends: silent, never failing, one at a time, and still never onto a branch of work", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    // Off unless asked for; when asked, one more entry at the end of a turn, in the background, and nothing else changes.
    let io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /To send at the end of every turn instead, install with --push\./);
    const settings = (): { hooks: Record<string, { hooks: { command: string; async?: boolean; timeout: number }[] }[]> } => JSON.parse(readFileSync(join(lane, ".claude", "settings.json"), "utf8"));
    assert.equal(settings().hooks["Stop"]!.length, 1);
    io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push"], io), 0);
    assert.match(text(io.stdout), /With --push, that is done at the end of every turn, in the background, to grooph-events\/<the branch checked out>/);
    const stop = settings().hooks["Stop"]!;
    assert.equal(stop.length, 2);
    assert.deepEqual(stop[1]!.hooks, [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-events-push.mjs" --hook', async: true, timeout: 60 }]);
    assert.equal(stop[0]!.hooks[0]!.async, undefined, "the event hook's own line at a turn's end is still waited for");
    io = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /claude-code: 8 hook entries in \.claude\/settings\.json, one of which sends the events at the end of each turn/);
    // A branch name is a branch name: nothing a shell would read as more.
    io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push-branch", "x; rm -rf ~"], io), 1);
    assert.match(text(io.stderr), /--push-branch takes a plain branch name/);
    // Nor a name git would refuse on every turn, or the branch of work itself: said at install, not swallowed at each turn's end.
    for (const [name, why] of [["a..b", /is not a branch name git accepts/], ["x.lock", /is not a branch name git accepts/], ["main", /is the branch checked out here/]] as const) {
      io = capture();
      assert.equal(await run(["hooks", "install", "--dir", lane, "--push-branch", name], io), 1, name);
      assert.match(text(io.stderr), why);
    }
    assert.equal(settings().hooks["Stop"]!.length, 2);
    io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane, "--harness", "codex", "--push-branch", "claude/grooph-events-lane"], io), 0);
    const codex = JSON.parse(readFileSync(join(lane, ".codex", "hooks.json"), "utf8")) as ReturnType<typeof settings>;
    assert.equal(codex.hooks["Stop"]![1]!.hooks[0]!.command, 'node "$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.grooph/hooks/grooph-events-push.mjs" --hook --branch claude/grooph-events-lane');

    // As the harness runs it: no output, exit 0, and the events are on their branch.
    const script = join(lane, ".grooph", "hooks", "grooph-events-push.mjs");
    const fire = (args: string[] = [], cwd = lane) => spawnSync(process.execPath, [script, "--hook", ...args], { cwd, input: '{"hook_event_name":"Stop"}', encoding: "utf8", env: { ...process.env, GROOPH_PUSH_SETTLE_MS: "0" } });
    let ran = fire(); // nothing recorded yet
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    addEvents(lane, "5aac1305.jsonl", NESTED);
    const before = untouched(lane);
    ran = fire();
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/main"), ".grooph/events/5aac1305.jsonl");
    assert.equal(existsSync(join(lane, ".grooph", "events", ".pushing")), false, "the lock is released");
    assert.equal(untouched(lane), before);

    // Another push under way: this one gives way, silently. A lock left by a push that died is taken over.
    mkdirSync(join(lane, ".grooph", "events", ".pushing"));
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00.000Z","harness":"claude-code","event":"turn-end","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    const first = git(remote, "rev-parse", "grooph-events/main");
    ran = fire();
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "rev-parse", "grooph-events/main"), first);
    const longAgo = new Date(Date.now() - 10 * 60_000);
    utimesSync(join(lane, ".grooph", "events", ".pushing"), longAgo, longAgo);
    ran = fire();
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "rev-parse", "grooph-events/main^"), first);
    assert.equal(existsSync(join(lane, ".grooph", "events", ".pushing")), false);
    // The lock is not an event file: it is never sent.
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/main"), ".grooph/events/5aac1305.jsonl");

    // Whatever is wrong, a turn is never failed and nothing is said: a branch of work, a folder that is not a repository.
    const mainBefore = git(remote, "rev-parse", "main");
    ran = fire(["--branch", "main"]);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "rev-parse", "main"), mainBefore);
    const plain = join(root, "plain", ".grooph", "hooks");
    mkdirSync(plain, { recursive: true });
    copyFileSync(script, join(plain, "grooph-events-push.mjs"));
    mkdirSync(join(root, "plain", ".grooph", "events"));
    writeFileSync(join(root, "plain", ".grooph", "events", "s.jsonl"), "{}\n");
    const lost = spawnSync(process.execPath, [join(plain, "grooph-events-push.mjs"), "--hook"], { cwd: join(root, "plain"), encoding: "utf8", env: { ...process.env, GROOPH_PUSH_SETTLE_MS: "0" } });
    assert.deepEqual([lost.status, lost.stdout, lost.stderr], [0, "", ""]);

    // Removing grooph's entries removes this one with them.
    io = capture();
    assert.equal(await run(["hooks", "remove", "--dir", lane, "--harness", "claude-code,codex"], io), 0);
    assert.equal(existsSync(join(lane, ".grooph", "hooks", "grooph-events-push.mjs")), false);
    assert.equal(JSON.stringify(settings()).includes("grooph-events-push"), false);
  });
});

test("events push leaves FETCH_HEAD as the session left it, and a push that loses a race is made again on top of the winner", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    // A session fetched something and means to use FETCH_HEAD next: it must still be what it fetched.
    git(lane, "fetch", "--quiet", "origin", "main");
    const fetchHead = readFileSync(join(lane, ".git", "FETCH_HEAD"), "utf8");
    addEvents(lane, "5aac1305.jsonl", NESTED);
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], capture()), 0); // the branch is new
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00.000Z","harness":"claude-code","event":"turn-start","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], capture()), 0); // the branch exists
    assert.equal(readFileSync(join(lane, ".git", "FETCH_HEAD"), "utf8"), fetchHead);

    // Two clones, one branch, both sending at once: git refuses the slower one, which looks again and goes on top.
    // The race is made to happen: a hook on the remote lets the other clone's push in just before this one's lands.
    const other = join(root, "other");
    git(root, "clone", "--quiet", remote, other);
    addEvents(other, "01a0f519.jsonl", CODEX);
    const once = join(root, "raced");
    writeFileSync(
      join(remote, "hooks", "pre-receive"),
      `#!/bin/sh\n# The first push to arrive finds the other clone's commit already there.\nif [ ! -e "${once}" ]; then touch "${once}"; unset GIT_DIR GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES; node "${join(repoRoot, "packages", "cli", "bin", "grooph.js")}" events push --dir "${other}" --branch grooph-events/shared >/dev/null 2>&1; fi\nexit 0\n`,
      { mode: 0o755 },
    );
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:05.000Z","harness":"claude-code","event":"turn-end","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    const io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], io), 0, text(io.stderr));
    assert.equal(existsSync(once), true, "the race did not happen");
    assert.match(text(io.stdout), /^Sent 1 event file to origin grooph-events\/shared \([0-9a-f]{7}\); the branch holds 2\./);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/shared"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");
    assert.match(git(remote, "show", "grooph-events/shared:.grooph/events/5aac1305.jsonl"), /"event":"turn-end"/);
    assert.equal(git(remote, "rev-list", "--count", "grooph-events/shared"), "4", "two before, the other clone's, then this one on top of it");
    // The record says it took two tries and why, and so does hooks status.
    const raced = lastPush(lane)!.last!;
    assert.deepEqual([raced.ok, raced.tries, raced.crowded], [true, 2, true]);
    const said = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], said), 0);
    assert.match(text(said.stdout), /^last push: .*, by hand: Sent 1 event file to origin grooph-events\/shared \([0-9a-f]{7}\); the branch holds 2 \(on try 2: other sessions were sending to the same branch\)$/m);
  });
});

test("events push says what is wrong and changes nothing: --no-push sends nothing, a bad branch name and a folder outside git are errors", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    addEvents(lane, "5aac1305.jsonl", NESTED);
    let io = capture();
    assert.equal(await run(["events", "push", "--no-push", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^Made commit [0-9a-f]{7} for grooph-events\/main \(1 event file\); not sent \(--no-push\)\.$/);
    assert.equal(git(remote, "branch", "--list", "grooph-events/*"), "");

    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "not a branch"], io), 1);
    assert.match(text(io.stderr), /"not a branch" is not a branch name git accepts/);

    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--everything"], io), 1);
    assert.match(text(io.stderr), /events push does not take "--everything"/);

    const plain = join(root, "plain");
    mkdirSync(plain);
    io = capture();
    assert.equal(await run(["events", "push", "--dir", plain], io), 1);
    assert.match(text(io.stderr), /is not in a git repository/);

    io = capture();
    assert.equal(await run(["events"], io), 1);
    assert.match(text(io.stderr), /events needs push/);
  });
});

/** The push script as a harness runs it at a turn's end. */
const fireHook = (project: string, args: string[] = []) =>
  spawnSync(process.execPath, [join(project, ".grooph", "hooks", "grooph-events-push.mjs"), "--hook", ...args], { cwd: project, input: '{"hook_event_name":"Stop"}', encoding: "utf8", env: { ...process.env, GROOPH_PUSH_SETTLE_MS: "0" } });
const NOW = () => new Date();

test("a session with no branch checked out still sends at its turn's end, and a session held on two events branches is read as one", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    // The owner installs the hooks with --push and commits them: every clone of the repository then carries them.
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push", "--tools"], capture()), 0);
    git(lane, "add", "-A");
    git(lane, "commit", "--quiet", "-m", "hooks");
    git(lane, "push", "--quiet", "origin", "main");

    // A cloud session: a fresh clone with HEAD detached at the branch's commit, and a first turn that ends.
    const cloud = join(root, "cloud");
    git(root, "clone", "--quiet", remote, cloud);
    git(cloud, "checkout", "--quiet", "--detach", "origin/main");
    assert.equal(git(cloud, "rev-parse", "--abbrev-ref", "HEAD"), "HEAD");
    git(cloud, "config", "user.name", "A Person");
    git(cloud, "config", "user.email", "a.person@example.com");
    const whole = readFileSync(NESTED, "utf8").split("\n").filter((line) => line !== "");
    mkdirSync(join(cloud, ".grooph", "events"), { recursive: true });
    const file = join(cloud, ".grooph", "events", "5aac1305.jsonl");
    writeFileSync(file, `${whole.slice(0, 4).join("\n")}\n`);
    const before = untouched(cloud);
    let ran = fireHook(cloud);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "show", "grooph-events-detached:.grooph/events/5aac1305.jsonl"), sent(`${whole.slice(0, 4).join("\n")}\n`), "the first turn's lines left the sandbox");
    assert.equal(untouched(cloud), before);
    // The commit names no person, whatever identity the session's git has: the branch holds ids, names of agents and times.
    assert.equal(git(remote, "log", "-1", "--format=%an <%ae> / %cn <%ce>", "grooph-events-detached"), "grooph <grooph@localhost> / grooph <grooph@localhost>");
    // How it went is on record, beside the events and never among them.
    let pushed = lastPush(cloud)!;
    assert.deepEqual([pushed.started, pushed.last?.ok, pushed.last?.by, pushed.last?.branch, pushed.arrived?.branch], [undefined, true, "hook", "grooph-events-detached", "grooph-events-detached"]);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/5aac1305.jsonl");
    let io = capture();
    assert.equal(await run(["hooks", "status", "--dir", cloud], io), 0);
    assert.match(text(io.stdout), /last push: (just now|\d+ s ago) \(\d{4}-\d\d-\d\d \d\d:\d\d UTC\), at a turn's end: Sent 1 event file to origin grooph-events-detached \([0-9a-f]{7}\): no branch is checked out here, so they went to the branch every such checkout shares$/m);

    // The session starts its branch of work and goes on: from then its turns send to that branch's own events branch.
    git(cloud, "checkout", "--quiet", "-b", "claude/lane-a");
    writeFileSync(file, `${whole.join("\n")}\n`);
    ran = fireHook(cloud);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "show", "grooph-events/claude/lane-a:.grooph/events/5aac1305.jsonl"), sent(`${whole.join("\n")}\n`));
    pushed = lastPush(cloud)!;
    assert.deepEqual([pushed.last?.ok, pushed.last?.branch], [true, "grooph-events/claude/lane-a"]);

    // A test runner that stays detached, on the same shared branch.
    const runner = join(root, "runner");
    git(root, "clone", "--quiet", remote, runner);
    git(runner, "checkout", "--quiet", "--detach", "origin/main");
    addEvents(runner, "01a0f519.jsonl", CODEX);
    ran = fireHook(runner);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");

    // Read where the owner reads. The lane's session is on both branches: its first four lines on the shared one, all
    // of it on its own. It is one session, under the lane's name, with every event counted once.
    git(lane, "fetch", "--quiet", "origin");
    const alone = readLive([parseSource("lane-a=git:origin/grooph-events/claude/lane-a")], NOW, lane);
    for (const order of [["detached=git:origin/grooph-events-detached", "lane-a=git:origin/grooph-events/claude/lane-a"], ["lane-a=git:origin/grooph-events/claude/lane-a", "detached=git:origin/grooph-events-detached"]]) {
      const both = readLive(order.map(parseSource), NOW, lane);
      assert.deepEqual(both.sessions.map((x) => [x.source, x.id.slice(0, 8)]).sort(), [["detached", "01a0f519"], ["lane-a", "5aac1305"]], order.join(" "));
      const mine = both.sessions.find((x) => x.source === "lane-a")!;
      assert.deepEqual({ ...mine }, { ...alone.sessions[0]! }, "read from two branches, the session is what it is read from one");
      assert.equal(mine.agents.every((a) => a.stops <= 1), true, "no subagent's stop is counted twice");
    }
    // What the lane's lead said through the MCP server, under an id of its own, was copied to both branches whole.
    // It goes with the lane's session, whichever branch is read first, and not to the runner that shares a branch with it.
    const det = join(root, "det");
    const own = join(root, "own");
    for (const dir of [det, own]) mkdirSync(dir);
    const plan = '{"v":1,"t":"2026-10-01T01:32:50.000Z","harness":"claude-code","event":"plan","session":"mcp-7f3a","text":"two readers","agents":[{"type":"general-purpose","count":1}]}\n';
    writeFileSync(join(det, "runner.jsonl"), readFileSync(CODEX, "utf8"));
    writeFileSync(join(det, "lane.jsonl"), `${whole.slice(0, 2).join("\n")}\n`);
    writeFileSync(join(own, "lane.jsonl"), `${whole.join("\n")}\n`);
    for (const dir of [det, own]) writeFileSync(join(dir, "said-mcp-7f3a.jsonl"), plan);
    for (const order of [[`detached=${det}`, `lane-a=${own}`], [`lane-a=${own}`, `detached=${det}`]]) {
      const view = readLive(order.map(parseSource), NOW, root);
      assert.deepEqual(view.sessions.map((x) => [x.source, x.id.slice(0, 8), x.plans?.length ?? 0]).sort(), [["detached", "01a0f519", 0], ["lane-a", "5aac1305", 1]], order.join(" "));
    }

    // The same line twice in one file is still two events: two tool calls can end in one millisecond.
    const twice = join(root, "twice.jsonl");
    const tool = '{"v":1,"t":"2026-10-01T00:00:01.000Z","harness":"claude-code","event":"tool","session":"s9","tool":"Read"}\n';
    writeFileSync(twice, `{"v":1,"t":"2026-10-01T00:00:00.000Z","harness":"claude-code","event":"turn-start","session":"s9"}\n${tool}${tool}`);
    assert.equal(readLive([{ path: twice }, { path: twice }], NOW, root).sessions[0]!.tools, 2);
  });
});

test("a push that fails at a turn's end says nothing and leaves word: hooks status and sessions show it, and a password in what git said is not kept", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push"], capture()), 0);
    let io = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^no push recorded yet/m);
    addEvents(lane, "5aac1305.jsonl", NESTED);

    // One that arrives, then two that are refused (pointed at a branch of work): each silent, exit 0, and on record.
    assert.equal(fireHook(lane).status, 0);
    assert.equal(lastPush(lane)!.last?.ok, true);
    git(lane, "push", "--quiet", "origin", "main:refs/heads/feature");
    for (const _ of [1, 2]) {
      const ran = fireHook(lane, ["--branch", "feature"]);
      assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    }
    const failed = lastPush(lane)!.last!;
    assert.deepEqual([failed.ok, failed.by, failed.branch, failed.failures], [false, "hook", "feature", 2]);
    assert.match(failed.message, /origin feature is not an events branch: it holds other files/);
    assert.equal(typeof failed.failedSince, "string");
    io = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^last push FAILED (just now|\d+ s ago) \(\d{4}-\d\d-\d\d \d\d:\d\d UTC\), at a turn's end, to feature: origin feature is not an events branch/m);
    assert.match(text(io.stdout), /^  2 in a row since \d{4}-\d\d-\d\d \d\d:\d\d UTC\. The last that arrived: \d{4}-\d\d-\d\d \d\d:\d\d UTC, to grooph-events\/main\. The events are still in \.grooph\/events\/ and go with the next push that works\.$/m);
    // Where the sessions are listed from the project itself, the same word: what is listed has not been seen elsewhere.
    io = capture();
    assert.equal(await run(["sessions", lane], io), 0);
    assert.match(text(io.stdout), /^last push FAILED .* at a turn's end, to feature: origin feature is not an events branch/m);
    // Not among the events: a reader of the folder sees the one session, and the data form is as it was.
    assert.equal(readLive([{ path: lane }], NOW, root).sessions.length, 1);
    io = capture();
    assert.equal(await run(["sessions", lane, "--json"], io), 0);
    assert.deepEqual(Object.keys(JSON.parse(text(io.stdout)) as object).sort(), ["at", "groophLive", "sessions"]);

    // The next push that works clears it, and the record itself is never sent.
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:00.000Z","harness":"claude-code","event":"turn-start","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    const ran = fireHook(lane);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    const ok = lastPush(lane)!.last!;
    assert.deepEqual([ok.ok, ok.branch, ok.failures, ok.failedSince], [true, "grooph-events/main", undefined, undefined]);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/main"), ".grooph/events/5aac1305.jsonl");
    io = capture();
    assert.equal(await run(["sessions", lane], io), 0);
    assert.doesNotMatch(text(io.stdout), /last push/);
    // A commit made and not sent is not a push: the record stays.
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:05.000Z","harness":"claude-code","event":"turn-end","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--no-push"], io), 0);
    assert.match(text(io.stdout), /^Made commit/);
    assert.equal(lastPush(lane)!.last!.at, ok.at);
    // By hand, a failure is said aloud and recorded too.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "feature"], io), 1);
    assert.deepEqual([lastPush(lane)!.last!.ok, lastPush(lane)!.last!.by, lastPush(lane)!.arrived?.branch], [false, "hand", "grooph-events/main"]);

    // A push that is stopped dead cannot say so: the word that it began is what is left, and past its two minutes that is said.
    const recordFile = join(lane, ".grooph", "events", ".last-push.json");
    const was = readFileSync(recordFile, "utf8");
    writeFileSync(recordFile, JSON.stringify({ ...(JSON.parse(was) as object), started: new Date(Date.now() - 20_000).toISOString() }));
    io = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^a push began 2\d s ago \(.* UTC\), at a turn's end, and is under way$/m);
    assert.match(text(io.stdout), /^the one before FAILED /m);
    writeFileSync(recordFile, JSON.stringify({ v: 1, started: new Date(Date.now() - 10 * 60_000).toISOString() }));
    io = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^a push began 10 min( \d s)? ago \(.* UTC\), at a turn's end, and NEVER FINISHED: it was stopped before it could say why \(the sandbox was put to sleep, or the process was killed\)\n  None has arrived from here\. The events are still in \.grooph\/events\/ and go with the next push that works\.$/m);
    io = capture();
    assert.equal(await run(["sessions", lane], io), 0);
    assert.match(text(io.stdout), /^a push began 10 min( \d s)? ago .* NEVER FINISHED/m);
    writeFileSync(recordFile, was);

    // What went wrong may name a remote with a password in its address, or quote a token: neither is kept, and
    // what is kept is one plain line.
    const secret = fireHook(lane, ["--remote", "https://lane:hunter2secret@example.invalid/x.git"]);
    assert.deepEqual([secret.status, secret.stdout, secret.stderr], [0, "", ""]);
    const kept = readFileSync(recordFile, "utf8");
    assert.match(kept, /there is no remote named \\"https:\/\/example\.invalid\/x\.git\\" here/);
    assert.doesNotMatch(kept, /hunter2secret|lane:/);

    // A remote that says no for a reason of its own is asked three times and no more, and its reason is what is kept.
    const asked = join(root, "asked");
    writeFileSync(join(remote, "hooks", "pre-receive"), `#!/bin/sh\necho x >> "${asked}"\necho "not on this remote: ghp_abcdefghijklmnopqrstuvwxyz0123456789 \\033[31mred" >&2\nexit 1\n`, { mode: 0o755 });
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:09.000Z","harness":"claude-code","event":"turn-start","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    const declined = fireHook(lane);
    assert.deepEqual([declined.status, declined.stdout, declined.stderr], [0, "", ""]);
    assert.equal(readFileSync(asked, "utf8"), "x\nx\nx\n");
    const why = lastPush(lane)!.last!;
    assert.equal(why.ok, false);
    assert.match(why.message, /^git push failed: remote: not on this remote: ghp_… .*pre-receive hook declined/);
    assert.doesNotMatch(why.message, /abcdefghijklmnop|[\u0000-\u001f]|hint:|failed to push some refs/);
    rmSync(join(remote, "hooks", "pre-receive"));
    assert.equal(existsSync(join(lane, ".grooph", "events", ".pushing")), false);

    // The repository's own pre-push hook is for its work. It is not run for the events, and cannot stop them.
    const ranPrePush = join(root, "pre-push-ran");
    writeFileSync(join(lane, ".git", "hooks", "pre-push"), `#!/bin/sh\ntouch "${ranPrePush}"\nexit 1\n`, { mode: 0o755 });
    assert.equal(fireHook(lane).status, 0);
    assert.equal(lastPush(lane)!.last!.ok, true, lastPush(lane)!.last!.message);
    assert.equal(existsSync(ranPrePush), false);
    rmSync(join(lane, ".git", "hooks", "pre-push"));

    // A record that is not one (garbage, or not a file at all) is replaced or left, never trusted, and nothing half-written stays.
    writeFileSync(recordFile, '["not", "a record"]');
    assert.equal(lastPush(lane), undefined);
    assert.equal(fireHook(lane).status, 0);
    assert.equal(lastPush(lane)!.last!.ok, true);
    writeFileSync(recordFile, JSON.stringify({ v: 1, at: new Date().toISOString(), ok: false, by: "hook", message: "one\u001b[31m\ntwo", failures: 1e308, branch: 7 }));
    const odd = lastPush(lane)!.last!;
    assert.deepEqual([odd.message, odd.failures, odd.branch], ["one [31m two", undefined, undefined]);
    rmSync(recordFile);
    mkdirSync(recordFile);
    assert.equal(fireHook(lane).status, 0);
    assert.deepEqual(readdirSync(join(lane, ".grooph", "events")).sort(), [".last-push.json", "5aac1305.jsonl"]);
    assert.equal(lastPush(lane), undefined);
  });
});

test("the name of the events branch comes from the branch HEAD is on, born or not; a clone without file contents can send to a shared branch", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push"], capture()), 0);
    git(lane, "add", "-A");
    git(lane, "commit", "--quiet", "-m", "hooks");
    git(lane, "push", "--quiet", "origin", "main");

    // A repository whose first commit is not made yet is on a branch all the same: not "no branch checked out".
    const fresh = join(root, "fresh");
    git(root, "init", "--quiet", "-b", "work", fresh);
    git(fresh, "remote", "add", "origin", remote);
    addEvents(fresh, "01a0f519.jsonl", CODEX);
    let io = capture();
    assert.equal(await run(["events", "push", "--dir", fresh], io), 0, text(io.stderr));
    assert.match(text(io.stdout), /^Sent 1 event file to origin grooph-events\/work /);
    // And naming that branch itself is refused, as for any branch of work.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", fresh, "--branch", "work"], io), 1);
    assert.match(text(io.stderr), /"work" is the branch checked out here/);
    assert.equal(git(remote, "branch", "--list", "work"), "");

    // A branch and a tag of one name: the branch is still named plainly.
    git(lane, "tag", "main");
    io = capture();
    addEvents(lane, "5aac1305.jsonl", NESTED);
    assert.equal(await run(["events", "push", "--dir", lane], io), 0, text(io.stderr));
    assert.match(text(io.stdout), /^Sent 1 event file to origin grooph-events\/main /);
    io = capture();
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push-branch", "main"], io), 1);
    assert.match(text(io.stderr), /"main" is the branch checked out here/);
    git(lane, "tag", "-d", "main");

    // A session's sandbox may hold the history without the files' contents. The shared branch already holds another
    // session's file, known there by its id only: this one's still goes on top, and the other's stays.
    git(lane, "checkout", "--quiet", "--detach");
    assert.equal(await run(["events", "push", "--dir", lane], capture()), 0);
    git(lane, "checkout", "--quiet", "main");
    git(remote, "config", "uploadpack.allowFilter", "true");
    const thin = join(root, "thin");
    git(root, "clone", "--quiet", "--filter=blob:none", `file://${remote}`, thin);
    git(thin, "checkout", "--quiet", "--detach", "origin/main");
    addEvents(thin, "01a0f519.jsonl", CODEX);
    const ran = fireHook(thin);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(lastPush(thin)!.last!.ok, true, lastPush(thin)!.last!.message);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");
    assert.equal(git(remote, "show", "grooph-events-detached:.grooph/events/5aac1305.jsonl"), sent(readFileSync(NESTED, "utf8")));
    assert.doesNotMatch(execFileSync("git", ["-C", remote, "fsck", "--no-dangling"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), /error|missing/);
  });
});

test("sessions whose turns end together all get through to one shared events branch", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push-branch", "grooph-events/all"], capture()), 0);
    git(lane, "add", "-A");
    git(lane, "commit", "--quiet", "-m", "hooks");
    git(lane, "push", "--quiet", "origin", "main");
    const line = (session: string, event: string, s: number): string => `{"v":1,"t":"2026-10-02T20:00:${String(s).padStart(2, "0")}.000Z","harness":"claude-code","event":"${event}","session":"${session}"}\n`;
    // Four here, so the test is the same on a small machine; ten at once is measured in experiments/hooks/2026-10-02/.
    const clones = Array.from({ length: 4 }, (_, i) => {
      const dir = join(root, `session-${i}`);
      git(root, "clone", "--quiet", remote, dir);
      // Half of them as a cloud session starts: no branch checked out. With --push-branch that changes nothing.
      if (i % 2 === 0) git(dir, "checkout", "--quiet", "--detach", "origin/main");
      mkdirSync(join(dir, ".grooph", "events"), { recursive: true });
      writeFileSync(join(dir, ".grooph", "events", `s${i}.jsonl`), line(`s${i}`, "turn-start", i) + line(`s${i}`, "turn-end", i + 20));
      return dir;
    });
    // All at once, as the harness would start them: the command the installed settings hold.
    const command = (JSON.parse(readFileSync(join(lane, ".claude", "settings.json"), "utf8")) as { hooks: Record<string, { hooks: { command: string }[] }[]> }).hooks["Stop"]![1]!.hooks[0]!.command;
    assert.equal(command, 'node "$CLAUDE_PROJECT_DIR/.grooph/hooks/grooph-events-push.mjs" --hook --branch grooph-events/all');
    const results = await Promise.all(
      clones.map(
        (dir) =>
          new Promise<{ code: number | null; out: string }>((done) => {
            const child = spawn("sh", ["-c", command], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, GROOPH_PUSH_SETTLE_MS: "0" }, stdio: ["ignore", "pipe", "pipe"] });
            let out = "";
            child.stdout.on("data", (chunk) => (out += String(chunk)));
            child.stderr.on("data", (chunk) => (out += String(chunk)));
            child.on("close", (code) => done({ code, out }));
          }),
      ),
    );
    assert.deepEqual(results, clones.map(() => ({ code: 0, out: "" })));
    // Every session's file is there, whole; every push says it arrived; nothing else moved.
    assert.deepEqual(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/all").split("\n"), clones.map((_, i) => `.grooph/events/s${i}.jsonl`));
    clones.forEach((dir, i) => {
      assert.equal(git(remote, "show", `grooph-events/all:.grooph/events/s${i}.jsonl`), (line(`s${i}`, "turn-start", i) + line(`s${i}`, "turn-end", i + 20)).trim());
      const pushed = lastPush(dir)!.last!;
      assert.deepEqual([pushed.ok, pushed.branch], [true, "grooph-events/all"], `session ${i}: ${pushed.message}`);
    });
    assert.equal(git(remote, "rev-list", "--count", "grooph-events/all"), "4", "one commit each, each on top of the one before");
    assert.equal(git(remote, "branch", "--list", "grooph-events/*").split("\n").length, 1);
    assert.doesNotMatch(execFileSync("git", ["-C", remote, "fsck", "--no-dangling"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), /error/);
    git(lane, "fetch", "--quiet", "origin");
    const view = readLive([parseSource("lanes=git:origin/grooph-events/all")], NOW, lane);
    assert.deepEqual(view.sessions.map((x) => [x.id, x.state]).sort(), clones.map((_, i) => [`s${i}`, "waiting"]));
  });
});

test("a refusal is a race only when the branch moved: a branch name that can never be made stops at three tries, and a remote's address or a branch's name never decide", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push"], capture()), 0);
    addEvents(lane, "5aac1305.jsonl", NESTED);
    // The remote still holds grooph-events/fix from a branch since deleted; this clone is on fix/abc. Git can never
    // make grooph-events/fix/abc beside it, and says so in words that look like a race.
    git(lane, "checkout", "--quiet", "-b", "fix");
    assert.equal(fireHook(lane).status, 0);
    git(lane, "checkout", "--quiet", "main");
    git(lane, "branch", "--quiet", "-D", "fix");
    git(lane, "checkout", "--quiet", "-b", "fix/abc");
    const began = Date.now();
    const ran = fireHook(lane);
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.ok(Date.now() - began < 15_000, `took ${Date.now() - began} ms: a refusal that cannot change was tried until the time ran out`);
    const stuck = lastPush(lane)!.last!;
    assert.equal(stuck.ok, false);
    assert.match(stuck.message, /^git push failed: .*grooph-events\/fix/);
    assert.doesNotMatch(stuck.message, /other sessions/);
    git(lane, "checkout", "--quiet", "main");

    // A real race, against a remote whose address says "access-denied", on a branch called "issue-403": it goes on top.
    const odd = join(root, "access-denied.git");
    git(root, "clone", "--quiet", "--bare", remote, odd);
    const a = join(root, "a");
    const b = join(root, "b");
    for (const dir of [a, b]) {
      git(root, "clone", "--quiet", odd, dir);
      mkdirSync(join(dir, ".grooph", "hooks"), { recursive: true });
      copyFileSync(pushSource(), join(dir, ".grooph", "hooks", "grooph-events-push.mjs"));
    }
    addEvents(a, "5aac1305.jsonl", NESTED);
    addEvents(b, "01a0f519.jsonl", CODEX);
    const once = join(root, "raced");
    writeFileSync(
      join(odd, "hooks", "pre-receive"),
      `#!/bin/sh\nif [ ! -e "${once}" ]; then touch "${once}"; unset GIT_DIR GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES; GROOPH_PUSH_SETTLE_MS=0 node "${join(b, ".grooph", "hooks", "grooph-events-push.mjs")}" --hook --branch grooph-events/issue-403 >/dev/null 2>&1; fi\nexit 0\n`,
      { mode: 0o755 },
    );
    const raced = fireHook(a, ["--branch", "grooph-events/issue-403"]);
    assert.deepEqual([raced.status, raced.stdout, raced.stderr], [0, "", ""]);
    assert.equal(existsSync(once), true, "the race did not happen");
    const won = lastPush(a)!.last!;
    assert.deepEqual([won.ok, won.tries, won.crowded], [true, 2, true], won.message);
    assert.equal(git(odd, "ls-tree", "-r", "--name-only", "grooph-events/issue-403"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");
  });
});

test("a link among the events is never followed: what it points at is not sent", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    addEvents(lane, "5aac1305.jsonl", NESTED);
    writeFileSync(join(root, "secret.txt"), "SECRET=hunter2\n");
    symlinkSync(join(root, "secret.txt"), join(lane, ".grooph", "events", "zz.jsonl"));
    assert.equal(await run(["events", "push", "--dir", lane], capture()), 0);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/main"), ".grooph/events/5aac1305.jsonl");
    // Nor is a folder of events that is itself a link.
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, "x.jsonl"), "{}\n");
    const other = join(root, "other");
    git(root, "clone", "--quiet", remote, other);
    mkdirSync(join(other, ".grooph"));
    symlinkSync(elsewhere, join(other, ".grooph", "events"));
    const io = capture();
    assert.equal(await run(["events", "push", "--dir", other, "--branch", "grooph-events/linked"], io), 1);
    assert.match(text(io.stderr), /\.grooph\/events is a link, not a folder: nothing is sent from it/);
    assert.equal(git(remote, "branch", "--list", "grooph-events/linked"), "");
  });
});

test("as a hook, only files written while its session has been running are sent: what an earlier session left in the sandbox stays", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    assert.equal(await run(["hooks", "install", "--dir", lane, "--push"], capture()), 0);
    git(lane, "checkout", "--quiet", "--detach");
    const events = join(lane, ".grooph", "events");
    mkdirSync(events, { recursive: true });
    const line = (session: string, event: string, t: string): string => `{"v":1,"t":"${t}","harness":"claude-code","event":"${event}","session":"${session}","cwd":"/home/user/project"}\n`;
    // Left by a session of October 1 in a sandbox this environment kept, and a lead's note from then.
    writeFileSync(join(events, "1afa0000-old.jsonl"), line("1afa0000-old", "session-start", "2026-10-01T20:00:00.000Z") + line("1afa0000-old", "session-end", "2026-10-01T20:00:00.060Z"));
    writeFileSync(join(events, "said-mcp-old.jsonl"), '{"v":1,"t":"2026-10-01T20:00:00.030Z","harness":"claude-code","event":"note","session":"mcp-old","text":"old"}\n');
    // This session, and what its lead said through the MCP server under an id the harness did not give.
    writeFileSync(join(events, "b0b00000-new.jsonl"), line("b0b00000-new", "session-start", "2026-10-03T00:48:38.000Z") + line("b0b00000-new", "turn-end", "2026-10-03T00:48:58.000Z"));
    writeFileSync(join(events, "said-mcp-new.jsonl"), '{"v":1,"t":"2026-10-03T00:48:50.000Z","harness":"claude-code","event":"note","session":"mcp-new","text":"new"}\n');
    const hook = (input: string) =>
      spawnSync(process.execPath, [join(lane, ".grooph", "hooks", "grooph-events-push.mjs"), "--hook"], { cwd: lane, input, encoding: "utf8", env: { ...process.env, GROOPH_PUSH_SETTLE_MS: "0" } });
    let ran = hook(JSON.stringify({ hook_event_name: "Stop", session_id: "b0b00000-new", cwd: lane }));
    assert.deepEqual([ran.status, ran.stdout, ran.stderr], [0, "", ""]);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/b0b00000-new.jsonl\n.grooph/events/said-mcp-new.jsonl");
    const pushed = lastPush(lane)!.last!;
    assert.equal(pushed.ok, true, pushed.message);
    assert.match(pushed.message, /^Sent 2 event files to origin grooph-events-detached \([0-9a-f]{7}\): no branch is checked out here, so they went to the branch every such checkout shares, leaving out 2 older files here that are not this session's and not on the branch\. /);

    // Told nothing it can use (no session, or one with no file here), it sends them all, as by hand.
    ran = hook(JSON.stringify({ hook_event_name: "Stop", session_id: "not-here" }));
    assert.equal(ran.status, 0);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached").split("\n").length, 4);
    // By hand, --since does the same, and says so.
    const io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/by-hand", "--since", "2026-10-03T00:48:38Z"], io), 0, text(io.stderr));
    assert.match(text(io.stdout), /leaving out 2 older files here that are not this session's and not on the branch\./);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/by-hand"), ".grooph/events/b0b00000-new.jsonl\n.grooph/events/said-mcp-new.jsonl");
    const bad = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--since", "yesterday-ish"], bad), 1);
    assert.match(text(bad.stderr), /--since needs a value that is a time/);

    // A session that has ended in this clone still has its last lines sent by the next session's push: the branch
    // holds its file, so what it gained since goes too. Here, its end and a subagent's late stop.
    git(remote, "branch", "-D", "grooph-events-detached");
    for (const f of readdirSync(events)) rmSync(join(events, f), { recursive: true, force: true });
    writeFileSync(join(events, "a0000000-first.jsonl"), line("a0000000-first", "session-start", "2026-10-03T01:00:00.000Z") + line("a0000000-first", "turn-end", "2026-10-03T01:00:20.000Z"));
    assert.equal(hook(JSON.stringify({ session_id: "a0000000-first" })).status, 0);
    appendFileSync(join(events, "a0000000-first.jsonl"), line("a0000000-first", "session-end", "2026-10-03T01:00:30.000Z"));
    writeFileSync(join(events, "b0000000-second.jsonl"), line("b0000000-second", "session-start", "2026-10-03T01:05:00.000Z") + line("b0000000-second", "turn-end", "2026-10-03T01:05:20.000Z"));
    assert.equal(hook(JSON.stringify({ session_id: "b0000000-second" })).status, 0);
    assert.match(git(remote, "show", "grooph-events-detached:.grooph/events/a0000000-first.jsonl"), /"event":"session-end"/);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), ".grooph/events/a0000000-first.jsonl\n.grooph/events/b0000000-second.jsonl");

    // A clock that stepped back: the session's last line is older than its first. Its own file goes all the same.
    writeFileSync(join(events, "c0000000-clock.jsonl"), line("c0000000-clock", "session-start", "2026-10-03T13:00:05.000Z") + line("c0000000-clock", "turn-end", "2026-10-03T13:00:01.000Z"));
    assert.equal(hook(JSON.stringify({ session_id: "c0000000-clock" })).status, 0);
    assert.match(git(remote, "ls-tree", "-r", "--name-only", "grooph-events-detached"), /c0000000-clock\.jsonl/);

    // The hook at a turn's end runs the project's own copy of the script: an older copy is said, by hand and in status.
    writeFileSync(join(lane, ".grooph", "hooks", "grooph-events-push.mjs"), `${readFileSync(pushSource(), "utf8")}\n// an older version\n`);
    const warned = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--no-push"], warned), 0);
    assert.match(text(warned.stderr), /\.grooph\/hooks\/grooph-events-push\.mjs here is not this grooph's version: the hook at a turn's end sends with that one\. Run grooph hooks install again/);
    const status = capture();
    assert.equal(await run(["hooks", "status", "--dir", lane], status), 0);
    assert.match(text(status.stdout), /grooph-events-push\.mjs is not this grooph's version/);
    void root;
  });
});

test("what leaves the machine carries a folder's name, not its path, and no transcript's path; only whole lines go; an older copy on the branch still joins", async () => {
  await withRemote(async ({ remote, lane, root }) => {
    const events = join(lane, ".grooph", "events");
    mkdirSync(events, { recursive: true });
    const file = join(events, "s1.jsonl");
    const start = '{"v":1,"t":"2026-10-03T00:00:00.000Z","harness":"claude-code","event":"session-start","session":"s1","cwd":"/Users/someone/work/project"}\n';
    const stop = '{"v":1,"t":"2026-10-03T00:00:05.000Z","harness":"claude-code","event":"subagent-stop","session":"s1","agent":"a1","type":"Explore","transcript":"/Users/someone/.claude/projects/-Users-someone-work-project/s1/subagents/agent-a1.jsonl"}\n';
    // An older version sent the paths as they were: the branch already holds this copy.
    const seed = join(root, "seed");
    git(root, "clone", "--quiet", remote, seed);
    git(seed, "checkout", "--quiet", "--orphan", "grooph-events/main");
    git(seed, "rm", "-r", "--quiet", "--cached", ".");
    for (const name of [".gitignore", "README.md"]) rmSync(join(seed, name));
    mkdirSync(join(seed, ".grooph", "events"), { recursive: true });
    writeFileSync(join(seed, ".grooph", "events", "s1.jsonl"), start);
    git(seed, "add", "-A");
    git(seed, "commit", "--quiet", "-m", "old");
    git(seed, "push", "--quiet", "origin", "grooph-events/main");

    // Here, the same session went on; its last line is still being written.
    writeFileSync(file, `${start}${stop}{"v":1,"t":"2026-10-03T00:00:06.000Z","harn`);
    assert.equal(await run(["events", "push", "--dir", lane], capture()), 0);
    const onBranch = git(remote, "show", "grooph-events/main:.grooph/events/s1.jsonl");
    assert.equal(onBranch, sent(`${start}${stop}`), "two lines, the folder by its name, no transcript, nothing half-written, and no line twice");
    assert.doesNotMatch(onBranch, /someone|\.claude/);
    assert.equal(readFileSync(file, "utf8").startsWith(`${start}${stop}`), true, "the file here is as the hook wrote it");
    // Read elsewhere, the session is what it was: the folder's name, the subagent done once.
    git(lane, "fetch", "--quiet", "origin");
    const view = readLive([parseSource("git:origin/grooph-events/main")], NOW, lane);
    assert.deepEqual([view.sessions[0]!.cwd, view.sessions[0]!.agents.length, view.sessions[0]!.agents[0]!.stops, view.sessions[0]!.agents[0]!.transcript], ["project", 1, 1, undefined]);
    // Read here and from the branch together, each event is one: the copy sent is the same event as the line here.
    const both = readLive([{ path: lane }, parseSource("git:origin/grooph-events/main")], NOW, lane);
    assert.deepEqual([both.sessions.length, both.sessions[0]!.agents.length, both.sessions[0]!.agents[0]!.stops], [1, 1, 1]);
    // The line is finished: it goes with the next push.
    appendFileSync(file, 'ess":"claude-code","event":"turn-end","session":"s1","cwd":"/Users/someone/work/project"}\n');
    assert.equal(await run(["events", "push", "--dir", lane], capture()), 0);
    assert.equal(git(remote, "show", "grooph-events/main:.grooph/events/s1.jsonl").split("\n").length, 3);

    // An older version's push and this one's both added the same event: the branch holds it twice, once with its
    // path. The next push leaves it once. A line torn by a full disk is not an event, and is not sent.
    git(seed, "fetch", "--quiet", "origin");
    git(seed, "reset", "--quiet", "--hard", "origin/grooph-events/main");
    appendFileSync(join(seed, ".grooph", "events", "s1.jsonl"), stop);
    git(seed, "commit", "--quiet", "-am", "an older version's push");
    git(seed, "push", "--quiet", "origin", "grooph-events/main");
    assert.equal(git(remote, "show", "grooph-events/main:.grooph/events/s1.jsonl").split("\n").length, 4);
    appendFileSync(file, '{"v":1,"t":"2026-10-03T00:00:07.000Z","harness":"claude-co\n{"v":1,"t":"2026-10-03T00:00:08.000Z","harness":"claude-code","event":"turn-start","session":"s1","cwd":"/Users/someone/work/project"}\n');
    assert.equal(await run(["events", "push", "--dir", lane], capture()), 0);
    const healed = git(remote, "show", "grooph-events/main:.grooph/events/s1.jsonl").split("\n");
    assert.equal(healed.length, 4, healed.join("\n"));
    assert.equal(healed.filter((l) => l.includes("subagent-stop")).length, 1);
    assert.doesNotMatch(healed.join("\n"), /someone|claude-co"|harness":"claude-co$/);
  });
});

