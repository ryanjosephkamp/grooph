This graph has a builder, the test check, a critic and a loop with brakes. A passing check alone could be reached by weakening the test, so the critic reads the diff for exactly that before the run can end.

```json
{
  "grooph": 0,
  "id": "fix-flaky-checkout-test",
  "name": "Fix flaky checkout test",
  "version": 1,
  "goal": "Make `pnpm test checkout` pass by fixing the code, without skipping, weakening or deleting any test.",
  "target": { "harness": "claude-code" },
  "nodes": [
    {
      "id": "builder",
      "kind": "agent",
      "name": "Builder",
      "role": "builder",
      "model": { "tier": "strong" },
      "brief": "Find the cause of the flaky checkout test and fix it in the application code. Do not edit test files, and do not skip, delete, retry, loosen an assertion in, or lengthen a timeout of any test. If you believe the test itself is wrong, say so in CHANGES.md instead of changing it. Say what you changed and why.",
      "inputs": ["the task", "the failing test output or the review, from round 1 on"],
      "outputs": ["the change", "CHANGES.md"],
      "allow": ["read-files", "edit-files", "run-tests"]
    },
    {
      "id": "tests",
      "kind": "check",
      "name": "Tests",
      "check": { "kind": "tests", "run": "pnpm test checkout", "pass": "exit code 0" }
    },
    {
      "id": "critic",
      "kind": "agent",
      "name": "Test integrity critic",
      "role": "critic",
      "model": { "tier": "frontier" },
      "brief": "Compare the working tree with the commit the run started from. Fail the change if any test file was edited, or if any test was skipped, deleted, retried, given a longer timeout or a looser assertion, or if the fix only hides the flakiness instead of removing its cause. Read the diff and the repository; trust no claim in CHANGES.md that you cannot check. Pass or fail, with findings.",
      "outputs": ["REVIEW.md"],
      "allow": ["read-files", "write-outputs"],
      "deny": ["edit-files"]
    },
    { "id": "done", "kind": "stop", "name": "Done", "outcome": "success" }
  ],
  "edges": [
    { "id": "e-builder-tests", "from": "builder", "to": "tests" },
    { "id": "e-tests-fail", "from": "tests", "to": "builder", "when": "fail", "evidence": ["the failing test output"] },
    {
      "id": "e-tests-critic",
      "from": "tests",
      "to": "critic",
      "when": "pass",
      "isolation": "fresh",
      "evidence": ["the diff against the starting commit", "CHANGES.md", "the repository at the head commit, read-only"]
    },
    { "id": "e-critic-fail", "from": "critic", "to": "builder", "when": "fail", "evidence": ["REVIEW.md"] },
    { "id": "e-critic-pass", "from": "critic", "to": "done", "when": "pass" }
  ],
  "loops": [
    {
      "id": "fix",
      "name": "Fix",
      "mode": "judgment",
      "members": ["builder", "tests", "critic"],
      "back": ["e-tests-fail", "e-critic-fail"],
      "bar": {
        "name": "Test integrity",
        "inspects": [{ "kind": "file", "ref": "REVIEW.md" }],
        "acceptance": "No test file is changed, no test is skipped, deleted, retried, given a longer timeout or a looser assertion, and the checkout tests pass."
      },
      "stops": [
        { "kind": "bar-passed" },
        { "kind": "max-iterations", "n": 5 },
        { "kind": "budget", "measure": "minutes", "limit": 30 }
      ]
    }
  ]
}
```

To open it, go to https://ryanjosephkamp.github.io/grooph/, choose **Paste a document** and paste the JSON. I couldn't run the validator in this chat. If the app lists any issues, paste the list back to me and I'll repair the document.

**What bounds it:**
- **Rounds and time:** the loop stops after 5 rounds or 30 minutes, whichever comes first.
- **Finish line:** the run only ends when `pnpm test checkout` exits 0 and the critic passes the diff.
- **No weakening:** the builder's brief forbids touching tests. The critic then checks the actual diff on a stronger model tier, so the rule is checked and not only asked for.

**Choices to review:**
- **Lean version:** if you'd rather have no critic, I can drop it. The loop then ends on the test passing, but nothing would catch a weakened test.
- **Flakiness:** a single green run can be luck. If you want proof the flake is gone, give me a command that repeats the suite, such as a script that runs it ten times, and I'll put it in the check's `run` field. I haven't invented one.
- **Harness:** I set the target to `claude-code`. Say so if you use another.

I haven't started anything. Running it is your call.
