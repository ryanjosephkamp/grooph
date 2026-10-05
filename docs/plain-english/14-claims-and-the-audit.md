# 14 · The claims page and the audit

[Start page](README.md) · previous: [what the experiments found](13-what-the-experiments-found.md) · next: [the glossary](glossary.md)

Chapter 13 said what grooph's experiments found. This chapter is about how the project checks **what it says about itself**, because the two are not the same thing. An experiment can be sound and the sentence written about it can still say too much.

## What a claim is

For grooph, a **claim** is a sentence about what the tool does to the quality, cost, speed or safety of work, or about what an experiment or a measurement showed. "The validator refuses a loop with no stop" is a claim. "The app has a templates page" is a description, not a claim.

## The claims page

One page, [claims.md](../claims.md), lists every claim grooph made about itself when version 0.3.0 was published: on its front page, in its README, in its documentation, in its technical report and in a blog draft. There are 52. Each has a number (C1 to C52), the place it was made, the evidence for it, and a **reading**.

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

1. A Claude Code session, called the **audit lane**, reads every claim against its evidence and writes down what it believes and how sure it is.
2. **Codex**, a different harness with a different model, reads the same claims and the same evidence as a skeptic. It is asked to attack the first reading as hard as the claims. It changes nothing in the repository. It writes what it found.
3. The audit lane answers each finding: agree, partly agree, or disagree.
4. **The owner decides** what gets corrected.

The rounds repeat until neither side holds a finding that blocks a claim. Anything still in dispute is written down with both positions. Every round is kept in the repository under `experiments/audits/`, and a round's record is not edited afterwards.

## What the first audit found

The first audit read all 52 claims. Codex returned 21 findings. The audit lane agreed with 19 and partly with 2, and disputed none. Three of Codex's findings corrected the audit lane's *own* reading, and when the lane went back to the records, Codex was right each time.

The largest finding concerned the sentence the whole project had been using to describe itself. It said grooph "is shown to bound and record autonomous work and to hold a design as a runtime contract". Both readers found:

- **"bound"** is not supported: no cap or budget has ever fired on record (chapter 13);
- **"record"** is supported by something narrower: runs leave records, and some records are incomplete;
- **"contract"** is supported by something narrower: most recorded sessions followed their packages, by a check of selected parts, and nothing enforces it.

The sentence was replaced, everywhere it stood, by the paragraph you read on this guide's first page. The owner accepted the audit's corrections on 5 October 2026 and they were made that day, each as its own change so that any one of them could be taken back alone.

The audit also turned up something that was not a wording problem. Checking the claim that a run "may tighten a brake and never loosen one", the audit lane tried it: it raised a round cap and a budget in a run's working copy and asked grooph to adopt it. grooph adopted it. Nothing had ever checked that rule. The adoption check of chapter 7 was written in answer. Later the same day, reading that new check, the audit lane found that it did not treat a test command as a brake, and the owner ruled that it should. That is the "one kind is known to be missing" of chapter 7.

## What still stands in old words

A few things were deliberately left as they were, and the claims page lists them: a blog draft its author is rewriting by hand, a few lines inside files that an experiment in progress has frozen, two long descriptions (one template's and one community graph's), and the write-ups of past experiments. Past write-ups and decisions are never edited. What they got wrong is written in a new decision instead, so the history stays readable.

## What has not been audited yet

- **The second comparison** of chapter 13.
- **The adoption check** of chapter 7 and the comparison it rests on.
- **This guide.**

These are the subject of the audit's second round, which had not been sent when this was written.

## Why this matters to you

Two reasons.

**First, it tells you how to read everything else grooph says.** Where a page of grooph's makes a statement about what the tool achieves, there is a numbered row on the claims page saying what the evidence supports. If you ever find a sentence that says more than its row, the row is right.

**Second, it is the tool's own idea turned on itself.** grooph is built on the belief that work should be checked by someone who did not do it, against something that can be looked at, with a record kept. The audit is that belief applied to the project's own claims: a second reader, the evidence in the open, every round on file. Whether that belief makes agent work better is, as chapter 13 said, not yet shown. It is at least practiced.

The references for this chapter are [claims.md](../claims.md), [decision 0029](../decisions/0029-what-is-shown-as-of-the-first-audit.md) and the audit's own record, [`experiments/audits/0001-claims-as-of-0-3-0/`](../../experiments/audits/0001-claims-as-of-0-3-0/README.md).
