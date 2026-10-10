# The watching check: what the runs showed

The protocol is [`README.md`](README.md), written before any run. This page is its record: thirty-six runs on 2026-10-10, started by the owner from a terminal, one block at a time. **It has not been read by a second harness.** Nothing here is a claim about grooph until it has been (decision 0024); it is what the records hold.

Every number below comes from a run's own record under `sonnet/`, `opus/` and `haiku/`, and the tables are made from those records by [`tables.mjs`](tables.mjs), which CI runs with `--check`.

## In short

- **All thirty-six runs ended by themselves, and every record is whole.** $16.72 by the list price the harness reports ($4.17, $9.42 and $3.14 for the three blocks, each rounded), of a cap of $140.00. The clean profile's first call, made first, cost $0.35 and held on every check.
- **Thirty-five of the thirty-six sessions used no subagent.** The tasks were small enough that a session did them itself, the wide one included. So this check says little about sessions that delegate, which is what the product is for.
- **The recorder loaded and wrote its file in all twenty-four watched runs.** In the one run with subagents, its file has four starts and four stops for the four subagents the harness's transcripts show, and no line for anything else.
- **Unseen-test scores overlap between the plain arm and each watched arm, on both tasks, in every block.**
- **Cost differs between arms in both directions, by amounts about the size of the spread between two runs of one arm.** By the protocol's rule these are reported as differences, below.
- **A watched session can see the recorder's files, and Opus looked.** In three of its four narrow watched runs it made calls that named them, and in one it wrote about them in its own review file and its final reply. Nothing of the recorder's was changed.
- **Nobody used the two tools.** No invited session called either or searched for them, the one that used subagents included.

## What each question got for an answer

**1. Does installing the recorder change what a session does?** Not in its score, by the protocol's rule: between plain and watched the unseen-test results overlap on both tasks in all three blocks. In cost, the rule gives a different answer in each block. On Sonnet the two watched runs of the wide task cost more than the two plain ones ($0.54 and $0.64 against $0.47 and $0.53); on Opus the ranges overlap on both tasks; on Haiku the two watched runs of the narrow task cost less than the two plain ones ($0.09 and $0.10 against $0.13 and $0.15). The differences run both ways, and in each case the gap between the two arms' ranges is smaller than the spread between two plain runs elsewhere in the same block. Two runs an arm cannot say more.

What the recorder does change is what is in the folder. Its files were shown to the session in tool results in sixteen of the twenty-four watched runs (a listing or `git status`). Sonnet and Haiku never made a call that named them. Opus did in three of its four narrow watched runs: one or two calls each, one of them an edit of its own review file, which says of the events file that it is "a session log written by the project's own hook", and its final reply says "I left it alone." So with the hook installed inside the project, watching is not invisible to a strong model: it takes a little of its attention and can appear in what it writes.

**2. What does the invitation cost, and does it change what the model chooses?** Every invited session was handed 2,071 characters of the server's own instructions, which name neither tool, and was named exactly the two tools: the cut the harness documents, seen. No invited session searched for a tool or called one. Between watched and invited, cost and score overlap on both tasks on Sonnet and on Opus. On Haiku there are two exceptions: on the narrow task the watched runs passed 52 and 52 of 70 and the invited runs 48 and 46; and on the wide task the invited runs cost more ($0.39 and $0.52 against $0.29 and $0.33), the dearer of them being the one run that used subagents.

The one session that used subagents was an invited one (`haiku/four/invited-1`: four `general-purpose` subagents in the background, one for each package). Its twin, `haiku/four/invited-2`, used none, and so did every other run. One run cannot say whether the invitation had anything to do with it. That session did not use the tools it was invited to use.

**3. Is the record true?** Where there was something to record, yes, once: four subagents in the transcripts, four starts and four stops in the hook's file, none missing and none extra. In the other twenty-three watched runs the hook wrote a file with no subagent lines, and the transcripts show no subagent. That is one run's worth of evidence about subagents.

**4. What a model does with subagents when it is allowed to and told nothing about how.** On these tasks: nothing, thirty-five times of thirty-six. Sonnet 5.5 and Opus 5.5 did four independent packages one after another in three to six minutes. Haiku split them among four subagents in one of its six runs of the wide task.

## What this cannot say

- Anything about a session that delegates as a matter of course. That needs tasks that call for it, and this check had none.
- Anything small. There are two runs an arm in each block.
- Anything about Haiku 5.5. The short name `haiku`, left to the harness, was answered by `claude-haiku-4-5-20251001` in every run of that block: that is what version 2.1.289 of the harness makes the name mean.
- Anything about another harness, a session a person is typing into, a run of hours, or an agent team. Every session was headless, sandboxed, in the clean profile, under Claude Code 2.1.289.

## What follows for the product

- **Install the recorder outside the project.** A hook at the user's level, with its events kept outside the working folder, leaves nothing in the folder for a session to notice. That removes the one effect this check did see.
- **The two tools, as shipped, are not picked up.** The server's one sentence for a session's lead does not arrive (it lies past the 2,048 characters the harness hands over), and what does arrive is about authoring graphs. What a session may say needs a short server of its own.
- **The next look needs work that calls for subagents.** What a model chooses, and whether the record of it is true, can only be seen where it chooses something.

## The thirty-six runs

In each table: cost is the harness's own figure; minutes are by the runner's clock; "unseen tests passed" is the package's hidden suite, and for the wide task the four packages in the order `settingskit`, `textwrap`, `csvline`, `semver-mini`; the last three columns are empty where an arm has nothing to count.

### The `sonnet` block (the session's own model answered as `claude-sonnet-5-5`)

| Task | Arm | Run | Ended by | Cost | Turns | Minutes | Subagents | Unseen tests passed | Calls naming / shown the hook's files | Hook: subagent starts / stops | Searches for / calls of the two tools |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `one` | plain | 1 | the session | $0.20 | 12 | 0.6 | 0 | 55/70 |  |  |  |
| `four` | plain | 1 | the session | $0.47 | 27 | 2.82 | 0 | 44/55 · 88/88 · 73/73 · 62/62 |  |  |  |
| `one` | watched | 1 | the session | $0.11 | 10 | 0.52 | 0 | 52/70 | 0 / 2 | 0 / 0 |  |
| `four` | watched | 1 | the session | $0.54 | 31 | 3.03 | 0 | 44/55 · 88/88 · 73/73 · 62/62 | 0 / 0 | 0 / 0 |  |
| `one` | invited | 1 | the session | $0.11 | 10 | 0.52 | 0 | 52/70 | 0 / 2 | 0 / 0 | 0 / 0 |
| `four` | invited | 1 | the session | $0.59 | 27 | 3.55 | 0 | 44/55 · 88/88 · 73/73 · 62/62 | 0 / 0 | 0 / 0 | 0 / 0 |
| `one` | plain | 2 | the session | $0.11 | 10 | 0.48 | 0 | 52/70 |  |  |  |
| `four` | plain | 2 | the session | $0.53 | 31 | 3 | 0 | 51/55 · 88/88 · 73/73 · 62/62 |  |  |  |
| `one` | watched | 2 | the session | $0.14 | 8 | 0.65 | 0 | 52/70 | 0 / 0 | 0 / 0 |  |
| `four` | watched | 2 | the session | $0.64 | 32 | 3.68 | 0 | 44/55 · 88/88 · 73/73 · 62/62 | 0 / 0 | 0 / 0 |  |
| `one` | invited | 2 | the session | $0.12 | 10 | 0.5 | 0 | 52/70 | 0 / 2 | 0 / 0 | 0 / 0 |
| `four` | invited | 2 | the session | $0.60 | 28 | 3.8 | 0 | 44/55 · 88/88 · 73/73 · 62/62 | 0 / 0 | 0 / 0 | 0 / 0 |

### The `opus` block (the session's own model answered as `claude-opus-5-5`)

| Task | Arm | Run | Ended by | Cost | Turns | Minutes | Subagents | Unseen tests passed | Calls naming / shown the hook's files | Hook: subagent starts / stops | Searches for / calls of the two tools |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `one` | plain | 1 | the session | $0.35 | 12 | 1.28 | 0 | 52/70 |  |  |  |
| `four` | plain | 1 | the session | $1.25 | 39 | 5.55 | 0 | 51/55 · 88/88 · 73/73 · 62/62 |  |  |  |
| `one` | watched | 1 | the session | $0.33 | 13 | 1.12 | 0 | 52/70 | 2 / 4 | 0 / 0 |  |
| `four` | watched | 1 | the session | $1.12 | 40 | 4.78 | 0 | 51/55 · 88/88 · 73/73 · 62/62 | 0 / 2 | 0 / 0 |  |
| `one` | invited | 1 | the session | $0.26 | 8 | 0.88 | 0 | 52/70 | 2 / 4 | 0 / 0 | 0 / 0 |
| `four` | invited | 1 | the session | $1.19 | 42 | 4.98 | 0 | 51/55 · 88/88 · 73/73 · 62/62 | 0 / 2 | 0 / 0 | 0 / 0 |
| `one` | plain | 2 | the session | $0.25 | 8 | 0.9 | 0 | 52/70 |  |  |  |
| `four` | plain | 2 | the session | $1.50 | 51 | 6.27 | 0 | 51/55 · 88/88 · 73/73 · 62/62 |  |  |  |
| `one` | watched | 2 | the session | $0.24 | 8 | 0.87 | 0 | 52/70 | 1 / 3 | 0 / 0 |  |
| `four` | watched | 2 | the session | $1.48 | 48 | 6.05 | 0 | 51/55 · 88/88 · 73/73 · 62/62 | 0 / 2 | 0 / 0 |  |
| `one` | invited | 2 | the session | $0.21 | 7 | 0.7 | 0 | 52/70 | 0 / 2 | 0 / 0 | 0 / 0 |
| `four` | invited | 2 | the session | $1.24 | 36 | 5.6 | 0 | 51/55 · 88/88 · 73/73 · 62/62 | 0 / 2 | 0 / 0 | 0 / 0 |

### The `haiku` block (the session's own model answered as `claude-haiku-4-5-20251001`)

| Task | Arm | Run | Ended by | Cost | Turns | Minutes | Subagents | Unseen tests passed | Calls naming / shown the hook's files | Hook: subagent starts / stops | Searches for / calls of the two tools |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `one` | plain | 1 | the session | $0.13 | 13 | 0.97 | 0 | 48/70 |  |  |  |
| `four` | plain | 1 | the session | $0.32 | 50 | 2.68 | 0 | 36/55 · 88/88 · 71/73 · 61/62 |  |  |  |
| `one` | watched | 1 | the session | $0.09 | 15 | 0.97 | 0 | 52/70 | 0 / 2 | 0 / 0 |  |
| `four` | watched | 1 | the session | $0.29 | 51 | 2.17 | 0 | 36/55 · 88/88 · 68/73 · 61/62 | 0 / 0 | 0 / 0 |  |
| `one` | invited | 1 | the session | $0.10 | 19 | 1.15 | 0 | 48/70 | 0 / 2 | 0 / 0 | 0 / 0 |
| `four` | invited | 1 | the session | $0.52 | 5 | 2.75 | 4 (4 general-purpose) | 44/55 · 88/88 · 73/73 · 61/62 | 0 / 6 | 4 / 4 | 0 / 0 |
| `one` | plain | 2 | the session | $0.15 | 21 | 1.95 | 0 | 58/70 |  |  |  |
| `four` | plain | 2 | the session | $0.62 | 80 | 5.43 | 0 | 41/55 · 88/88 · 71/73 · 58/62 |  |  |  |
| `one` | watched | 2 | the session | $0.10 | 17 | 1.07 | 0 | 52/70 | 0 / 2 | 0 / 0 |  |
| `four` | watched | 2 | the session | $0.33 | 55 | 3.1 | 0 | 36/55 · 88/88 · 73/73 · 60/62 | 0 / 0 | 0 / 0 |  |
| `one` | invited | 2 | the session | $0.09 | 13 | 1.17 | 0 | 46/70 | 0 / 2 | 0 / 0 | 0 / 0 |
| `four` | invited | 2 | the session | $0.39 | 57 | 3.62 | 0 | 36/55 · 78/88 · 71/73 · 61/62 | 0 / 0 | 0 / 0 | 0 / 0 |
