// What the scorer checks about a usage statement: the properties of the reference statement, one case
// each, read from the text the project's renderer returns for its own data. Run from the project root:
//   node --test <this file>
// The file imports the project's src/statement.mjs and reads data/usage.json by the working directory.
//
// "style" holds what the project's STYLE.md asks for. The seven groups after it hold what only the
// reference statement shows (REFERENCE.md, points 1 to 7): structure, order, money, no usage, share,
// heading, usage. The checks read properties, not a layout or a wording. A row is found by its name and
// its amount, wherever on the line they sit; the total by its amount; a rule by being a line of rule
// characters, of any length. Column widths, indents, the words of headings and labels, and the words of
// the sentence at the foot are free.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

// A renderer that is missing, or that throws, fails every case, each on its own.
let text = "";
let loadError;
const data = JSON.parse(readFileSync(join(process.cwd(), "data", "usage.json"), "utf8"));
try {
  const { renderStatement } = await import(pathToFileURL(join(process.cwd(), "src", "statement.mjs")).href);
  text = String(renderStatement(data)).replace(/\r\n/g, "\n");
} catch (error) {
  loadError = error;
}
const check = (name, body) =>
  test(name, () => {
    if (loadError) throw new assert.AssertionError({ message: `src/statement.mjs could not render the statement: ${loadError.message}` });
    body();
  });

const lines = text.replace(/\n+$/, "").split("\n");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const [year, month] = data.period.split("-").map(Number);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (cents) => `${grouped(Math.floor(Math.abs(cents) / 100))}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const plain = (cents) => `${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
/** Where a figure stands on a line as a figure of its own, not as part of a longer one; -1 when it does not. */
const figureAt = (line, figure) => {
  const found = new RegExp(`(?<![\\d.,])${escape(figure)}(?![\\d,]|\\.\\d)`).exec(line);
  return found ? found.index : -1;
};
/** Does a line carry an amount, written with commas or without? */
const carries = (line, cents) => figureAt(line, money(cents)) >= 0 || figureAt(line, plain(cents)) >= 0;
/** The column of an amount's decimal point on a line; -1 when the line does not carry it. */
const pointColumn = (at, cents) => {
  if (at < 0) return -1;
  for (const written of [money(cents), plain(cents)]) {
    const found = figureAt(lines[at], written);
    if (found >= 0) return found + written.length - 3;
  }
  return -1;
};

const charged = data.lines.filter((line) => line.amount_cents !== 0);
const unused = data.lines.filter((line) => line.amount_cents === 0);
const subtotal = charged.reduce((sum, line) => sum + line.amount_cents, 0);
const total = subtotal + data.credits.reduce((sum, credit) => sum + credit.amount_cents, 0);

/** A row of the table: the first line that names the item and carries its amount. */
const rowOf = (name, cents) => lines.findIndex((line) => line.includes(name) && carries(line, cents));
const chargeRows = charged.map((line) => rowOf(line.service, line.amount_cents));
const creditRows = data.credits.map((credit) => rowOf(credit.reason, credit.amount_cents));
const lastRow = Math.max(-1, ...chargeRows, ...creditRows);
/** The line that states the total due: the first after the table's rows that carries the total's amount (a note further down may repeat it), or else the last that does. */
const totalAt = (() => {
  const after = lines.findIndex((line, at) => at > lastRow && carries(line, total));
  return after >= 0 ? after : lines.findLastIndex((line) => carries(line, total));
})();
/** The line that adds up the charges: the first after the last charge's row that carries their sum. */
const subtotalAt = lines.findIndex((line, at) => at > Math.max(-1, ...chargeRows) && at !== totalAt && carries(line, subtotal));
/** The heading: every line above the first that names a service. */
const firstNamed = lines.findIndex((line) => data.lines.some((item) => line.includes(item.service)));
const heading = lines.slice(0, firstNamed < 0 ? lines.length : firstNamed).join("\n");

// ── style: what STYLE.md asks for ────────────────────────────────────────
check("style: no line is wider than 72 characters", () => {
  assert.deepEqual(lines.filter((line) => line.length > 72), []);
});
check("style: no tabs and no spaces at the end of a line", () => {
  assert.ok(!text.includes("\t"));
  assert.deepEqual(lines.filter((line) => /\s$/.test(line)), []);
});
check("style: plain characters only (no box drawing, no color codes, no emoji)", () => {
  assert.ok(!/[─-▟]/.test(text), "box drawing");
  assert.ok(!/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/.test(text), "a control character, as a color code has");
  assert.ok(!/\p{Extended_Pictographic}/u.test(text.replace(/[#*0-9©®™]/g, "")), "an emoji");
});
check("style: the heading says whose statement it is and for which month", () => {
  assert.ok(heading.includes(data.customer), "the customer is not named above the table");
  assert.ok(heading.includes(String(year)) && new RegExp(`\\b0?${month}\\b|${MONTHS[month - 1].slice(0, 3)}`, "i").test(heading), "the month is not named above the table");
});
check("style: every charge has a line of its own, with its amount in dollars and cents", () => {
  for (const [i, line] of charged.entries()) assert.ok(chargeRows[i] >= 0, `no line names ${line.service} with ${money(line.amount_cents)}`);
  assert.equal(new Set(chargeRows).size, charged.length, "two charges share a line");
});
check("style: the total due is right, to the cent", () => {
  assert.ok(totalAt >= 0, `no line carries the total, ${money(total)}`);
});
check("style: the charges' amounts line up on the decimal point", () => {
  const columns = charged.map((line, i) => pointColumn(chargeRows[i], line.amount_cents));
  assert.ok(columns.every((column) => column >= 0), "a charge does not carry its amount on its line");
  assert.equal(new Set(columns).size, 1, `the decimal points sit in columns ${[...new Set(columns)].join(", ")}`);
});

// ── structure: the total is found at once (point 1) ──────────────────────
check("structure: a line adds up the charges, after the last charge and before the first credit", () => {
  assert.ok(subtotalAt >= 0, `no line after the charges carries their sum, ${money(subtotal)}`);
  assert.ok(creditRows.every((at) => at >= 0), "a credit has no row");
  assert.ok(subtotalAt < Math.min(...creditRows), "the charges are added up after a credit");
});
check("structure: the total due is the last of the figures", () => {
  assert.ok(totalAt >= 0, "no line carries the total");
  assert.ok(chargeRows.every((at) => at >= 0) && creditRows.every((at) => at >= 0), "a charge or a credit has no row");
  assert.ok(totalAt > lastRow, "a charge or a credit comes after the total");
  assert.ok(subtotalAt < totalAt, "the charges are added up after the total");
});
check("structure: a rule sits right above the total due", () => {
  assert.ok(totalAt > 0, "no line carries the total");
  const above = lines.slice(0, totalAt).findLast((line) => line.trim() !== "") ?? "";
  assert.match(above, /^[\s\-=_.~*·]+$/, `the line above the total is not a rule: ${above}`);
  assert.ok(above.replace(/\s/g, "").length >= 3, "a rule has at least three characters");
});

// ── order: largest first (point 2) ───────────────────────────────────────
check("order: charges are listed by amount, largest first, and equal amounts by name", () => {
  assert.ok(chargeRows.every((at) => at >= 0), "a charge has no row");
  const expected = [...charged].sort((a, b) => b.amount_cents - a.amount_cents || (a.service < b.service ? -1 : 1)).map((line) => line.service);
  const shown = charged.map((line, i) => [chargeRows[i], line.service]).sort((a, b) => a[0] - b[0]).map((pair) => pair[1]);
  assert.deepEqual(shown, expected);
});
check("order: credits are listed largest first", () => {
  assert.ok(creditRows.every((at) => at >= 0), "a credit has no row");
  const expected = [...data.credits].sort((a, b) => a.amount_cents - b.amount_cents).map((credit) => credit.reason);
  const shown = data.credits.map((credit, i) => [creditRows[i], credit.reason]).sort((a, b) => a[0] - b[0]).map((pair) => pair[1]);
  assert.deepEqual(shown, expected);
});
check("order: every credit comes after every charge and before the total due", () => {
  assert.ok(chargeRows.every((at) => at >= 0) && creditRows.every((at) => at >= 0), "a charge or a credit has no row");
  assert.ok(Math.min(...creditRows) > Math.max(...chargeRows));
  assert.ok(Math.max(...creditRows) < totalAt);
});

// ── money: amounts read as money (point 3) ───────────────────────────────
check("money: thousands carry a comma", () => {
  const large = [...charged.map((line) => line.amount_cents), total].filter((cents) => cents >= 100000);
  for (const cents of large) assert.ok(lines.some((line) => figureAt(line, money(cents)) >= 0), `${money(cents)} is not in the statement`);
  for (const cents of [...large, subtotal]) assert.ok(!lines.some((line) => figureAt(line, plain(cents)) >= 0), `${plain(cents)} is written without its comma`);
});
check("money: a credit is in parentheses, with no minus sign", () => {
  for (const [i, credit] of data.credits.entries()) {
    assert.ok(creditRows[i] >= 0, `no line names ${credit.reason} with its amount`);
    const row = lines[creditRows[i]];
    assert.match(row, new RegExp(`\\(\\s*${escape(money(credit.amount_cents))}\\s*\\)`), `not in parentheses: ${row}`);
    assert.ok(!new RegExp(`[-\\u2212\\u2013]\\s*[$(]?\\s*${escape(money(credit.amount_cents))}`).test(row), `a minus sign: ${row}`);
  }
});
check("money: the credits' and the total's digits fall in line with the charges'", () => {
  const columns = [
    ...charged.map((line, i) => pointColumn(chargeRows[i], line.amount_cents)),
    ...data.credits.map((credit, i) => pointColumn(creditRows[i], credit.amount_cents)),
    pointColumn(totalAt, total),
  ];
  assert.ok(columns.every((column) => column >= 0), "a charge, a credit or the total does not carry its amount on its line");
  assert.equal(new Set(columns).size, 1, `the decimal points sit in columns ${[...new Set(columns)].join(", ")}`);
});
check("money: the currency is named once, above the table, and never as a sign on an amount", () => {
  assert.ok(!/[$€£]/.test(text), "a currency sign");
  const named = new RegExp(`${escape(data.currency)}|dollars`, "i");
  const where = lines.map((line, at) => (named.test(line) ? at : -1)).filter((at) => at >= 0);
  assert.equal(where.length, 1, `the currency is named on ${where.length} lines`);
  assert.ok(firstNamed >= 0 && where[0] < firstNamed, "the currency is not named above the first line that names a service");
});

// ── no usage: nothing that says nothing (point 4) ────────────────────────
check("no usage: a service with no usage is not a line of the table", () => {
  assert.ok(totalAt >= 0, "no line carries the total, so the table has no end");
  for (const line of unused) {
    const at = lines.findIndex((row, i) => i <= totalAt && row.includes(line.service));
    assert.ok(at < 0, `${line.service} is listed above the total: ${lines[at]}`);
  }
});
check("no usage: a sentence at the foot says how many were left out and names them", () => {
  assert.ok(totalAt >= 0, "no line carries the total, so the statement has no foot");
  const foot = lines.slice(totalAt + 1).join(" ").replace(/\s+/g, " ");
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  assert.match(foot, new RegExp(`\\b(${unused.length}|${words[unused.length] ?? unused.length})\\b`, "i"), "the foot does not say how many");
  for (const line of unused) assert.ok(foot.includes(line.service), `${line.service} is not named at the foot`);
});

// ── share: each charge's share (point 5) ─────────────────────────────────
const shareOf = (line) => ((line.amount_cents / subtotal) * 100).toFixed(1);
const showsShare = (line, i) => chargeRows[i] >= 0 && figureAt(lines[chargeRows[i]], shareOf(line)) >= 0;
check("share: each charge carries its percentage of the charges, to one decimal", () => {
  for (const [i, line] of charged.entries()) assert.ok(showsShare(line, i), `${line.service} should show ${shareOf(line)}`);
});
check("share: the shares are the charges' alone: a credit carries none", () => {
  assert.ok(charged.some(showsShare), "no charge shows a share, so there is no share column to keep the credits out of");
  for (const [i, credit] of data.credits.entries()) {
    assert.ok(creditRows[i] >= 0, `no line names ${credit.reason} with its amount`);
    assert.ok(!/\d\s*%/.test(lines[creditRows[i]]), `a percentage on a credit: ${lines[creditRows[i]]}`);
  }
});

// ── heading: the month by name (point 6) ─────────────────────────────────
check("heading: the month is written by name, not in digits", () => {
  const name = MONTHS[month - 1];
  assert.match(text, new RegExp(`\\b(${name}|${name.slice(0, 3)}|${name.slice(0, 4)})\\b\\.?[^\\n]{0,14}\\b${year}\\b`, "i"), "the month is not written by name");
  assert.ok(!text.includes(data.period), `the month is still written ${data.period}`);
});
check("heading: the customer's name opens the statement, with the account number at the right of the same line", () => {
  const first = (lines.find((line) => line.trim() !== "") ?? "").trim();
  assert.ok(first.startsWith(data.customer), `the statement opens with: ${first}`);
  assert.match(first, new RegExp(`${escape(data.account)}\\W{0,2}$`), `the account number does not end the line: ${first}`);
});

// ── usage: the quantity with its unit (point 7) ──────────────────────────
check("usage: each charge shows its quantity, with a comma between thousands, beside its unit", () => {
  for (const [i, line] of charged.entries()) {
    assert.ok(chargeRows[i] >= 0, `no row for ${line.service}`);
    assert.match(lines[chargeRows[i]], new RegExp(`(?<![\\d,])${escape(grouped(line.quantity))}\\s+${escape(line.unit)}`), `${line.service} should show "${grouped(line.quantity)} ${line.unit}": ${lines[chargeRows[i]]}`);
  }
});
