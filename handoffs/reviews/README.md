# The owner's reviews

Where the owner's own review of the site and of grooph goes, when he has one. A review is a file here, so that it is in the record, survives a change of Claude account (a page published as an Artifact belongs to the account that published it), and can be read by whichever session holds the driver's seat.

## How to hand one in

1. Copy [`TEMPLATE-owner-review.md`](TEMPLATE-owner-review.md) to `handoffs/reviews/YYYY-MM-DD-owner-review.md` and write in it. Any length, any order, plain words; the headings are prompts and can be ignored or deleted. Screenshots can sit beside it in a folder of the same name (each 150 KB or less, as `scripts/check-pictures.mjs` asks).
2. Or do not touch the repository at all: write it anywhere, attach the file to a message, and the driver saves it here unchanged before doing anything else.
3. Then say this to the driver's session:

```text
You are the driver. Read handoffs/DRIVER.md. My review is at handoffs/reviews/<the file> (or attached to this message: save it there first, unchanged). Read all of it before answering. Then: tell me in the chat what you understood, in my order; turn it into slices with a recommendation for each, on the review desk; ask me only what you cannot decide; and change nothing until I have answered.
```

## What the driver does with it

Saves it unchanged and commits it (`docs: the owner's review of <date>`). Reads all of it. Answers in the chat first, in the owner's own order, with what was understood and anything unclear. Puts one card on the desk for each thing that is his to decide, each with a recommendation, and starts nothing that needs his word before he gives it. Small fixes that decision 0023 lets the driver merge can go ahead and are listed. The file is never edited afterwards: replies and outcomes go under it in a file of their own, `…-owner-review.REPLY.md`.
