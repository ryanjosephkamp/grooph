# 14 · The claims page and the audit

[Start page](README.md) · previous: [what the experiments found](13-what-the-experiments-found.md) · next: [the glossary](glossary.md)

Chapter 13 said what grooph's experiments found. This chapter is about how the project checks **what it says about itself**, because the two are not the same thing. An experiment can be sound and the sentence written about it can still say too much.

## What a claim is

For grooph, a **claim** is a sentence about what the tool does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed. "The validator refuses a loop with no stop" is a claim. "The app has a templates page" is a description, not a claim.

## The claims page

One page, [claims.md](../claims.md), lists the claims the audit found that grooph made about itself when version 0.3.0 was published: on its front page, in its README, in its documentation, in its technical report and in a blog draft. There are 52. (The list was made by reading those pages. Nothing proves that no sentence was missed.) Each has a number (C1 to C52), the place it was made, the evidence for it, and a **reading**.

A reading is one of three.

| Reading | Meaning |
|---|---|
| **Carried** | The evidence supports the sentence as a careful reader would take it |
| **Other words** | The evidence supports something narrower, or only under a condition the sentence did not give |
| **Not carried** | The evidence does not support the sentence as it was worded |

Of the 52: **12 carried, 33 other words, 7 not carried.**

Read those numbers slowly. Fewer than a quarter of the project's own published sentences survived exactly as written. Most were true of something narrower than they said. That is a normal result of looking hard at one's own writing, and the point of the page is that anyone can see it.

## How a claim is audited

The idea is simple: **the one who built the thing should not be the only one to check what is said about it.** It is the independent reviewer of chapter 1, applied to grooph itself.

So each claim is read twice, by two different harnesses.

1. A Claude Code session, called the **audit lane**, reads every claim against its evidence and writes down what it believes and how sure it is. ("Lane" here is the project's word for a session with one standing job. It is not the lane of chapter 9.)
2. **Codex**, a different harness with a different model, reads the same claims and the same evidence as a skeptic. It is asked to attack the first reading as hard as the claims. It changes nothing in the repository. It writes what it found.
3. The audit lane answers each finding: agree, partly agree, or disagree.
4. **The owner**, the person the project belongs to, **decides** what gets corrected.

These four steps are one round of the audit, and rounds repeat until neither side holds a finding that blocks a claim. Anything still in dispute is written down with both positions. Every round is kept in the repository under `experiments/audits/`, and a round's record is not edited afterward.

## What the first audit found

The first audit read all 52 claims. Codex returned 21 findings. The audit lane agreed with 19 and partly with 2, and disputed none. Three of Codex's findings corrected the audit lane's *own* reading, and when the lane went back to the records, Codex was right each time.

The largest finding concerned the sentence the whole project had been using to describe itself. It said grooph "is shown to bound and record autonomous work and to hold a design as a runtime contract". Both readers found:

- **"bound"** is not supported: no cap or budget has ever fired on record (chapter 13);
- **"record"** is supported by something narrower: runs leave records, and some records are incomplete;
- **"contract"** is supported by something narrower: most recorded sessions followed their packages, by a check of selected parts, and nothing enforces it.

The sentence was replaced, on every page but a blog draft its author is rewriting by hand, by the paragraph quoted at the top of chapter 13. The owner accepted the audit's corrections on 5 October 2026 and they were made that day, each as its own change so that any one of them could be taken back alone.

The audit also turned up something that was not a wording problem. Checking the claim that a run "may tighten a brake and never loosen one", the audit lane tried it: it raised a round cap and a budget in a run's working copy and asked grooph to adopt it. grooph adopted it. Nothing had ever checked that rule. The adoption check of chapter 7 was written in answer. Later the same day, reading that new check, the audit lane found that it did not treat a test command as a brake. The owner ruled that it should, and the check was extended that evening. Chapter 7 shows it as it is now, with what it still lets through.

## What still stands in old words

A few things were deliberately left as they were, and the claims page lists them with the reason for each. The main one is the project's past write-ups and decisions, which are never edited. What they got wrong is written in a new decision instead, so the history stays readable.

## The second round

The audit's second round was sent on 5 October 2026 and came back the next day. Codex read the corrected sentences from round one, the second comparison of chapter 13, the adoption check of chapter 7, the experiment built to show a budget at work, and five chapters of this guide. It returned 16 findings, and the audit lane agreed with all 16.

- **The adoption check is real and incomplete.** Codex found that two limits on one loop can be swapped so that a run goes on where it should have halted, and the check does not notice. A fresh reader of the audit lane's own answer then found a second way, a new limit of another kind that sends the run on, which grooph printed as a tightening. Both were still true in version 0.4.0. Both are repaired in the project's main copy since 6 October 2026, and the repair is meant for version 0.4.1, which had not been released when this was written. Chapter 7 says how, and what the repair costs.
- **The second comparison's headline had to name what it measured.** Its designs scored higher than the task done alone on tests the author wrote and kept hidden. Two blind judges, shown only the task and the results, preferred the task-alone results in the two code projects. Both facts belong in the sentence, and it has not been put on any page of the site.
- **The counter of the budget experiment can miscount in both directions**, so no result of that experiment can be trusted until it is repaired. The experiment has not been run.
- **The rest was wording**, some of it in this guide: a worker's "empty context", "nothing in grooph watches", and the account of one failed record were each corrected.

The audit lane was itself wrong three times in that round. Twice in its first answer, where the fresh reader caught both. And once in its first scan of the ready-made templates, which reported nothing open because it had tested nothing: the check was refusing every template for being a template, and the scan counted each refusal as a brake held. That is in the record too.

## The third round

The third round was sent on 6 October 2026 and came back the same night. Codex read this whole guide (the start page, all fourteen chapters and the glossary), the repair to the adoption check, and the check `grooph export` makes. It read them in the project's main copy at commit `c1ff8f7`: a build that calls itself version 0.4.0 and holds the repairs meant for version 0.4.1. It found no new way past the check. It returned 19 findings, all of them about what is said: in this guide, in the project's pages, and in one line the program prints. The audit lane agreed with all 19. By the owner's decision the guide was corrected chapter by chapter and the gaps already listed were kept as listed. So what became of the 19 is three different things.

- **Corrected.** Fourteen findings were about this guide's words: its start page, twelve of its chapters and its glossary. Each was corrected in the guide, in Codex's words or closer to the program. Most of the other five were about the project's reference pages and release notes, which now say what the repair costs an honest change, what the export check compares with, and that an early scan of the ready-made templates had tested nothing.
- **Kept, and listed.** The ways around a limit that the check still lets through are not repaired. Chapter 7 names four of them and the project's reference has the full list. A line the check prints says "round" where the project's rule says "pass", and the instructions a lead is given say "before every round"; this guide changes neither. And one comparison, of a graph with forty loops of forty stops each, took fourteen to twenty seconds over the four times it was run, and printed twelve million characters of reasons each time. That is recorded as a measurement of one case. Nothing bounds it yet.
- **Left with the owner.** Whether a new road around a limit, where nothing else was checking, should be refused at all. The owner has been asked and, as of 6 October 2026, has not answered.

Codex also said what it could not check, and that stays unchecked. No released version 0.4.1 existed to read. No agent session, real hook event or live site was exercised. And its search for a way past the repair had limits, so finding none is not a proof that there is none.

## What has not been audited

- **The corrections themselves.** Codex read the guide as it stood before them. The corrections were read by another of the project's AI sessions, not by Codex again.
- **A released version 0.4.1.** What was read calls itself 0.4.0.
- **The counter of the budget experiment**, which is not repaired. The experiment has still not been run.

A reading by a second AI system is not a review by a person, and it is not a guarantee.

## Why this matters to you

Two reasons.

**First, it tells you how to read everything else grooph says.** For each of the 52 statements the audit found as of version 0.3.0, there is a numbered row on the claims page saying what the evidence supports. If you ever find a sentence that says more than its row, the row is right. A row is the project's reading at a date. Check it against its evidence and the version, as the audit does.

**Second, it is the tool's own idea turned on itself.** grooph is built on the belief that work should be checked by someone who did not do it, against something that can be looked at, with a record kept. The audit is that belief applied to the project's own claims: a second reader, the evidence in the open, every round on file. Whether that belief makes agent work better is, as chapter 13 said, not yet shown. It is at least practiced.

The references for this chapter are [claims.md](../claims.md), [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md) and the audit's own record, [`experiments/audits/0001-claims-as-of-0-3-0/`](../../experiments/audits/0001-claims-as-of-0-3-0/README.md).
