/** Formats an amount in minor units (cents) as a currency string: 123456 → "$1,234.56". */
export function formatMoney(cents, symbol = "$") {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(abs % 100).padStart(2, "0");
  return `${symbol}${whole}.${frac}`;
}
