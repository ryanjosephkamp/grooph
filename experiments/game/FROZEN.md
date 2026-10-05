# The freeze

The spec, the graph and the checks of the game experiment, as they are for both runs. Frozen on 2026-10-04, before any session was started and before anything was pushed to either game repository.

**The commit: `11070a7c5bbc7e77c1fc7e6304f7bf07f7d20a8c`** of grooph's repository (`main` on 2026-10-04 at 21:02 Eastern, the merge of pull request #77).

From here `SPEC.md`, `arena.grooph.json` and every file under `acceptance/` change only by an amendment written into this file, with its date and its reason, that both runs get. The Codex run, whenever it is made ready, takes the spec and the graph from this commit and is compiled from the same `arena.grooph.json`.

## The fourteen files

SHA-256 of each file as the commit holds it. The list is [`setup/frozen.sha256`](setup/frozen.sha256), in the form `shasum` checks:

```bash
shasum -a 256 -c experiments/game/setup/frozen.sha256
```

| File | SHA-256 |
|---|---|
| `SPEC.md` | `43f4d7da1abb88301084f726976f196b7d458dd2bd4c8a81879f0f9eb7fffa55` |
| `arena.grooph.json` | `b3605be3d31d9a9f4163d09fabee3155850e2adf09da23cb42ee3bdf8847d3f0` |
| `acceptance/.gitignore` | `f72fb6803cb7331ac3520a6823cb4967b33f317c7e707b7cc337b61a9aae972f` |
| `acceptance/LIST.md` | `09db36189d92e53eb84f4ee92d072f5a2241f1acbce6ef10d919b1c45bb7811c` |
| `acceptance/README.md` | `fb3a31675bb75aeca7941e695bccb350b7144042046609c645cf6955ca854f83` |
| `acceptance/check.mjs` | `c60a2d4872a71d65b825fc0129692bcaf19e70af414dcae4403e4107ece3cdea` |
| `acceptance/prove.mjs` | `fcbb87e9b73124e4550af26fbbda34247829c16f3b207a3f86dcd9341b11ff6c` |
| `acceptance/serve.mjs` | `bc72ca9b74faedf82acde4f90624bcd572c3ed40d5d4147bbd84f2949cc75fd6` |
| `acceptance/proof/broken.txt` | `a3a317d1aa7242449380b0d20dfa78842754136b9e6fbc4b4d90ed28fbff1a5c` |
| `acceptance/proof/good.txt` | `cb6a0d693c6aa821d85f941ac7a9912804bc93ece3963cd7f4246308069d22a4` |
| `acceptance/proof/one-at-a-time.txt` | `7a2ed7451bf646f2229b516803c6e10108ec63ae8f1cd58c6821cd1400bf93bb` |
| `acceptance/stand-ins/broken.html` | `536bc50d0c0c63880548d17026c2a975d7a90538ddc163e848549d273b8df672` |
| `acceptance/stand-ins/good.html` | `74c86fe58159b7592f4fbacf28bcdb8c53feaca112951809c98306432580a621` |
| `acceptance/stand-ins/stand-in.js` | `bc745a1f7cafb20d1487fa3080da33c315f3219bd15e0428fa3dd1b0b8f52bd4` |

## The Claude Code run's starting contents

What [`setup/make-repo.sh`](setup/make-repo.sh) builds, and refuses to hand over if a single file differs: seventeen files, listed with their checksums in [`setup/starting-contents.claude-code.sha256`](setup/starting-contents.claude-code.sha256).

- **Compiled by** grooph's packages as of `4a6f91d7dc9a3e2fbdaab4f284d69a5872a30d81` (the last commit to change `packages/` before the frozen commit, so the compiler `main` had at the freeze: after #63, #71, #72 and #83).
- **With** `grooph export experiments/game/arena.grooph.json --target claude-code --models frontier=claude-opus-5-5,strong=claude-sonnet-5-5,fast=claude-sonnet-5-5`. The owner's answer was Opus 5.5 for `frontier` and Sonnet 5.5 for `strong`; the models are named in full so that the package does not depend on what the aliases `opus` and `sonnet` mean on the day. In the package: the planner, the critic and the final play are `claude-opus-5-5`, the builder and the wrap-up `claude-sonnet-5-5`. The lead is the session itself, started with `--model claude-opus-5-5`.
- **The hook** as `grooph hooks install` writes it: two scripts under `.grooph/hooks/` and the hook entries in `.claude/settings.json`.
- **The tree: `3238a9052ce7765c79990029bbff6bccd88628bf`.** Built twice, in two folders, it is the same tree, and with the date of the frozen commit and the name grooph's clone commits under, the same commit: `8c4aceb29e1534cfdf5ffdebd7d77fe9befbcc17`.

The Codex run's starting contents will get the same treatment when its compiler exists: the same `SPEC.md` and `LICENSE`, its own package from the same graph, its own manifest here.

## What is not frozen

- The compiler for Codex, which does not exist at this commit. Its commit is recorded when the Codex package is compiled.
- The scripts under `setup/`, the runbook and the record: they are how the runs are started and written down, not what a session is given.

## Amendments

None.
