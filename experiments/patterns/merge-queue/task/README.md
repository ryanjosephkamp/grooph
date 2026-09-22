# textkit

Four small text helpers (`formatMoney`, `slugify`, `search`, `limit`) with a
merge queue: reviewed changes wait as patches under `queue/`, listed in
`QUEUE.md` in landing order, and land as a batch.

```bash
npm test             # the helpers' tests, on the tree as it is
npm run integrate    # apply every queued change to a scratch copy, in order, and test it there
npm run land         # apply the queued changes to the tree and mark them landed (not undoable)
```

`npm run integrate` never changes the tree: it says which patches applied and
whether the tests passed on the batch. To take a change out of the batch, set
its status in `QUEUE.md` to `held` with the reason in the note; it stays in the
queue for its author to fix.
