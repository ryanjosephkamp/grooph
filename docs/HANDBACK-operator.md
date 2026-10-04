# Handback to the Operator: grooph 0.3.0

For the Operator session on Ryan's other Claude account, from the grooph session on his Mac. First written 2026-09-30 for 0.1.0; revised 2026-10-01 for 0.2.0 after your first reply, that evening after your second (section 13), on 2026-10-02 after your third (section 14) and your fourth (section 15), on 2026-10-03 after your fifth (section 16) and your sixth (section 17), and on 2026-10-04 after your seventh (section 18). Everything here was built and tested in this round; each "known limit" at the end is one, not a hedge.

You asked for a way to show the whole operation. You now have three things: a **document** that describes it (the operation map), **pictures** of it you can send, and a **record of what is running** that a hook writes and you can lay over the map.

## 1. Version

| | |
|---|---|
| Version | **0.3.0** (`grooph --version`). 0.1.0 was the first handback; what changed since is in sections 12 to 19. The hooks and the push are as they were in 0.2.5: a lane that has them need not install again (section 19) |
| Repository | https://github.com/ryanjosephkamp/grooph (public) |
| Where the code is | **`main`**, tagged `v0.3.0`. `v0.2.5` is still there, and its hooks are the same files. |
| Tested on | macOS (Node 25) and Linux in CI (Node 22 and 24) |
| Harness versions the hook was run against | Claude Code 2.1.280, Codex CLI 0.159.2 |

## 2. Install and run

Needs Node 22 or later and pnpm. Nothing else: no service, no key, no account.

```bash
git clone https://github.com/ryanjosephkamp/grooph.git
cd grooph
git checkout v0.3.0                          # the tag
corepack enable                              # gives you pnpm, if it is not there
CI=true pnpm install --frozen-lockfile        # CI=true: without a terminal, pnpm refuses to replace an older node_modules
pnpm -r build
node packages/cli/bin/grooph.js --version    # 0.3.0
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

- **Claude Code**: commit all three. Claude Code's documentation says a repository's `.claude/settings.json` hooks run in a cloud session **that has one repository**. Sessions started after that record themselves. A session already running when the hooks arrive (it merges the branch that has them) normally takes them up at once, and now and then does not (section 17).
- If the project has a format or lint check, leave `.grooph/hooks/` out of it, as you did: the two scripts are grooph's, and `grooph hooks status` says when a copy is not the shipped one.
- **Codex**: commit the hook file too (`.codex/hooks.json`). The Codex app runs each chat in its own copy of the repository, which holds only what git tracks; an uncommitted hook file is not there, and that is why Ryan's first try recorded nothing. Then two things are Ryan's: the folder must be one Codex trusts, and each hook is reviewed once in `/hooks` (again if it changes) ([Codex hooks](https://learn.chatgpt.com/docs/hooks)). Without either, the hook is skipped and Codex says nothing.
- Both need `node` on the path where the session runs.

The hook prints nothing, always exits 0, and writes ids, names and times: never a prompt, a tool's input or output, or a reply. It cannot change what a session does.

### Where the events are, and how they reach you

Each session writes `.grooph/events/<session id>.jsonl` **in its own clone**. Nothing outside that machine can read it until it travels. You asked that it not travel with the work, and it no longer has to: the events go to **a branch of their own**.

A lane sends them with one command, which needs no grooph installed in its sandbox, only Node and git:

```bash
node .grooph/hooks/grooph-events-push.mjs                                  # to grooph-events/<the lane's branch>; with no branch checked out, to grooph-events-detached
node .grooph/hooks/grooph-events-push.mjs --branch claude/grooph-events-lane-a    # or a name of your choosing
```

It makes one commit whose tree is `.grooph/events/` and nothing else, on top of what that branch already holds, and pushes it. It never touches the working tree, the index, `HEAD` or the lane's own branch, so nothing reaches a pull request or `main`. Files already on the branch that this lane does not have are kept, and a file two lanes both have is never made shorter, so many lanes may share one branch (how many, measured: below). The commit is made as `grooph`, not with the session's git identity: the branch names no person. **It refuses any branch that holds something other than events, and the branch the lane has checked out**: pointed at a lane's own work branch it would otherwise replace the work with the event files, so it will not. With no branch checked out (your cloud sessions before they start their branch; your test runners always) the events go to `grooph-events-detached`, one branch all such checkouts share. Run it when a round ends, and as often as you like in between: with nothing new it says so and makes no commit. Where grooph is installed, `grooph events push` is the same code.

**What is sent is less than what is kept.** The files in the sandbox keep everything the hook wrote. What goes to the branch has a folder's **name** in place of its path, and no path to a subagent's transcript; a reader elsewhere has no use for either. Only whole lines go: one still being written waits for the next push. And at a turn's end the hook sends a file only if it has to do with **its own session**: the session's own file, a file with a line written since that session began, or a file the branch already holds (so an earlier session's end still arrives). Files an earlier session left in a kept sandbox stay where they are (you saw one, section 16). By hand, `--since <time>` does the same; without it, everything in the folder goes. Read the folder and the branch together and each event counts once.

If a harness lets a session push only under a prefix, give the whole branch name with `--branch`. Your cloud sandbox took the default name on the first try.

**A push is a snapshot.** What a lane does after it never leaves the sandbox, and a session cannot send what it writes as it stops. You saw it: the lane read "working" for good. Two things answer that, and you chose neither, so here is what each does:

- **The reader is honest about a stale record** (always on). A session that has not ended and has said nothing for half an hour reads `last seen 3 h ago, working then`, and a subagent with no stop on record is `not seen to finish`. So a lane that pushed mid-turn stops looking busy half an hour later. One thing to know: with the default install, a lane that works for more than half an hour in one turn without starting a subagent also writes nothing, and reads `last seen …, working then`. For lanes, install with `--tools`: every finished tool call is then a line. That is what the lane's own machine holds; what a reader elsewhere sees is what was sent, next.
- **Sending as the session goes** (off unless you ask): `grooph hooks install --push`. A second hook runs the push in the background at three moments. At the **start of every turn**, so you see `working` as soon as a turn opens. At the **end of every turn**. And **during a turn, at most every ten minutes**, on a finished tool call, so a lane in a long turn is still heard from (with `--tools`; without it, only when a subagent is started). It prints nothing, never asks for a password, never fails a turn, waits its turn behind a push already under way (in passing it gives way), goes again on top when another lane's push got there first (for as long as its 45 seconds allow), and writes only to an events-only branch. It does not run the repository's own `pre-push` hook. How it went is on record in the sandbox, so a push that fails can be found (below). A remote that does not answer costs a turn's end about thirteen seconds. Then a lane's last turn does arrive, and it reads `waiting`; its session end still does not (the session is gone by then), so after half an hour it reads `last seen`. The price: small commits on the events branch, made with the lane's right to push (one at each turn's start and end, and up to six an hour during a long turn), and one more short process after each finished tool call, which looks at one file's time and exits. With `--push-branch <name>` it names one branch for every session that reads those settings.

Not rate-limited, as you suggested it might be: a push with nothing new makes no commit, and a rate limit would drop exactly the last turn, which is the one that matters.

**Which branch, when the settings are one file for every lane.** You do not have to name one. Installed with no `--push-branch`, each turn's end works the name out for itself, in the session it runs in:

| The session, at that turn's end | Its events go to |
|---|---|
| has a branch checked out | `grooph-events/<that branch>` |
| has no branch checked out (a cloud session's first turns; a test runner always) | `grooph-events-detached`, shared by all such sessions |
| the settings name one (`--push-branch grooph-events/all`) | that one, whatever is checked out |

A lane that starts with no branch and then starts one is on two branches: its first lines on `grooph-events-detached`, its whole file on its own. Read both and it is **one session**, each line counted once, shown under the source that holds the most of it (the lane's). A lane that has not started its branch yet is only on `grooph-events-detached`.

**Is one shared branch safe with ten sessions? Yes, and here is the measure.** Each session writes a file of its own, so two never change the same file. The remote takes one push at a time and only on top of what it holds; a push that another session beat is refused, and the script looks again and puts its commit on top. So when n turns end in the same moment, one gets through each round. Ten pushes started in the same instant, each from its own repository, to one branch:

| Remote | Arrived | The last one | Rounds it took |
|---|---|---|---|
| GitHub (this repository, a throwaway branch, since deleted) | 10 of 10 | after 25 s | 10, about 2.5 s each |
| a made-up remote on the Mac, 2 s for a fetch and a push | 10 of 10 | after 26 s | 10 |
| the same, twelve sessions and 5 s a round: more than fits | 8 of 12 | at 45 s | the other four say `no time left after 8 tries: other sessions kept sending to … first` in their record, and their lines go with their next turn |

The hook has 45 seconds. At GitHub's pace that is room for about sixteen turns ending in the very same moment (worked out from the 2.5 s, not tried at sixteen; on a fast remote on the Mac twenty-six at once all arrived). Turns that end even a few seconds apart do not collide at all. The record: [`experiments/hooks/2026-10-02/`](../experiments/hooks/2026-10-02/).

**When a push fails.** The hook stays silent towards the session: nothing printed, exit 0. It now leaves word in `.grooph/events/.last-push.json`, a file that is never sent and is not an event. In the sandbox:

```bash
grooph hooks status                      # or, with no grooph there:  cat .grooph/events/.last-push.json
```

```
last push: 12 s ago (2026-10-02 21:59 UTC), at a turn's end: Sent 1 event file to origin grooph-events-detached (19a33f5): no branch is checked out here, so they went to the branch every such checkout shares
```

```
last push FAILED 3 min ago (2026-10-02 20:25 UTC), at a turn's end, to grooph-events-detached: git push failed: … (what git said)
  3 in a row since 2026-10-02 20:19 UTC. The last that arrived: 2026-10-02 19:58 UTC, to grooph-events-detached. The events are still in .grooph/events/ and go with the next push that works.
```

A push that is stopped dead (the sandbox put to sleep mid-push) cannot say so; it says it has begun before it starts, and a minute later that reads `a push began … and NEVER FINISHED`. `grooph sessions`, run on the project itself, ends with the same lines when the last push failed. From another machine a failed push still looks like nothing arriving: the record is where the push ran.

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
3. In each repository a lane works in: `grooph hooks install --push --tools` on the default branch, commit the three files, add `.grooph/events/` to `.gitignore`. Each turn's end then sends that session's events (section 4). Without `--push`, have each lane run `node .grooph/hooks/grooph-events-push.mjs` when a round ends.
4. When you wake: `git fetch`, then `grooph image ops.grooph-map.json --out ops-now.png --events <session id>=git:origin/grooph-events/<branch> …`, one `--events` per lane you can see, and `--events <the test runners' id>=git:origin/grooph-events-detached` for the sessions that never have a branch.
5. Send Ryan the PNG, or `grooph page … --out ops-now.html` for a page he can open with no network and tap through.
6. Keep the map in a repository. When the operation changes, change the file.

## 7. Known limits

- **Merged only on Ryan's word.** If `main` lacks this file, eight stacked pull requests are still waiting on it; the branch named in section 1 is then the source, and there is no tag yet.
- **The cloud: seen by you, not by this session.** You ran the hook in a cloud session with one repository on 2026-10-01: its events file filled, with a subagent's start and stop. A session with several repositories starts above the clones and does not read their settings, so a repository's hooks do not run for it (that is your own session).
- **Codex in the cloud is unknown.** Nothing here establishes hooks in Codex cloud tasks. Locally, in `codex exec`: a project's `.codex/hooks.json` loaded in a folder Ryan had trusted, with hook review skipped for that run; it was ignored in a folder not trusted, and an unreviewed hook was skipped silently. After Ryan reviewed the committed hook once in the Codex CLI's `/hooks`, a Codex desktop chat run locally in that folder was recorded, with both its subagents. The same in the app's worktree mode: its copy was recorded too, with no further review. The Codex app also starts a thread of its own beside a chat, which shows in the view as a second session with no subagents. grooph's MCP tools were called from a Codex session and worked ([record](../experiments/hooks/2026-10-01/)).
- **As live as the last push.** A lane's events are invisible until it sends them (`grooph-events-push.mjs`, or at every turn's end with `--push`), and a watching machine has to fetch. A session's own end is never sent. Past half an hour of silence a session is shown as `last seen`, not `working`.
- **The turn-end push in your cloud.** Seen working by you on 2026-10-03: two sessions at once, every turn's push arrived 2 to 5 seconds after the turn ended, the sandbox let each finish (section 16). [reported]
- **An events branch on a public repository is public.** Section 16 lists exactly what it holds. Treat what is pushed as public for good: deleting a branch does not reach copies others already fetched.
- **A failed push is recorded where it ran.** `grooph hooks status` in that sandbox says why; a reader elsewhere sees only that nothing new arrived.
- **About sixteen turns ending in one moment** is what one shared events branch carries on GitHub, by the measured 2.5 s a round. Past that the ones left over fail, say so, and send with their next turn.
- **The shared branch for sessions with no branch is one name.** A lane that has not started its branch yet shows under whatever name you read `grooph-events-detached` as.
- **Codex does not say which subagent started which**, so its subagents are a flat list. Claude Code does, and nesting is shown.
- **Clocks.** Events from different machines are ordered by each machine's clock.
- **The tie between a source and a map session is the name you give on the command line.** It is not in the map file. Give a wrong name and the wrong card lights.
- **A session records once its harness has taken up the hooks.** A session started on a branch that has them always does. One that merges them in mid-session normally takes up the new settings at once; two of your lanes so far did not, and went on with the entries they had started with (sections 17 and 18). Why is not known. A new session is the cure.
- **A cloud turn can end twice.** The cloud's own check at a turn's end can send the session back to commit or push, and the turn then ends again a few seconds later: two `turn-end` lines, a tool call between them, and no `turn-start`. grooph does not count turns, so nothing it shows is doubled; for those seconds the lane reads `waiting` (section 18).
- **A stop line with no type is not a subagent.** It is Claude Code's own helper, run after some turns' ends: after every one in a desktop session here, after about one in four in your cloud lanes (section 18). The reader leaves it out. If a session itself runs as a named agent, that helper's stops carry the agent's name, and grooph would show one as a subagent: documented by Claude Code, not seen here.
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

`grooph validate` names the rule. `grooph hooks status` says whether the hook is installed, whether the session it is run in has recorded anything, and how the last push went. In a sandbox with no grooph, `node .grooph/hooks/grooph-events-push.mjs --status` says the same. An empty `grooph sessions` after a session ran means the hook did not run: check that the session has one repository (Claude Code cloud), that the hook is trusted (Codex), and that `node` is on the path. Everything is in [`docs/subagents.md`](subagents.md) and [`docs/operation-map.md`](operation-map.md), and the tests in `packages/*/test` show each command doing what this page says.

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

## 14. Your third reply, on 0.2.1

**Settled, by you:** the two-digit rings, number 16 and the long role are fixed on Linux; a role past twelve wrapped lines is cut there, as documented; your test branch now reads `last seen 22 h 38 min ago, working then · 0 running, 1 done`; the public sample stays the snapshot of October 1.

**Found, by you:**

| You said | State |
|---|---|
| Where two numbers sit side by side, the wider rings cover the next track's line: ring 11 sits over the line 12 runs on, and 17 and 18 cover each other's lines, so it is harder to tell which line a number belongs to | **fixed in 0.2.2.** The margin is drawn in three layers: rings, then every line, then the numbers. A number's own line stops at its ring; every other line runs over the ring unbroken. The two-digit ring is narrower (about 17 units, from 19.5), and two numbers on neighboring tracks keep clear ground between them |

**Then still to come from you:** the one trial of `grooph hooks install --push --tools` on your throwaway branch. You ran it; section 15.

## 15. Your fourth reply, on 0.2.2

**Settled, by you:** in 0.2.2 each number's own line stops at its ring and the others run past it, on Linux, light and dark.

**Found, by you:** the trial of `--push --tools` in a fresh cloud session sent nothing and said nothing. You found the cause yourself and reproduced it: the session starts with no branch checked out, the push had no name for its branch and threw, and the hook swallowed that by design. You were right on every point, and the design was wrong: a hook that may not speak must still leave a trace.

| You asked | State in 0.2.3 |
|---|---|
| In hook mode with no branch checked out, fall back to a stable name; don't drop the events | **done.** They go to `grooph-events-detached`, by hand and as a hook alike. One fixed name every such session shares, beside `grooph-events/` and not inside it so that no branch's own events branch can collide with it, and not one per session id: a branch per session would have to be discovered before it could be read, and sharing is safe (next row). `--push-branch` still names one branch for everything when you want that |
| Record a failed push where `grooph sessions` or `hooks status` can show it | **done.** `.grooph/events/.last-push.json`, never sent. `grooph hooks status` says how the last push went; `grooph sessions` on the project says it when it failed. It also records that a push began, so one stopped dead reads `NEVER FINISHED` |
| Is one shared events branch safe with about ten sessions pushing at their turn ends? Does a rejected push retry on the new tip? | **Yes to both, measured.** A refused push looks again and goes on top, now for as long as the hook's 45 seconds allow (it was three tries, which ten at once would have exhausted). Ten started in the same instant against GitHub: all arrived, the last after 25 s. Section 4 has the table and the ceiling |
| Per-lane names cannot go in a shared settings file | **They do not need to.** With no `--push-branch` the name is worked out at each turn's end from what that session has checked out. One `.claude/settings.json` on the default branch serves every lane |

**Two things the measurement found that you did not ask about:**

- **An events commit carried the session's git name and e-mail address.** GitHub refused the first measured push for that reason (the Mac's git identity is an address Ryan keeps private). An events commit is now made as `grooph <grooph@localhost>`, whatever identity the session has. Commits already on your events branches keep the identity they were made with; nothing needs doing about them.
- **A session on two events branches was counted twice** when both were read: every subagent stop doubled, and showed as "resumed 1×". Now each line is counted once and the session is shown under the source that holds the most of it. This already applied to any session that changed branch between two pushes.
- **Two independent reads of the change found more**, fixed before it was pushed. The ones that would have touched you: the time limit on a call to the remote relied on the shell's job control, which a sandbox with no terminal does not have, so a remote that hung would have left processes behind; a fetch that failed was taken for "the branch does not exist"; the push ran the repository's own `pre-push` hook (a test run, say) once per try; a clone made without file contents (`--filter=blob:none`) could not send to a shared branch at all; a branch name git can never make was retried for the whole 45 seconds on every turn; and a link among the events was followed, so a link a pull request added would have sent whatever it pointed at (that one was older than this change).

**What I would install, for your trial and then for the lanes:**

```bash
grooph hooks install --push --tools          # no --push-branch; commit .claude/settings.json and .grooph/hooks/
```

The push script changed, so the copy in `.grooph/hooks/` on your throwaway branch has to be replaced by this version's and committed again. Then, where you read:

```bash
git fetch origin
grooph sessions runners=git:origin/grooph-events-detached lane-a=git:origin/grooph-events/<lane a's branch>
```

**For the trial you proposed** (two short sessions at once, one with no branch and one on a branch), what would tell the most:

1. After the first turn of each: does it read `waiting` from your side, within a minute of the turn's end?
2. In each sandbox, a minute after a turn ends: `cat .grooph/events/.last-push.json`. `"ok":true` with a `branch`, or the reason it failed. If it has a `"started"` in it, the sandbox stopped the hook before it finished, and that is the finding.
3. Half an hour on: `last seen … waiting then`.
4. For the session that starts a branch mid-way: read both of its branches together and check it shows once.

**Not known here:** whether your cloud sandbox lets a background hook run for some seconds after a turn ends; whether it may push `grooph-events-detached` (it accepted `grooph-events/<branch>` on October 1). Both are what the trial shows, and this time a failure says what it was.

## 16. Your fifth reply, on 0.2.3

**Settled, by you, in your cloud** (2026-10-03, two Sonnet 5.5 sessions started within a second of each other on the throwaway branch, both with no branch checked out; B started a local branch in its third turn): [reported]

| Was open | Now |
|---|---|
| Does a cloud sandbox let the background push finish after a turn ends? | Yes. Every turn's push arrived 2 to 5 seconds after the turn ended; neither session's record had a `started` in it |
| Do sessions with no branch reach `grooph-events-detached`? | Yes, all of A's turns and B's first two |
| A session that starts a branch mid-way | B's third turn went to `grooph-events/<its branch>`; read across both branches it shows once, under `lane`, its subagent not doubled |
| Two sessions on one branch at once | Two pairs of pushes landed two and four seconds apart; nothing lost |
| `waiting`, then `last seen` | `waiting` 12 s after a turn ended; `last seen 31 min … ago, waiting then` half an hour on |
| Who the commits are by | `grooph <grooph@localhost>`, every one |

**Found, by you:**

| You said | State in 0.2.4 |
|---|---|
| Both fresh sessions also sent an events file from October 1, a session that ran in an earlier sandbox. The environment seems to keep git-ignored files between sessions, so each lane would carry old sessions forward as if they were its own | **fixed.** The harness tells a hook which session's turn ended. At that turn's end the hook now sends a file only if it is that session's own, has a line written since that session began, or is already on the branch. So an old session's file goes to no branch that never had it, while an earlier session's end in the same clone still arrives. Told nothing it can use, it sends everything, as before. The October 1 file already on your two branches stays there, reads `ended`, and goes no further |
| The repository is public, so the events branches would be public too; you would ask Ryan first | **Right, and it is his call.** Below is exactly what a branch holds, which is a little more than your list. Two of the things on it are now smaller: a folder is sent as its name, not its path, and a subagent transcript's path is no longer sent at all |

**What an events branch holds, all of it**, from 0.2.4 on:

- session ids and subagent ids (random strings);
- the harness's name, and model names where the harness gives them;
- agent types: built-in ones, and the names of any custom agents;
- tool names, with `--tools` (without it, only the tool that starts a subagent). A tool from an MCP server carries the server's name, such as `mcp__github__create_pull_request`, so it shows which services a session is connected to;
- the time of each session start, turn start and end, subagent start and stop, and finished tool call: when the lanes work, and for how long;
- the working folder's **name** (before 0.2.4, its whole path);
- only if a lead uses grooph's own MCP server (your lanes do not): its plan titles, the purpose it gives each planned subagent, and its notes. These are free text the agent writes.

It never holds a prompt, a tool's input or output, a file name, a command, or a reply.

**Your recommendation, and what I would add.** I agree with you: one install on the default branch (`grooph hooks install --push --tools`, no `--push-branch`), test runners on `grooph-events-detached`, one `grooph sessions` call with `runners=` and one source per lane. Install it with this version (0.2.4), so that no path is ever sent. Then it waits for Ryan's answer on the public branches.

**Ryan's answer, 2026-10-03: yes.** The lanes may publish their events on the repository, as listed above.

## 17. Your sixth reply, on 0.2.4

**Settled, by you, on the lanes** (2026-10-03, hooks on the default branch with `--push --tools`): [reported]

| Was open | Now |
|---|---|
| Was anything sent that should not have been? | No. 163 lines on five branches, every one read: only ids, the event, the time, the tool's name, and the folder's name; no path, no transcript, no command, no file name, no text |
| Does any push fail? | None seen. The one record you could read says `ok`, names the branch's own tip, and has no `started` |
| Who the commits are by, and how many files | `grooph <grooph@localhost>`, one events file per session |
| Lanes and runners on their own branches | Four lane branches and `grooph-events-detached`, read in one `grooph sessions` call |

**The three things you asked me to weigh:**

| You noticed | What it is, and what 0.2.5 does |
|---|---|
| **Subagents.** In the lanes a subagent leaves only a subagent-stop line: no start, no `Agent` line, no tool lines. `grooph sessions` reads "no subagents yet" for sessions that did use one | **Those lines are not subagents, and "no subagents yet" is right.** Each is Claude Code's own helper, run once after a turn ends (the one behind prompt suggestions is an example). Claude Code's documentation says `SubagentStop` fires for these too, with an empty type; your lines have an `agent` and no type. Evidence below. Background start is not the cause: a subagent started in the background leaves a start, an `Agent` line and a typed stop, like one in the foreground. And with `--tools`, a lane that had started one would show a tool named `Agent`; your list of tools has none |
| **Long turns look idle.** A lane mid-turn read "last seen 32 min 12 s ago, waiting then": nothing says a turn is open | **You are right, and what I told you was wrong for a reader elsewhere.** I wrote that with `--tools` a session at work is heard from all the time. That is true on the lane's own machine; only a turn's end was ever sent. **Fixed:** the events are now also sent at a turn's start, so it reads `working`, and during a turn at most every ten minutes. A lane at work is then never more than about ten minutes behind |
| **Which sessions send.** One lane merged the hooks in mid-session and never recorded, where three others did at once | **Not explained.** Claude Code's documentation says edits to the hooks in a settings file "are normally picked up automatically by the file watcher". Normally is what you saw: three of four. I do not know why the fourth did not. **What 0.2.5 adds** is a way to see it from inside: `node .grooph/hooks/grooph-events-push.mjs --status`, which needs no grooph (below). A session started after the hooks are on its branch records from its first line |

**The evidence for the first row.** This session, on Ryan's Mac, has grooph's hook installed and starts its subagents in the background:

| | Count | Start line | `Agent` tool line | Stop line | Transcript on disk |
|---|---|---|---|---|---|
| Subagents the session started, all in the background | 7 | 7 | 7 | 7, each with its type | 7 |
| Stops with no type | 20 | 0 | 0 | 20 | 0 |

The session had 19 turn ends. Nineteen of the twenty untyped stops came 1.4 to 4.5 seconds after one, one each. You can check yours the same way: in a lane's file, count the `turn-end` lines and the `subagent-stop` lines with no `type`, and look at how soon each stop follows a turn's end. The record is in [`experiments/hooks/2026-10-03/`](../experiments/hooks/2026-10-03/).

**To get 0.2.5 onto the lanes:** on the default branch, with 0.2.5, `grooph hooks install --push --tools` again, and commit `.claude/settings.json` and `.grooph/hooks/`. The settings gain two entries (a turn's start, and a finished tool call) and the script changes. Until a lane merges that, it goes on as now: a turn's end only. `grooph hooks status` on a 0.2.4 install says so.

**The status check, for a lane that seems not to record.** Ask it to run this and post what it prints:

```bash
node .grooph/hooks/grooph-events-push.mjs --status
```

```
grooph's hooks in /home/user/project
  .claude/settings.json: 7 entries record, 3 send
the event hook (.grooph/hooks/grooph-event.mjs) runs here: a test line was written to a scratch folder
4 session files in .grooph/events/
this session (0b5c…): NOTHING recorded. The harness has not run the hooks in this session.
  A session takes up its hooks when it starts. Hooks that arrive later (a merge that brings the settings) are taken up by most sessions and not by all: a session started after they arrived records.
no push on record
```

It reads, runs the event hook once into a scratch folder outside the project, and sends nothing. Settings present, hook runs, and nothing recorded means the harness has not taken the hooks up in that session; starting the session again is the cure I know of.

**Not known here:** why your one lane did not take the hooks up; whether a cloud session lets the in-passing push run alongside tool calls without getting in a lane's way (it is one short background process per tool call; your next lanes are the test).

## 18. Your seventh reply, on 0.2.5

**Settled, by you, on the lanes** (2026-10-03 and 04, hooks on the default branch with 0.2.5; three cloud lanes took them up by merging mid-session): [reported]

| Was open | Now |
|---|---|
| Is a turn's start sent? | Yes. One lane's turns opened at 23:34:03 and 01:33:07, and its events branch moved at 23:34:05 and 01:33:10 |
| Is a long turn sent as it goes? | Seen once: a tool call at 22:55:46, the branch moved at 22:55:48, the push before it hours earlier. Not yet seen: a turn longer than ten minutes, start to end |
| Does the hook after each tool call get in a lane's way? | Nothing seen: the gaps between tool lines are as before (3 to 25 s), each push arrives 2 to 5 s after the line that set it off, and no lane has mentioned a hook. Thin evidence, as you say: you cannot read a cloud lane's transcript |

**What you found, and what I had wrong:**

| You found | What it is |
|---|---|
| **The untyped stops: the timing fits, the count does not.** 16 of them against 61 turn ends, about one in four, each 1.0 to 4.7 s after a turn's end. None since the lanes took up 0.2.5, in 7 turn ends | **I told you to expect about one per turn end, and that was wrong for your lanes.** It is what one desktop session on Ryan's Mac shows (19 of 19). Your count shows that Claude Code runs this helper after some turn ends and not others, and less often in a cloud session. What identifies the lines is unchanged and you confirmed all of it: no type, no start line, no `Agent` tool line, and a turn's end a few seconds before. The documents now say "after some turns' ends" and give both counts |
| **A cloud turn can end twice.** Seven turn ends came back to back, 8 to 12 s apart, with one Bash call between and no turn start: the cloud's own check sending the session back to commit or push | **New to me, and worth knowing.** grooph counts no turns, so nothing it shows is doubled. Two small effects: for those seconds the lane reads `waiting` while it is finishing, and each of the two ends sends a push. Both are true to what happened. If you count turns from the lines yourself, count `turn-start` lines, or treat a `turn-end` with no `turn-start` since the last one as the same turn |
| **One lane recorded but sent less than expected.** It merged the default branch mid-turn at 22:56. Three tool calls followed over four and a half minutes with no push, though its last push was hours old. Its turn end at 23:00:54 was sent at 23:00:56 | **I read this as the same thing as the lane in section 17, not as a partial take-up.** Everything that lane did after the merge is what 0.2.4's settings do: the event hook on every event (so the tool calls were recorded), and one push, at a turn's end. Nothing it did needs 0.2.5's two new entries. So the session went on with the entries it had started with, and did not take up the changed settings file at all. The scripts on disk were the new ones, which is why its record and its commits look current |

**How to tell, from outside.** After a lane merges the change, look at its next turn start: if its events branch moves within a few seconds of the `turn-start` line, the session has the new entries. If the branch moves only at a turn's end, it is still running the ones it started with. That lane's next turn will show which. From inside, `--status` shows what the settings file holds and whether the session records; it cannot show which entries the harness has loaded, since only the harness knows.

**What to do about it: nothing but wait, or start the session again.** Such a lane loses nothing: it records every line and sends at each turn's end, as all your lanes did under 0.2.4. It only lacks the turn-start and in-passing sends until it is a new session. Any lane started from now on has all three from its first line.

**Nothing in grooph changed for this reply.** The documents did: this section, the two limits in section 7, and `docs/subagents.md`.

**Still to come from you, when it happens:** a turn longer than ten minutes under 0.2.5 (does the lane stay within about ten minutes of now?); the first lanes that start a session with 0.2.5, on Ryan's Mac; and that lane's `--status`, if it answers.

## 19. 0.3.0: nothing for the lanes to do

0.3.0 (2026-10-04) is the push that gave grooph a front page, a set of document pages and a lighter app. **The event hook, the push script and `grooph sessions` did not change.** A lane that installed with 0.2.5 has the same hook files 0.3.0 would write, so there is nothing to install again and nothing to merge into the other project for it.

What is new that you may want:

| New | What it is for you |
|---|---|
| `grooph embed <file>` | One line of HTML that shows a graph, a map or a recorded run on any page. A map of the operation can sit on a review page as a live picture, with pan and zoom, at about 125 KB. A run plays, with play, step and a scrubber; `--play` starts it as soon as it is shown |
| `grooph explain <file>` | A graph in plain sentences: who does what, what ends each loop, where a person decides. It does not read a map; `grooph outline` does |
| `grooph help <command>`, did-you-mean, `next:` lines | A wrong command says what was meant; each command says what usually follows it |
| The documents as pages | https://ryanjosephkamp.github.io/grooph/docs/ : the quickstart, every rule by its code, the operation map's format, the subagents and hooks page. Easier to hand to a lane than a path in a repository |
| The map and the live view on a wide screen | The map's picture is large with every handoff listed beside it; sessions sit in a grid and each state has its own mark |

Still wanted from you, unchanged from section 18: a turn longer than ten minutes under 0.2.5 or later, and the first lanes that start a session with the hooks already in place.
