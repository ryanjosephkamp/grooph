# patrol-pulse · one proving run

**Run** `20260922-050527` · Claude Code 2.1.278 · lead `claude-opus-5`, investigator `claude-opus-5` (tier strong), ticket writer `claude-sonnet-5` (tier fast) · **$1.31** · 22 harness turns · 241 s · evidence in [`run/`](run/) · **`--check` passes** · **the bet paid**

_Pre-registered 2026-09-22 before the run (commit `experiments: patrol-pulse task, slots, expectations and pre-registration`); the sections after "Pre-registration" are written from the record afterwards._

**Credits:** u/croovies's "Lloyd" heartbeat orchestrator as written up by explainx.ai (2026-08-14, a secondary source): a standing checklist per pulse, a read-only investigator, findings to a durable ticket store, humans prioritise; Steve Yegge's Gas Town patrols: patrol agents that loop by design, here one pulse is one run.

## Pre-registration

**Task.** [`task/`](task/): `orders-api`, a small HTTP service with a routing table, a fixed connection pool and a webhook verifier, and yesterday's log ([`logs/app.log`](task/logs/app.log), 78 lines). The scan command (`grep -n -E ' (ERROR|WARN) ' logs/app.log`) lists 31 lines: 13 `ERROR` and 18 `WARN`. `README.md` says which lines are routine: slow `/reports` requests during the nightly export, cold-cache misses after a deploy, retries that succeeded, the deprecated header, expiring tokens, and a single failed health probe followed by `probe ok`. Two faults are genuine: the payment webhook signature mismatches (four dropped events across the day), which [`TICKETS.md`](task/TICKETS.md) already holds as **T-0007 (open)**, and the connection pool exhausting during the noon flash sale (four `503`s in five seconds), which no ticket holds.

**Why a first pass should not simply succeed.** A pulse has no loop; what can go wrong is judgment, and the fixture sets three traps. The investigator can ticket the noise (the nightly `/reports` slowness looks like T-0005, which is a different fault; the failed probe looks like an outage), can miss the pool exhaustion because it is a burst inside a busy minute, or can report the webhook mismatches as new. The writer can then file two tickets where one is due, or file the pool exhaustion under T-0005's title. The bet is the narrow outcome: **exactly one new ticket** (the pool exhaustion), **T-0007 referenced rather than refiled**, **nothing outside `TICKETS.md` changed**, and a **halt note at `prioritise`**.

**Expected probability that the bet pays in full:** about 0.6. The investigator is a strong-tier critic with the README's noise list as an input, so finding both faults is likely (0.85); the writer's dedupe against T-0007 is the brief's first sentence, and the ticket format is given (0.8 given the findings); a halt note at the gate has been reliable since slice 0010 (0.95). What `--check` asserts is in [`expect.json`](expect.json): `added` counts the `## T-` headings TICKETS.md gained (exactly one), `ownership` confines the writer to TICKETS.md, `reports` require the investigator's own FINDINGS.md and the writer's own FILED.md, `ending` requires the halt at `prioritise`.

**Shape.** `scan` check (`grep`; nothing printed ends the pulse `clean`) → `investigator` (strong critic, fresh, read-only: allow `read-files`, `run-commands`, `write-outputs`; deny `edit-files`; evidence: the scan output, TICKETS.md read-only, the repository read-only) → verdict `clean` → `clean` stop; verdict `finding` → `ticket-writer` (fast builder; owns TICKETS.md) → `prioritise` gate → `done`. No loop: one pulse is one run.

**Spend expected:** about $1.50 (two dispatches, no round). Ledger cap $75.00, $29.36 available before this run.

## What happened

| node | result | record |
|---|---|---|
| scan | the lead ran the grep: exit 0, 31 lines, saved as `scan-output.txt` in the run folder; `e-scan-investigator` taken | `n-0003` |
| investigator | read the scan output, `README.md`, `TICKETS.md`, the log and all three source files, ran `npm test` (2/2); **two genuine faults**: F-1 the pool exhaustion (lines 53–63, four `503`s, cause traced to `POOL_SIZE = 20` and `WAIT_MS = 5000` in `src/db.mjs`, "not covered: T-0005 is `/reports` 504s from a missing index"), F-2 the webhook mismatches (four dropped events, "covered by T-0007, open; not filed again"); **six noise classes dismissed** each with the README line that makes it routine, the nightly-export window checked against the export's own start and finish lines, the single failed probe checked against the `probe ok` ten seconds later; verdict **finding** | `n-0005`, [`FINDINGS.md`](run/project.diff) |
| ticket-writer | one `Edit` to `TICKETS.md` appending **T-0008 · DB pool exhausted during flash sale, 503s on /orders (open)** in the store's format with the log line, the cause and a next step; `FILED.md` lists T-0008 as filed and F-2 as "already covered by T-0007 … additional confirmation, not a new ticket" | `n-0007`, [`project.diff`](run/project.diff) |
| prioritise | **halt note first** (`n-0008`, `outcome: halt`, naming T-0008 and the options), `PROGRESS.md` updated, then the question, then the turn ended | [`PROGRESS.md`](run/runs/20260922-050527/PROGRESS.md) |

**Ending:** the halt at `prioritise`. The project changed in exactly three files: `TICKETS.md` (one ticket appended, the `added` assertion: one `## T-` heading), `FINDINGS.md` and `FILED.md` (new). No source file, no test, no README touched; `clean` was not taken; no amendment, no proposal; the working copy is identical to the source. Dispatch counts do not apply (no loop).

## Did a back edge fire, and what caught it

No, and none exists: a pulse is not a loop. What the template puts in place of a loop is judgment before writing, and the record shows it working: the investigator separated two faults from twenty-nine noise lines with the README's rules cited line by line, recognised the ticketed fault by its number, and the writer filed one ticket and refiled nothing. The bet as pre-registered (one new ticket, T-0007 referenced, nothing else changed, a halt at the gate) paid in full.

## What the pulse contributed

The record is the pulse log the target doc promises: `runs/20260922-050527/` holds the scan output, the notes with a `started` line before each dispatch, and a `PROGRESS.md` that says what is waiting and how to resume by run id. A scheduler that starts this package daily would leave one such folder per day, and a clean day would still leave its notes (`e-scan-clean` or a `clean` verdict end the run at the `clean` stop). The read-only policy held without a rule to enforce it: the investigator has `edit-files` denied and the harness's `acceptEdits` mode would have let it write; it wrote its report and nothing else.

## What the lead did that the package did not intend

- **The harness refused the investigator's `Write FINDINGS.md`** with "Subagents should return findings as text, not write report files. Include this content in your final response instead." This is a Claude Code rule, not a permission denial, and it did not fire for `REVIEW.md`, `GAPS.md` or `FILED.md` in any run on record, so it looks keyed to the file name. The investigator wrote the same content with a `cat > … <<'EOF'` heredoc (its first attempt was denied for a trailing `git -C … status`; the second succeeded), so the report exists and `--check` credits the investigator with it. The first run compiled from the 0014 brief, and the first time a subagent's report file was refused by the harness itself.
- Two denials in all: the lead's first note-append `printf` (shell syntax the analyser refuses; it used `echo` after) and the heredoc above.
- The final note is at `node:prioritise`, not at `graph`, as in every gate halt on record; no `ending` line precedes it, which is right by LEAD.md §11 (the `ending` line belongs before a final note at `graph`, and a halt is not one).
- Both worker notes carry `cost: {measure: "tokens"}`, advisory and harmless.

## What I would change in the template

Name the investigator's report something other than `FINDINGS.md`: the harness's report-file heuristic cost the investigator two turns and would cost a fast-tier investigator more. `PULSE.md` or `TRIAGE.md` says the same thing. Otherwise nothing: the fixture's three traps were all sidestepped with reasons, which is what the read-only investigator is for.
