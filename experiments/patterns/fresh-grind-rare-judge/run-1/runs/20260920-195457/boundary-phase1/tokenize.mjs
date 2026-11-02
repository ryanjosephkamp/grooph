const OPS = new Set(["+", "-", "*", "/", "^"]);

const isDigit = (ch) => ch >= "0" && ch <= "9";

export function tokenize(text) {
  if (typeof text !== "string") {
    throw new TypeError(`tokenize expects a string, got ${typeof text}`);
  }

  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(", at: i });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")", at: i });
      i += 1;
      continue;
    }

    if (OPS.has(ch)) {
      tokens.push({ type: "op", value: ch, at: i });
      i += 1;
      continue;
    }

    if (isDigit(ch) || ch === ".") {
      const start = i;
      let end = i;

      while (end < text.length && isDigit(text[end])) {
        end += 1;
      }

      if (end < text.length && text[end] === ".") {
        const dotAt = end;
        const hasDigitBefore = dotAt > start;
        const hasDigitAfter = dotAt + 1 < text.length && isDigit(text[dotAt + 1]);

        if (!hasDigitBefore || !hasDigitAfter) {
          throw new SyntaxError(`unexpected "." at index ${dotAt}`);
        }

        end = dotAt + 1;
        while (end < text.length && isDigit(text[end])) {
          end += 1;
        }
      }

      if (end === start) {
        throw new SyntaxError(`unexpected character at index ${start}`);
      }

      tokens.push({
        type: "number",
        value: Number(text.slice(start, end)),
        at: start,
      });
      i = end;
      continue;
    }

    throw new SyntaxError(`unexpected character at index ${i}`);
  }

  return tokens;
}
