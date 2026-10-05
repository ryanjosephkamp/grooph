# 11 · Watching a run

[Start page](README.md) · previous: [pictures, views and themes](10-pictures-and-views.md) · next: [the command line and the app](12-command-line-and-app.md)

Chapter 6 showed what a run leaves behind: the notes and the progress page its lead writes. That record has one weakness. It is the lead's own account, and it only says what the lead chose to write down.

There is a second, independent source. The harness itself knows when a session starts, when a subagent starts, and when each one stops. A **hook** is the harness's way of telling an outside program about such things as they happen.

## What a hook is

A **hook** is a small command the harness runs whenever a named thing happens: a session starts, a subagent stops, a tool is about to be used. Both Claude Code and Codex have hooks.

Hooks are powerful. In general a hook can refuse an action, or add text to what an agent sees. That means the first question to ask of any hook is "what can this one do to my agents?"

## grooph's hook only writes down

grooph's hook is the **event hook**. It is built to do one thing: append one line to a file, and finish. Each line is a **session event**.

The project has a rule for this, in four words: **observation never steers.** Watching must not change what is watched. So the event hook:

- prints nothing, so there is no text for the harness to pass to an agent;
- always finishes with "success", so it never blocks a step;
- reads no file, calls no model, and opens no connection.

The hook itself is one readable file, copied into your project where you can open it. Installing also copies a second script, the sender described further down, which does nothing unless you turn it on, and adds the hook's entry to the harness's settings file.

Two careful qualifications, from the project's own audit:

- What is established is that the script **returns no decision to the harness**. Starting the script can still fail, and it takes a moment to run.
- The lines it writes can be **read back by an agent** that is given grooph's own tool for that (the MCP server, in chapter 12). So "an agent can never be influenced by it" would be saying too much.

## Installing it

In a project folder:

```bash
grooph hooks status
```

```text
not installed: .grooph/hooks/grooph-event.mjs
claude-code: no entries in .claude/settings.json
codex: no entries in .codex/hooks.json
0 session files in .grooph/events/
```

```bash
grooph hooks install
```

```text
wrote .grooph/hooks/grooph-event.mjs
wrote .grooph/hooks/grooph-events-push.mjs
wrote .claude/settings.json

From the next session on, claude-code sessions in this project append to .grooph/events/<session id>.jsonl:
  one line when a session or a subagent starts or stops.
The hook prints nothing and always exits 0: it records, it cannot steer. It needs node on the PATH.
Watch: grooph watch --sessions   ·   List: grooph sessions   ·   Undo: grooph hooks remove
The events are a record of this machine's sessions: add .grooph/events/ to .gitignore. To let another machine read them,
send them to a branch of their own: grooph events push (or, with no grooph there, node .grooph/hooks/grooph-events-push.mjs).
A session cannot send what it writes as it stops. To send at the end of every turn instead, install with --push.
```

It says what it wrote and changes nothing else. `grooph hooks remove` undoes it and keeps the events already recorded.

For Codex, add `--harness codex`. Codex asks two things of you first: the folder must be one you have told Codex to trust, and you must review each hook once inside Codex. Some events that Claude Code reports are missing in Codex.

## What a line holds, and what it never holds

This is a line from a real record kept in the repository:

```json
{"v":1,"t":"2026-10-01T01:32:52.537Z","harness":"claude-code","event":"subagent-start","session":"5aac1305-f22d-4cad-a6e7-810700aeb49e","agent":"a3c7f127015e09ab9","type":"general-purpose"}
```

It says: at this time, in this session, a subagent of this type started.

| It holds | It never holds |
|---|---|
| The time | What you asked the agent |
| Which harness | What the agent said |
| The kind of event: a session, a turn or a subagent starting or stopping, or (if you ask for it with `--tools`) a tool call finishing | What a tool was given or what it returned |
| Ids for the session and the subagent | The contents of any file |
| The subagent's type and, where given, the model | |
| A tool's *name*, if you installed with `--tools` | |

One more thing it holds, which the short description "ids, names and times" leaves out: **on the machine it runs on, a line can also hold the path of the working folder and the path where a subagent's transcript is kept.** A path is not content, but it can say something about you, such as a folder's name. When events are sent to another machine (below), the folder is sent as its name only and the transcript's path is not sent. The file is plain text, so you can open it and look.

## Reading what was recorded

With nothing recorded yet:

```bash
grooph sessions
```

```text
no sessions recorded in .. The event hook writes them: grooph hooks install
```

On the kept record that the line above came from, run from the repository:

```bash
grooph sessions experiments/hooks/2026-09-30/cc-4-real-hook-nested-again/events.jsonl
```

```text
claude-code · ended · 0 running, 3 done · session 00aeb49e · exp2
  ✓ general-purpose  15e09ab9  done in 11 s · 1 tool call, last Agent
    ✓ Explore  fa11c02e  done in 7 s · 2 tool calls, last Read
  ✓ general-purpose  6dc2472e  done in 4 s · 1 tool call, last Bash
```

One session, now ended. (`exp2` is the name of the folder it worked in. "general-purpose" and "Explore" are the harness's own names for kinds of subagent.) It started two subagents, and the first of those started one of its own (the indented line). Each shows how long it ran and the name of its last tool. This record was made with the `--tools` option, which is why tool calls are counted. Nothing here says what any of them was asked or what it answered.

## The live view

`grooph watch` starts a small viewer **on your own machine** and prints an address to open in a browser.

```bash
grooph watch --sessions --port 4369
```

```text
watching the newest run under .: nothing to show yet (no runs under . yet; a run writes .grooph/<graph-id>/runs/<run-id>/ when it starts); the view waits for it
sessions: none recorded under .grooph/events/ yet (grooph hooks install records them)
open http://127.0.0.1:4369/grooph/#/live
read-only: re-reads the run folder and the events on every request and writes nothing. Ctrl-C stops it.
```

(It was stopped after three seconds here. It normally runs until you press Ctrl-C.) The address it prints begins `http://127.0.0.1`, which is a computer's name for itself: the page comes from your own machine and is not on the internet. `--port` only chooses which of the machine's numbered doors to use. The page it serves is the **live view**. It shows two things side by side, refreshed every two seconds:

- **the run**, from the lead's notes: the graph with each node marked pending, running, passed, failed or halted, and each loop's round;
- **the sessions**, from the event hook: which sessions and subagents exist and which are running right now.

It reads files and writes nothing. It is reachable only from your own computer unless you ask otherwise with `--host`. That option is how you watch a run from your phone: the phone must be on the same network, and the command prints the address to open. It also warns that anyone else on that network can then read the run.

One honesty rule is built into every such view: **a silent session is not called "working".** If a session that has not ended has written nothing for half an hour, the view says "last seen" and how long ago. A long turn with no subagents can look quiet without having stopped, and the view does not pretend to know which.

## Sending events to another machine

The events file lives on the machine where the session ran. `grooph events push` copies the events to a branch of their own in the shared, online copy of your repository (sending changes there is called a **push**), so someone on another machine can read them. Whoever can read that repository can read that branch. A second, longer script, the **sender**, can do this at the end of every turn.

Before you turn the sender on, know what the audit found about it: **it sends more than event lines.** Notes and plans that the session itself has recorded go too, with their text. The "never content" promise is about the event hook's lines. Read [subagents.md](../subagents.md) before using the sender on work you would not want copied to a branch.

## Maps that show who is at work

Chapter 9's operation map says which sessions exist. The events say which are at work. Put together, a map's picture can mark each session as working, waiting or ended.

## What grooph itself keeps about you

grooph has no account, no server of its own, no cookies and no analytics, and it never calls a model. It sends nothing about you anywhere. It uses the network only when you ask it to send something (a push, a share link you pass on) or when you ask for a template by a name it cannot find on your computer. A share link carries its whole document inside the link, so whoever has the link has the document. See [privacy.md](../privacy.md).

That is grooph. **The harness is a different matter**: as chapter 1 said, it sends what your agents read to its model provider, under its own terms.

The reference for this chapter is [subagents.md](../subagents.md).
