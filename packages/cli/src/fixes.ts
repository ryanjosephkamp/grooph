/**
 * What to do about each rule, in one line an agent can act on: the operation that usually
 * fixes it, as `grooph apply` and the `grooph_apply` tool take it (packages/core/README.md).
 *
 * The rule itself is in docs/graph-ir.md §3 and, with a failing document, in docs/rules.md.
 * A line here adds no rule and loosens none: it names the usual repair, and where the honest
 * repair is a decision (a gate, a bar, a budget) it says whose decision it is.
 *
 * `Record<ImplementedCode, …>` on purpose: a rule added to core does not build here until it
 * has a line. docs/agents.md prints the same lines (a test holds the two together).
 */

import type { ImplementedCode } from "@grooph/core";

export const FIXES: Record<ImplementedCode, string> = {
  E_SCHEMA:
    'The message names the path and what it expected. Set that field to a value the schema takes, with updateNode, updateEdge or updateLoop and "set"; a document that cannot be read at all is easier to start again from grooph_new.',
  E_DUPLICATE_ID:
    'Two objects share an id, the graph\'s own id included. Remove one and add it again under another id: {"op":"removeNode","id":"<id>"} then addNode with a new "id". renameId cannot help, because it cannot tell the two apart.',
  E_DANGLING_REF:
    'Something points at an id that does not exist. Add the missing object, or re-point the reference: {"op":"updateEdge","id":"<edge>","set":{"to":"<node that exists>"}}; for a loop, updateLoop with "members" or "back"; for a stop, setStop with a "then" that exists.',
  E_LOOP_BACK_EDGE:
    'A loop needs a back edge whose two ends are both members and that really closes a cycle inside them. Add the members first, then {"op":"toggleLoopBack","loop":"<loop>","edge":"<edge from the last member to an earlier one>","on":true}.',
  E_GROUP_CYCLE:
    'A group holds itself, directly or through another group, and groups form a tree. No operation edits groups: in the document itself, take the inner group\'s id out of one group\'s "members", and pass the whole document again.',
  E_SECOND_LEAD:
    'Two agent nodes have the role "lead", and a graph is one session with one lead. Keep one and say what the other does: {"op":"updateNode","id":"<the other>","set":{"role":"builder"}} (or critic, or a role of its own).',
  E_PERSON_LEAD:
    'The lead is the harness\'s own session, and no person can be it. Ask the person which they mean. If the mark is a mistake, take it off: {"op":"updateNode","id":"<the lead>","set":{"by":null}}. If a person does this step, it is not the lead: give it the role that says what they do, {"op":"updateNode","id":"<node>","set":{"role":"planner"}} (or builder, critic, a role of its own).',
  E_CYCLE_NO_STOP:
    'A cycle no loop with a stop covers. Wrap it: {"op":"addLoop","members":[…the cycle\'s nodes…]}, toggleLoopBack for its returning edge, then {"op":"addStop","loop":"<loop>","kind":"max-iterations","set":{"n":4}} and a budget stop.',
  E_JUDGMENT_LOOP_NO_BAR:
    'A loop a critic closes needs something to judge against: {"op":"setBar","loop":"<loop>","bar":{"name":"…","inspects":[{"kind":"file","ref":"<a file, checklist, metric or url that exists>"}],"acceptance":"<what is good enough to stop>"}}. If nothing inspectable exists yet, ask the person, or start from the spec-then-loop template.',
  E_STOP_NOT_INSPECTABLE:
    'The loop\'s only stop is "bar-passed" and the bar inspects nothing, so it stops on an adjective. Give the bar an "inspects" entry (setBar), and add a second brake: {"op":"addStop","loop":"<loop>","kind":"max-iterations"}.',
  E_NO_TARGET: 'Say which harness the package is for: {"op":"setTarget","harness":"claude-code"}.',
  E_NO_GOAL: 'Say what the run is for, in the person\'s words: {"op":"setGraphField","key":"goal","value":"<the goal>"}.',
  E_IS_TEMPLATE:
    'This document is a template, not a graph. Make a graph from it: grooph_use_template with its id, a name and the slot values (grooph template use <id> --name "…" on the command line).',
  E_UNFILLED_SLOT:
    'A {{slot}} is still in the text; [at: …] names the objects holding it. Ask the person for the value if you do not have it, then set the whole field: {"op":"updateNode","id":"<node>","set":{"brief":"<the text with the slot filled>"}} (setGraphField for the goal), or make the graph again with grooph_use_template and every value.',
  E_PERSON_STEP_NOT_COMPILED:
    'A step marked as a person\'s ("by":"person") makes this graph a plan: grooph does not yet hand a step to a person inside a harness, so no package is written. In a plan this is nothing to repair: grooph_export_plan (grooph plan <file> on the command line) writes it for people to follow. Only when the person says a harness is to run the whole of it: {"op":"updateNode","id":"<node>","set":{"by":null}} for each step the message names, and give each the model tier and capabilities an agent needs. Whose step it is is the person\'s decision, not yours.',
  E_CRITIC_NOT_ISOLATED:
    'An edge into a critic shares the builder\'s context or names no evidence. {"op":"updateEdge","id":"<edge>","set":{"isolation":"fresh","evidence":["<the diff, the files or the report the critic may read>"]}}. Do not remove the critic-isolation policy to pass: that loosens a brake.',
  E_OWNERSHIP_CONFLICT:
    'Two writers own the same artifact. Give it one owner: {"op":"updateNode","id":"<the other writer>","set":{"owns":[…without it…]}}; or, when both must write it, add a merge node whose "merges" lists it.',
  E_IRREVERSIBLE_NO_GATE:
    'A node that merges, publishes, spends or deletes can be reached without a person. Every way in must pass one: {"op":"updateEdge","id":"<each inbound edge>","set":{"approval":true}}, or put a human-gate node in front. Never drop the "irreversible" marker to pass.',
  W_HOMOGENEOUS_CRITICS:
    'A critic runs on the same tier as the writer it judges; one on a different tier may catch different mistakes. {"op":"updateNode","id":"<critic>","set":{"model":{"tier":"frontier"}}} (or any tier that differs); or keep it and tell the person plainly.',
  W_FANOUT_ON_COUPLED:
    'Parallel work is aimed at something marked coupled. Lower the edge to one at a time: {"op":"updateEdge","id":"<edge>","set":{"concurrency":{"max":1}}}, or give the coupled piece one owner.',
  W_LONG_LOOP_NO_BUDGET:
    'The loop has no budget and no small round cap. {"op":"addStop","loop":"<loop>","kind":"budget","set":{"measure":"dispatches","limit":12}}; choose the limit with the person when the work is costly.',
  W_ASPIRATION_AS_ACCEPTANCE:
    'The bar\'s "acceptance" is blank or repeats its "aspiration". Write an acceptance that can be reached and checked, and keep the aspiration for direction: setBar with both.',
  W_ONLY_MAX_ITERATIONS:
    'The loop ends only by running out of rounds. Give it a real stop: for a check loop the check passing ends it, so add {"op":"addStop","loop":"<loop>","kind":"budget"}; for a critic loop setBar and {"op":"addStop","loop":"<loop>","kind":"bar-passed"}.',
  W_UNREACHABLE_NODE:
    'Nothing leads to this node. Connect it: {"op":"connect","from":"<a node that runs>","to":"<node>"}, or remove it: {"op":"removeNode","id":"<node>"}. It usually comes with an error (a cycle or a dangling reference); fix that first.',
  W_NO_TERMINAL:
    'No stop node can be reached, so the run ends when the lead runs out of edges. {"op":"addNode","kind":"stop","name":"Done"} and connect the last node to it (with "when":"pass" after a check or a critic).',
  W_OUTPUT_NOT_WRITABLE:
    'The node must leave files behind and may not write. {"op":"updateNode","id":"<node>","set":{"allow":["read-files","write-outputs"]}} lets it write only its own outputs; a builder takes "edit-files".',
  W_PERSON_FIELDS_NOT_READ:
    'A person\'s step is given no model, effort, skills or capabilities: those are an agent\'s, and are not read. Take off the ones the message names: {"op":"updateNode","id":"<node>","set":{"model":null,"effort":null,"skills":null,"allow":null,"deny":null}}. What the person needs to know goes in the step\'s brief, inputs and outputs.',
  W_GROUP_OVERLAP:
    'A node or a group is in two groups and neither holds the other, so a view draws it in the first only. No operation edits groups: in the document itself, take it out of one group\'s "members", or put one group inside the other if that is what is meant; or keep it and tell the person.',
  W_UNKNOWN_KEY:
    'A key the schema does not know, usually a typo. Remove it by setting it to null in a "set" patch: {"op":"updateNode","id":"<node>","set":{"<the key>":null}}, and set the field it was meant to be.',
  W_DOC_TOO_LARGE:
    'The document is past what a model rewrites in one pass and what a link carries. Shorten the briefs: point at the project\'s own files (a path) and do not restate them; split work that is really two graphs.',
};

/** The fix lines for the codes in a list of issues, each once, in the order they first appear: `fix  <CODE>  <what to do>`. */
export function fixLines(issues: readonly { code: string }[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.code) || !Object.hasOwn(FIXES, issue.code)) continue;
    seen.add(issue.code);
    lines.push(`fix  ${issue.code}  ${FIXES[issue.code as ImplementedCode]}`);
  }
  return lines;
}
