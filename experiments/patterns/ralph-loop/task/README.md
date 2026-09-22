# wordbank

Word statistics for plain text: tokenise, count, rank, summarise. Built one
plan item at a time: `PLAN.md` is the list, `AGENT.md` the operating notes.

```bash
npm test     # every test under tests/, plus the acceptance cases of each ticked plan item
```

`src/text.mjs` holds the module. Each plan item names the function it adds,
where its tests go, and what counts as done.
