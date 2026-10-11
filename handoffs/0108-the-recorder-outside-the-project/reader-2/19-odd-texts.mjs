/**
 * Second reader, slice 0108. Settings a harness may well read and that are odd underneath: bytes that are not
 * UTF-8 (a file saved as Latin-1), a byte-order mark, an event written twice, "hooks" written twice.
 *
 *   node 19-odd-texts.mjs
 *
 * Every grooph run goes through the first reader's lib.mjs (scratch folders only).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { g, person, row, summary, S } from "../reader/lib.mjs";

const short = (t, n = 200) => (t.length > n ? `${t.slice(0, n)}...` : t).replaceAll(S, "<S>").replace(/\n/g, " / ");
let n = 0;
function tryBytes(what, bytes, verdictIfChanged) {
  const env = person(`o${(n += 1)}`);
  mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  const file = join(env.CLAUDE_CONFIG_DIR, "settings.json");
  writeFileSync(file, bytes);
  const i = g(env, ["hooks", "install", "--user"]);
  const mid = readFileSync(file);
  const r = g(env, ["hooks", "remove", "--user"]);
  const end = readFileSync(file);
  const keptBytes = (buf) => buf.includes(bytes.subarray(bytes.indexOf(0x22, 2), bytes.indexOf(0x7d)));
  const back = end.equals(bytes);
  row(what, 2, `install exit ${i.status}${i.status !== 0 ? `: "${short(i.err.trim())}"` : ""}; remove exit ${r.status}${r.status !== 0 ? `: "${short(r.err.trim())}"` : ""}; after install the person's own bytes are in the file as they were: ${i.status !== 0 ? "(nothing written)" : keptBytes(mid)}; after remove the file is byte for byte what it was: ${back}`, back ? (i.status === 0 ? "held" : "limit") : verdictIfChanged);
}
tryBytes("a settings file saved as Latin-1: {\"name\":\"caf<E9>\"} (one byte that is not UTF-8)", Buffer.concat([Buffer.from('{"name":"caf'), Buffer.from([0xe9]), Buffer.from('"}\n')]), "broke");
tryBytes("a string holding a lone surrogate written as bytes (ED A0 80)", Buffer.concat([Buffer.from('{"name":"x'), Buffer.from([0xed, 0xa0, 0x80]), Buffer.from('"}\n')]), "broke");
tryBytes("a byte-order mark before the object", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"name":"x"}\n')]), "broke");
tryBytes("an event written twice in hooks (a harness reads the second)", Buffer.from('{"name":"x","hooks":{"Stop":[],"Stop":[{"hooks":[{"type":"command","command":"say done"}]}]}}\n'), "broke");
tryBytes("hooks written twice (a harness reads the second)", Buffer.from('{"name":"x","hooks":{},"hooks":{"Notification":[{"hooks":[{"type":"command","command":"say done"}]}]}}\n'), "broke");
summary();
