# Glossary

Terms as this project uses them. Definitions that carry rules live in `graph-ir.md`; this page is the short index.

| Term | Meaning |
|---|---|
| **Graph document** | The canonical JSON file that is the graph. Source of truth for every view. |
| **View** | A projection of the document: canvas, outline, package. Never a second source of truth. |
| **Node** | An agent or a named non-agent step (human gate, check, merge, stop). |
| **Edge** | A contract between nodes: condition, isolation, concurrency, evidence, approval. |
| **Loop** | A first-class object: member nodes, back edges, a bar, stops. |
| **Back edge** | An edge that returns work to an earlier member of a loop. One traversal is one round. |
| **Bar** | A named standard a critic compares against; it names inspectable evidence. An adjective is not a bar. |
| **Acceptance / aspiration** | The reachable "good enough to stop" and the directional target; only acceptance can stop a loop. |
| **Stop** | A structured rule that ends a loop: human, budget, bar-passed, diminishing-returns, evidence-invalid, max-iterations. |
| **Policy** | A rule attached to graph, loop, node or edge: critic isolation, no self-grading, ownership, concurrency cap. |
| **Judgment loop / grind loop** | A loop whose back edge is decided by an agent's verdict / by a deterministic check. |
| **Critic family / writer family** | Roles the rules treat as judges (critic, judge, red-team) / as producers (builder, synthesizer, planner). |
| **Evidence** | What a downstream node may inspect. Critics see evidence, never the builder's transcript. |
| **Package** | The compiled output for one harness: lead brief, node briefs, loop policy, progress contract, gate list, mapping notes, kickoff. |
| **Files mode / paste-only mode** | Package delivered as files in a repo / as one prompt that writes those files. |
| **Lead** | The harness's main session, which runs the graph. |
| **Run note** | Structured commentary appended by a run; imported onto the graph; never applied silently. |
| **Proposal** | A run note's suggested graph edit, accepted or rejected by the human. |
| **Pattern** | A named, validated template graph or subgraph in the library. |
| **Executive** | The harness session, using the `grooph-design` skill, that proposes candidate graphs. |
| **Slice** | The unit of handoff between driver and implementer. |
| **Handoff / handback / review** | The three files that carry a slice between sessions. |
