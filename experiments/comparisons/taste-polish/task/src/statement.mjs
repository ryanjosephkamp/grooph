/**
 * The monthly usage statement as plain text.
 * @param {{ customer: string, account: string, period: string, currency: string,
 *           lines: { service: string, quantity: number, unit: string, amount_cents: number }[],
 *           credits: { reason: string, amount_cents: number }[] }} data
 * @returns {string}
 */
export function renderStatement(data) {
  const out = [];
  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
  let total = 0;
  for (const line of data.lines) {
    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
    total += line.amount_cents;
  }
  for (const credit of data.credits) {
    out.push(`${credit.reason} ${credit.amount_cents}`);
    total += credit.amount_cents;
  }
  out.push(`Total ${total} ${data.currency} cents`);
  return `${out.join("\n")}\n`;
}
