// What the scorer checks about a usage statement: the properties of the reference statement, one case
// each, read from the text the project's renderer returns for its own data. Run from the project root:
//   node --test <this file>
// The file imports the project's src/statement.mjs and reads data/usage.json by the working directory.
//
// "style" holds what the project's STYLE.md asks for. The seven groups after it hold what only the
// reference statement shows (REFERENCE.md, points 1 to 7): structure, order, money, no usage, share,
// heading, usage. The checks read properties, not a layout: column widths, the wording of headings and
// the length of rules are free.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { renderStatement } = await import(pathToFileURL(join(process.cwd(), "src", "statement.mjs")).href);
const data = JSON.parse(readFileSync(join(process.cwd(), "data", "usage.json"), "utf8"));
const text = renderStatement(data);
const lines = text.replace(/\n+$/, "").split("\n");
const flat = text.replace(/\s+/g, " ");

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (cents) => `${grouped(Math.floor(Math.abs(cents) / 100))}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const plain = (cents) => `${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

const charged = data.lines.filter((line) => line.amount_cents !== 0);
const unused = data.lines.filter((line) => line.amount_cents === 0);
const subtotal = charged.reduce((sum, line) => sum + line.amount_cents, 0);
const total = subtotal + data.credits.reduce((sum, credit) => sum + credit.amount_cents, 0);

/** A figure in dollars and cents: digits, a point, exactly two digits (so not a share such as 39.5%). */
const MONEY = /\d\.\d\d(?![\d%])/;
/** The lines that carry an amount, wherever on the line it sits. */
const amountLines = lines.map((line, at) => ({ line, at })).filter(({ line }) => MONEY.test(line));
/** The first line that starts with a name (indented or not): a row of the table, not a sentence that mentions it. */
const rowOf = (name) => lines.findIndex((line) => line.trimStart().startsWith(name));
/** The line that states the total due: the last one that says "total" and carries the total's amount, or any amount. */
const totalAt = () => {
  const right = lines.findLastIndex((line) => /total/i.test(line) && (line.includes(money(total)) || line.includes(plain(total))));
  return right >= 0 ? right : lines.findLastIndex((line) => /total/i.test(line) && MONEY.test(line));
};
/** The column of the decimal point of an amount on a line, written with or without commas; -1 when the line does not carry it. */
const pointColumn = (at, cents) => {
  if (at < 0) return -1;
  for (const written of [money(cents), plain(cents)]) {
    const found = lines[at].lastIndexOf(written);
    if (found >= 0) return found + written.length - 3;
  }
  return -1;
};

// ── style: what STYLE.md asks for ────────────────────────────────────────
test("style: no line is wider than 72 characters", () => {
  assert.deepEqual(lines.filter((line) => line.length > 72), []);
});
test("style: no tabs and no spaces at the end of a line", () => {
  assert.ok(!text.includes("\t"));
  assert.deepEqual(lines.filter((line) => /\s$/.test(line)), []);
});
test("style: plain characters only (no box drawing, no color codes, no emoji)", () => {
  assert.ok(!/[─-▟\u001B]|[\u{1F000}-\u{1FAFF}]/u.test(text));
});
test("style: the heading names the customer and the account", () => {
  const head = lines.slice(0, 4).join("\n");
  assert.ok(head.includes(data.customer));
  assert.ok(head.includes(data.account));
});
test("style: every service with a charge has its own line, with its amount in dollars and cents", () => {
  for (const line of charged) {
    const at = rowOf(line.service);
    assert.ok(at >= 0, `no line for ${line.service}`);
    assert.ok(lines[at].includes(money(line.amount_cents)) || lines[at].includes(plain(line.amount_cents)), `${line.service}: ${lines[at]}`);
  }
});
test("style: the total due is right, to the cent", () => {
  const at = totalAt();
  assert.ok(at >= 0, "no line names a total with an amount");
  assert.ok(lines[at].includes(money(total)) || lines[at].includes(plain(total)), lines[at]);
});
test("style: the amounts of the charges and the total line up on the decimal point", () => {
  const columns = [...charged.map((line) => pointColumn(rowOf(line.service), line.amount_cents)), pointColumn(totalAt(), total)];
  assert.ok(columns.every((column) => column >= 0), "a charge or the total does not carry its amount on its line");
  assert.equal(new Set(columns).size, 1, `the decimal points sit in columns ${[...new Set(columns)].join(", ")}`);
});

// ── structure: the total is found at once (point 1) ──────────────────────
test("structure: a line adds up the charges, after the last charge and before the first credit", () => {
  const at = lines.findIndex((line) => line.includes(money(subtotal)) || line.includes(plain(subtotal)));
  assert.ok(at >= 0, `no line carries the charges' sum, ${money(subtotal)}`);
  assert.ok(at > Math.max(...charged.map((line) => rowOf(line.service))));
  assert.ok(at < Math.min(...data.credits.map((credit) => rowOf(credit.reason)).filter((n) => n >= 0)));
});
test("structure: the total due is the last line that carries an amount", () => {
  assert.ok(amountLines.length > 0);
  assert.equal(totalAt(), amountLines[amountLines.length - 1].at);
});
test("structure: a rule sits right above the total due", () => {
  const at = totalAt();
  assert.ok(at > 0, "no line names a total with an amount");
  const above = lines.slice(0, at).findLast((line) => line.trim() !== "") ?? "";
  assert.match(above, /^\s*([-=_])\1{19,}$/);
});

// ── order: largest first (point 2) ───────────────────────────────────────
test("order: charges are listed by amount, largest first, and equal amounts by name", () => {
  const expected = [...charged].sort((a, b) => b.amount_cents - a.amount_cents || a.service.localeCompare(b.service)).map((line) => line.service);
  const shown = [...charged].sort((a, b) => rowOf(a.service) - rowOf(b.service)).map((line) => line.service);
  assert.deepEqual(shown, expected);
});
test("order: credits are listed largest first", () => {
  const expected = [...data.credits].sort((a, b) => a.amount_cents - b.amount_cents).map((credit) => credit.reason);
  const shown = [...data.credits].sort((a, b) => rowOf(a.reason) - rowOf(b.reason)).map((credit) => credit.reason);
  assert.ok(data.credits.every((credit) => rowOf(credit.reason) >= 0));
  assert.deepEqual(shown, expected);
});
test("order: every credit comes after every charge and before the total due", () => {
  const credits = data.credits.map((credit) => rowOf(credit.reason));
  assert.ok(credits.every((at) => at >= 0));
  assert.ok(Math.min(...credits) > Math.max(...charged.map((line) => rowOf(line.service))));
  assert.ok(Math.max(...credits) < totalAt());
});

// ── money: amounts read as money (point 3) ───────────────────────────────
test("money: thousands carry a comma", () => {
  for (const cents of [...charged.map((line) => line.amount_cents), total].filter((c) => c >= 100000)) {
    assert.ok(text.includes(money(cents)), `${money(cents)} is not in the statement`);
    assert.ok(!new RegExp(`(^|[^\\d,])${plain(cents).replace(".", "\\.")}`, "m").test(text), `${plain(cents)} is written without its comma`);
  }
});
test("money: a credit is in parentheses, with no minus sign", () => {
  for (const credit of data.credits) {
    const at = rowOf(credit.reason);
    assert.ok(at >= 0, `no line for ${credit.reason}`);
    assert.ok(lines[at].includes(`(${money(credit.amount_cents)})`), lines[at]);
    assert.ok(!/[-−–]\s*\$?\d/.test(lines[at].slice(credit.reason.length)), `a minus sign: ${lines[at]}`);
  }
});
test("money: a credit's digits fall in line with the amounts above it", () => {
  const columns = [
    ...charged.map((line) => pointColumn(rowOf(line.service), line.amount_cents)),
    ...data.credits.map((credit) => pointColumn(rowOf(credit.reason), credit.amount_cents)),
    pointColumn(totalAt(), total),
  ];
  assert.ok(columns.every((column) => column >= 0), "a charge, a credit or the total does not carry its amount on its line");
  assert.equal(new Set(columns).size, 1, `the decimal points sit in columns ${[...new Set(columns)].join(", ")}`);
});
test("money: the currency is named once, and never as a sign on an amount", () => {
  assert.equal(text.split(data.currency).length - 1, 1, `${data.currency} should appear exactly once`);
  assert.ok(!text.includes("$"));
});

// ── no usage: nothing that says nothing (point 4) ────────────────────────
test("no usage: a service with no usage is not a line of the table", () => {
  for (const line of unused) {
    const at = rowOf(line.service);
    assert.ok(at < 0 || !MONEY.test(lines[at]), `${line.service} has a line with an amount`);
    assert.ok(!flat.includes(`${line.service} 0 `), `${line.service} is listed with a quantity of 0`);
  }
  assert.ok(!/(^|[^\d.,])0\.00\b/m.test(text), "an amount of 0.00 is shown");
});
test("no usage: a sentence at the foot says how many were left out and names them", () => {
  const foot = lines.slice(totalAt() + 1).join(" ").replace(/\s+/g, " ");
  assert.match(foot, /\bno usage\b/i);
  assert.match(foot, new RegExp(`\\b(${unused.length}|two)\\b`, "i"));
  for (const line of unused) assert.ok(foot.includes(line.service), `${line.service} is not named at the foot`);
});

// ── share: each charge's share (point 5) ─────────────────────────────────
test("share: each charge carries its percentage of the charges, to one decimal", () => {
  for (const line of charged) {
    const share = `${((line.amount_cents / subtotal) * 100).toFixed(1)}%`;
    const at = rowOf(line.service);
    assert.ok(at >= 0 && new RegExp(`(^|[^\\d.])${share.replace(".", "\\.")}`).test(lines[at]), `${line.service} should show ${share}: ${lines[at]}`);
  }
});
test("share: a credit carries no percentage", () => {
  for (const credit of data.credits) {
    const at = rowOf(credit.reason);
    assert.ok(at >= 0 && !lines[at].includes("%"), lines[at]);
  }
});

// ── heading: the month by name (point 6) ─────────────────────────────────
test("heading: the month is written by name, not in digits", () => {
  assert.ok(text.includes("September 2026"));
  assert.ok(!text.includes(data.period));
});
test("heading: the customer's name opens the statement, with the account number at the right of the same line", () => {
  assert.ok(lines[0].startsWith(data.customer), lines[0]);
  assert.ok(lines[0].endsWith(data.account), lines[0]);
});

// ── usage: the quantity with its unit (point 7) ──────────────────────────
test("usage: each charge shows its quantity, with a comma between thousands, beside its unit", () => {
  for (const line of charged) {
    const at = rowOf(line.service);
    assert.ok(at >= 0 && lines[at].includes(`${grouped(line.quantity)} ${line.unit}`), `${line.service} should show "${grouped(line.quantity)} ${line.unit}": ${lines[at]}`);
  }
});
