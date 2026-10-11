# The recorder outside the project: one page to choose from

Written 2026-10-11 by the driver, for the owner. Nothing here is built. It is the second of the two things the last driver left owed (`handoffs/DRIVER.md`, "Now"), and it turned out to be a choice, not a patch.

## Why

- **A watched session can see the recorder.** In the watching check the recorder's files were shown to the session in sixteen of the twenty-four runs with the hook, and eight final replies mention its events folder ([`experiments/watching/RESULTS.md`](../../experiments/watching/RESULTS.md)). The check did not try a remedy.
- **The recorder's own file is in the project.** A harness runs a hook outside its sandbox. The hook now writes through no link, but nothing in grooph keeps a session that can write in a project from changing a file in it, the hook included.
- **You want to watch your own projects without putting grooph's files in their repositories.**

## What a watched project holds today

Three things, all inside the folder: the hook's copy (`.grooph/hooks/`), the entries that tell the harness to run it (`.claude/settings.json` or `.codex/hooks.json`), and the events (`.grooph/events/`). One of the three can already be moved: `GROOPH_EVENTS_DIR` sends the events elsewhere. Nothing reads them from there without being told where, and the other two stay in the folder.

## What I recommend: an install at the user's level, for the folders you list

One command, `grooph hooks install --user`, run once on a machine:

| | Today | With `--user` |
|---|---|---|
| The hook's file | `<project>/.grooph/hooks/` | `~/.grooph/hooks/`, one copy for the machine |
| What tells the harness to run it | the project's `.claude/settings.json` or `.codex/hooks.json` | the harness's own user-level settings (`~/.claude/settings.json`, `~/.codex/hooks.json`; a profile named by `CLAUDE_CONFIG_DIR` is honored) |
| The events | `<project>/.grooph/events/` | `~/.grooph/events/<a name made from the project's path>/` |
| Which sessions are recorded | those working in that project | those working in a folder on a list you keep (`grooph hooks watch <folder>`, `unwatch`, and `status` to read it). The list starts empty |
| What the project holds of grooph | three things | nothing |

`grooph sessions`, `grooph watch --sessions` and `grooph hooks status`, run in a listed folder, read that folder's events from the user-level store. The install in a project stays as it is for anyone who wants it, and for a cloud session, which has no user level of yours.

## The choice

- **A. User level, only the folders you list (recommended).** A hook at the user's level is run by every session on the machine, whatever project it is in. With a list, a session in a folder you did not name leaves no line: your other projects are recorded only when you say so, and Codex's own background session, which works in its own folder, is left out.
- **B. User level, every session on the machine.** Simplest to explain, and nothing to remember when you start a new project. The store would then hold the folder names and session times of every project you work in. It stays on the machine unless you push it.
- **C. Stay in the project and move only the events.** The smallest change. The hook's file and the settings entry stay in the folder, where a session can see them and could change the first.

## Held to the question: does it add anything to what a model reads or has to do?

A and B take something away: no file of grooph's is in the folder a session works in. In the check, sessions met the recorder by listing their folder or running `git status`; an install at the user's level leaves nothing there to meet. The hook still prints nothing and exits 0. **Whether a session then notices nothing has not been tried.** The second look at watching, on work that calls for subagents, is where it would be: one more arm, "watched from outside the project".

## What it leaves open

- **What it costs every other session.** A hook at the user's level is started by every session on the machine at every event, listed or not. For a folder that is not listed it would start, read the list and leave: about the time Node takes to start (some 50 to 70 ms on this Mac), in the background at all but a turn's end and a session's end. The slice measures it and says the number before anything merges.
- **Sending events to another machine** (`grooph events push`) makes its commit from the project's own events folder. With the events at the user's level it would need to read them from there. I would leave the push to installs in a project at first, and say so.
- **Codex asks to trust a hook once**, by its exact text, in `/hooks`. That is yours to do after the install, as it is today.
- **A worktree of a listed project** that lies outside the listed folder (Codex keeps its own under `~/.codex/worktrees/`) is not in a listed folder. Either such folders are listed too, or the list names a repository and the hook asks git which repository a folder belongs to. The handoff settles it.
- **The words for the privacy page.** The store holds, for each listed project, what the events hold today: ids, names and times, the working folder's path, and where a subagent's transcript is kept. Nothing a session read, wrote or said. The words are yours to approve when it is built.

## What it is as work

One slice, in `packages/cli` only: the install and its list, the hook's test of where a session is working, and where the three reading commands look. Its tests are the hook's own, run against a user-level layout in a scratch home. It reaches people with the next version. It touches the file the link fix touches, so it starts from that fix.
