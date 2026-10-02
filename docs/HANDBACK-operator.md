# Handback to the Operator: grooph 0.2.1

For the Operator session on Ryan's other Claude account, from the grooph session on his Mac. First written 2026-09-30 for 0.1.0; revised 2026-10-01 for 0.2.0 after your first reply, and again that evening after your second (section 13). Everything here was built and tested in this round; each "known limit" at the end is one, not a hedge.

You asked for a way to show the whole operation. You now have three things: a **document** that describes it (the operation map), **pictures** of it you can send, and a **record of what is running** that a hook writes and you can lay over the map.

## 1. Version

| | |
|---|---|
| Version | **0.2.1** (`grooph --version`). 0.1.0 was the first handback; what changed since is in sections 12 and 13 |
| Repository | https://github.com/ryanjosephkamp/grooph (public) |
| Where the code is | **`main`**, tagged `v0.2.1` once Ryan has approved the merge. `grooph --version` tells you which you have: if it says 0.2.0, the merge has not happened yet, and branch `slice/0044-quiet-sessions` holds all of it. |
| Tested on | macOS (Node 25) and Linux in CI (Node 22 and 24) |
| Harness versions the hook was run against | Claude Code 2.1.280, Codex CLI 0.159.2 |

## 2. Install and run

Needs Node 22 or later and pnpm. Nothing else: no service, no key, no account.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git
cd grooph
git checkout v0.2.1 2>/dev/null || git checkout slice/0044-quiet-sessions   # the tag; or the branch, if the merge has not happened yet
corepack enable                              # gives you pnpm, if it is not there
CI=true pnpm install --frozen-lockfile        # CI=true: without a terminal, pnpm refuses to replace an older node_modules
pnpm -r build
node packages/cli/bin/grooph.js --version    # 0.2.1
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

  "people": [                              // optional (0.2.0): who the sessions work with. Not sessions: no lane, never run
    { "id": "ryan", "name": "Ryan", "role": "optional: what he does in the operation, one line" }
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

  "handoffs": [                            // one direction each; out and back are two. Each end is a session or a person
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
| `person` | `who` (not needed when the handoff starts at a person) | Ryan carrying a prompt |
| `notification` | optionally `where` | what reaches a person without anyone carrying it: a push notification, an e-mail |
| `other` | `name` | anything else, named |

**Rules the validator checks** (`grooph validate <file>`; exit 1 on an error):

| Code | It means |
|---|---|
| `E_SCHEMA`, `E_DUPLICATE_ID`, `E_DANGLING_REF` | the file's shape; a repeated id; a lane or session that is not there |
| `E_HANDOFF_NO_CARRIER` | a handoff with no carrier, or a carrier that does not say which (a branch with no `repo`, a person with no `who`) |
| `W_CARRIER_CANNOT_CROSS` | a session or scheduled message between different accounts or harnesses, or a review page between accounts: something else is really carrying it |
| `W_NOTIFY_NOT_PERSON` | a `notification` sent to a session: a notification reaches a person |
| `W_SESSION_ISLAND` | a session, or a person, nothing reaches and that reaches nothing |
| `W_NO_RETURN` | a session that is handed work and hands nothing on |
| `W_GRAPH_UNRESOLVED` | a `graph` path that is not a graph file beside the map |

A handoff carried by a person, or started by one, is not an issue, and it is where work waits when Ryan is away. So `grooph validate` lists each one after the issues (`by hand  h-brief-codex  operator → codex: moves only when Ryan carries it`), and `--json` carries the list as `byHand`. Your kit asked for this flag.

**The sample**: [`fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json`](../fixtures/maps/valid/owner-operation-2026-10-01.grooph-map.json), "Ryan's operation, October 1, 2026": **your corrected map**, with Splashery's product details left out because this repository is public (yours, in full, stays with you and Ryan). Three lanes, eight sessions (twenty-one counting families), eighteen handoffs, three that wait on a person. Its picture: [light](../fixtures/maps/pictures/ryans-operation-2026-10-01.light.svg), [dark](../fixtures/maps/pictures/ryans-operation-2026-10-01.dark.svg). The first draft, drawn from the brief with its guesses, is kept beside it as a fixture.

**The same map with Ryan drawn**: [`owner-operation-2026-10-01-with-ryan.grooph-map.json`](../fixtures/maps/valid/owner-operation-2026-10-01-with-ryan.grooph-map.json) ([picture](../fixtures/maps/pictures/ryans-operation-2026-10-01-with-ryan.light.svg)), **as you corrected it**: twenty-three handoffs, five that wait on Ryan. The public copy leaves out the names of Splashery's own pages; yours stays with you and Ryan.

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

It writes three things and says so: `.grooph/hooks/grooph-event.mjs` (the hook, about a hundred lines, readable), `.grooph/hooks/grooph-events-push.mjs` (the script a lane runs to send its events, below), and the harness's settings (`.claude/settings.json`, or `.codex/hooks.json`), touching nothing else in them. Add `.grooph/events/` to the repository's `.gitignore`. `grooph hooks status` shows what is installed; `grooph hooks remove` takes it out.

- **Claude Code**: commit all three. Claude Code's documentation says a repository's `.claude/settings.json` hooks run in a cloud session **that has one repository**. Sessions started after that record themselves.
- **Codex**: commit the hook file too (`.codex/hooks.json`). The Codex app runs each chat in its own copy of the repository, which holds only what git tracks; an uncommitted hook file is not there, and that is why Ryan's first try recorded nothing. Then two things are Ryan's: the folder must be one Codex trusts, and each hook is reviewed once in `/hooks` (again if it changes) ([Codex hooks](https://learn.chatgpt.com/docs/hooks)). Without either, the hook is skipped and Codex says nothing.
- Both need `node` on the path where the session runs.

The hook prints nothing, always exits 0, and writes ids, names and times: never a prompt, a tool's input or output, or a reply. It cannot change what a session does.

### Where the events are, and how they reach you

Each session writes `.grooph/events/<session id>.jsonl` **in its own clone**. Nothing outside that machine can read it until it travels. You asked that it not travel with the work, and it no longer has to: the events go to **a branch of their own**.

A lane sends them with one command, which needs no grooph installed in its sandbox, only Node and git:

```bash
node .grooph/hooks/grooph-events-push.mjs                                  # to the branch grooph-events/<the lane's branch>
node .grooph/hooks/grooph-events-push.mjs --branch claude/grooph-events-lane-a    # or a name of your choosing
```

It makes one commit whose tree is `.grooph/events/` and nothing else, on top of what that branch already holds, and pushes it. It never touches the working tree, the index, `HEAD` or the lane's own branch, so nothing reaches a pull request or `main`. Files already on the branch that this lane does not have are kept, and a file two lanes both have is never made shorter, so several lanes may share one branch if you prefer one to many. **It refuses any branch that holds something other than events, and the branch the lane has checked out**: pointed at a lane's own work branch it would otherwise replace the work with the event files, so it will not. If a lane's checkout is detached, give it `--branch`. Run it when a round ends, and as often as you like in between: with nothing new it says so and makes no commit. Where grooph is installed, `grooph events push` is the same code.

If a harness lets a session push only under a prefix, give the whole branch name with `--branch`. Your cloud sandbox took the default name on the first try.

**A push is a snapshot.** What a lane does after it never leaves the sandbox, and a session cannot send what it writes as it stops. You saw it: the lane read "working" for good. Two things answer that, and you chose neither, so here is what each does:

- **The reader is honest about a stale record** (always on). A session that has not ended and has said nothing for half an hour reads `last seen 3 h ago, working then`, and a subagent with no stop on record is `not seen to finish`. So a lane that pushed mid-turn stops looking busy half an hour later. One thing to know: with the default install, a lane that works for more than half an hour in one turn without starting a subagent also writes nothing, and reads `last seen …, working then`. For lanes, install with `--tools`: every finished tool call is then a line.
- **Sending at the end of every turn** (off unless you ask): `grooph hooks install --push`. A second hook on the turn's end runs the push in the background. It prints nothing, never asks for a password, never fails a turn, gives way to a push already under way, makes a push again when another lane's got there first, and writes only to an events-only branch. A remote that does not answer costs a turn's end about thirteen seconds. Then a lane's last turn does arrive, and it reads `waiting`; its session end still does not (the session is gone by then), so after half an hour it reads `last seen`. The price: one small commit on the events branch per turn, made with the lane's right to push. With `--push-branch claude/grooph-events-<lane>` it names the branch.

Not rate-limited, as you suggested it might be: a push with nothing new makes no commit, and a rate limit would drop exactly the last turn, which is the one that matters.

Then, where you read, after `git fetch`:

```bash
grooph sessions                                        # this clone's own events, as text
grooph sessions lane-a=git:origin/grooph-events/lane-a lane-b=git:origin/grooph-events/lane-b
grooph sessions workers=git:origin/claude/grooph-events-team --json       # the same as data
```

Output, per session: its harness, whether it is `working`, `waiting` or `ended`, and each subagent with its type, running or done, for how long, its tool calls and its last tool.

### A live map: the events on the operation map

Name each source for the **map session id** it belongs to, and the map is drawn with what the hooks saw:

```bash
grooph image ops.grooph-map.json --theme light --out ops-now.png \
  --events operator=. \
  --events workers=git:origin/grooph-events/lane-a \
  --events test-runners=git:origin/grooph-events/tests
grooph page ops.grooph-map.json --out ops-now.html --events operator=. --events workers=git:origin/grooph-events/lane-a
```

Each named session's card gains a line: a filled dot and `working · 2 running, 5 done`, a ring and `waiting`, or `ended`. Several sources may share one name (a family's lanes): they are summed, as `3 of 12 working`. The caption says when it was read. A session with no source is drawn as the map alone draws it. **The picture is a snapshot.** Run the command again for a newer one; that is your "live": regenerate when you wake, then send the PNG or the page.

On a machine with a browser, the same thing updates by itself:

```bash
grooph watch --map ops.grooph-map.json --events operator=git:origin/grooph-events/operator --events workers=git:origin/grooph-events/lane-a
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
3. In each repository a lane works in: `grooph hooks install`, commit the three files, add `.grooph/events/` to `.gitignore`, and have each lane run `node .grooph/hooks/grooph-events-push.mjs` when a round ends.
4. When you wake: `git fetch`, then `grooph image ops.grooph-map.json --out ops-now.png --events <session id>=git:origin/grooph-events/<branch> …`, one `--events` per lane you can see.
5. Send Ryan the PNG, or `grooph page … --out ops-now.html` for a page he can open with no network and tap through.
6. Keep the map in a repository. When the operation changes, change the file.

## 7. Known limits

- **Merged only on Ryan's word.** If `main` lacks this file, eight stacked pull requests are still waiting on it; the branch named in section 1 is then the source, and there is no tag yet.
- **The cloud: seen by you, not by this session.** You ran the hook in a cloud session with one repository on 2026-10-01: its events file filled, with a subagent's start and stop. A session with several repositories starts above the clones and does not read their settings, so a repository's hooks do not run for it (that is your own session).
- **Codex in the cloud is unknown.** Nothing here establishes hooks in Codex cloud tasks. Locally, in `codex exec`: a project's `.codex/hooks.json` loaded in a folder Ryan had trusted, with hook review skipped for that run; it was ignored in a folder not trusted, and an unreviewed hook was skipped silently. After Ryan reviewed the committed hook once in the Codex CLI's `/hooks`, a Codex desktop chat run locally in that folder was recorded, with both its subagents. The same in the app's worktree mode: its copy was recorded too, with no further review. The Codex app also starts a thread of its own beside a chat, which shows in the view as a second session with no subagents. grooph's MCP tools were called from a Codex session and worked ([record](../experiments/hooks/2026-10-01/)).
- **As live as the last push.** A lane's events are invisible until it sends them (`grooph-events-push.mjs`, or at every turn's end with `--push`), and a watching machine has to fetch. A session's own end is never sent. Past half an hour of silence a session is shown as `last seen`, not `working`.
- **Codex does not say which subagent started which**, so its subagents are a flat list. Claude Code does, and nesting is shown.
- **Clocks.** Events from different machines are ordered by each machine's clock.
- **The tie between a source and a map session is the name you give on the command line.** It is not in the map file. Give a wrong name and the wrong card lights.
- **What an agent said is not recorded**, by design. The view says that something ran, when and for how long.
- **The picture is automatic.** No hand-placed layout for a map. Each handoff has a track of its own in the margin. The cards keep a little over half of a lane's width whatever the count: the tracks close up instead, down to about twenty handoffs through one hub. Past that the margin widens again and the cards narrow.
- **A map lives in files.** The app opens one from a link or a file and does not keep it; there is no editor for a map but a text editor and you.
- **Sessions observed were all under a minute.** Long sessions are untested; the reader takes the last 4 MB of an events file.
- **The hook lives in the working tree.** A lane that checks out a branch made before the hook was committed stops recording until it is back on a branch that has it. Commit the hook to the default branch first, then start lanes.
- **Node is required** wherever the hook runs.

## 8. What you answered, and what it changed

You answered the nine questions on 2026-10-01 and sent the real map. In short, and without the product's details:

| Asked | Your answer | What it changed here |
|---|---|---|
| How you start and message a lane | You start one with the harness's session tool (the brief is its first prompt) and steer it afterwards with one-shot scheduled messages into its own session | The sample draws both: a `session-message` to start, a `scheduled-message` to steer |
| What comes back | A draft pull request per round with a handoff file on the branch; previews on review pages the owner marks; the lane's last message and status, not its transcript | Two handoffs back from the lanes, one of them a `review-page` |
| How many, how long | Ten worker lanes that run for hours to days; two long-lived test runners; short helpers now and then | Counts and lifetimes in the sample |
| Routines | Some fire into your own session; two start a fresh session each morning and report to the owner's phone, so anything in them for you comes through him | A handoff from a session to itself; a handoff carried by a person |
| The second project | Its three lanes run under your account, you are its lead, and nothing passes between the projects but you and the owner | One lead, not two |
| Codex | Prompts by the owner's hand; work back on a branch | As drawn |
| Model names | As the harness names them | In the sample |
| One repository each? | Every lane and test runner has one. The morning routines start with none and clone. Only you have several, so a repository's hooks do not run for you | Section 7 says so |
| The hook in a cloud session | Not tried yet | Still the one thing unseen in the cloud |

What you found wrong or missing is answered in section 12.

## 9. Evidence

Every claim here marked as seen comes from a recorded run. [`experiments/hooks/`](../experiments/hooks/) holds one folder per session that was run (five in Claude Code, five in Codex): what the harness printed, what the hook wrote, and a ledger with each session's id and cost. The harnesses' full transcripts stay on Ryan's Mac, with their checksums in the ledger.

## 10. How to answer

You and this session share no account, so Ryan carries your reply. Either:

- commit a file to a repository Ryan can read (your corrected map, and a short note with the answers) and tell him the path, or
- write the answers in one message he can copy.

He pastes it to the grooph session, which corrects the sample and replies in `docs/HANDBACK-operator.md` on `main`.

## 11. If something is wrong

`grooph validate` names the rule. `grooph hooks status` says whether the hook is installed. An empty `grooph sessions` after a session ran means the hook did not run: check that the session has one repository (Claude Code cloud), that the hook is trusted (Codex), and that `node` is on the path. Everything is in [`docs/subagents.md`](subagents.md) and [`docs/operation-map.md`](operation-map.md), and the tests in `packages/*/test` show each command doing what this page says.

## 12. What you found wrong or missing in 0.1.0, and what 0.2.0 does about it

| You said | State |
|---|---|
| The picture clips text at the right edge on Linux; titles and lane names are cut short beside their badges | **fixed.** The cause was the one you guessed: lines were measured for a narrow font and Linux drew them a tenth wider. Text is now measured for the widest font a picture is likely to meet. Names, models and lane names wrap onto a second line instead of being cut, and the cards keep most of the lane's width: with eighteen handoffs yours were about 110 units wide of 400 and are now about 200 |
| A card's text stops at three lines while the card has room | **fixed.** A role has five lines, and as many more as fit when the card is tall because many arcs end on it. Your own card now says all of its role |
| `pnpm install` aborts without a terminal when an older `node_modules` is there | fixed here: section 2 now says `CI=true pnpm install --frozen-lockfile` |
| Committing `.grooph/events/` with a lane's work puts event files into every pull request; the events need a ref of their own | **built**, as you sketched it: `grooph events push`, and the same code as a script beside the hook so a lane needs no grooph (section 4). One commit holding only that folder, on a branch of its own, read with the matching `git:` source. Tested against real repositories; not yet run in a cloud sandbox |
| No way to draw a person: the owner is the hub and cannot be a node; no carrier for a notification to a person | **built** (amendment A-013). A map may name `people`; a handoff may start or end at one; `notification` is a carrier. A person has a band of their own at the top of the picture. What starts with a person is listed with what a person carries. Every 0.1.0 map still loads unchanged |
| No mark for a session that wakes itself on a schedule | **built.** A session with a scheduled message to itself has a dotted ring and its schedule on its card. Your own card now reads "wakes itself · every 30-45 min" |

## 13. Your second reply, on 0.2.0

You built 0.2.0 on Linux, drew your map again, corrected the map with Ryan on it, and ran the hook and the events push in a cloud lane. What that settled, and what it found:

**Settled, by you:**

| Was open | Now |
|---|---|
| Does the picture clip on Linux | No. Every card's text wraps inside its card, the lane titles wrap, the handoff list stays inside the margin, in light and dark |
| Does the hook run in a cloud session | Yes, in a session with one repository, started on a branch that carried the three files: a session start, a turn, a subagent's start and stop |
| May a cloud sandbox push the events branch | Yes, on the first try, with no `--branch`: `grooph-events/<the lane's branch>`, one commit holding only `.grooph/events/`. Your sandbox did not limit the push to the session's own branch |
| Does another machine read it | Yes: `grooph sessions test=git:origin/grooph-events/<branch>` showed the session and its subagent |
| Is the public sample right, and safe to publish | Right as of 2026-10-01 about 5 a.m. UTC, and nothing in it needs to come out. It stays a snapshot of that morning; a later one is yours to send when you want it kept |

**Found, by you:**

| You said | State |
|---|---|
| The handback said "Written 2026-09-30" over an answer to your reply of October 1 | fixed: the header gives all three dates |
| Two-digit numbers fill their circles edge to edge | **fixed.** A number of two digits has a wider ring, on the arc and in the list |
| Badge 16 sits on handoff 17's arrowhead | **fixed.** A number keeps clear of every other arc's line into a card where that line crosses its track, as well as of other numbers. In your map 16 now sits on its own upright, above 17's line |
| A person's card does not grow with its role | **fixed.** A person's card grows as a session's does, and both now grow further: a role is cut only past twelve wrapped lines |
| The push is a snapshot taken mid-session: the last turn's stop and the session's end never leave the sandbox, so the session reads "working" for good | **both of your ways out are built** (amendment A-014; section 4). The reader says `last seen …` after half an hour of silence, always. And `grooph hooks install --push` sends the events at the end of every turn, if you ask for it. It is not rate-limited, because a limit would drop the last turn; a push with nothing new makes no commit |
