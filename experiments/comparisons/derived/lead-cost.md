# Where the package's extra cost goes

**Derived on 2026-10-05 from the records of study two. It is not evidence of the runs, it has not been audited, and no model session was started to make it. The dollar rates are inferred, not taken from a price list: they are the ones that reproduce every reported per-model cost of these runs, and the split of the difference into three parts depends on them.** Every number in the tables at the end is made by [`scripts/lib/compare-lead.mjs`](../../../scripts/lib/compare-lead.mjs) from the harness's own transcripts of the six package runs (arm A) and the six runs of the same design as prose (arm B), and kept in [`lead-cost.json`](lead-cost.json): counts and kinds, no prompt, no reply, no file content. A few facts in the prose are counted straight from the kept packages, notes and digests instead, and say so.

The owner's question was what exactly makes a graph cost more than the same design given as a prompt, and whether a longer or larger run would dilute it.

## The answer

1. **On the mean, all of it is the lead.** The subagents cost the same in both arms on the mean, not in each project (A less B: −$0.008 a run; by project −$0.008, +$0.055 and −$0.071). The lead cost $0.838 a run in A and $0.314 in B. That +$0.524 is the whole difference (Tables 1 and 2).
2. **It is three things of about the same size** (Table 2).
   - **Reading the context back: +$0.179.** Every call the lead makes reads back everything so far. The package's lead made 25.5 calls a run and the prose lead 7.5. This part goes with the number of calls.
   - **Adding to the context: +$0.183.** Most of it is one thing: the brief, the graph and the agent files, 16.3 thousand tokens written to the cache once, which at $8.00 a million is $0.130. This part goes with size, not with the number of calls.
   - **Output: +$0.162.** This part goes with what the lead writes. Half of what the package's lead sends is notes and the progress file (Table 5).
3. **At four dispatches, about half of it falls before the first dispatch and at the reply, and half in the four cycles.** Before the first dispatch and at the reply: +$0.276. In the four cycles: +$0.248, which is $0.062 a cycle (Table 4). By project the first part is 50%, 53% and 55%. Every run had four dispatches, so this says where the cost fell and not how it would grow.
4. **Two items are most of it.** Reading the brief, the graph and the agent files costs $0.165 in its own calls, once, and $0.076 more in the later calls that read them back: $0.241 at four dispatches, or 46% of the difference (Table 9). Writing a node's note and the progress file costs $0.222, and repeats (Table 3).

A mean call of the package's lead cost three cents. A call that only read the clock cost a cent and a half ($0.037 over 2.5 calls). So making fewer calls, with the same things read and written, would save at most the first third.

## What each call was for

Table 3 files every call under one kind. In the order of what they add to the difference:

- **A node's note, often with the progress file: +$0.222.** 5.7 calls a run. The lead sends about 5,300 characters a run to write the notes and 5,000 to write the progress file (Table 5; the kept notes files themselves average 4,300 characters).
- **Reading the brief, the graph and the agent files: +$0.165, and $0.076 later.** 3.2 calls, all before the first dispatch. Counted from the kept packages: the lead brief is about 20,000 characters, the graph document 8,400 and the two agent files 6,700. Neither the kickoff nor the brief tells the lead to read the graph document or the agent files. The kickoff says to read the brief and copy the graph, and the brief says the agent files carry the subagents' briefs. The brief does ask the lead's dispatch prompt to carry a node's declared inputs, and those are written only in the agent file and the graph. All six leads read both agent files, and five read the graph document.
- **Amending the working copy and validating it: +$0.042.** In three of the six runs, always before the first dispatch.
- **A clock read and nothing else: +$0.037.** 2.5 calls. The lead read the clock 6 times a run. Most reads share a call with another tool use and cost almost nothing.
- **Keeping a copy of a round's report: +$0.037.** 1.5 calls. The brief asks for it before a builder is sent again.
- **Looking at the work and gathering a reviewer's evidence: +$0.029.** Both forms ask the lead for the diff and the test output as the reviewer's evidence. The package's leads took 3.8 calls a run over it and the prose leads 2.5. Two of the six package leads also saved each round's diff and test output into the run folder.
- **A `started` line and nothing else: +$0.017. Making the run folder and the working copy: +$0.014. The progress file on its own: +$0.008.**
- **Dispatching: −$0.029. The prompt as given: −$0.023.** The two places the package is cheaper. With no agent file to carry a brief, the prose lead writes the brief into every dispatch (9,600 characters a run against 6,400), and its prompt is longer.

Two kinds the driver asked about have no call of their own in any of the twelve runs. **Routing** happens inside the call that dispatches the next node. **The gate** is the lead's reply, and in arm A also a line in the last note it writes.

**Refused calls.** The harness refused 8 of the package leads' 239 tool uses and none of the prose leads'. Five calls did nothing but get refused: $0.018 a run. They are filed above by what they asked for.

**What every session starts with.** Each call also reads back 15,983 tokens that are the harness's own instructions and tool definitions. That is $0.0032 a call and $0.058 of the difference (Table 9). It is not grooph's to change.

## Where in a run it falls, and what that can say about a longer one

**Every run here had four dispatches, so a slope cannot be fitted across runs.** What can be separated is where in a run a call fell (Table 4).

- **Plainly once:** the prompt, reading the brief, the run folder and working copy, the amendments (all at the start in these runs), the first note and progress file, and the reply.
- **Plainly repeating:** the dispatch itself, the note after each node, the progress file after each node, the clock reads, and once a round the kept report.

The split is by position, so it is rough at its edges. The first node's `started` line and clock read fall before the first dispatch ($0.026 of the first part), and the run's last note and progress file fall in the fourth cycle.

The four cycles cost the package's lead $0.127, $0.118, $0.118 and $0.117: flat over four. So at four dispatches the difference is about $0.28 before the first dispatch and at the reply, and about $0.06 in each of the four cycles. That is what the records carry.

**What that would mean for a longer run is arithmetic, and Table 8 does it.** It is not a measurement. It is also not these designs, whose own stops end them at 10 or 16 dispatches: it is a design of the same shape with more nodes, with each arm held at what four dispatches showed. Nothing past four dispatches was observed.

- **If the first part is paid once, a longer run dilutes it.** By arithmetic on twelve runs of four dispatches, the package would be about 45% above the prose at 20 dispatches, against about 60% as run. From each project's runs alone that figure is 30%, 49% and 64%.
- **If the second part is paid again at each dispatch, a longer run does not dilute it.**
- **The context grows, which works the other way.** Each dispatch adds to the lead's context, and every later call reads all of it back. The package's lead adds 4,238 tokens a dispatch and makes 3.9 calls a dispatch; the prose lead adds 2,848 and makes 1.6 (Table 6). At four dispatches that is a cent.
- **Past that the arithmetic stops being a guide.** Carried to 100 dispatches it says about 74% above the prose, and from each project's runs alone 41%, 85% and 112%. But it gets there by taking the package lead's context to about 465 thousand tokens, and it has no compaction. What the harness does with a context of that size is not known here: no run came near it. A compaction would reset what is read back, at the price of a summary and of writing the new context once, and the growth term would no longer be this one.

**So the direction is: a longer run dilutes one part and compounds another, and these runs cannot say where the two cross.** The spread between projects is wide, because each rests on two runs an arm.

The first lead transcript of real length will be the game experiment's own run. The same reading could be made of it afterwards: the script would need pointing at its record, and it would start no session.

## What the prose lead did instead, and what it left out

**The same job in fewer calls.** It started dispatching on its first call: no setup. It decided each edge in the call that sent the next node, from the reply the last node had just returned. It looked at the work in 2.5 calls a run. It ended with its reply. That is 4 dispatches, 2.5 looks and 1 reply.

**What it did not do at all** (zero in all six B runs, Table 5): no run id and no run folder, no working copy, no notes, no progress file, no kept report.

**What would be missing to resume a B run from a fresh session:** which node and which round it had reached, how many dispatches it had spent against the budget, whether it had reached the gate or died before it, and what the first review said. The reviewer's report from round 0 was overwritten by round 1, so only the last one is in the final tree.

**What would be missing to audit one:** when each node started and ended and with what outcome, which stop was evaluated, and whether the lead changed the design along the way. There is no working copy for a change to show in. What a B run does leave is the final tree with the builder's own account and the last report, and the lead's reply. That is why study two's write-up calls the loop's turn "shown" in arm A and "reported" in arm B.

## Who was given what

Audit 0001 asks that every comparison carry this table (finding F12). It is from each run's recorded conditions and the kept packages and prompts.

| | Arm A, the package | Arm B, the same design as prose |
|---|---|---|
| **The lead** | The kickoff as its prompt, about 3,000 characters. It then reads the lead brief (20,000), and unasked the graph (8,400) and both agent files (6,700), from the project. The `grooph` command is on its path. It is asked to keep a run folder. | One prompt of 8,600 to 10,200 characters, derived by rule from the same package: the roles, the routing, the loop and its stops, the gate, and each node's brief. No package in the project, no command on the path, no record asked for. |
| **A builder** | A named agent. Its agent file gives it a model, a tool list, its brief, its declared inputs and outputs, a line that it dispatches nobody, and sections on what it owns, what evidence it may inspect and the form of its report. Then the lead's dispatch prompt. | A general-purpose subagent, with that subagent's own tools. It is given what the lead writes into the dispatch prompt from the prose, which carries the node's brief, inputs, outputs and capabilities. |
| **A reviewer** | A named agent in the same way, with the held-out material named by its path. | A general-purpose subagent in the same way, with the same path. |
| **The held-out material** | Reviewers were told to read it. The package's builder files also list its path among the builder's inputs and tell the builder not to read it; three of the six leads took that line out of their working copy. A scan found no builder read that names the path. A copy sits beside the project and the session's rules allow reading it, so a builder is kept from it by instruction and not by the harness. | The same. |
| **Models** | The lead on Opus 5.5 at high effort. Each node on the model its tier maps to. | The same. The prose names each role's model. |

**The two arms differ in what the lead is given and asked to keep, and in the form a builder and a reviewer get their instructions in:** a named agent with a tool list and a compiled file in A, a general-purpose subagent with a prompt the lead wrote in B (audit 0001, finding F4). The held-out material goes to the same role in both. The cost finding does not rest on the subagents being given the same thing: it is the lead's cost that differs, and the subagents' differs by −$0.008 on the mean. The other half of F12, whether the roles or the reviewer's evidence lifted both arms above the task alone, is a question about arm D, which this page does not price.

## What stage 16 would remove, by this count

Table 7 removes calls from the package's lead and leaves every other call as it was. It is arithmetic on these twelve runs, not a forecast.

- **Hook-written notes (slice 0021): by this count about a sixth, not a half.** The plan has the harness's hooks append the started, ended and ending events, and the brief then ask the lead only for what a hook cannot know. What that plainly replaces is every clock read and every write that held only `started` lines: 7 of 40.8 harness turns (17%), 3.3 whole calls (13%), $0.054 a run. The difference to the prose lead goes from $0.524 to $0.470. The plan's test for stage 16 is that the lead's turns fall by half, and by this count hooks alone do not reach it.
  - **Why so little.** Counted from the kept notes, each run holds 4 to 6 `started` lines, but the leads already fold most of them into the write of the previous node's note. One write a run held `started` lines only.
  - **It is an upper bound on that part.** Of the 28 kept `started` lines, 16 also carry text the lead wrote, and 4 are for a check the lead runs itself, where no subagent starts and no hook fires.
  - **What it cannot say.** What a rewritten brief would do to the number of notes. The plan's own test is a re-run. What the hooks leave in any case is the note itself, with the outcome, the verdict, the round and the stop, and the progress file: the $0.222.
- **The progress file rendered from the notes (not in the plan; my suggestion).** The lead rewrites it 4.5 times a run. It is nearly always in the same call as a note, so removing it removes few calls (Table 7 counts whole calls only: $0.008). Its real saving is output inside the note calls, about half of the 10,400 characters those calls send. This count cannot split one call's output between its two writes.
- **A workflow script that dispatches and keeps the record (slice 0022): a floor of $0.107 for the lead, by this count.** If a script sends the nodes and writes the record, the lead keeps the prompt, its amendments and its reply: 2.8 of 25.5 calls, below the prose lead by $0.208. That is a floor and not a forecast. It assumes the script's own bookkeeping costs no model call, it does not count the call that starts the script, and it keeps the amendments while removing the reading that made them possible.
  - **That the script keeps the record is my assumption.** The plan says only that the same graph runs from the script with the same record, and the target document speaks of routing.
  - **If the script's nodes report to the script and not to the lead, the lead's cost would stop rising with each dispatch.** Nothing is built, so that is a reading of the target document and not a finding.
  - **Amendments.** A script cannot amend the working copy mid-run. None of these six leads did: the three that amended did so before the first dispatch. A human gate has to be reachable from the script.

**Not in stage 16, and the largest item: the reading before the first dispatch, $0.241.** Table 10 splits it by file.

- **The graph document and the agent files, which nothing tells the lead to read: $0.088 a run by this count**, 17% of the difference, and from $0.036 to $0.105 by run. That is more than hook-written notes would remove, for one sentence in the brief.
- **What that reading did in these runs.** Three of the six leads amended the working copy after it, each for the same reason: the builder's declared inputs named the reviewer's held-out material, and the lead took it out. Those inputs are in the agent file and the graph, not in the brief. A lead told not to read them would not have seen it.
- **What it did not do.** No run shows routing that depended on it. The one lead that did not read the graph document dispatched builder, reviewer, builder, reviewer, as the five that did, and was the cheapest package lead of the six.
- **One thing a sentence would have to settle.** The brief asks the dispatch prompt to carry a node's declared inputs, which are written only in the files the sentence would tell the lead not to read. Either the brief lists them, or it says the agent file already gives the node its inputs.
- **The brief itself: $0.106.** About 5,400 of its 20,000 characters are the rules and operations for amending the graph, which three of six leads used. A brief that left those to be read when an amendment is wanted would be shorter by a quarter.

None of this is measured: it removes reading from runs that did read.

## What this cannot say

- **Twelve runs, three small tasks, four dispatches each, one harness version, one day, two models.** The tables give the mean of six runs. Ranges are shown only in Tables 5, 7 and 8.
- **The rates are inferred.** They are the ones that reproduce every reported cost of these runs: each run's Opus line exactly, and two Sonnet lines to within half a cent. In `review-gate-2` the Opus line is the lead alone; in the other two projects it is the lead and one Opus subagent together.
- **A call with two purposes is filed once**, by a fixed order in the script. Table 5 counts tool uses instead, and carries no cost.
- **Tables 7 and 8 are arithmetic.** Nothing was run with a hook, a script or more than four dispatches.
- **It prices the record. It does not say what the record is worth.**

## How to make it again

On the Mac that holds the transcripts: `node scripts/lib/compare-lead.mjs --write`. Anywhere: `node scripts/lib/compare-lead.mjs --check` confirms the tables below are the ones `lead-cost.json` gives.

## The tables

<!-- tables: made by scripts/lib/compare-lead.mjs from lead-cost.json; do not edit by hand -->

**Table 1. Each run: what the harness reported, and the lead's share of it.** A call is one request to the model; the harness's turns count tool uses.

| run | reported | lead | subagents | turns | lead's calls | its tool uses | dispatches | context at first dispatch | at the reply |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `review-gate-2/A-1` | $1.184 | $0.809 | $0.372 | 36 | 24 | 35 | 4 | 41,549 | 56,690 |
| `review-gate-2/A-2` | $1.230 | $0.821 | $0.409 | 41 | 28 | 40 | 4 | 39,674 | 55,528 |
| `review-gate-2/B-1` | $0.666 | $0.297 | $0.370 | 7 | 6 | 6 | 4 | 23,630 | 33,071 |
| `review-gate-2/B-2` | $0.692 | $0.260 | $0.428 | 5 | 5 | 4 | 4 | 23,658 | 31,421 |
| `heterogeneous-critic/A-1` | $1.600 | $0.780 | $0.820 | 41 | 21 | 40 | 4 | 39,334 | 57,578 |
| `heterogeneous-critic/A-2` | $1.285 | $0.642 | $0.643 | 30 | 19 | 29 | 4 | 34,855 | 49,578 |
| `heterogeneous-critic/B-1` | $1.047 | $0.365 | $0.683 | 11 | 8 | 10 | 4 | 23,709 | 38,474 |
| `heterogeneous-critic/B-2` | $1.030 | $0.359 | $0.671 | 12 | 8 | 11 | 4 | 23,829 | 38,382 |
| `taste-polish/A-1` | $1.584 | $1.055 | $0.529 | 48 | 31 | 47 | 4 | 46,347 | 66,946 |
| `taste-polish/A-2` | $1.421 | $0.924 | $0.497 | 49 | 30 | 48 | 4 | 43,606 | 60,748 |
| `taste-polish/B-1` | $0.891 | $0.300 | $0.591 | 11 | 9 | 10 | 4 | 23,287 | 34,195 |
| `taste-polish/B-2` | $0.881 | $0.305 | $0.576 | 10 | 9 | 9 | 4 | 23,325 | 34,251 |
| **mean of A** | **$1.384** | **$0.838** | **$0.545** | 40.8 | 25.5 | 39.8 | 4 | 40,894 | 57,845 |
| **mean of B** | **$0.868** | **$0.314** | **$0.553** | 9.3 | 7.5 | 8.3 | 4 | 23,573 | 34,966 |

**Table 2. A less B, by project (each the mean of two runs).** The lead's difference is then split by what was paid for.

| project | whole run | subagents | lead | lead: reading the context back | lead: adding to the context | lead: output |
|---|---:|---:|---:|---:|---:|---:|
| `review-gate-2` | +$0.527 | −$0.008 | +$0.536 | +$0.191 | +$0.191 | +$0.154 |
| `heterogeneous-critic` | +$0.404 | +$0.055 | +$0.349 | +$0.112 | +$0.121 | +$0.116 |
| `taste-polish` | +$0.616 | −$0.071 | +$0.687 | +$0.233 | +$0.237 | +$0.217 |
| **all three** | **+$0.516** | **−$0.008** | **+$0.524** | **+$0.179** | **+$0.183** | **+$0.162** |

**Table 3. The lead's calls by what each was for: the mean of a run, six runs an arm.** Tokens in thousands. A call with several tool uses is filed once, under the first kind in the script's order.

| what the call was for | A: calls | A: read back | A: added | A: output | A: cost | of that, before the first dispatch | B: calls | B: cost | A less B |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| the prompt as given, with what the harness adds to it, written to the cache once | 0 | 0.0 | 4.7 | 0.0 | $0.038 | $0.038 | 0 | $0.061 | −$0.023 |
| reading the brief, the graph and the agent files | 3.2 | 72.1 | 16.3 | 1.0 | $0.165 | $0.165 | 0 | $0.000 | +$0.165 |
| making the run folder and the working copy | 0.8 | 28.6 | 0.3 | 0.3 | $0.014 | $0.014 | 0 | $0.000 | +$0.014 |
| amending the working copy, and validating it | 1.8 | 70.9 | 1.2 | 0.9 | $0.042 | $0.042 | 0 | $0.000 | +$0.042 |
| a `started` line and nothing else | 0.8 | 31.8 | 0.6 | 0.3 | $0.017 | $0.017 | 0 | $0.000 | +$0.017 |
| a clock read and nothing else | 2.5 | 116.7 | 0.6 | 0.4 | $0.037 | $0.009 | 0 | $0.000 | +$0.037 |
| a node's note (often with the progress file) | 5.7 | 268.0 | 7.1 | 5.6 | $0.222 | $0.043 | 0 | $0.000 | +$0.222 |
| the progress file on its own | 0.3 | 14.6 | 0.2 | 0.2 | $0.008 | $0.004 | 0 | $0.000 | +$0.008 |
| keeping a copy of a round's report | 1.5 | 72.1 | 1.0 | 0.7 | $0.037 | $0.000 | 0 | $0.000 | +$0.037 |
| looking at the work, and gathering a reviewer's evidence | 3.8 | 179.3 | 2.4 | 0.9 | $0.074 | $0.000 | 2.5 | $0.045 | +$0.029 |
| dispatching a node | 4 | 185.5 | 7.4 | 3.1 | $0.158 | $0.000 | 4 | $0.187 | −$0.029 |
| the final reply | 1 | 56.1 | 0.0 | 0.8 | $0.027 | $0.000 | 1 | $0.022 | +$0.005 |
| **the lead, whole** | 25.5 | 1095.7 | 41.9 | 14.2 | **$0.838** | $0.332 | 7.5 | **$0.314** | **+$0.524** |

**Table 4. The same cost by where in the run it fell.** Setup is everything before the first dispatch, the prompt included; a cycle is one dispatch and every call after it up to the next.

| phase | A: calls | A: cost | B: calls | B: cost | A less B |
|---|---:|---:|---:|---:|---:|
| setup | 8.8 | $0.332 | 0 | $0.061 | +$0.271 |
| cycle 1 | 5.2 | $0.127 | 2.7 | $0.077 | +$0.050 |
| cycle 2 | 3.2 | $0.118 | 1 | $0.050 | +$0.067 |
| cycle 3 | 4.3 | $0.118 | 1.8 | $0.055 | +$0.063 |
| cycle 4 | 3 | $0.117 | 1 | $0.050 | +$0.068 |
| reply | 1 | $0.027 | 1 | $0.022 | +$0.005 |
| **before the first dispatch and at the reply** |  | **$0.359** |  | **$0.083** | **+$0.276** |
| **in the four cycles** |  | **$0.480** |  | **$0.232** | **+$0.248** |

Of A less B, the part that fell before the first dispatch and at the reply is 53% over all three projects, and by project 50%, 53%, 55%.

**Table 5. What the lead did, counted by tool use: the mean of a run, with the range.** Characters sent is the size of the arguments the lead wrote to make those tool uses (a note's line, a file's new text, a dispatch's prompt): where its output went.

| tool use | A | A: range | A: characters sent | B | B: range | B: characters sent |
|---|---:|---:|---:|---:|---:|---:|
| reading the brief, the graph and the agent files | 4.5 | 4 to 5 | 556 | 0 | 0 | 0 |
| making the run folder and the working copy | 3 | 3 | 262 | 0 | 0 | 0 |
| amending the working copy, and validating it | 2.2 | 0 to 6 | 858 | 0 | 0 | 0 |
| a write of `started` lines only | 1 | 0 to 2 | 346 | 0 | 0 | 0 |
| a clock read | 6 | 5 to 8 | 272 | 0 | 0 | 0 |
| a write to the notes | 5.7 | 5 to 7 | 5,334 | 0 | 0 | 0 |
| a write of the progress file | 4.5 | 3 to 6 | 5,036 | 0 | 0 | 0 |
| keeping a copy of a round's report | 1.7 | 1 to 3 | 550 | 0 | 0 | 0 |
| looking at the work, and gathering a reviewer's evidence | 7.3 | 1 to 12 | 680 | 4.3 | 0 to 7 | 272 |
| dispatching a node | 4 | 4 | 6,439 | 4 | 4 | 9,610 |
| **all** | 39.8 | 29 to 48 | 20,333 | 8.3 | 4 to 11 | 9,882 |

The harness refused 8 of arm A's 239 tool uses over the six runs and 0 of arm B's. They are counted above by what they asked for. 5 of A's calls held nothing but refused uses, and cost $0.018 a run.

**Table 6. The lead's context, and what one more call costs to read it back.** Tokens.

| arm | what every session starts with, read on every call | at the first dispatch | at the reply | added per dispatch | calls per dispatch | read-back cost of a mean call |
|---|---:|---:|---:|---:|---:|---:|
| A | 15,983 | 40,894 | 57,845 | 4,238 | 3.9 | $0.0085 |
| B | 15,983 | 23,573 | 34,966 | 2,848 | 1.6 | $0.0053 |

**Table 7. What stage 16 would take off the package's lead, by this count.** Arithmetic on the calls above, not a measurement: each line removes the tool uses and the calls named and leaves every other call as it was. The harness's turns are the tool uses and the reply.

| what goes | tool uses a run | of the harness's turns | whole calls a run | range | of the lead's calls | cost a run | A's lead after | A's lead less B's after |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| nothing (as run) | 0 | 0% | 0 | 0 | 0% | $0.000 | $0.838 | +$0.524 |
| hook-written notes (slice 0021): every clock read and every write of `started` lines only | 7 | 17% | 3.3 | 2 to 6 | 13% | $0.054 | $0.785 | +$0.470 |
| the same, and the progress file rendered from the notes (not in the plan) | 11.5 | 28% | 3.7 | 3 to 6 | 14% | $0.062 | $0.776 | +$0.462 |
| a workflow script that dispatches and keeps the record (slice 0022): everything but the prompt, the amendments and the reply | 37.7 | 92% | 22.7 | 18 to 27 | 89% | $0.732 | $0.107 | −$0.208 |

**Table 8. A design of the same shape at more dispatches: arithmetic, not a measurement.** It holds each arm at what four dispatches showed (the cost paid once, the cost of a dispatch with its subagent, the context each dispatch adds and the calls that read it back), prices the context at the cached rate at any size, and has no compaction: it is not known here at what size the harness compacts a lead's context, and a compaction would reset what is read back, at the price of a summary and of writing the new context once. No run here had more than four dispatches, and these designs' own stops end them at 10 or 16. Nothing past four dispatches was observed.

| dispatches | B | A | A less B | A above B | of the difference: held as paid once | held as paid at each dispatch | from the context growing | A's lead's context by then, in tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 4 (as run) | $0.87 | $1.38 | +$0.52 | 60% | +$0.28 | +$0.23 | +$0.01 | 57,845 |
| 20 | $4.15 | $6.01 | +$1.86 | 45% | +$0.28 | +$1.13 | +$0.45 | 125,647 |
| 100 | $24.14 | $41.92 | +$17.78 | 74% | +$0.28 | +$5.65 | +$11.85 | 464,657 |

Each dispatch adds $0.0033 to the cost of every later dispatch in A and $0.0009 in B: the calls a dispatch takes, times the context it adds, at the cached rate.

The same arithmetic from each project's four runs alone, to show how far two runs an arm can move it:

| from the runs of | A above B at 4 | at 20 | at 100 | what a dispatch adds to each later one, A over B |
|---|---:|---:|---:|---:|
| `review-gate-2` | 78% | 64% | 112% | 6.4 times |
| `heterogeneous-critic` | 39% | 30% | 41% | 2.1 times |
| `taste-polish` | 70% | 49% | 85% | 3.9 times |
| all three | 60% | 45% | 74% | 3.6 times |

**Table 9. The read-back cost again, filed by whose tokens were read and not by which call read them.** What a call adds to the context is read back by every later call. This is the same money as the read-back column of Table 3, cut the other way: the mean of a run.

| whose tokens | A | B | A less B |
|---|---:|---:|---:|
| what every session starts with (the harness's instructions and tools) | $0.082 | $0.024 | +$0.058 |
| the prompt as given, with what the harness adds to it, written to the cache once | $0.023 | $0.010 | +$0.013 |
| reading the brief, the graph and the agent files | $0.076 | $0.000 | +$0.076 |
| making the run folder and the working copy | $0.001 | $0.000 | +$0.001 |
| amending the working copy, and validating it | $0.005 | $0.000 | +$0.005 |
| a `started` line and nothing else | $0.002 | $0.000 | +$0.002 |
| a clock read and nothing else | $0.001 | $0.000 | +$0.001 |
| a node's note (often with the progress file) | $0.011 | $0.000 | +$0.011 |
| the progress file on its own | $0.001 | $0.000 | +$0.001 |
| keeping a copy of a round's report | $0.001 | $0.000 | +$0.001 |
| looking at the work, and gathering a reviewer's evidence | $0.005 | $0.002 | +$0.003 |
| dispatching a node, and what the node replied | $0.012 | $0.004 | +$0.007 |
| **all the read-back** | **$0.219** | **$0.040** | **+$0.179** |

Reading the brief, the graph and the agent files therefore costs $0.165 in its own calls and $0.076 in every later call that reads it back: $0.241 a run, 46% of A less B.

**Table 10. The package's files, by what reading each one added: arm A, the mean of six runs.** Where a call read two things its added tokens are shared by the characters each read returned, so a file's tokens are an estimate. Nothing tells the lead to read the graph document or the agent files, though the brief asks its dispatch prompt to carry a node's declared inputs, and those are written only there.

| what was read | runs that read it, of six | tokens it added | written once | read back by later calls | both |
|---|---:|---:|---:|---:|---:|
| the lead brief | 6 | 8,345 | $0.067 | $0.039 | $0.106 |
| the graph document | 5 | 3,346 | $0.027 | $0.016 | $0.043 |
| the agent files | 6 | 3,350 | $0.027 | $0.014 | $0.041 |
| a listing of the package's folders | 4 | 625 | $0.005 | $0.003 | $0.008 |

0.3 calls a run read nothing but the graph document or the agent files, and cost $0.004 more in their own read-back and output. So by this count a lead that read neither would have cost $0.088 less a run ($0.036 to $0.105), 17% of A less B. 3 of the six leads amended the working copy after that reading; in the 3 that did not, the figure is $0.075.

<!-- end of tables -->
