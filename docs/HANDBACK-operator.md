# Handback to the Operator: grooph 0.1.0

For the Operator session on Ryan's other Claude account, from the grooph session on his Mac. Written 2026-09-30. Everything here was built and tested in this round; each "known limit" at the end is one, not a hedge.

You asked for a way to show the whole operation. You now have three things: a **document** that describes it (the operation map), **pictures** of it you can send, and a **record of what is running** that a hook writes and you can lay over the map.

## 1. Version

| | |
|---|---|
| Version | **0.1.0** (`grooph --version`) |
| Repository | https://github.com/ryanjosephkamp/grooph (public) |
| Where the code is | **`main`, tagged `v0.1.0`**, once Ryan has approved the merge of pull requests #1 to #8. If `main` does not have this file yet, the merge has not happened: use branch `slice/0031-evidence-and-policies`, which holds all of it. |
| Tested on | macOS (Node 25) and Linux in CI (Node 22 and 24) |
| Harness versions the hook was run against | Claude Code 2.1.280, Codex CLI 0.159.2 |

## 2. Install and run

Needs Node 22 or later and pnpm. Nothing else: no service, no key, no account.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git
cd grooph
git checkout v0.1.0 2>/dev/null || git checkout slice/0031-evidence-and-policies   # the tag; or the branch, if the merge has not happened yet
corepack enable                              # gives you pnpm, if it is not there
pnpm install --frozen-lockfile
pnpm -r build
node packages/cli/bin/grooph.js --version    # 0.1.0
```

Call it by that path from anywhere, or make it a command:

```bash
alias grooph="node $PWD/packages/cli/bin/grooph.js"     # this shell
scripts/install-local.sh                                # or: a link in ~/.local/bin (prints its plan first)
```

`grooph --help` lists every command; `grooph <command> --help` explains one. grooph never starts a session, calls a model, or sends anything anywhere. It reads and writes files.

## 3. The operation map

A small JSON file, `<name>.grooph-map.json`. It is the thing to keep current. The full contract is [`docs/operation-map.md`](operation-map.md); this is all of it you need to write one.

```jsonc
{
  "groophMap": 0,
  "id": "splashery-operation",            // kebab-case; every id in the file is unique
  "name": "Splashery operation",
  "version": 1,
  "asOf": "2026-10-01",                   // optional, YYYY-MM-DD
  "description": "optional, one paragraph",

  "lanes": [                               // one machine under one account
    { "id": "cloud-b", "name": "Cloud, account B", "machine": "Claude Code cloud sandboxes", "place": "cloud", "account": "Claude account B" }
  ],

  "sessions": [                            // one harness session, or a family drawn as one
    {
      "id": "operator", "name": "Operator", "lane": "cloud-b",
      "harness": "claude-code",            // or "codex", or any string
      "model": "optional, as the harness names it",
      "role": "what this session is for, one line",          // required
      "lifetime": "long-lived",            // optional: long-lived | per-task | scheduled
      "count": 12,                         // optional: a family of 12 like sessions
      "graph": "optional pointer to its loop graph: a path, a URL, or id@version",
      "repo": "optional"
    }
  ],

  "handoffs": [                            // one direction each; out and back are two
    {
      "id": "h-start", "from": "operator", "to": "workers",
      "carrier": { "kind": "session-message" },
      "what": "optional: what is handed over"
    }
  ]
}
```

**Carriers.** Every handoff names what actually moves the work:

| `kind` | Also needs | Use for |
|---|---|---|
| `branch` | `repo` (and optionally `ref`) | work committed to a branch the other side can fetch |
| `pull-request` | `repo` | a pull request |
| `session-message` | | the harness's own channel: you starting or messaging a lane |
| `scheduled-message` | optionally `schedule` | a routine or timer that puts a prompt into a session |
| `review-page` | `where` | a published page someone reads |
| `person` | `who` | Ryan carrying a prompt |
| `other` | `name` | anything else, named |

**Rules the validator checks** (`grooph validate <file>`; exit 1 on an error):

| Code | It means |
|---|---|
| `E_SCHEMA`, `E_DUPLICATE_ID`, `E_DANGLING_REF` | the file's shape; a repeated id; a lane or session that is not there |
| `E_HANDOFF_NO_CARRIER` | a handoff with no carrier, or a carrier that does not say which (a branch with no `repo`, a person with no `who`) |
| `W_CARRIER_CANNOT_CROSS` | a session or scheduled message between different accounts or harnesses, or a review page between accounts: something else is really carrying it |
| `W_SESSION_ISLAND` | a session nothing reaches and that reaches nothing |
| `W_NO_RETURN` | a session that is handed work and hands nothing on |
| `W_GRAPH_UNRESOLVED` | a `graph` path that is not a graph file beside the map |

A handoff carried by a person is not an issue, and it is where work waits when Ryan is away. So `grooph validate` lists each one after the issues (`by hand  h-brief-codex  operator → codex: moves only when Ryan carries it`), and `--json` carries the list as `byHand`. Your kit asked for this flag.

**The sample**: [`fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json`](../fixtures/maps/valid/owner-operation-2026-09-30.grooph-map.json), "Ryan's operation, September 30, 2026", drawn from his brief: you, your worker lanes as a family of twelve, test runners, routines, the research lanes, this session, and Codex on the Mac, with ten handoffs. It is a starting point and it holds guesses, which its own `description` lists. **You know the real shape; correct it.** Its picture: [light](../fixtures/maps/pictures/ryans-operation-2026-09-30.light.svg), [dark](../fixtures/maps/pictures/ryans-operation-2026-09-30.dark.svg).

**What to do with a map:**

```bash
grooph validate ops.grooph-map.json                       # the rules above
grooph canonicalize ops.grooph-map.json --write           # stable key order, clean diffs
grooph shape ops.grooph-map.json                          # "3 lanes · 7 sessions (18 counting families) · 10 handoffs, 2 carried by a person"
grooph image ops.grooph-map.json --theme light --out ops.png     # or .svg; --theme dark
grooph page  ops.grooph-map.json --out ops.html           # one file, opens with no network
grooph outline ops.grooph-map.json                        # the map as Markdown
grooph share ops.grooph-map.json                          # a link that opens it in the app on a phone
```

The picture is laid out for a phone: lanes top to bottom, a card per session, each handoff a numbered arc in the margin, the handoffs listed underneath with their carriers. A map is drawn and validated. It is never compiled or run: `grooph export` refuses one.

A session's own loop graph is still a graph document (`docs/graph-ir.md`): one session and its subagents. `grooph image`, `outline`, `page` and `share` take those too.

## 4. The live view

A hook appends one line to a file when a session or a subagent starts or stops. grooph reads those files. [`docs/subagents.md`](subagents.md) explains what each harness tells a hook and where each fact comes from.

### Turn it on, per repository

```bash
cd <the repository a lane works in>
grooph hooks install                          # Claude Code
grooph hooks install --harness codex          # Codex
grooph hooks install --harness claude-code,codex --tools    # both, and each tool call's name
```

It writes two things and says so: `.grooph/hooks/grooph-event.mjs` (the hook, about a hundred lines, readable) and the harness's settings (`.claude/settings.json`, or `.codex/hooks.json`), touching nothing else in them. `grooph hooks status` shows what is installed; `grooph hooks remove` takes it out.

- **Claude Code**: commit both files. Claude Code's documentation says a repository's `.claude/settings.json` hooks run in a cloud session **that has one repository**. Sessions started after that record themselves.
- **Codex**: project hooks need a trusted project layer and approval of each hook definition. In the CLI, Ryan reviews them in `/hooks`; a changed definition needs review again ([Codex hooks](https://learn.chatgpt.com/docs/hooks)). Verify the chat's actual working folder: slice 0032 found the entries installed in the intended worktree, while the desktop chat ran in a different worktree and recorded no events.
- Both need `node` on the path where the session runs.

The hook prints nothing, always exits 0, and writes ids, names and times: never a prompt, a tool's input or output, or a reply. It cannot change what a session does.

### Where the events are, and how they reach you

Each session writes `.grooph/events/<session id>.jsonl` **in its own clone**. Nothing outside that machine can read it until it travels, and the repository is the carrier:

- Have each lane commit `.grooph/events/` with its work. Then its events are on its branch.
- Read a branch without checking it out, after `git fetch`: the source `git:<ref>`.

```bash
grooph sessions                                        # this clone's own events, as text
grooph sessions lane-a=git:origin/lane-a lane-b=git:origin/lane-b
grooph sessions workers=git:origin/lane-a --json       # the same as data
```

Output, per session: its harness, whether it is `working`, `waiting` or `ended`, and each subagent with its type, running or done, for how long, its tool calls and its last tool.

### A live map: the events on the operation map

Name each source for the **map session id** it belongs to, and the map is drawn with what the hooks saw:

```bash
grooph image ops.grooph-map.json --theme light --out ops-now.png \
  --events operator=. \
  --events workers=git:origin/lane-a \
  --events test-runners=git:origin/tests
grooph page ops.grooph-map.json --out ops-now.html --events operator=. --events workers=git:origin/lane-a
```

Each named session's card gains a line: a filled dot and `working · 2 running, 5 done`, a ring and `waiting`, or `ended`. Several sources may share one name (a family's lanes): they are summed, as `3 of 12 working`. The caption says when it was read. A session with no source is drawn as the map alone draws it. **The picture is a snapshot.** Run the command again for a newer one; that is your "live": regenerate when you wake, then send the PNG or the page.

On a machine with a browser, the same thing updates by itself:

```bash
grooph watch --map ops.grooph-map.json --events operator=git:origin/operator --events workers=git:origin/lane-a
grooph watch --sessions --host 0.0.0.0        # sessions only; reachable from a phone on the same network
```

It serves a page that asks again every two seconds. It reads the refs as they are locally, so something must `git fetch` for it to see new pushes.

### For a run of a graph

`grooph watch <run folder>` shows the run view as before. With the hook installed, a node shows as running from the moment its subagent starts. Nothing about the package or the lead's brief changed.

## 5. Optional: tell grooph your plan

`grooph mcp` is an MCP server with four tools. With it, a session can say what it means to do, and the live view shows that beside what the hook saw.

```bash
claude mcp add grooph -- grooph mcp
```

| Tool | Use |
|---|---|
| `grooph_plan` | before starting subagents: the kinds you will start, what each is for, how many |
| `grooph_note` | one or two sentences for whoever is watching |
| `grooph_running` | what the hook has seen in this project, and each plan with how much of it has started |
| `grooph_validate` | check a graph or a map file |

They record and report. None starts or changes anything. Whether using them makes a lead coordinate better is untested.

## 6. A recipe for the whole operation

1. Clone and build grooph where you run (section 2).
2. Write `ops.grooph-map.json` for the operation as it really is, from the sample. `grooph validate` until it is clean; fix what it names.
3. In each repository a lane works in: `grooph hooks install`, commit the two files, and have lanes commit `.grooph/events/` with their work.
4. When you wake: `git fetch`, then `grooph image ops.grooph-map.json --out ops-now.png --events <session id>=git:origin/<branch> …`, one `--events` per lane you can see.
5. Send Ryan the PNG, or `grooph page … --out ops-now.html` for a page he can open with no network and tap through.
6. Keep the map in a repository. When the operation changes, change the file.

## 7. Known limits

- **Merged only on Ryan's word.** If `main` lacks this file, eight stacked pull requests are still waiting on it; the branch named in section 1 is then the source, and there is no tag yet.
- **No cloud session was run.** The hook was run in real sessions on Ryan's Mac, in both harnesses. That a cloud session runs a repository's hooks is from Claude Code's documentation, and holds for a session with **one** repository; a session with several starts above the clones and does not read their settings. You are the first to try it: check `.grooph/events/` after a lane's first subagent.
- **Codex in the cloud is unknown.** This check does not establish hooks in Codex cloud tasks. Locally, both project-layer trust and hook-definition trust are required. The earlier CLI check ran the hook by passing it for one invocation; slice 0032's desktop chat and two trivial subagents produced no events in the intended project, with a different session working folder and Ryan reporting no hooks found. Loading after trust in the intended folder remains unverified ([record](../experiments/hooks/2026-10-01/codex-1-interactive-project-hooks/check.json)).
- **As live as the last push.** A lane's events are invisible until committed and pushed, and a watching machine has to fetch.
- **Codex does not say which subagent started which**, so its subagents are a flat list. Claude Code does, and nesting is shown.
- **Clocks.** Events from different machines are ordered by each machine's clock.
- **The tie between a source and a map session is the name you give on the command line.** It is not in the map file. Give a wrong name and the wrong card lights.
- **What an agent said is not recorded**, by design. The view says that something ran, when and for how long.
- **The picture is automatic.** No hand-placed layout for a map. Past about fifteen sessions or a very tangled set of handoffs the margin of arcs widens and the cards narrow.
- **A map lives in files.** The app opens one from a link or a file and does not keep it; there is no editor for a map but a text editor and you.
- **Sessions observed were all under a minute.** Long sessions are untested; the reader takes the last 4 MB of an events file.
- **Node is required** wherever the hook runs.

## 8. Questions for you

The sample map was drawn from Ryan's brief alone, and he says you know these better than he does. Each answer changes a line of the sample, so please answer them in your reply (section 10 says how it gets back).

1. **Your lanes.** How do you start a worker lane and message it afterwards: Claude Code's own session tools, or something else? The sample calls it a `session-message`.
2. **What comes back from a lane.** The sample says a lane returns work as a pull request and you read it there. Is that right, or do you also read the lane's transcript or a file on its branch?
3. **How many, and how long.** The sample draws twelve worker lanes as one family, per task. What are the real number and lifetime? Are the test runners and the routines separate sessions, as drawn?
4. **Routines.** What starts them, on what schedule, and which session does a routine's prompt land in?
5. **The research project.** Which Claude account do its lanes run under, does it have its own lead session, and does anything pass between it and Splashery besides Ryan? The sample puts it under your account with no handoffs to you, as a guess. Keep its name and contents out of your answer: the map only needs the shape.
6. **Codex.** How does Codex on the Mac get its prompts and return its work: only Ryan pasting, or a branch too? Which repositories?
7. **Model names.** What does each harness call the model each kind of session runs?
8. **One repository or several.** Does each of your cloud sessions have exactly one repository? The hook is only documented to run from a repository's settings in that case (section 7).
9. **After you try the hook**: did `.grooph/events/` fill in a cloud session, and did a subagent's start and stop both appear? That is the one thing nobody has checked.

If it is easier, skip the list and send back a corrected `ops.grooph-map.json`: the file answers 1 to 7 by itself.

## 9. Evidence

Every claim here marked as seen comes from a recorded run. [`experiments/hooks/`](../experiments/hooks/) holds one folder per session that was run (five in Claude Code, five in Codex): what the harness printed, what the hook wrote, and a ledger with each session's id and cost. The harnesses' full transcripts stay on Ryan's Mac, with their checksums in the ledger.

## 10. How to answer

You and this session share no account, so Ryan carries your reply. Either:

- commit a file to a repository Ryan can read (your corrected map, and a short note with the answers) and tell him the path, or
- write the answers in one message he can copy.

He pastes it to the grooph session, which corrects the sample and replies in `docs/HANDBACK-operator.md` on `main`.

## 11. If something is wrong

`grooph validate` names the rule. `grooph hooks status` says whether the hook is installed. An empty `grooph sessions` after a session ran means the hook did not run: check that the session has one repository (Claude Code cloud), that the hook is trusted (Codex), and that `node` is on the path. Everything is in [`docs/subagents.md`](subagents.md) and [`docs/operation-map.md`](operation-map.md), and the tests in `packages/*/test` show each command doing what this page says.
