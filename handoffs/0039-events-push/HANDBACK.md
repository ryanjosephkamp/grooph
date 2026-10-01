# Handback 0039 · Events on a branch of their own

**Branch:** `slice/0039-events-push` (stacked on 0038) · **Date:** 2026-10-01 · **By:** the operator-round session (Opus 5.5) · **Spend:** none

The Operator: "Have each lane commit `.grooph/events/` with its work" would put event files into every pull request and onto `main`; the events need a ref of their own, for example a `grooph events push`.

## What changed

- **`grooph events push [--branch <name>] [--remote <name>] [--no-push] [--dir <project>]`.** One commit whose tree is `.grooph/events/` and nothing else, on top of what the target branch already holds on the remote, pushed to `grooph-events/<the branch checked out>` or the branch named. It uses git's plumbing (`hash-object`, `mktree`, `commit-tree`, `push <commit>:<ref>`), so the working tree, the index, `HEAD` and the checked-out branch are never touched and no local branch is made. Event files already on the branch that this clone lacks are kept, so several sessions may share one branch.
- **The same code as a script with no dependencies**, `packages/cli/hooks/grooph-events-push.mjs`. `grooph hooks install` copies it beside the hook, so a cloud lane with Node and git and no grooph runs `node .grooph/hooks/grooph-events-push.mjs`. The CLI command imports and runs that file: there is one implementation.
- Reading is unchanged: `grooph sessions lane=git:origin/grooph-events/<branch>` after a fetch.
- This repository carries the script too, and the test that keeps installed copies equal to the shipped ones covers it.

## Verified

| Claim | How | Result |
|---|---|---|
| It sends the events and touches nothing else | `packages/cli/test/events-push.test.ts`, against real repositories with a bare remote: `HEAD`, the branch, `git status`, the index and the branch list are compared before and after | passes |
| The remote branch holds only `.grooph/events/`; the work's branch does not have them | the same test | passes |
| Nothing new makes no commit; one more line makes one more commit on top | the same test | passes |
| Two clones share one branch and each keeps the other's file; a third reads it as a `git:` source | the same suite | passes |
| `--no-push`, a bad branch name, an unknown option, a folder outside git | the same suite | each said plainly, nothing changed |
| A branch of work is refused and untouched; a diverged file is joined; an accented name stays one entry | the same suite, five tests in all | passes |
| Here | `grooph events push --no-push` in this repository | made a commit for seven event files; nothing staged, no branch made |

## An independent read, and what it stopped

A subagent with no part in writing it reviewed the script and exercised it in scratch repositories. It found one serious defect, before anything was pushed:

- **Named a branch of work, the first version would have replaced that branch's contents with the event files.** `--branch main` built a tree holding only `.grooph/events/` on top of `main`, and git accepted it as a fast-forward. A cloud lane allowed to push only its own branch would plausibly have passed that branch. Now the script refuses any branch whose tip holds anything but `.grooph/events/` and its files, and refuses the branch checked out, and sends nothing. Tested: a work branch on the remote, the checked-out branch, and `main` from a detached checkout are each refused and left exactly as they were.

And three smaller ones, all fixed with tests:

- a file name with an accent or a space was written twice into the tree on its second push (git quotes such names unless asked not to); the script now reads and writes trees with `-z`, and `git fsck` is clean;
- a clone with a shorter copy of a file replaced the longer one on the branch; a file both sides have is now joined line by line and never shortened;
- with no branch checked out, the default name was made from the commit and changed with every commit; it now asks for `--branch`.

It confirmed that no path stages, checks out or moves a local branch, and that two pushes racing for one branch fail safe: the second is rejected and a retry loses nothing.

## Not verified

- **A cloud sandbox.** Whether a cloud session may push a branch it is not working on is the harness's rule, not grooph's. `--branch` takes a whole name for a harness that only allows a prefix. The Operator will be the first to try.
- Two pushes to one branch at the same instant: the second is rejected by git as not a fast-forward and the script says so; running it again succeeds. Not exercised in a test.

## Decisions made here

- **A command a lane runs, not something the hook does.** The hook's promise is one appended line and no output; it must not reach the network.
- **No local branch.** The commit is pushed by its id, so `git branch` in a lane shows nothing new.
