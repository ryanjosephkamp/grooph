/**
 * `grooph events push` and the script it runs (packages/cli/hooks/grooph-events-push.mjs):
 * a project's session events go to a branch that holds nothing else, without the
 * working tree, the index, HEAD or the checked-out branch being touched, and a
 * machine that fetches that branch reads them as a `git:` source.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { pushSource } from "../src/commands/hooks.js";
import { parseSource, readLive } from "../src/events-io.js";
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
    assert.equal(git(remote, "show", "grooph-events/main:.grooph/events/5aac1305.jsonl"), readFileSync(NESTED, "utf8").trim());
    const first = git(remote, "rev-parse", "grooph-events/main");
    assert.equal(git(remote, "rev-list", "--count", "grooph-events/main"), "1");
    // And the work's own branch does not have them.
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "main").includes(".grooph/events"), false);

    // Again with nothing new: said so, no new commit.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 0);
    assert.match(text(io.stdout), /^Nothing new: origin grooph-events\/main already holds these 1 event file\./);
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
    assert.match(text(io.stdout), /^Sent 2 event files to origin claude\/grooph-events-team/);
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
    // And with no branch checked out there is no name to derive one from.
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane], io), 1);
    assert.match(text(io.stderr), /no branch is checked out here, so there is no name to give the events branch: say one with --branch <name>/);
    io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/detached-lane"], io), 0);
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
      `#!/bin/sh\n# The first push to arrive finds the other clone's commit already there.\nif [ ! -e "${once}" ]; then touch "${once}"; unset GIT_DIR GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES; node "${join(repoRoot, "packages", "cli", "bin", "grooph.js")}" events push --dir "${other}" --branch grooph-events/shared >/dev/null 2>&1; exit 1; fi\nexit 0\n`,
      { mode: 0o755 },
    );
    appendFileSync(join(lane, ".grooph", "events", "5aac1305.jsonl"), '{"v":1,"t":"2026-10-01T02:00:05.000Z","harness":"claude-code","event":"turn-end","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e"}\n');
    const io = capture();
    assert.equal(await run(["events", "push", "--dir", lane, "--branch", "grooph-events/shared"], io), 0, text(io.stderr));
    assert.equal(existsSync(once), true, "the race did not happen");
    assert.match(text(io.stdout), /^Sent 2 event files to origin grooph-events\/shared/);
    assert.equal(git(remote, "ls-tree", "-r", "--name-only", "grooph-events/shared"), ".grooph/events/01a0f519.jsonl\n.grooph/events/5aac1305.jsonl");
    assert.match(git(remote, "show", "grooph-events/shared:.grooph/events/5aac1305.jsonl"), /"event":"turn-end"/);
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
