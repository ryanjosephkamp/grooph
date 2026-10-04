// A careful first pass written from STYLE.md alone, without the reference statement: a heading, one
// line per service in aligned columns with dollars and cents, credits and the total set apart, 72
// columns, plain characters, exact numbers. What STYLE.md does not say it leaves as the data has it:
// the order of the lines, the month as the data writes it, a line for every service, a currency sign
// on each amount, a minus sign on a credit. Kept to show that the held-out suite separates such a
// pass from one that has seen the reference; it is one author's reading, not a model's, and is never
// copied into a run.

const dollars = (cents) => `${cents < 0 ? "-" : ""}$${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const WIDTH = 68;

export function renderStatement(data) {
  const row = (name, quantity, unit, amount) => `${name.padEnd(30)}${quantity.padStart(8)}  ${unit.padEnd(16)}${amount.padStart(12)}`.trimEnd();
  const rule = "-".repeat(WIDTH);
  const total = [...data.lines, ...data.credits].reduce((sum, item) => sum + item.amount_cents, 0);
  const out = [];
  out.push(`Usage statement: ${data.customer} (account ${data.account})`);
  out.push(`Period: ${data.period}`);
  out.push("");
  out.push(row("Service", "Quantity", "Unit", "Amount"));
  out.push(rule);
  for (const line of data.lines) out.push(row(line.service, String(line.quantity), line.unit, dollars(line.amount_cents)));
  out.push("");
  out.push("Credits");
  for (const credit of data.credits) out.push(row(credit.reason, "", "", dollars(credit.amount_cents)));
  out.push(rule);
  out.push(row(`Total due (${data.currency})`, "", "", dollars(total)));
  return `${out.join("\n")}\n`;
}
