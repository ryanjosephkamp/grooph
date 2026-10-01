# 0015 · Working rules for the operator round: a page at each gate, merge on the owner's word, every run recorded, Codex through the repository

**Date:** 2026-09-30 · **Status:** accepted · **Deciders:** owner (spoken, 2026-09-30), driver

## Context

After the first working turn of the operator round (decision 0014) left seven stacked pull requests open, the owner said how he wants the work run from here. He speaks his prompts and they reach the session as a transcription. He drives from his phone through Remote Control. He will also drive Codex that way. He asked whether the experiments had really been run and what they had cost, and asked for records he can check himself.

## Decision

1. **Spoken prompts are read for what he means.** A transcription slips on names and commands ("codecs" is Codex). The session takes the plain reading; where a slip changes what would be done, it says which reading it took, and where it cannot tell, it asks.
2. **A page at each gate.** When a turn ends with something for the owner to decide or carry, the session publishes a short page (an Artifact) from a source kept in `handoffs/briefs/`: what was done, what is verified and what is not, the questions, and **the next prompt, ready to copy, filled in with the session's own recommendation**. The chat status stays; the page is in addition. Not every turn needs one.
3. **Merging.** The session may merge to `main` in this repository, and in any repository the owner names for it. It never pushes to, opens a pull request on, or otherwise touches the repositories of his other projects. **For the first several rounds a merge waits for his word**: the page gives the order, he answers "approved", and the session merges in that order, resolves conflicts itself, and tags. The session does not merge on its own judgment until he says that has changed.
4. **Every model session started by command is recorded before its result is used.** The harness's own output is saved to a file as it runs. It gets a folder under `experiments/`, a ledger row with its session id and what the harness says it cost, and the path and checksum of the harness's transcript. Transcripts stay on the machine when they hold account details, and the record says where. A cost is what the harness reported; an estimate is called one. The first such record, made after the fact for the ten sessions of slices 0027 and 0028, is `experiments/hooks/2026-09-30/`.
5. **Codex is an implementer through the repository.** It works a slice from a `HANDOFF.md` in its own worktree and answers with a `HANDBACK.md` on a pushed branch (`handoffs/README.md`). The owner carries one prompt each way. The session may run `codex exec` itself for a small check. Nothing under `~/.codex` is changed without his yes.
6. **Questions go to whoever can answer them.** What only the Operator knows (the real shape of the operation) is asked in `docs/HANDBACK-operator.md`, not of the owner. Questions for the owner go in the chat, the page, or both.
7. **What the session can do with other sessions on the Mac** is recorded as found, so nobody rediscovers it: it can list the desktop app's sessions, read their transcripts and send them a message (one round trip was made on 2026-09-30); it cannot open a new session in the app. It can start subagents, and headless sessions in either harness by command. The owner can start sessions on the Mac from his phone (Remote Control's server mode, per Claude Code's documentation; not tried here).

## Consequences

- `handoffs/briefs/` gains a page per gate; its table records each URL.
- `experiments/hooks/README.md` holds the recording rule and `experiments/hooks/check.mjs` checks a ledger against the transcripts on the machine.
- `handoffs/README.md` gains a section on Codex as an implementer; slice 0032 is the first.
- The "Who merges" row in `docs/PROGRESS.md` is answered: the session, on his word.
