# Pull request #168: audit 0001, round two: the beginner's guide, fourteen sentences (correction 15)

*Its description, by the audit lane, as it stood on 2026-10-06. Copied here for the words it proposes the guide should carry about itself once this round is reconciled.*

---

The owner's answer on the review desk, q62 (2026-10-06). Correction 15 of [`round-02/RECONCILE.md`](https://github.com/ryanjosephkamp/grooph/blob/main/experiments/audits/0001-claims-as-of-0-3-0/round-02/RECONCILE.md), in its words: fourteen sentences in eight files of `docs/plain-english/`, one commit. Findings F15 and F16, and Codex's note on chapter 5.

| Where | Old | New |
|---|---|---|
| chapter 1, three places; the glossary, two; chapter 2 | "empty context", "knows only what it was handed", "and nothing more" | a fresh worker starts without the earlier conversation; it has its own standing instructions and can read what it is allowed to; it is told to read nothing else |
| chapter 13; the start page | "nothing in grooph watches it or can stop it"; grooph's work "begins again when the agents are finished" | grooph can show what a run records, in the live view, and can stop nothing; it controls none of it |
| chapter 13 | "a step that should have been its own subagent never ran as one"; "keep the whole record" | `gauntlet-decomposed` halted where its plan told it to ask a person, before its last three steps, and its check fails all the same, for reasons given; the record is the harness's output, the run folder and the cost |
| chapter 5 | "An agent cannot run a plan written as JSON any more than a builder can pour concrete …" | a harness has its own form for instructions, and compiling writes the plan out in it |
| chapter 7, two places | (added) | not every arrow around a check is caught; a loop's stops are not held in two ways, and the second is called a tightening |
| chapter 14 | (added after "the row is right") | a row is the project's reading at a date; check it against its evidence and the version |

**The guide still says of itself that it has not been audited and is not on the site. Neither sentence is changed here.**

## Proposed, for after round three: what the guide says of itself

These go in only when round three has read all fourteen chapters and its findings are reconciled. The dates and the version are to be filled then.

In `docs/plain-english/README.md`, "About this guide", in place of the two items "It is not on grooph's website" and "It has not been audited":

> - **It is on grooph's website**, as it stands in the repository.
> - **It has been read by a second, independent AI system.** The project's rule is that a statement about what grooph does to the quality, cost, speed or safety of work is read by a second harness before it is published ([chapter 14](14-claims-and-the-audit.md)). Codex read five of these chapters in the audit's second round and all fourteen, with the glossary, in its third, on *(date)*, against grooph *(version)*. What it found was corrected, and both rounds are on file under `experiments/audits/0001-claims-as-of-0-3-0/`. A reading is not a guarantee. Where a sentence here and the [claims page](../claims.md) differ, check both against the evidence the claims page names.

In `14-claims-and-the-audit.md`, in place of the section "What has not been audited yet" and its three items:

> ## What the later rounds read
>
> The audit's second round read the second comparison, the adoption check of chapter 7 and five chapters of this guide. It found the comparison's headline needed to name what its scores measure, and found the adoption check real and incomplete: chapter 7 lists what it lets through. Its third round read the whole of this guide. *(One sentence on what round three found, when it is known.)*

## Found while there, and not changed: the guide is a guide to 0.3.0

Correction 15 fixes what Codex found in five chapters. Reading the others for these edits, I met sentences that version 0.4.0, or round two itself, has made untrue. Round three would find each of them, and the guide is going on the site:

- Chapter 7, "`grooph export` does not make this check": it does since 0.4.0. Chapter 13 says the same in one clause ("`grooph export` makes no such check").
- Chapter 7, "It has not been audited. No second, independent AI system has read this check yet": one has.
- Chapter 14, "What has not been audited yet … the audit's second round, which had not been sent when this was written".
- Chapter 12 shows `grooph --help` printing "grooph 0.3.0", and its list of commands has no `grooph plan`. The start page's "Which grooph" says 0.3.0.
- Nothing in the guide knows a plan, a person's step or the four plan templates.

**My proposal:** before the snapshot for round three is cut, one more pull request, "the guide at 0.4.0": every command in it run again on 0.4.0 and its output replaced where it differs, the sentences above brought up to date, and a short section on plans. No model session is needed for it. Say the word and I do it next; without it, round three reads a guide that is two days behind the product.

Checks on this head: spelling over 800 files, site pages 25 with the guide not among them. Merges cleanly with #165's head, which changes one other line of chapter 13.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
