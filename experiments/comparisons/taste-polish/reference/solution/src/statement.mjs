// The renderer of the reference statement: what it returns for task/data/usage.json is, byte for byte,
// held-out/reference.txt (scripts/lib/compare-projects.test.mjs holds the two together). Kept to show
// the held-out suite can be passed; it is never copied into a run.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SERVICE = 30;
const USAGE = 20;
const SHARE = 6;
const AMOUNT = 13;
const WIDTH = SERVICE + USAGE + SHARE + AMOUNT;

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (cents) => `${grouped(Math.floor(Math.abs(cents) / 100))}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const row = (service, usage, share, amount) => `${service.padEnd(SERVICE)}${usage.padEnd(USAGE)}${share.padStart(SHARE)}${amount.padStart(AMOUNT)}`.trimEnd();
const rule = "-".repeat(WIDTH);

/** Words wrapped to the table's width. */
function wrap(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line !== "" && line.length + 1 + word.length > WIDTH) {
      lines.push(line);
      line = word;
    } else line = line === "" ? word : `${line} ${word}`;
  }
  if (line !== "") lines.push(line);
  return lines;
}

export function renderStatement(data) {
  const [year, month] = data.period.split("-").map(Number);
  const byAmount = (a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents);
  const charges = data.lines.filter((line) => line.amount_cents !== 0).sort((a, b) => byAmount(a, b) || a.service.localeCompare(b.service));
  const unused = data.lines.filter((line) => line.amount_cents === 0).map((line) => line.service).sort((a, b) => a.localeCompare(b));
  const credits = [...data.credits].sort((a, b) => byAmount(a, b) || a.reason.localeCompare(b.reason));
  const subtotal = charges.reduce((sum, line) => sum + line.amount_cents, 0);
  const total = subtotal + credits.reduce((sum, credit) => sum + credit.amount_cents, 0);
  const account = `Account ${data.account}`;

  const out = [];
  out.push(`${data.customer}${account.padStart(WIDTH - data.customer.length)}`);
  out.push(`Usage statement for ${MONTHS[month - 1]} ${year}`);
  out.push("");
  out.push(row("Service", "Usage", "Share", `Amount (${data.currency})`));
  out.push(rule);
  for (const line of charges) out.push(row(line.service, `${grouped(line.quantity)} ${line.unit}`, `${((line.amount_cents / subtotal) * 100).toFixed(1)}%`, money(line.amount_cents)));
  out.push(rule);
  out.push(row("Charges", "", "100.0%", money(subtotal)));
  if (credits.length > 0) {
    out.push("");
    out.push("Credits");
    // A credit is in parentheses, and the closing one hangs past the column so the digits stay in line.
    for (const credit of credits) out.push(`${row(credit.reason, "", "", `(${money(credit.amount_cents)}`)})`);
  }
  out.push(rule);
  out.push(row("Total due", "", "", money(total)));
  if (unused.length > 0) {
    out.push("");
    out.push(...wrap(`${unused.length} ${unused.length === 1 ? "service" : "services"} had no usage this month and ${unused.length === 1 ? "is" : "are"} not listed: ${unused.join(", ")}.`));
  }
  return `${out.join("\n")}\n`;
}
