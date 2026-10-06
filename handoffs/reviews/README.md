# The owner's reviews

Where the owner's own review of the site and of grooph goes, when he has one. A review is a file here, so that it is in the record, survives a change of Claude account (a page published as an Artifact belongs to the account that published it), and can be read by whichever session holds the driver's seat.

This folder is not a slice's `REVIEW.md` (the driver's verdict on one handback) and not `docs/review-2026-10.md` (an earlier review written by an agent).

## How to hand one in

Any length, any order, plain words. [`TEMPLATE-owner-review.md`](TEMPLATE-owner-review.md) has headings that may help; they are prompts and can be ignored. On a phone it reads at <https://github.com/ryanjosephkamp/grooph/blob/main/handoffs/reviews/TEMPLATE-owner-review.md>.

1. Easiest: give the driver's session the prompt below, and say or paste the review as the rest of the message.
2. Or attach the review as a file to that message.
3. Do not copy a file into the repository yourself. The driver saves it.

Screenshots: attach them to the chat. The driver keeps the originals out of git, commits JPEG copies of 150 KB or less beside the review (`handoffs/README.md`, "Rules for both sides"), and says which it converted.

The prompt works in a fresh driver session or in one already running:

```text
You are the driver. Read handoffs/DRIVER.md and handoffs/reviews/README.md. My review follows this line as text, or is attached to this message. Read all of it and look at every picture before you answer. Before you save it, read it for any project, product or person's name that is not already in this repository, and for anyone's private details; if there are any, do not commit it, and tell me. Otherwise save it exactly as I gave it, nothing added or removed, under handoffs/reviews/ on a new branch in a worktree, and open a pull request for it that you do not merge until I answer. Then reply in the chat, briefly: what you understood, in my order; what is unclear, as questions I can answer with a letter; and put a card on the review desk, with your recommendation, for each thing that is mine to decide. Until I answer, make no change that comes from the review and take no step on it beyond saving it and writing those cards: change nothing in the product, the site, the documents or any claim; write no handoff; start no lane, run or spending; send no lane a message about it; publish and merge nothing from it. If nothing needs my answer, say so and wait for my go.
```

## What the driver does with it

- **Reads it for private names first.** The review is spoken or typed quickly and may name one of the owner's other projects, and a phone screenshot can show a notification or an account. The public repository names neither. The test the driver can apply: any project, product or person's name that is not already in this repository. If there is one, the file is held untracked in the driver's worktree, never in the main clone and never committed, and the driver asks him.
- **Saves it as given**, as `handoffs/reviews/YYYY-MM-DD-owner-review.md` (a second review the same day ends `-2`), on a new branch in a worktree as `handoffs/DRIVER.md` describes for documents, never in the main clone. It commits it (`handoffs: the owner's review of <date>`), pushes, and opens a pull request that waits for his answer like everything else that comes from the review. A review is never edited afterward; his later thoughts are a new file. A picture that did not reach the driver as a file cannot be converted: the driver says so and describes it in the reply file.
- **Reads all of it and looks at every picture**, then answers in the chat first, briefly and in his order: what was understood, and what is unclear as questions he can answer with a letter.
- **Puts one card on the review desk** for each thing that is his to decide, each with a recommendation. If the desk cannot be read or written from this account, the cards go in the reply file below, and the driver says so.
- **Makes no change that comes from the review until he has answered.** Saving the file and writing cards are the only steps taken on it: no change to the product, the site, the documents or a claim; no handoff; no lane, run or spending; no message to a lane about it; nothing published or merged from it. A fix that decision 0023 would let the driver merge is listed as a card, not made, unless he says to go ahead. A change to a claim is never a small fix: it goes through the audit loop (decision 0024) and waits for his word. Work already under way that has nothing to do with the review goes on as `handoffs/DRIVER.md` says.
- **Writes the driver's replies and what came of each point** beside the review, in a file of their own: `YYYY-MM-DD-owner-review.REPLY.md`.
