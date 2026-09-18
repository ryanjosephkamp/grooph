/** Small markdown helpers. Everything a compiler emits is deterministic. */

export const lines = (...parts: (string | false | undefined | null)[]): string =>
  parts.filter((p): p is string => typeof p === "string").join("\n");

/** Joins blocks with one blank line between them and ends with a single newline. */
export const doc = (...blocks: (string | false | undefined | null)[]): string =>
  `${blocks.filter((b): b is string => typeof b === "string" && b !== "").join("\n\n")}\n`;

export const bullet = (text: string): string => `- ${text}`;

export const fence = (body: string, lang = ""): string => "```" + lang + "\n" + body + "\n```";

export const table = (headers: string[], rows: string[][]): string =>
  lines(
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  );

/** Inline code, with pipes escaped so a cell never breaks a table. */
export const code = (text: string): string => `\`${text.replace(/\|/g, "\\|")}\``;

export const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** First sentence of a brief, for a subagent `description`. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^.*?[.!?](?=\s|$)/s.exec(trimmed);
  const sentence = (match ? match[0] : trimmed).replace(/\s+/g, " ").trim();
  return sentence;
}

export const quoteYaml = (text: string): string => {
  const single = text.replace(/\s+/g, " ").trim();
  return /^[A-Za-z0-9][A-Za-z0-9 ,.'·/()-]*$/.test(single) ? single : JSON.stringify(single);
};
