# 0024 · Lanes, the review desk, and the audit loop with Codex

**Date:** 2026-10-04 · **Status:** accepted (the owner's words, 2026-10-04) · **Deciders:** owner, driver

## Context

The push of 2026-10-04 was built by one driver session, three lanes the owner started by pasting a line into a terminal, and subagents. It worked, and it left the owner with one page to read at the end. He asked for three things: several lanes at once that the driver manages for him; one live place to see what needs him and to answer; and a second harness to audit grooph's claims before they are published. No audit by Codex has been made of any claim so far.

## Decision

### Lanes

1. **A lane is a session the owner starts in the Claude app**, in this repository, in a worktree of its own. He starts it; the driver cannot. From then on the driver runs it: assigns its slice by a handoff file and a message, reads its transcript, answers its questions, reviews its pull request, and merges it or puts it on the desk (decision 0023).
2. **At most four lanes at once**, beside the driver. The Mac also runs sessions for the owner's other projects.
3. **Models.** Opus 5.5 by default. Sonnet 5.5 where the work is a checklist. In Codex, GPT-6.1 Sol leads and GPT-6 Luna works. **Never Fable. Never Astra.** Local sessions, not cloud.
4. **A lane works one slice at a time** from `handoffs/NNNN-<slug>/HANDOFF.md`, on `slice/NNNN-<slug>`, and ends with a handback and a pull request. It does not merge. It asks the driver, not the owner, unless the handoff says a question is the owner's.
5. **Experiments.** As of 2026-10-04 the owner has lifted the spending cap on comparison runs made with Claude. Every run is still recorded before its result is used (decision 0015), and the desk shows what has been spent. A study still needs his yes to its design before it runs.

### The review desk

6. **One live page** (`handoffs/briefs/desk.html`, published as an Artifact, its address in `handoffs/briefs/README.md`). It holds what waits on the owner, each item with a recommendation and a place to answer; the lanes and what each is doing; what the driver merged without asking; and the standing reference: what grooph can do, what it claims and on what evidence.
7. **The desk's queue, its lanes and its log are data, not page text.** The driver adds and settles items without publishing the page again; the owner's answers are stored with them. The driver reads the answers when the owner says he has answered, and at each turn's start.
8. **A gate page is still published** for a release or a result that deserves its own record. The desk is where the work is steered; a gate page is what is kept.

### The audit loop

9. **A claim is audited by a second harness before it is published.** A claim is any sentence, in the README, on the site, in the blog or in a report, about what grooph does to the quality, cost, speed or safety of work, or about what an experiment showed. The auditor is Codex with GPT-6.1 Sol at its highest effort.
10. **One lane holds the loop**: an Opus 5.5 session at extra-high effort, which does the analysis, writes the handoff for Codex, and reconciles what comes back.
11. **Codex reads and writes a handback. It changes nothing.** It is opened on a folder outside the repository, `/Users/noir/Documents/grooph-exchange/codex/<audit>/`, and reads a snapshot of the repository at the audited commit beside it. Its sandbox lets it read the snapshot and write only in its own folder.
12. **The owner carries one prompt each way.** The lane gives him the prompt for Codex; Codex gives him the prompt to bring back.
13. **Reconciling.** For each finding the lane says agree, partly, or disagree, with its reason; proposes the correction, in the words that would be published; says whether the finding needs a new experiment; and judges how close the two are. It publishes that as a page for the owner and puts the decisions on the desk.
14. **The owner decides.** The lane makes the corrections he accepts, in a pull request that waits for him (a claim changed is his to merge, decision 0023).
15. **The loop repeats** until neither side holds a finding that blocks a claim, and every disagreement that remains is written down with both positions. The owner can call it sooner.
16. **A new experiment is designed, not run, inside the loop.** If both sides agree the evidence is not enough, the lane writes the design as a handoff and passes it to the driver. It runs later, as its own slice, and its result goes through the loop again.
17. **Every round is kept**: the handoff, the handback and the reconciliation are copied into `experiments/audits/<audit>/round-NN/` and committed. The exchange folder is the working copy; the repository is the record.

## Consequences

- `handoffs/README.md` gains the lane protocol and the audit loop, with templates for the three audit documents.
- `AGENTS.md` names the roles as they now are: driver, lane, auditor.
- What is published today (the front page's claims, the README, the technical report, the blog draft) has not been through the loop. The first audit takes them as its subject.
- The owner is the carrier between the harnesses, as he was between sessions. The operation map of this arrangement counts those handoffs; the count is the cost of the audit and is kept visible.
