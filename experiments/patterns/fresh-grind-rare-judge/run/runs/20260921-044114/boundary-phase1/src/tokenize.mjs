const OPERATORS = new Set(["+", "-", "*", "/", "^"]);

export function tokenize(text) {
  if (typeof text !== "string") {
    throw new TypeError("tokenize expects a string");
  }

  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === " " || ch === "\t" || ch === "\n") {
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

    if (OPERATORS.has(ch)) {
      tokens.push({ type: "op", value: ch, at: i });
      i += 1;
      continue;
    }

    if (isDigit(ch) || ch === ".") {
      const start = i;
      let j = i;
      let sawDigitBeforeDot = false;
      let sawDot = false;
      let sawDigitAfterDot = false;

      while (j < text.length && isDigit(text[j])) {
        sawDigitBeforeDot = true;
        j += 1;
      }

      if (j < text.length && text[j] === ".") {
        sawDot = true;
        const dotIndex = j;
        j += 1;
        const afterDotStart = j;
        while (j < text.length && isDigit(text[j])) {
          sawDigitAfterDot = true;
          j += 1;
        }

        if (!sawDigitBeforeDot || !sawDigitAfterDot) {
          throw new SyntaxError(
            `unexpected character at index ${dotIndex}`,
          );
        }
      }

      const raw = text.slice(start, j);
      tokens.push({ type: "number", value: Number(raw), at: start });
      i = j;
      continue;
    }

    throw new SyntaxError(`unexpected character at index ${i}`);
  }

  return tokens;
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}
