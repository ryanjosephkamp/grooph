# Audits

A claim is audited by a second harness before it is published (decision 0024). This folder is the record of every audit: one folder per audit, one folder per round, three documents per round.

```
experiments/audits/<audit>/
  README.md              the subject, the commit, how it ended
  round-01/HANDOFF.md    what the audit lane (Claude Code) asked Codex to read and attack
  round-01/HANDBACK.md   what Codex found
  round-01/RECONCILE.md  where the two stood, what was corrected, what stayed disputed
  round-02/…
```

The working copies are outside the repository, in `/Users/noir/Documents/grooph-exchange/`. What is here is copied from there at the end of each round and is not edited afterwards. The protocol is in [`handoffs/README.md`](../../handoffs/README.md), "The audit loop with Codex".

| Audit | Subject | Commit | Rounds | Ended |
|---|---|---|---|---|
| (none yet) | | | | |
