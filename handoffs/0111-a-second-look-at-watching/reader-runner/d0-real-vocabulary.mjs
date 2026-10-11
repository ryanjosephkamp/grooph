// D0. What the harness's own files really hold, where the measures lean on a word or a shape: read from this project's
// own sessions on this Mac (the folders RECORDS.md read), and from nothing else. READ ONLY: it opens transcripts, counts,
// and prints counts and the harness's own status words (a word is printed only if it is lower-case letters and
// underscores, at most 24 of them; anything else is counted as "(not a word)"). Nothing a session read, wrote or said
// is printed. This one is run with the real home, since that is where the files are; it writes nothing anywhere.
//
//   node handoffs/0111-a-second-look-at-watching/reader-runner/d0-real-vocabulary.mjs
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.READER_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { readSession } = await import(join(root, "scripts", "lib", "watching-second-look-measures.mjs"));
const profile = join(homedir(), ".claude");
const projects = join(profile, "projects");
const word = (text) => (/^[a-z_]{1,24}$/.test(String(text)) ? String(text) : "(not a word)");
const tally = new Map();
const add = (what, key) => tally.set(what, { ...(tally.get(what) ?? {}), [key]: ((tally.get(what) ?? {})[key] ?? 0) + 1 });
let sessions = 0;
let subagents = 0;
for (const project of existsSync(projects) ? readdirSync(projects).filter((name) => name.startsWith("-Users-noir-Documents-grooph")) : []) {
  for (const name of readdirSync(join(projects, project)).filter((file) => file.endsWith(".jsonl"))) {
    const read = readSession(profile, name.slice(0, -6));
    const lead = read.find((transcript) => transcript.lead);
    if (!lead) continue;
    sessions += 1;
    const known = new Set(read.filter((transcript) => !transcript.lead).map((transcript) => transcript.agent));
    subagents += known.size;
    // The words on a result that names an agent, by the tool whose result it is: which of them are endings?
    for (const transcript of read) {
      for (const [id, result] of transcript.results) {
        if (result.agent === null || result.status === null) continue;
        const use = [...read].map((t) => t.uses.get(id)).find(Boolean);
        add(`a result that names an agent, on a call of ${word(use?.tool?.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "") ?? "a tool not found")}`, `${word(result.status)}${known.has(result.agent) ? "" : " (an agent with no transcript)"}`);
      }
    }
    // The words in the harness's notices, and how many notices one line holds.
    for (const notice of lead.ended) add("a notice to the session", `${word(notice.status)}${known.has(notice.agent) ? " (a subagent)" : " (not a subagent: a command in the background, or the like)"}`);
    // A subagent whose transcript begins before the call that started it: it holds lines that are not its own.
    const owner = new Map();
    for (const transcript of read) for (const [id, use] of transcript.uses) owner.set(id, use);
    for (const transcript of read.filter((t) => !t.lead)) {
      const startedAt = owner.get(transcript.meta.toolUseId)?.at;
      if (!startedAt || !transcript.first) add("a subagent's transcript, beside the call that started it", "the call or a time not found");
      else add("a subagent's transcript, beside the call that started it", Date.parse(transcript.first) < Date.parse(startedAt) - 1000 ? "BEGINS BEFORE the call (it holds lines of another's)" : "begins at or after the call");
      // Endings counted for one agent, against its runs.
      const runs = 1 + transcript.resumes;
      const endings = [...lead.ended.filter((n) => n.agent === transcript.agent).map((n) => n.status), ...read.flatMap((t) => [...t.results.values()].filter((r) => r.agent === transcript.agent && r.status !== null && r.status !== "async_launched").map((r) => r.status))];
      add("endings the measure would count for one subagent, against its runs", endings.length === runs ? "as many as runs" : endings.length > runs ? "MORE than runs" : "fewer than runs");
    }
  }
}
console.log(`${sessions} sessions with a transcript, ${subagents} subagents`);
for (const [what, counts] of [...tally].sort(([a], [b]) => a.localeCompare(b))) console.log(`${what}: ${JSON.stringify(counts)}`);
