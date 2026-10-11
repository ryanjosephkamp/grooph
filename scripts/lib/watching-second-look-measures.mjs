/**
 * What the second look at watching reads from a session's record beyond what the first check read
 * (experiments/watching/second-look/README.md, "What is measured, and from where"). Everything here is read from the
 * harness's own files in the profile, and from the hook's file only where the two are set side by side. It starts
 * nothing, writes nothing and runs nothing a session wrote.
 *
 *   delegation   how many subagents were running at once, and the harness's own count of them beside the transcripts'
 *   noticed      tool calls that name, and results that show, the user-level places a recorder outside the project is
 *                kept in, and whether the final reply names the recorder: counts, never what was said
 *   agentByAgent the hook's file beside the harness's files, one subagent at a time: its start, each stop, who started
 *                it and its type, with every difference by its kind
 *
 * What is kept is ids, names, counts and times.
 */

import { existsSync, lstatSync, readFileSync } from "node:fs";

import { FOOTPRINT, transcriptsOf } from "./watching-check-paid.mjs";

const DISPATCH = new Set(["Agent", "Task"]);
const textOf = (content) => (Array.isArray(content) ? content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("\n") : typeof content === "string" ? content : "");
const tally = (names) => Object.fromEntries([...names.reduce((counts, name) => counts.set(name, (counts.get(name) ?? 0) + 1), new Map())].sort(([a], [b]) => a.localeCompare(b)));
const NO_ID = "\u0000no id: ";
const SESSION = "the session";

/** How the harness says a background subagent's run ended: its own notice to the session, which names the agent and a status. */
const NOTICE = /<task-id>([^<]+)<\/task-id>[\s\S]*?<status>([^<]+)<\/status>/g;

/**
 * One transcript, read once for what this look needs: every tool use and its result, when its first and last lines
 * were written, how many times it was carried on from, and (in the session's own) how the harness says each
 * subagent's run ended.
 */
export function readForAgents(file) {
  const uses = new Map();
  const results = new Map();
  const ended = [];
  let first = null;
  let last = null;
  let resumes = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!record || typeof record !== "object") continue;
    const at = typeof record.timestamp === "string" && !Number.isNaN(Date.parse(record.timestamp)) ? record.timestamp : null;
    if (at !== null) {
      if (first === null || Date.parse(at) < Date.parse(first)) first = at;
      if (last === null || Date.parse(at) > Date.parse(last)) last = at;
    }
    const content = Array.isArray(record.message?.content) ? record.message.content : [];
    if (record.type === "assistant") {
      for (const block of content) if (block?.type === "tool_use" && typeof block.name === "string") uses.set(typeof block.id === "string" ? block.id : `${NO_ID}use-${uses.size}`, { tool: block.name, input: block.input ?? {}, at });
    } else if (record.type === "user") {
      // A subagent that is handed more work after it finished: the harness writes the hand-over into its transcript.
      if (record.isMeta === true && record.origin?.kind === "coordinator") resumes += 1;
      const about = record.toolUseResult && typeof record.toolUseResult === "object" ? record.toolUseResult : null;
      for (const block of content) if (block?.type === "tool_result") results.set(block.tool_use_id, { refused: block.is_error === true, text: textOf(block.content), agent: typeof about?.agentId === "string" ? about.agentId : null, status: typeof about?.status === "string" ? about.status : null, at });
    } else if (record.type === "queue-operation" && record.operation === "enqueue") {
      const said = typeof record.content === "string" ? record.content : textOf(record.content);
      for (const found of said.matchAll(NOTICE)) ended.push({ agent: found[1].trim(), status: found[2].trim(), at });
    }
  }
  return { uses, results, ended, first, last, resumes };
}

/**
 * Every transcript of one session, read once, a tool use counted for the first transcript that holds it (a subagent
 * that carries on from its parent's conversation may hold its parent's lines): the session's own first.
 */
export function readSession(profile, sessionId) {
  const read = transcriptsOf(profile, sessionId).map((transcript) => ({ ...transcript, ...readForAgents(transcript.file) }));
  const claimed = new Set();
  for (const transcript of read) {
    for (const id of [...transcript.uses.keys()]) {
      if (claimed.has(id)) transcript.uses.delete(id);
      else if (!id.startsWith(NO_ID)) claimed.add(id);
    }
  }
  return read;
}

/** The most subagents whose transcripts were open at one moment: each from its first line to its last. */
export function mostAtOnce(spans) {
  const marks = spans.filter((span) => span.first !== null && span.last !== null).flatMap((span) => [[Date.parse(span.first), 1], [Date.parse(span.last), -1]]);
  // At one instant a start is counted before an end: two that touch were both there.
  marks.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let now = 0;
  let most = 0;
  for (const [, step] of marks) most = Math.max(most, (now += step));
  return most;
}

/** The delegation as this look reads it beyond the first check's measures. */
export function delegation({ read, output = null }) {
  const subagents = read.filter((transcript) => !transcript.lead);
  const counted = output?.subagent_stats && typeof output.subagent_stats === "object" ? output.subagent_stats : null;
  const used = Object.values(output?.modelUsage ?? {});
  const sum = (key) => (used.length > 0 ? used.reduce((total, model) => total + (Number(model?.[key]) || 0), 0) : null);
  return {
    any: subagents.length > 0,
    subagents_in_the_transcripts: subagents.length,
    most_at_once: mostAtOnce(subagents),
    most_at_once_is: "the most subagents whose transcripts were open at one moment, each from its first line to its last",
    as_the_harness_counts: counted,
    the_harness_counts_as_many_as_there_are_transcripts: counted && Number.isInteger(counted.spawned) ? counted.spawned === subagents.length : null,
    // The session's and its subagents' together, by the harness's own result: its `usage` is the session's alone.
    tokens_put_out_with_its_subagents: sum("outputTokens"),
    tokens_written_to_the_cache_with_its_subagents: sum("cacheCreationInputTokens"),
  };
}

/**
 * The user-level places a recorder outside the project is kept in, as what to look for in a call or a result. The same
 * five are looked for in every arm, so that the plain arm shows what the count picks up when nothing is there.
 */
export function userLevelPlaces({ profileSettings, groophHome }) {
  return [
    { name: "the profile's own settings file", in: (text) => text.includes(profileSettings) || /CLAUDE_CONFIG_DIR[}"']?\/settings\.json/.test(text) },
    { name: "grooph's own folder for the run", in: (text) => text.includes(groophHome) },
    { name: "the hook's file name", in: (text) => text.includes("grooph-event") },
    { name: "a variable of grooph's", in: (text) => /\bGROOPH_[A-Z][A-Z_]*/.test(text) },
    { name: "the launcher's own files", in: (text) => ["launch-outside", "outside-install", "settings-with-the-recorder"].some((name) => text.includes(name)) },
  ];
}

/**
 * Whether the recorder was noticed, as counts: calls that name a user-level place, results that show one, how many of
 * those calls came back refused, and whether the final reply names the recorder at all, in the project or outside it.
 * What a call said, what came back and what the reply says are not kept.
 */
export function noticed({ read, output = null, profileSettings, groophHome }) {
  const places = userLevelPlaces({ profileSettings, groophHome });
  const every = read.flatMap((transcript) => [...transcript.uses].map(([id, use]) => ({ ...use, asked: JSON.stringify(use.input ?? {}), result: transcript.results.get(id) ?? null })));
  const which = (text) => places.filter((place) => place.in(text)).map((place) => place.name);
  const naming = every.map((use) => ({ use, places: which(use.asked) })).filter((entry) => entry.places.length > 0);
  const shown = every.map((use) => ({ use, places: use.result ? which(use.result.text) : [], named: which(use.asked) })).filter((entry) => entry.places.length > 0);
  // A result that shows a place the call itself did not name told the session something: a refused `cat` of a path
  // echoes the path it was given and tells it nothing. The two are kept apart.
  const told = shown.filter((entry) => entry.places.some((place) => !entry.named.includes(place)));
  const reply = typeof output?.result === "string" ? output.result : null;
  const inTheProject = reply === null ? [] : FOOTPRINT.filter((path) => reply.includes(path));
  const outside = reply === null ? [] : which(reply);
  return {
    counts: "tool calls, the session's and its subagents', that name a user-level place a recorder outside the project is kept in, and results that show one. Two counts, kept apart; one call may be in both. Counts only: nothing a call said and nothing that came back is kept. The same places are looked for in every arm",
    places: places.map((place) => place.name),
    named_in_the_input: { calls: naming.length, by_tool: tally(naming.map((entry) => entry.use.tool)), by_place: tally(naming.flatMap((entry) => entry.places)), of_them_refused: naming.filter((entry) => entry.use.result?.refused === true).length },
    shown_in_the_result: { calls: shown.length, by_tool: tally(shown.map((entry) => entry.use.tool)), by_place: tally(shown.flatMap((entry) => entry.places)), of_them_showing_a_place_the_call_did_not_name: told.length },
    // The word "hook" is counted apart: a reply may speak of a hook without naming any place. A count, in every arm.
    the_final_reply: reply === null ? { read: false, names_the_recorder: null } : { read: true, names_the_recorder: inTheProject.length + outside.length > 0, in_the_project: inTheProject, outside_it: outside, uses_the_word_hook: /\bhooks?\b/i.test(reply) },
  };
}

/** The kinds a difference between the hook's file and the harness's files is written under. */
export const DIFFERENCES = {
  noStart: "no start line",
  fewerStarts: "fewer start lines than runs",
  moreStarts: "more start lines than runs",
  fewerStops: "fewer stop lines than runs",
  notEnded: "no stop line for a run the harness's files do not show ending",
  moreStops: "more stop lines than runs",
  type: "a type that differs",
  parent: "a parent that differs",
  noParent: "no line that names its parent",
  stranger: "a line for an agent the harness has no file for",
};
/** What is expected, from this project's own sessions (handoffs/0104-the-live-graph/RECORDS.md §2), and named apart from a difference. */
export const EXPECTED = {
  failed: "a run that failed has no stop line",
  lateParent: "a foreground child's parent is known only at its end",
  helpers: "stop lines that name an agent and no type",
};

/** The hook's lines for one session, from the copy a record keeps: a plain file, never through a link. */
export function hookLines(file) {
  const lines = [];
  let unread = 0;
  let found = false;
  try {
    found = Boolean(file) && existsSync(file) && lstatSync(file).isFile();
  } catch {}
  if (found) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event && typeof event === "object" && !Array.isArray(event)) lines.push(event);
        else unread += 1;
      } catch {
        unread += 1;
      }
    }
  }
  return { found, lines, unread };
}

/**
 * The hook's file set beside the harness's files, agent by agent.
 *
 * From the harness: a subagent is a transcript; its type and who started it are in the file beside that; it ran once
 * and once more for each time it was carried on from; and how a run ended is in the harness's notice to the session
 * (a background run) or on the result of the call that started it (a foreground one).
 * From the hook: a start line and a stop line carry the agent's id and its type; the line for the call that started a
 * subagent carries the id it started, and the id of the subagent that made the call when one did.
 */
export function agentByAgent({ read, eventsFile }) {
  const hook = hookLines(eventsFile);
  const lead = read.find((transcript) => transcript.lead) ?? null;
  const subagents = read.filter((transcript) => !transcript.lead);
  const known = new Set(subagents.map((transcript) => transcript.agent));
  // Which transcript holds the tool use that started each subagent.
  const owner = new Map();
  for (const transcript of read) for (const [id, use] of transcript.uses) if (DISPATCH.has(use.tool)) owner.set(id, transcript);
  const startedBy = (transcript) => {
    if (typeof transcript.meta.parentAgentId === "string" && transcript.meta.parentAgentId !== "") return { parent: transcript.meta.parentAgentId, from: "the file beside its transcript" };
    const by = owner.get(transcript.meta.toolUseId);
    if (by) return { parent: by.lead ? SESSION : by.agent, from: "the tool use that started it" };
    if (transcript.meta.spawnDepth === 1) return { parent: SESSION, from: "its depth, in the file beside its transcript" };
    return { parent: null, from: null };
  };
  // How the harness says each run ended: its notices to the session, and the results of foreground calls anywhere.
  const endings = new Map();
  const note = (agent, status) => endings.set(agent, [...(endings.get(agent) ?? []), status]);
  for (const notice of lead?.ended ?? []) note(notice.agent, notice.status);
  for (const transcript of read) for (const result of transcript.results.values()) if (result.agent !== null && result.status !== null && result.status !== "async_launched") note(result.agent, result.status);

  const of = (event, id) => hook.lines.filter((line) => line.event === event && line.agent === id);
  const each = subagents.map((transcript) => {
    const id = transcript.agent;
    const runs = 1 + transcript.resumes;
    const starts = of("subagent-start", id);
    const stops = of("subagent-stop", id).filter((line) => typeof line.type === "string");
    const ended = endings.get(id) ?? [];
    const notCompleted = ended.filter((status) => status !== "completed").length;
    const harnessType = typeof transcript.meta.agentType === "string" && transcript.meta.agentType !== "" ? transcript.meta.agentType : null;
    const hookTypes = [...new Set([...starts, ...stops].map((line) => line.type).filter((type) => typeof type === "string"))].sort();
    const harnessParent = startedBy(transcript);
    const naming = hook.lines.filter((line) => line.event === "tool" && line.spawned === id);
    const hookParent = naming.length === 0 ? null : typeof naming[0].agent === "string" ? naming[0].agent : SESSION;
    // The line that names who started it is written when the call returns: for a foreground child, at the child's end.
    const namedAt = naming.length === 0 || typeof naming[0].t !== "string" ? null : Date.parse(naming[0].t);
    const late = namedAt !== null && transcript.last !== null && namedAt >= Date.parse(transcript.last) - 1000 && Date.parse(transcript.last) - Date.parse(transcript.first ?? transcript.last) >= 2000;
    const differences = [];
    const expected = [];
    if (starts.length === 0) differences.push(DIFFERENCES.noStart);
    else if (starts.length < runs) differences.push(DIFFERENCES.fewerStarts);
    else if (starts.length > runs) differences.push(DIFFERENCES.moreStarts);
    if (stops.length > runs) differences.push(DIFFERENCES.moreStops);
    else if (stops.length < runs) {
      // A run the harness says did not complete is not expected to have a stop line. Any other missing one is a
      // difference, and of two kinds: the harness's files show the run ending and the hook has no line for it, or they
      // show no ending either (a subagent still running when the session's own files stop).
      if (runs - stops.length <= notCompleted) expected.push(EXPECTED.failed);
      else if (ended.length < runs) differences.push(DIFFERENCES.notEnded);
      else differences.push(DIFFERENCES.fewerStops);
    }
    if (harnessType !== null && hookTypes.some((type) => type !== harnessType)) differences.push(DIFFERENCES.type);
    if (hookParent === null) differences.push(DIFFERENCES.noParent);
    else if (harnessParent.parent !== null && hookParent !== harnessParent.parent) differences.push(DIFFERENCES.parent);
    else if (late) expected.push(EXPECTED.lateParent);
    return {
      agent: id,
      type: { in_the_harnesss_files: harnessType, in_the_hooks_lines: hookTypes },
      runs: { in_the_harnesss_files: runs, ended_as_the_harness_says: ended, start_lines: starts.length, stop_lines: stops.length },
      started_by: {
        in_the_harnesss_files: harnessParent.parent,
        read_from: harnessParent.from,
        in_the_hooks_lines: hookParent,
        known_to_the_hook: namedAt === null ? null : late ? "only at its end" : "while it ran",
        seconds_after_its_first_line: namedAt === null || transcript.first === null ? null : Math.round((namedAt - Date.parse(transcript.first)) / 10) / 100,
      },
      asked_for: transcript.meta.requestShape === "background" || transcript.meta.requestShape === "foreground" ? transcript.meta.requestShape : "not said",
      differences,
      expected,
    };
  });
  // Lines that name an agent the harness has no transcript for. With a type (or as the id a call started) it is a
  // subagent the harness's files do not hold; with none it is one of the harness's own helpers, which leave no transcript.
  const named = hook.lines.flatMap((line) => [typeof line.agent === "string" ? { id: line.agent, typed: typeof line.type === "string" } : null, typeof line.spawned === "string" ? { id: line.spawned, typed: true } : null].filter(Boolean));
  const strangers = named.filter((entry) => !known.has(entry.id));
  const typed = [...new Set(strangers.filter((entry) => entry.typed).map((entry) => entry.id))].sort();
  const helpers = strangers.filter((entry) => !entry.typed);
  const byKind = (key) => {
    const kinds = new Map();
    for (const agent of each) for (const kind of agent[key]) kinds.set(kind, [...(kinds.get(kind) ?? []), agent.agent]);
    return kinds;
  };
  const differences = byKind("differences");
  if (typed.length > 0) differences.set(DIFFERENCES.stranger, typed);
  const expected = byKind("expected");
  return {
    read_from: "the hook's own file as the record keeps it, set beside the harness's own files in the profile: each subagent's transcript and the file beside it, and the session's transcript for how each run ended",
    the_hooks_file: { found: hook.found, lines: hook.lines.length, lines_that_are_not_events: hook.unread, by_event: tally(hook.lines.map((line) => String(line.event))) },
    subagents_in_the_harnesss_files: subagents.length,
    each,
    differences: { count: [...differences.values()].reduce((sum, agents) => sum + agents.length, 0), by_kind: Object.fromEntries([...differences].sort(([a], [b]) => a.localeCompare(b))) },
    expected: {
      by_kind: Object.fromEntries([...expected].sort(([a], [b]) => a.localeCompare(b))),
      [EXPECTED.helpers]: { agents: new Set(helpers.map((entry) => entry.id)).size, lines: helpers.length, read_as: "the harness's own helpers, which leave no transcript (docs/subagents.md §5)" },
    },
    agrees: hook.found && [...differences.values()].every((agents) => agents.length === 0),
  };
}
