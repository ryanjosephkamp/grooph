# specialist-critic-bank · one proving run

**Run** `20260920-200356` · Claude Code 2.1.278 · lead, builder and the four critics `claude-opus-5` (tier strong), triage `claude-fable-5-1` (tier frontier) · **$5.76** of a $6.00 session ceiling · 36 harness turns · 957 s · evidence in [`run/`](run/) · **`--check` fails two assertions** (the ending is a halt on the session budget, not a graph stop; the dispatch count is off by four) · **a back edge was taken**

## Task

[`task/`](task/): `userfiles`, the file store behind a "my files" page, whose helpers carry two planted defects: `readUserFile(root, name)` joins the request's name onto the root with no traversal check, and `listFiles(root)` reads every file whole to report its size. The task ([`slots.json`](slots.json)) asks for `searchFiles(root, query, { within })`, built on those helpers, with a request-supplied subfolder.

## Mechanism

A real search space for four specialist critics: the change is told to build on helpers whose defects it inherits, and it adds a second traversal surface (`within`) of its own. The design bet: the security and performance critics rate what they find blocker or major, the triage judge merges four reports and sends the builder back once, and the second round is clean, ending in a halt at `gate` ([`expect.json`](expect.json)).

## Shape

`builder` (strong) → `correctness`, `security`, `performance`, `taste` (strong, fresh, in parallel, concurrency cap 4) → `triage` (frontier) → `gate` → `done`; triage fail and gate rejection → `builder`. Loop `review`: bar-passed, max-iterations 4, budget 26 dispatches.

## What happened

| round | node | result | record |
|---|---|---|---|
| 0 | builder | `searchFiles` with a lexical `within` guard (`startsWith` after `join`), 8 tests, README; flagged the untouched `readUserFile` as out of scope | `n-0003` |
| 0 | correctness, security, performance, taste | **dispatched in parallel** (all started 20:07:02); each read `DIFF.patch` and the repository, three of the four ran the tests or probes; each wrote its own `REVIEW-*.md` | `n-0004`–`n-0011`, [`transcript-digest.json`](run/transcript-digest.json) |
| 0 | triage | merged four reports with every duplicate collapsed and named: 0 blockers, **3 majors** (the `within` guard is lexical, so a symlink escapes it; every search reads every file whole, synchronously; `listFiles` reads files to learn sizes), 12 minors; verdict **fail** | `n-0013`, [`TRIAGE-round0.md`](run/runs/20260920-200356/TRIAGE-round0.md) |
| 0 | loop | bar not passed; max-iterations 4 not reached; **`e-triage-fail` taken** | `n-0014` |
| 1 | builder | fixed all three majors (realpath containment and `Dirent.isFile()`; chunked byte search with early exit; `statSync().size`), 9 of 12 minors, declined 3 with reasons; 16 tests | `n-0016`, [`project.diff`](run/project.diff) |
| 1 | the four critics | in parallel again; two ran probes | `n-0017`–`n-0024` |
| 1 | triage | 0 blockers, **1 major** (a search *miss* still reads every byte of the folder on the request thread, which the performance critic framed as a design question for a human), 15 minors; verdict **fail** | `n-0026`, [`TRIAGE-round1.md`](run/runs/20260920-200356/TRIAGE-round1.md) |
| 1 | loop | graph stops in order: bar no, max-iterations no (1 of 4), dispatches no (16 of 26); the graph says `e-triage-fail` again; **the lead halted instead**: "the session USD budget (5.51 of 6.00 spent) cannot cover another pass", with a proposal to add a `usd` stop to the loop | `n-0027` |
| — | graph | `outcome: halt`, "resume with the same run id from e-triage-fail into builder round 2 with TRIAGE.md as evidence" | `n-0028`, [`PROGRESS.md`](run/runs/20260920-200356/PROGRESS.md) |

**Ending:** a halt the graph does not have. The proving ledger caps every invocation at $6.00 with `--max-budget-usd`; the lead could see that figure, checked the graph's stops first, and stopped before a third round it could not finish, leaving a resumable record. `--check` calls that a problem because it is one: the run did not end through the template. The two planted defects were both caught at round 0 (M1 and M3, plus M2 which nobody planted), the second round is materially better, and the loop was still open when the money ran out. No amendment; per-round copies of `TRIAGE.md` and `CHANGES.md` kept by the lead.

## Did a back edge fire, and what caught it

**Yes: `e-triage-fail`, once, and it would have fired again.** Triage caught it both times, merging what the security and performance critics found: the two planted defects and one the builder introduced (a lexical containment check that a symlink defeats), then the residual full-folder read on a miss.

## What the bank contributed

Four independent readings of one diff, each in its lane (the taste critic ran nothing and found six minors; the security and correctness critics both probed the symlink escape without knowing the other had), and a judge that kept the severity honest: it named which reviewer raised what, collapsed duplicates to the highest shown severity, and explained why the round-1 major stayed major although the performance critic had called it a design decision. What the bank costs is equally visible: eight dispatches a round, about $2.80 a round here, which is why the session ceiling ended the run before the loop did.

## What the lead did that the package did not intend

- **It counted 8 dispatches a round where the graph has 6** (builder, four critics, triage): its tally says "builder, npm-test check, 4 critics, triage… counted 7 + triage = 8", so it counted a test run that is no node of this graph and then counted triage twice. `--check`'s dispatch comparison, added this slice for exactly this, calls it off by four. The count never came near the 26 budget, so nothing turned on it.
- **It halted on a stop the graph does not have**, correctly reasoned and correctly recorded, and it turned the reason into a proposal (`usd` stop on the loop). The alternative, starting round 2 and dying mid-dispatch when the harness cut the session, would have left a worse record.
- Three denials: a heredoc `cat >` for `PROGRESS.md`, a `TS=$(date …); printf` note line, a heredoc `cat >>`. Zero compound `cd`/`git -C` forms.
- Every critic wrote its report into the run folder rather than the project root; `DIFF.patch` and `NPM-TEST.txt` were served from there as well.

## What I would change in the template

Nothing in the shape: the bank did what four critics and a judge are for. Two things around it: the lead's own proposal is right for headless use (a `usd` stop on the loop, so a run that is going to be cut by `--max-budget-usd` can plan for it), and the description should say what a round costs in dispatches (six) so a lead does not have to derive it.
