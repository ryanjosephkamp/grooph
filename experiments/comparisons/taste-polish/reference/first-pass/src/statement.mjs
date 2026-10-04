// A plain first pass written from STYLE.md alone, without the reference statement: what the brief asks
// for, done the usual way. A heading with the customer and the month by name, a line for each service
// in aligned columns with amounts in dollars and cents (the platform's own number formatting, so
// thousands get their comma), credits and the total set apart under rules, 72 columns, plain characters.
// What the brief does not say it leaves as the data has it or as habit has it: the lines in the data's
// order, a line for every service, a dollar sign on each amount, a minus sign on a credit, no line that
// adds up the charges, no share column. Kept to show what the held-out suite does to such a pass. It is
// one author's reading, not a model's, and is never copied into a run.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WIDTH = 68;
const count = new Intl.NumberFormat("en-US");
const dollars = (cents) => `${cents < 0 ? "-" : ""}$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)}`;

export function renderStatement(data) {
  const [year, month] = data.period.split("-").map(Number);
  const row = (name, quantity, unit, amount) => `${name.padEnd(30)}${quantity.padStart(8)}  ${unit.padEnd(16)}${amount.padStart(12)}`.trimEnd();
  const rule = "-".repeat(WIDTH);
  const total = [...data.lines, ...data.credits].reduce((sum, item) => sum + item.amount_cents, 0);
  const out = [];
  out.push(`Usage statement for ${MONTHS[month - 1]} ${year}`);
  out.push(`${data.customer} (account ${data.account})`);
  out.push("");
  out.push(row("Service", "Quantity", "Unit", "Amount"));
  out.push(rule);
  for (const line of data.lines) out.push(row(line.service, count.format(line.quantity), line.unit, dollars(line.amount_cents)));
  out.push("");
  out.push("Credits");
  for (const credit of data.credits) out.push(row(credit.reason, "", "", dollars(credit.amount_cents)));
  out.push(rule);
  out.push(row(`Total due (${data.currency})`, "", "", dollars(total)));
  return `${out.join("\n")}\n`;
}
