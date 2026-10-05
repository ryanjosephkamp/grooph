# Blind judge · taste-polish

Model `claude-opus-5-5`, no tools, fresh session, 2026-10-04T22:44:23.191Z; ledger invocation 67, $0.3717. The letters' mapping is in `mapping.json`, which the judge never saw.

## Prompt

You are a critic judging 8 candidate changes to one small Node project. Each candidate was produced by a different session working from the same task; you do not know how, and you should not guess. Judge only what the diff shows against the task and its acceptance material. Under each diff is what that candidate renders: the output of `npm run render` on its final tree (`out/statement.txt`), produced the same way for every candidate. The rendered output is the deliverable; the diff says how it is made. You have no tools: read carefully and cite lines of the diff.

# The task

Polish the monthly usage statement that `npm run render` writes from src/statement.mjs until it reads like the statement the billing team already sends: STYLE.md says what the statement should be, data/usage.json is the data, and `npm run capture` produces what is judged. The billing team's statement is kept outside this project; work from STYLE.md.

# Acceptance material the builder saw

### README.md

```
# usage-statement

Renders the monthly usage statement that is emailed to each customer as plain
text.

```bash
npm run render     # writes out/statement.txt from data/usage.json via src/statement.mjs
npm run capture    # renders, then copies the statement into captures/ with a readable summary
npm test           # the statement names the customer and every service
```

`src/statement.mjs` exports `renderStatement(data)` and returns the statement
as one string; `scripts/render.mjs` writes it to `out/statement.txt`.
`STYLE.md` says what the statement should look like. The statement is judged
from the files in `captures/`.

Amounts in `data/usage.json` are whole cents (`amount_cents`), so nothing is
lost to rounding; a credit is a negative amount.
```

### STYLE.md

```
# Style brief

The statement is sent to customers as plain text in an email and read in a
fixed-width font. It should read at a glance and look like the rest of our
billing mail: quiet, exact, no decoration.

- A heading that says whose statement it is and for which month.
- A line for each charge, in columns that line up, with the amounts in dollars
  and cents.
- Credits and the total due set apart from the charges, so the reader finds
  the total at once.
- Nothing wider than 72 characters; no tabs; no spaces at the end of a line.
- Plain characters only: no box drawing, no color codes, no emoji.
- Numbers exact to the data, to the cent.

The statement the billing team already sends is the yardstick: each revision
is compared against it, and the gaps that matter most are closed first.
```

# Candidates (in random order, under random letters)

## Candidate F

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..a834b90 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,60 @@
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** Whole number with thousands separators. */
+function grouped(n) {
+  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+/**
+ * Cents as a plain amount: 164250 -> "1,642.50 ", -16425 -> "(164.25)".
+ * Positive amounts end in a space so decimal points line up with the
+ * closing parenthesis of negative ones.
+ */
+function amountText(cents) {
+  const abs = Math.abs(cents);
+  const text = `${grouped(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
+  return cents < 0 ? `(${text})` : `${text} `;
+}
+
+/** Share of a whole as a percentage with one decimal, in integer math (half up). */
+function percent(part, whole) {
+  if (whole <= 0) return "";
+  const tenths = Math.floor((part * 2000 + whole) / (2 * whole));
+  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
+}
+
+const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
+
+/** Greedy word wrap to the given width. */
+function wrap(text, width) {
+  const lines = [];
+  let line = "";
+  for (const word of text.split(" ")) {
+    if (line && line.length + 1 + word.length > width) {
+      lines.push(line);
+      line = word;
+    } else {
+      line = line ? `${line} ${word}` : word;
+    }
+  }
+  if (line) lines.push(line);
+  return lines;
+}
+
+/** "2026-09" -> "September 2026". */
+function monthName(period) {
+  const match = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!match || !MONTHS[Number(match[2]) - 1]) return period;
+  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
+}
+
+const left = (s, w) => s.padEnd(w);
+const right = (s, w) => s.padStart(w);
+const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +63,99 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const GAP = 2;
+  const gap = " ".repeat(GAP);
+
+  const isIdle = (l) => l.quantity === 0 && l.amount_cents === 0;
+
+  // Largest charge first, ties by name; zero-usage services go to the footnote.
+  const used = data.lines
+    .filter((l) => !isIdle(l))
+    .sort((a, b) => b.amount_cents - a.amount_cents || cmp(a.service, b.service));
+  const idle = data.lines.filter(isIdle).map((l) => l.service).sort(cmp);
+
+  const chargesCents = data.lines.reduce((sum, l) => sum + l.amount_cents, 0);
+  const creditsCents = data.credits.reduce((sum, c) => sum + c.amount_cents, 0);
+  const totalCents = chargesCents + creditsCents;
+
+  const charges = used.map((l) => ({
+    service: l.service,
+    usage: `${grouped(l.quantity)} ${l.unit}`,
+    share: percent(l.amount_cents, chargesCents),
+    amount: amountText(l.amount_cents),
+  }));
+  // Largest credit first: most negative amount first, ties by reason.
+  const credits = [...data.credits]
+    .sort((a, b) => a.amount_cents - b.amount_cents || cmp(a.reason, b.reason))
+    .map((c) => ({ reason: c.reason, amount: amountText(c.amount_cents) }));
+
+  const subtotal = amountText(chargesCents);
+  const creditsTotal = amountText(creditsCents);
+  const total = amountText(totalCents);
+  const heading = `Amount (${data.currency})`;
+
+  const wAmount = Math.max(
+    heading.length,
+    ...charges.map((c) => c.amount.length),
+    ...credits.map((c) => c.amount.length),
+    subtotal.length,
+    creditsTotal.length,
+    total.length,
+  );
+  // Positive amounts keep a trailing pad slot; credits fill the full column.
+  const amountCell = (a) => (a.endsWith(" ") ? `${right(a.trimEnd(), wAmount - 1)} ` : right(a, wAmount));
+
+  const wService = Math.max("Service".length, ...charges.map((c) => c.service.length));
+  const wUsage = Math.max("Usage".length, ...charges.map((c) => c.usage.length));
+  const wShare = Math.max("Share".length, "100.0%".length, ...charges.map((c) => c.share.length));
+  const labelWidth = Math.max(
+    wService + GAP + wUsage + GAP + wShare,
+    ...credits.map((c) => c.reason.length),
+    "Total credits".length,
+  );
+  const width = labelWidth + GAP + wAmount;
+  const wUsageFit = labelWidth - wService - GAP - wShare - GAP;
+
+  const rule = (ch) => ch.repeat(width);
+  const summary = (label, amount) => `${left(label, labelWidth)}${gap}${amountCell(amount)}`;
+
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  const account = `Account ${data.account}`;
+  out.push(`${left(data.customer, width - account.length)}${account}`);
+  out.push(`Usage statement for ${monthName(data.period)}`);
+  out.push("");
+  out.push(
+    [left("Service", wService), left("Usage", wUsageFit), right("Share", wShare), right(heading, wAmount)].join(gap),
+  );
+  out.push(rule("-"));
+  for (const c of charges) {
+    out.push(
+      [left(c.service, wService), left(c.usage, wUsageFit), right(c.share, wShare), amountCell(c.amount)].join(gap),
+    );
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  out.push(rule("-"));
+  out.push(
+    [left("Charges", wService + GAP + wUsageFit), right("100.0%", wShare), amountCell(subtotal)].join(gap),
+  );
+  out.push("");
+  out.push("Credits");
+  for (const c of credits) out.push(summary(c.reason, c.amount));
+  out.push(rule("-"));
+  out.push(summary("Total credits", creditsTotal));
+  out.push("");
+  out.push(rule("="));
+  out.push(summary("TOTAL DUE", total));
+  out.push(rule("="));
+  if (idle.length > 0) {
+    const count = NUMBER_WORDS[idle.length] ?? String(idle.length);
+    const noun = idle.length === 1 ? "service" : "services";
+    const verb = idle.length === 1 ? "was" : "were";
+    out.push("");
+    // Keep each service name on one line: wrap with placeholders for its inner spaces.
+    const names = idle.map((n) => n.replace(/ /g, "\u0000")).join(", ");
+    const note = `${count} ${noun} with no usage ${verb} left out: ${names}.`;
+    out.push(...wrap(note, width).map((line) => line.replace(/\u0000/g, " ")));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
-  return `${out.join("\n")}\n`;
+
+  return `${out.map((line) => line.replace(/\s+$/, "")).join("\n")}\n`;
 }
```

### What candidate F renders

```text
Northwind Robotics                          Account NW-20418
Usage statement for September 2026

Service             Usage                Share  Amount (USD)
------------------------------------------------------------
Compute             18,250 vCPU-hours    39.5%     1,642.50
Managed database    720 instance-hours   31.2%     1,296.00
Dedicated support   1 plan               12.0%       500.00
Data transfer out   4,380 GB              9.5%       394.20
Object storage      9,120 GB-months       5.0%       209.76
Container registry  412 GB-months         1.0%        41.20
Key management      36 keys               0.9%        36.00
Load balancing      1,440 hours           0.9%        36.00
------------------------------------------------------------
Charges                                 100.0%     4,155.66

Credits
Committed-use discount                              (410.63)
Service credit, 14 Sep outage                       (164.25)
------------------------------------------------------------
Total credits                                       (574.88)

============================================================
TOTAL DUE                                          3,580.78
============================================================

Two services with no usage were left out:
Machine learning inference, Monitoring.
```

## Candidate W

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..489e3c6 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,10 @@
+const WIDTH = 68;
+const GAP = "  ";
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +13,113 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const lines = data.lines ?? [];
+  const credits = data.credits ?? [];
+  const charges = sum(lines);
+  const allowed = sum(credits);
+  const due = charges + allowed;
+
+  const amounts = [...lines, ...credits].map((l) => money(l.amount_cents));
+  amounts.push(money(charges), money(allowed), money(due));
+  const amountHead = `Amount (${data.currency})`;
+  const amountWidth = Math.max(amountHead.length, ...amounts.map((a) => a.length));
+  const quantityWidth = Math.max("Quantity".length, ...lines.map((l) => quantity(l.quantity).length));
+  const unitWidth = Math.max("Unit".length, ...lines.map((l) => l.unit.length));
+  const labelWidth = WIDTH - amountWidth - quantityWidth - unitWidth - 3 * GAP.length;
+
+  const row = (label, qty, unit, amount) =>
+    wrap(label, labelWidth).map((part, i, parts) => {
+      if (i < parts.length - 1) return part;
+      return trimEnd(
+        part.padEnd(labelWidth) + GAP + qty.padStart(quantityWidth) + GAP +
+          unit.padEnd(unitWidth) + GAP + amount.padStart(amountWidth),
+      );
+    });
+  // Credits and totals have no quantity or unit, so their label may run up to the amount.
+  const totalWidth = WIDTH - amountWidth - GAP.length;
+  const total = (label, amount) =>
+    wrap(label, totalWidth).map((part, i, parts) =>
+      i < parts.length - 1 ? part : part.padEnd(totalWidth) + GAP + amount.padStart(amountWidth));
+  const rule = (ch) => ch.repeat(WIDTH);
+  const underline = " ".repeat(WIDTH - amountWidth) + "-".repeat(amountWidth);
+
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  out.push(spread("Usage statement", month(data.period)));
+  out.push(spread(data.customer, `Account ${data.account}`));
+  out.push("");
+  out.push(...row("Charges", "Quantity", "Unit", amountHead));
+  out.push(rule("-"));
+  for (const l of lines) out.push(...row(l.service, quantity(l.quantity), l.unit, money(l.amount_cents)));
+  out.push(underline);
+  out.push(...total("Total charges", money(charges)));
+
+  if (credits.length > 0) {
+    out.push("");
+    out.push("Credits");
+    out.push(rule("-"));
+    for (const c of credits) out.push(...total(c.reason, money(c.amount_cents)));
+    out.push(underline);
+    out.push(...total("Total credits", money(allowed)));
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
-  }
-  out.push(`Total ${total} ${data.currency} cents`);
+
+  out.push("");
+  out.push(rule("="));
+  out.push(...total(`Total due (${data.currency})`, money(due)));
+  out.push(rule("="));
   return `${out.join("\n")}\n`;
 }
+
+function sum(items) {
+  return items.reduce((acc, item) => acc + item.amount_cents, 0);
+}
+
+/** Whole cents as dollars and cents, e.g. -41063 -> "-410.63", without floating point. */
+function money(cents) {
+  const sign = cents < 0 ? "-" : "";
+  const abs = Math.abs(cents);
+  return `${sign}${group(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, "0")}`;
+}
+
+function quantity(n) {
+  const [whole, fraction] = String(Math.abs(n)).split(".");
+  return `${n < 0 ? "-" : ""}${group(whole)}${fraction ? `.${fraction}` : ""}`;
+}
+
+function group(digits) {
+  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+/** "2026-09" -> "September 2026"; anything else is shown as given. */
+function month(period) {
+  const m = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return period;
+  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
+}
+
+function spread(left, right) {
+  const room = WIDTH - left.length - right.length;
+  return room >= 2 ? left + " ".repeat(room) + right : `${left}\n${right}`;
+}
+
+/** Splits text into pieces no wider than `width`, breaking at spaces where it can. */
+function wrap(text, width) {
+  const parts = [];
+  let current = "";
+  for (const word of text.split(/\s+/).filter(Boolean)) {
+    let w = word;
+    while (w.length > width) {
+      if (current) parts.push(current), (current = "");
+      parts.push(w.slice(0, width));
+      w = w.slice(width);
+    }
+    if (!current) current = w;
+    else if (current.length + 1 + w.length <= width) current += ` ${w}`;
+    else parts.push(current), (current = w);
+  }
+  parts.push(current);
+  return parts;
+}
+
+function trimEnd(s) {
+  return s.replace(/ +$/, "");
+}
```

### What candidate W renders

```text
Usage statement                                       September 2026
Northwind Robotics                                  Account NW-20418

Charges                       Quantity  Unit            Amount (USD)
--------------------------------------------------------------------
Compute                         18,250  vCPU-hours          1,642.50
Container registry                 412  GB-months              41.20
Data transfer out                4,380  GB                    394.20
Dedicated support                    1  plan                  500.00
Key management                      36  keys                   36.00
Load balancing                   1,440  hours                  36.00
Machine learning inference           0  requests                0.00
Managed database                   720  instance-hours      1,296.00
Monitoring                           0  metrics                 0.00
Object storage                   9,120  GB-months             209.76
                                                        ------------
Total charges                                               4,155.66

Credits
--------------------------------------------------------------------
Service credit, 14 Sep outage                                -164.25
Committed-use discount                                       -410.63
                                                        ------------
Total credits                                                -574.88

====================================================================
Total due (USD)                                             3,580.78
====================================================================
```

## Candidate G

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..f9d1a05 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,45 @@
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** "2026-09" -> "September 2026"; anything else is passed through. */
+function monthName(period) {
+  const m = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return period;
+  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
+}
+
+const grouped = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ",");
+
+/** Whole cents -> "1,234.56" (magnitude only; callers mark credits), exact. */
+function money(cents) {
+  const abs = Math.abs(cents);
+  return `${grouped(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
+}
+
+/** Share of total as "39.5%", one decimal, rounded half up in integer arithmetic. */
+function share(cents, totalCents) {
+  const tenths = Math.floor((cents * 2000 + totalCents) / (2 * totalCents));
+  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
+}
+
+/** Greedy word wrap to `width` characters. */
+function wrap(text, width) {
+  const lines = [];
+  let cur = "";
+  for (const word of text.split(" ")) {
+    if (cur && cur.length + 1 + word.length > width) {
+      lines.push(cur);
+      cur = word;
+    } else {
+      cur = cur ? `${cur} ${word}` : word;
+    }
+  }
+  if (cur) lines.push(cur);
+  return lines;
+}
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +48,82 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const isUnused = (l) => l.quantity === 0 || l.amount_cents === 0;
+  const listed = data.lines.filter((l) => !isUnused(l));
+  const unlisted = data.lines.filter(isUnused);
+
+  const chargeCents = listed.reduce((s, l) => s + l.amount_cents, 0);
+  const creditCents = data.credits.reduce((s, c) => s + c.amount_cents, 0);
+  const totalCents = chargeCents + creditCents;
+
+  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+  const charges = [...listed]
+    .sort((a, b) => b.amount_cents - a.amount_cents || byName(a.service, b.service))
+    .map((l) => ({
+      label: l.service,
+      qty: grouped(l.quantity),
+      unit: l.unit,
+      share: share(l.amount_cents, chargeCents),
+      amount: money(l.amount_cents),
+    }));
+  // Credits are negative in the data: most negative (largest) first.
+  const credits = [...data.credits]
+    .sort((a, b) => a.amount_cents - b.amount_cents || byName(a.reason, b.reason))
+    .map((c) => ({ label: c.reason, amount: `(${money(c.amount_cents)}` }));
+
+  const subtotal = money(chargeCents);
+  const totalText = money(totalCents);
+  const amountHeader = `Amount (${data.currency})`;
+
+  const labelW = Math.max("Service".length, ...charges.map((c) => c.label.length));
+  const qtyW = Math.max("Usage".length, ...charges.map((c) => c.qty.length));
+  const unitW = Math.max(...charges.map((c) => c.unit.length));
+  const shareW = Math.max("Share".length, "100.0%".length, ...charges.map((c) => c.share.length));
+  const amtW = Math.max(
+    amountHeader.length, subtotal.length, totalText.length,
+    ...charges.map((c) => c.amount.length), ...credits.map((c) => c.amount.length),
+  );
+
+  // Columns: label, usage, unit, share, amount, then one column to the right
+  // for a credit's closing parenthesis so its digits line up with the rest.
+  const gap = "  ";
+  const width = labelW + gap.length + qtyW + 1 + unitW + gap.length + shareW + gap.length + amtW + 1;
+  const amtStart = width - 1 - amtW;
+  const line = (label, qty, unit, sh, amount) =>
+    label.padEnd(labelW) + gap + qty.padStart(qtyW) + " " + unit.padEnd(unitW) + gap +
+    sh.padStart(shareW) + gap + amount.padStart(amtW);
+  const amountOnly = (label, amount, suffix = "") =>
+    label.padEnd(amtStart) + amount.padStart(amtW) + suffix;
+  const rule = "-".repeat(width);
+  const dbl = "=".repeat(width);
+
+  const account = `Account ${data.account}`;
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  out.push(data.customer + " ".repeat(Math.max(1, width - data.customer.length - account.length)) + account);
+  out.push(`Usage statement for ${monthName(data.period)}`);
+  out.push("");
+  out.push(line("Service", "Usage", "", "Share", amountHeader));
+  out.push(rule);
+  for (const c of charges) out.push(line(c.label, c.qty, c.unit, c.share, c.amount));
+  out.push(rule);
+  out.push(line("Total charges", "", "", "100.0%", subtotal));
+  out.push("");
+  if (credits.length > 0) {
+    out.push("Credits");
+    for (const c of credits) out.push(amountOnly(c.label, c.amount, ")"));
+    out.push("");
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  out.push(dbl);
+  out.push(amountOnly("Total due", totalText));
+  out.push(dbl);
+  if (unlisted.length > 0) {
+    const n = unlisted.length;
+    const names = unlisted.map((l) => l.service).join(", ");
+    out.push("");
+    out.push(...wrap(
+      `${n} ${n === 1 ? "service" : "services"} had no usage this month and are not listed: ${names}.`,
+      width,
+    ));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
-  return `${out.join("\n")}\n`;
+  return `${out.map((l) => l.replace(/\s+$/, "")).join("\n")}\n`;
 }
```

### What candidate G renders

```text
Northwind Robotics                              Account NW-20418
Usage statement for September 2026

Service              Usage                  Share  Amount (USD)
----------------------------------------------------------------
Compute             18,250 vCPU-hours       39.5%      1,642.50
Managed database       720 instance-hours   31.2%      1,296.00
Dedicated support        1 plan             12.0%        500.00
Data transfer out    4,380 GB                9.5%        394.20
Object storage       9,120 GB-months         5.0%        209.76
Container registry     412 GB-months         1.0%         41.20
Key management          36 keys              0.9%         36.00
Load balancing       1,440 hours             0.9%         36.00
----------------------------------------------------------------
Total charges                              100.0%      4,155.66

Credits
Committed-use discount                                  (410.63)
Service credit, 14 Sep outage                           (164.25)

================================================================
Total due                                              3,580.78
================================================================

2 services had no usage this month and are not listed: Machine
learning inference, Monitoring.
```

## Candidate M

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..f3b1b29 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,56 @@
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** "2026-09" -> "September 2026"; anything else is passed through. */
+function monthName(period) {
+  const match = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return period;
+  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
+}
+
+/** Whole cents -> "1,642.50" (sign ignored; credits get parentheses elsewhere), exact. */
+function dollars(cents) {
+  const abs = Math.abs(cents);
+  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+  const frac = String(abs % 100).padStart(2, "0");
+  return `${whole}.${frac}`;
+}
+
+const count = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+const left = (s, w) => s.padEnd(w);
+const right = (s, w) => s.padStart(w);
+
+/** Share of the whole in tenths of a percent, rounded half up, integers only -> "39.5%". */
+function percent(part, whole) {
+  if (whole <= 0) return "0.0%";
+  const tenths = Math.floor((part * 2000 + whole) / (2 * whole));
+  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
+}
+
+/** "A", "A and B", "A, B and C". */
+function joinNames(names) {
+  if (names.length < 2) return names.join("");
+  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
+}
+
+/** Greedy word wrap to at most `width` characters per line. */
+function wrap(text, width) {
+  const lines = [];
+  let line = "";
+  for (const word of text.split(" ")) {
+    if (line && line.length + 1 + word.length > width) {
+      lines.push(line);
+      line = word;
+    } else {
+      line = line ? `${line} ${word}` : word;
+    }
+  }
+  if (line) lines.push(line);
+  return lines;
+}
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +59,89 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+  const hasUsage = (l) => l.quantity > 0 || l.amount_cents !== 0;
+  const used = data.lines.filter(hasUsage);
+  const unused = data.lines.filter((l) => !hasUsage(l));
+
+  const chargeCents = data.lines.reduce((sum, l) => sum + l.amount_cents, 0);
+  const creditCents = data.credits.reduce((sum, c) => sum + c.amount_cents, 0);
+  const totalCents = chargeCents + creditCents;
+
+  // Largest charge first, ties by name.
+  const charges = [...used]
+    .sort((a, b) => b.amount_cents - a.amount_cents || byName(a.service, b.service))
+    .map((l) => ({
+      service: l.service,
+      usage: `${count(l.quantity)} ${l.unit}`,
+      share: percent(l.amount_cents, chargeCents),
+      amount: dollars(l.amount_cents),
+    }));
+  // Credits are stored as negative cents; the largest credit comes first.
+  const credits = [...data.credits]
+    .sort((a, b) => a.amount_cents - b.amount_cents || byName(a.reason, b.reason))
+    .map((c) => ({ reason: c.reason, amount: dollars(c.amount_cents), credit: c.amount_cents < 0 }));
+  const subtotal = dollars(chargeCents);
+  const creditSum = dollars(creditCents);
+  const total = dollars(totalCents);
+
+  const head = { service: "Service", usage: "Usage", share: "Share", amount: `Amount (${data.currency})` };
+  const wService = Math.max(head.service.length, ...charges.map((c) => c.service.length));
+  const wUsage = Math.max(head.usage.length, ...charges.map((c) => c.usage.length));
+  const wShare = Math.max(head.share.length, "100.0%".length, ...charges.map((c) => c.share.length));
+  const wAmount = Math.max(
+    head.amount.length,
+    ...charges.map((c) => c.amount.length),
+    ...credits.map((c) => c.amount.length + 1),
+    subtotal.length,
+    creditSum.length + 1,
+    total.length,
+  );
+  // Plain amounts stop one column short of the table edge, so a credit's closing
+  // parenthesis hangs in the last column and the decimal points stay in line.
+  const wCol = wAmount + 1;
+  const gap = "  ";
+  const width = wService + wUsage + wShare + wCol + gap.length * 3;
+
+  const plain = (amount) => `${right(amount, wAmount)} `;
+  const credit = (amount) => `${right(`(${amount}`, wAmount)})`;
+  const amountCol = (c) => (c.credit ? credit(c.amount) : plain(c.amount));
+  const row = (service, usage, share, amount) =>
+    [left(service, wService), left(usage, wUsage), right(share, wShare), amount]
+      .join(gap)
+      .trimEnd();
+  const money = (label, amount) => `${left(label, width - wCol - gap.length)}${gap}${amount}`.trimEnd();
+  const rule = (ch) => ch.repeat(width);
+
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
-  }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  const account = `Account ${data.account}`;
+  out.push(`${left(data.customer, width - account.length)}${account}`.trimEnd());
+  out.push(`Usage statement, ${monthName(data.period)}`);
+  out.push("");
+  out.push(row(head.service, head.usage, head.share, right(head.amount, wCol)));
+  out.push(rule("-"));
+  for (const c of charges) out.push(row(c.service, c.usage, c.share, plain(c.amount)));
+  out.push(rule("-"));
+  out.push(row("Charges", "", "100.0%", plain(subtotal)));
+  out.push("");
+  for (const c of credits) out.push(money(c.reason, amountCol(c)));
+  out.push(rule("-"));
+  out.push(money("Credits", amountCol({ amount: creditSum, credit: creditCents < 0 })));
+  out.push("");
+  out.push(rule("="));
+  out.push(money("Total due", plain(total)));
+  out.push(rule("="));
+  if (unused.length > 0) {
+    const n = unused.length;
+    // Service names stay whole across line breaks (spaces held as   while wrapping).
+    const names = joinNames(unused.map((l) => l.service.replace(/ /g, " ")));
+    out.push("");
+    out.push(
+      ...wrap(
+        `${n} ${n === 1 ? "service" : "services"} with no usage this month ${n === 1 ? "is" : "are"} not listed: ${names}.`,
+        width,
+      ).map((s) => s.replace(/ /g, " ")),
+    );
   }
-  out.push(`Total ${total} ${data.currency} cents`);
   return `${out.join("\n")}\n`;
 }
```

### What candidate M renders

```text
Northwind Robotics                           Account NW-20418
Usage statement, September 2026

Service             Usage                Share   Amount (USD)
-------------------------------------------------------------
Compute             18,250 vCPU-hours    39.5%      1,642.50
Managed database    720 instance-hours   31.2%      1,296.00
Dedicated support   1 plan               12.0%        500.00
Data transfer out   4,380 GB              9.5%        394.20
Object storage      9,120 GB-months       5.0%        209.76
Container registry  412 GB-months         1.0%         41.20
Key management      36 keys               0.9%         36.00
Load balancing      1,440 hours           0.9%         36.00
-------------------------------------------------------------
Charges                                 100.0%      4,155.66

Committed-use discount                               (410.63)
Service credit, 14 Sep outage                        (164.25)
-------------------------------------------------------------
Credits                                              (574.88)

=============================================================
Total due                                           3,580.78
=============================================================

2 services with no usage this month are not listed:
Machine learning inference and Monitoring.
```

## Candidate S

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..9ec5fd7 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,22 +1,140 @@
 /**
- * The monthly usage statement as plain text.
+ * The monthly usage statement as plain text, at most 72 characters wide.
+ * Amounts are whole cents; all arithmetic stays in integers.
  * @param {{ customer: string, account: string, period: string, currency: string,
  *           lines: { service: string, quantity: number, unit: string, amount_cents: number }[],
  *           credits: { reason: string, amount_cents: number }[] }} data
  * @returns {string}
  */
+
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+const WIDTH = 72;
+
+function groups(n) {
+  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+// Bare digits with thousands commas and two decimals. The sign is dropped;
+// credits are shown in parentheses by the caller.
+function plain(cents) {
+  const abs = Math.abs(cents);
+  return `${groups(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
+}
+
+// Percentage of `whole` to one decimal, rounded half up, integer arithmetic only.
+function share(part, whole) {
+  if (whole === 0) return "0.0%";
+  const tenths = Math.floor((Math.abs(part) * 2000 + whole) / (2 * whole));
+  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
+}
+
+function monthName(period) {
+  const m = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return period;
+  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
+}
+
+function wrap(text, width) {
+  const rows = [];
+  let cur = "";
+  for (const w of text.split(/\s+/).filter(Boolean)) {
+    if (cur && cur.length + 1 + w.length > width) {
+      rows.push(cur);
+      cur = w;
+    } else {
+      cur = cur ? `${cur} ${w}` : w;
+    }
+  }
+  if (cur) rows.push(cur);
+  return rows;
+}
+
 export function renderStatement(data) {
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  const rule = "-".repeat(WIDTH);
+  const heavy = "=".repeat(WIDTH);
+
+  const isUnused = (l) => l.quantity === 0 && l.amount_cents === 0;
+  const unused = data.lines.filter(isUnused);
+  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+  // Largest first; ties by name.
+  const lines = data.lines
+    .filter((l) => !isUnused(l))
+    .sort((a, b) => b.amount_cents - a.amount_cents || byName(a.service, b.service));
+  // Credits are negative, so largest credit first means most negative first.
+  const creditRows = [...data.credits].sort(
+    (a, b) => a.amount_cents - b.amount_cents || byName(a.reason, b.reason),
+  );
+
+  const charges = data.lines.reduce((s, l) => s + l.amount_cents, 0);
+  const credits = data.credits.reduce((s, c) => s + c.amount_cents, 0);
+  const total = charges + credits;
+
+  const left = data.customer;
+  const right = `Account ${data.account}`;
+  out.push(`${left}${" ".repeat(Math.max(2, WIDTH - left.length - right.length))}${right}`);
+  out.push(`Usage statement for ${monthName(data.period)}`);
+  out.push("");
+
+  const amtHead = `Amount (${data.currency})`;
+  const qtyW = Math.max(3, ...lines.map((l) => groups(l.quantity).length));
+  const unitW = Math.max(4, ...lines.map((l) => l.unit.length));
+  const shareW = 6;
+  // The amount column ends at `edge` for charges; a credit's closing
+  // parenthesis sits one column further right (at WIDTH).
+  const edge = WIDTH - 1;
+  const amtW = Math.max(
+    amtHead.length,
+    ...[...data.lines, ...data.credits].map((x) => plain(x.amount_cents).length),
+    plain(charges).length,
+    plain(credits).length,
+    plain(total).length,
+  );
+  const svcW = Math.max(7, edge - qtyW - unitW - shareW - amtW - 8);
+
+  const row = (svc, qty, unit, sh, amt) =>
+    `${svc.padEnd(svcW)}  ${qty.padStart(qtyW)}  ${unit.padEnd(unitW)}  ${sh.padStart(shareW)}  ${amt.padStart(amtW)}`;
+  // Label at the left, amount ending at the charge column (parenthesised
+  // amounts end one column further right so the digits stay aligned).
+  const pair = (label, cents, paren = false) => {
+    const text = paren ? `(${plain(cents)})` : plain(cents);
+    const end = paren ? WIDTH : edge;
+    return `${label}${" ".repeat(Math.max(2, end - label.length - text.length))}${text}`;
+  };
+
+  out.push(row("Service", "Qty", "Unit", "Share", amtHead));
+  out.push(rule);
+  for (const l of lines) {
+    out.push(row(l.service, groups(l.quantity), l.unit, share(l.amount_cents, charges), plain(l.amount_cents)));
+  }
+  out.push(rule);
+  out.push(row("Charges", "", "", share(charges, charges), plain(charges)));
+  out.push("");
+  out.push("Credits");
+  for (const c of creditRows) {
+    const parts = wrap(c.reason, edge - amtW - 6);
+    parts.forEach((p, i) => {
+      const label = `  ${p}`;
+      out.push(i === parts.length - 1 ? pair(label, c.amount_cents, true) : label);
+    });
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  out.push(pair("Total credits", credits, true));
+  out.push("");
+  out.push(heavy);
+  out.push(pair("TOTAL DUE", total, total < 0));
+  out.push(heavy);
+
+  if (unused.length > 0) {
+    const n = unused.length;
+    const names = unused.map((l) => l.service).join(", ");
+    const text = `${n} ${n === 1 ? "service" : "services"} had no usage this month and ${n === 1 ? "is" : "are"} not listed: ${names}.`;
+    out.push("");
+    out.push(...wrap(text, WIDTH));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
+
   return `${out.join("\n")}\n`;
 }
```

### What candidate S renders

```text
Northwind Robotics                                      Account NW-20418
Usage statement for September 2026

Service                       Qty  Unit             Share  Amount (USD)
------------------------------------------------------------------------
Compute                    18,250  vCPU-hours       39.5%      1,642.50
Managed database              720  instance-hours   31.2%      1,296.00
Dedicated support               1  plan             12.0%        500.00
Data transfer out           4,380  GB                9.5%        394.20
Object storage              9,120  GB-months         5.0%        209.76
Container registry            412  GB-months         1.0%         41.20
Key management                 36  keys              0.9%         36.00
Load balancing              1,440  hours             0.9%         36.00
------------------------------------------------------------------------
Charges                                            100.0%      4,155.66

Credits
  Committed-use discount                                        (410.63)
  Service credit, 14 Sep outage                                 (164.25)
Total credits                                                   (574.88)

========================================================================
TOTAL DUE                                                      3,580.78
========================================================================

2 services had no usage this month and are not listed: Machine learning
inference, Monitoring.
```

## Candidate Y

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..43b11e5 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,22 +1,147 @@
 /**
- * The monthly usage statement as plain text.
+ * The monthly usage statement as plain text, for a fixed-width font.
+ * All arithmetic is in whole cents; amounts are shown as dollars and cents.
  * @param {{ customer: string, account: string, period: string, currency: string,
  *           lines: { service: string, quantity: number, unit: string, amount_cents: number }[],
  *           credits: { reason: string, amount_cents: number }[] }} data
  * @returns {string}
  */
+
+const MAX_WIDTH = 72;
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** "2026-09" -> "September 2026" (unrecognised periods are shown as given). */
+function monthName(period) {
+  const m = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return period;
+  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
+}
+
+/** Whole number with thousands separators: 18250 -> "18,250". */
+function count(n) {
+  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+/** Cents as dollars and cents, without sign: 164250 -> "1,642.50". */
+function money(cents) {
+  const abs = Math.abs(cents);
+  return `${count(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
+}
+
+/** Share of the whole as a percentage to one decimal, in integer arithmetic (half up). */
+function share(part, whole) {
+  if (whole <= 0) return "0.0%";
+  const tenths = Math.floor((part * 2000 + whole) / (2 * whole));
+  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
+}
+
+/** Greedy word wrap to at most `width` characters per line. */
+function wrap(text, width) {
+  const lines = [];
+  let line = "";
+  for (const word of text.split(" ")) {
+    if (line && line.length + 1 + word.length > width) {
+      lines.push(line);
+      line = word;
+    } else {
+      line = line ? `${line} ${word}` : word;
+    }
+  }
+  if (line) lines.push(line);
+  return lines;
+}
+
+const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+
 export function renderStatement(data) {
-  const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  // Services with no usage and no charge are named in a closing note, not tabled.
+  const isUnused = (l) => l.quantity === 0 && l.amount_cents === 0;
+  const unused = data.lines.filter(isUnused);
+  // Largest charge first; ties by service name A-Z.
+  const used = data.lines
+    .filter((l) => !isUnused(l))
+    .sort((a, b) => b.amount_cents - a.amount_cents || byName(a.service, b.service));
+  // Largest credit first (credits are negative in the data); ties by reason A-Z.
+  const creditsIn = [...data.credits].sort(
+    (a, b) => a.amount_cents - b.amount_cents || byName(a.reason, b.reason),
+  );
+
+  const chargeCents = data.lines.reduce((sum, l) => sum + l.amount_cents, 0);
+  const creditCents = data.credits.reduce((sum, c) => sum + c.amount_cents, 0);
+  const totalCents = chargeCents + creditCents;
+
+  const charges = used.map((l) => ({
+    label: l.service,
+    usage: `${count(l.quantity)} ${l.unit}`,
+    share: share(l.amount_cents, chargeCents),
+    amount: money(l.amount_cents),
+  }));
+  const credits = creditsIn.map((c) => ({
+    label: c.reason,
+    amount: money(c.amount_cents),
+    neg: c.amount_cents < 0,
+  }));
+  const chargesAmount = money(chargeCents);
+  const total = { amount: money(totalCents), neg: totalCents < 0 };
+
+  const amountHead = `Amount (${data.currency})`;
+  const shareHead = "Share";
+  const labelW = Math.max(...charges.map((r) => r.label.length), "Service".length, "Charges".length);
+  const usageW = Math.max(...charges.map((r) => r.usage.length), "Usage".length);
+  const shareW = Math.max(...charges.map((r) => r.share.length), "100.0%".length, shareHead.length);
+  const amountW = Math.max(
+    amountHead.length,
+    chargesAmount.length,
+    total.amount.length + (total.neg ? 1 : 0),
+    ...charges.map((r) => r.amount.length),
+    ...credits.map((r) => r.amount.length + (r.neg ? 1 : 0)),
+  );
+  const account = `Account ${data.account}`;
+  const amountStart = labelW + 2 + usageW + 2 + shareW + 2;
+  const width = Math.max(amountStart + amountW, data.customer.length + 2 + account.length);
+  // A closing parenthesis hangs one column past the amount column.
+  const widest = width + (credits.some((r) => r.neg) || total.neg ? 1 : 0);
+  if (widest > MAX_WIDTH) {
+    throw new Error(`statement would be ${widest} characters wide; the limit is ${MAX_WIDTH}`);
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+
+  const left = (s, w) => s.padEnd(w);
+  const right = (s, w) => s.padStart(w);
+  const rule = "-".repeat(width);
+  // Label on the left, amount right-aligned to the amount column; negatives in parentheses.
+  const flush = (label, amount, neg) =>
+    `${left(label, width - amountW)}${right(neg ? `(${amount}` : amount, amountW)}${neg ? ")" : ""}`;
+  const row = (label, usage, shr, amount) =>
+    `${left(label, labelW)}  ${left(usage, usageW)}  ${right(shr, shareW)}  ${right(amount, amountW)}`
+      .trimEnd();
+
+  const out = [];
+  out.push(`${left(data.customer, width - account.length)}${account}`);
+  out.push(`Usage statement for ${monthName(data.period)}`);
+  out.push("");
+  out.push(row("Service", "Usage", shareHead, amountHead));
+  out.push(rule);
+  for (const r of charges) out.push(row(r.label, r.usage, r.share, r.amount));
+  out.push(rule);
+  out.push(row("Charges", "", charges.length ? "100.0%" : "", chargesAmount));
+  out.push("");
+  out.push("Credits");
+  for (const r of credits) out.push(flush(r.label, r.amount, r.neg));
+  out.push("");
+  out.push(rule);
+  out.push(flush("Total due", total.amount, total.neg));
+  if (unused.length) {
+    const names = unused.map((l) => l.service).sort(byName).join(", ");
+    const n = unused.length;
+    const sentence =
+      n === 1
+        ? `1 service had no usage this month and is not listed: ${names}.`
+        : `${n} services had no usage this month and are not listed: ${names}.`;
+    out.push("");
+    out.push(...wrap(sentence, width));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
   return `${out.join("\n")}\n`;
 }
```

### What candidate Y renders

```text
Northwind Robotics                          Account NW-20418
Usage statement for September 2026

Service             Usage                Share  Amount (USD)
------------------------------------------------------------
Compute             18,250 vCPU-hours    39.5%      1,642.50
Managed database    720 instance-hours   31.2%      1,296.00
Dedicated support   1 plan               12.0%        500.00
Data transfer out   4,380 GB              9.5%        394.20
Object storage      9,120 GB-months       5.0%        209.76
Container registry  412 GB-months         1.0%         41.20
Key management      36 keys               0.9%         36.00
Load balancing      1,440 hours           0.9%         36.00
------------------------------------------------------------
Charges                                 100.0%      4,155.66

Credits
Committed-use discount                               (410.63)
Service credit, 14 Sep outage                        (164.25)

------------------------------------------------------------
Total due                                           3,580.78

2 services had no usage this month and are not listed:
Machine learning inference, Monitoring.
```

## Candidate J

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..604b042 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,52 @@
+const MAX_WIDTH = 72;
+const GAP = "  ";
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** "2026-09" -> "September 2026"; anything else is shown as given. */
+function formatPeriod(period) {
+  const match = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return period;
+  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
+}
+
+/** 18250 -> "18,250" */
+function groupDigits(digits) {
+  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+function formatQuantity(quantity) {
+  const [whole, fraction] = String(Math.abs(quantity)).split(".");
+  const sign = quantity < 0 ? "-" : "";
+  return `${sign}${groupDigits(whole)}${fraction ? `.${fraction}` : ""}`;
+}
+
+/** Whole cents to dollars and cents, exactly: -16425 -> "-164.25" */
+function formatCents(cents) {
+  if (!Number.isInteger(cents)) throw new Error(`amount_cents must be whole cents, got ${cents}`);
+  const sign = cents < 0 ? "-" : "";
+  const abs = Math.abs(cents);
+  const dollars = Math.floor(abs / 100);
+  const rest = String(abs % 100).padStart(2, "0");
+  return `${sign}${groupDigits(String(dollars))}.${rest}`;
+}
+
+/** Splits text into pieces no wider than width, at spaces where possible. */
+function wrap(text, width) {
+  const pieces = [];
+  let rest = text;
+  while (rest.length > width) {
+    let cut = rest.lastIndexOf(" ", width);
+    if (cut <= 0) cut = width;
+    pieces.push(rest.slice(0, cut).trimEnd());
+    rest = rest.slice(cut).trimStart();
+  }
+  pieces.push(rest);
+  return pieces;
+}
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +55,79 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const charges = data.lines.map((line) => ({
+    label: line.service,
+    quantity: formatQuantity(line.quantity),
+    unit: line.unit,
+    amount: formatCents(line.amount_cents),
+  }));
+  const credits = data.credits.map((credit) => ({
+    label: credit.reason,
+    amount: formatCents(credit.amount_cents),
+  }));
+  const chargesCents = data.lines.reduce((sum, line) => sum + line.amount_cents, 0);
+  const creditsCents = data.credits.reduce((sum, credit) => sum + credit.amount_cents, 0);
+  const totalLabel = `Total due (${data.currency})`;
+  const totals = {
+    charges: formatCents(chargesCents),
+    credits: formatCents(creditsCents),
+    due: formatCents(chargesCents + creditsCents),
+  };
+
+  // Columns: label, quantity (number right-aligned, then unit), amount (right-aligned).
+  const amountHeading = "Amount";
+  const quantityHeading = "Quantity";
+  const unitWidth = Math.max(0, ...charges.map((row) => row.unit.length));
+  const amountWidth = Math.max(amountHeading.length, ...[...charges, ...credits].map((row) => row.amount.length),
+    ...Object.values(totals).map((amount) => amount.length));
+  const numberWidth = Math.max(0, ...charges.map((row) => row.quantity.length));
+  const quantityWidth = Math.max(quantityHeading.length, numberWidth + 1 + unitWidth);
+  const quantityText = (charge) =>
+    `${charge.quantity.padStart(numberWidth)} ${charge.unit}`.padEnd(quantityWidth);
+  const labelWidth = Math.min(
+    Math.max("Service".length, ...charges.map((row) => row.label.length)),
+    MAX_WIDTH - quantityWidth - amountWidth - 2 * GAP.length,
+  );
+  const width = labelWidth + GAP.length + quantityWidth + GAP.length + amountWidth;
+  // Credits and totals have no quantity column, so their labels may use its room.
+  const wideLabelWidth = width - GAP.length - amountWidth;
+
+  const row = (label, quantity, amount) => {
+    const pieces = wrap(label, labelWidth);
+    const last = pieces.pop();
+    return [
+      ...pieces,
+      `${last.padEnd(labelWidth)}${GAP}${quantity.padStart(quantityWidth)}${GAP}${amount.padStart(amountWidth)}`,
+    ];
+  };
+  const wideRow = (label, amount) => {
+    const pieces = wrap(label, wideLabelWidth);
+    const last = pieces.pop();
+    return [...pieces, `${last.padEnd(wideLabelWidth)}${GAP}${amount.padStart(amountWidth)}`];
+  };
+  const rule = (ch) => `${" ".repeat(width - amountWidth)}${ch.repeat(amountWidth)}`;
+
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
-  }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  out.push(...wrap(`${data.customer} usage statement, ${formatPeriod(data.period)}`, MAX_WIDTH));
+  out.push(...wrap(`Account ${data.account}. Amounts in ${data.currency}.`, MAX_WIDTH));
+  out.push("");
+  out.push("Charges");
+  out.push(...row("Service", quantityHeading.padEnd(quantityWidth), amountHeading));
+  for (const charge of charges) out.push(...row(charge.label, quantityText(charge), charge.amount));
+  out.push(rule("-"));
+  out.push(...wideRow("Total charges", totals.charges));
+
+  if (credits.length > 0) {
+    out.push("");
+    out.push("Credits");
+    for (const credit of credits) out.push(...wideRow(credit.label, credit.amount));
+    out.push(rule("-"));
+    out.push(...wideRow("Total credits", totals.credits));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
-  return `${out.join("\n")}\n`;
+
+  out.push("");
+  out.push(rule("="));
+  out.push(...wideRow(totalLabel, totals.due));
+
+  return `${out.map((line) => line.trimEnd()).join("\n")}\n`;
 }
diff --git a/tests/statement.test.mjs b/tests/statement.test.mjs
index f5162c9..e1e3d1e 100644
--- a/tests/statement.test.mjs
+++ b/tests/statement.test.mjs
@@ -18,6 +18,31 @@ test("renderStatement names the customer and the account", () => {
   assert.ok(text.includes(data.account));
 });
 
+test("renderStatement keeps to plain text no wider than 72 characters", () => {
+  const lines = renderStatement(data).replace(/\n$/, "").split("\n");
+  for (const line of lines) {
+    assert.ok(line.length <= 72, line);
+    assert.ok(!/[ \t]$/.test(line), `trailing space: ${JSON.stringify(line)}`);
+    assert.ok(/^[ -~]*$/.test(line), `not plain ASCII: ${JSON.stringify(line)}`);
+  }
+});
+
+test("renderStatement shows the month, dollars and cents, and the exact total due", () => {
+  const text = renderStatement(data);
+  assert.ok(text.includes("September 2026"));
+  assert.match(text, /Compute +18,250 vCPU-hours +1,642\.50\n/);
+  assert.match(text, /Service credit, 14 Sep outage +-164\.25\n/);
+  assert.match(text, /Total charges +4,155\.66\n/);
+  assert.match(text, /Total credits +-574\.88\n/);
+  assert.match(text, /Total due \(USD\) +3,580\.78\n$/);
+});
+
+test("renderStatement wraps a long service name instead of widening the statement", () => {
+  const long = { ...data, lines: [{ ...data.lines[0], service: "A very long service name ".repeat(4).trim() }] };
+  const lines = renderStatement(long).split("\n");
+  assert.ok(lines.every((line) => line.length <= 72));
+});
+
 test("renderStatement names every service and every credit", () => {
   const text = renderStatement(data).replace(/\s+/g, " ");
   for (const line of data.lines) assert.ok(text.includes(line.service), line.service);
```

### What candidate J renders

```text
Northwind Robotics usage statement, September 2026
Account NW-20418. Amounts in USD.

Charges
Service                     Quantity                 Amount
Compute                     18,250 vCPU-hours      1,642.50
Container registry             412 GB-months          41.20
Data transfer out            4,380 GB                394.20
Dedicated support                1 plan              500.00
Key management                  36 keys               36.00
Load balancing               1,440 hours              36.00
Machine learning inference       0 requests            0.00
Managed database               720 instance-hours  1,296.00
Monitoring                       0 metrics             0.00
Object storage               9,120 GB-months         209.76
                                                   --------
Total charges                                      4,155.66

Credits
Service credit, 14 Sep outage                       -164.25
Committed-use discount                              -410.63
                                                   --------
Total credits                                       -574.88

                                                   ========
Total due (USD)                                    3,580.78
```

## Candidate R

```diff
diff --git a/src/statement.mjs b/src/statement.mjs
index 8bf919c..7a7877e 100644
--- a/src/statement.mjs
+++ b/src/statement.mjs
@@ -1,3 +1,64 @@
+const MONTHS = [
+  "January", "February", "March", "April", "May", "June",
+  "July", "August", "September", "October", "November", "December",
+];
+
+/** Whole number with thousands separators, e.g. 18250 -> "18,250". */
+function groupDigits(n) {
+  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
+}
+
+/** Whole cents as dollars and cents, e.g. -16425 -> "-164.25". Exact, no floats. */
+function money(cents) {
+  const sign = cents < 0 ? "-" : "";
+  const abs = Math.abs(cents);
+  const dollars = Math.trunc(abs / 100);
+  const rest = String(abs % 100).padStart(2, "0");
+  return `${sign}${groupDigits(dollars)}.${rest}`;
+}
+
+/** "2026-09" -> "September 2026"; anything else is passed through. */
+function monthName(period) {
+  const match = /^(\d{4})-(\d{2})$/.exec(period);
+  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return period;
+  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
+}
+
+const padRight = (s, w) => s.padEnd(w, " ");
+const padLeft = (s, w) => s.padStart(w, " ");
+const trimEnd = (s) => s.replace(/\s+$/, "");
+
+/** Share of the whole as a percentage to one decimal, rounded half up, from whole cents. */
+function percent(part, whole) {
+  if (whole <= 0) return "0.0%";
+  const tenths = Math.floor((part * 2000 + whole) / (2 * whole));
+  return `${Math.trunc(tenths / 10)}.${tenths % 10}%`;
+}
+
+/** "A", "A and B", "A, B and C". */
+function listNames(names) {
+  if (names.length <= 1) return names.join("");
+  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
+}
+
+/** Greedy word wrap to at most `width` characters per line. */
+function wrap(text, width) {
+  const lines = [];
+  let line = "";
+  for (const word of text.split(" ")) {
+    if (line && line.length + 1 + word.length > width) {
+      lines.push(line);
+      line = word;
+    } else {
+      line = line ? `${line} ${word}` : word;
+    }
+  }
+  if (line) lines.push(line);
+  return lines;
+}
+
+const isUnused = (l) => l.quantity === 0 && l.amount_cents === 0;
+
 /**
  * The monthly usage statement as plain text.
  * @param {{ customer: string, account: string, period: string, currency: string,
@@ -6,17 +67,76 @@
  * @returns {string}
  */
 export function renderStatement(data) {
+  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
+  const unused = data.lines.filter(isUnused).sort((a, b) => byName(a.service, b.service));
+  // Services with usage, largest charge first; equal amounts by name.
+  const used = data.lines
+    .filter((l) => !isUnused(l))
+    .sort((a, b) => b.amount_cents - a.amount_cents || byName(a.service, b.service));
+  // Credits, largest first.
+  const credits = [...data.credits].sort(
+    (a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents) || byName(a.reason, b.reason),
+  );
+
+  const charges = data.lines.reduce((sum, l) => sum + l.amount_cents, 0);
+  const total = charges + data.credits.reduce((sum, c) => sum + c.amount_cents, 0);
+
+  const usageOf = (l) => `${groupDigits(l.quantity)} ${l.unit}`;
+  const serviceW = Math.max("Service".length, ...used.map((l) => l.service.length));
+  const usageW = Math.max("Usage".length, ...used.map((l) => usageOf(l).length));
+  const shareW = "100.0%".length;
+  const amountW = Math.max(
+    `Amount (${data.currency})`.length,
+    ...used.map((l) => money(l.amount_cents).length),
+    ...credits.map((c) => money(Math.abs(c.amount_cents)).length + 1),
+    money(charges).length,
+    money(total).length,
+  );
+  // One character after the amount column holds the closing parenthesis of a credit.
+  const slot = 1;
+  const gap = "  ";
+  const width = serviceW + usageW + shareW + amountW + slot + gap.length * 3;
+  const rule = "-".repeat(width);
+
+  const row = (a, b, c, d) =>
+    trimEnd(
+      `${[padRight(a, serviceW), padRight(b, usageW), padLeft(c, shareW), padLeft(d, amountW)].join(gap)} `,
+    );
+  const labelW = width - amountW - slot - gap.length;
+  // A label on the left and an amount flush with the amount column.
+  const summary = (label, text, tail = " ") =>
+    trimEnd(`${padRight(label, labelW)}${gap}${padLeft(text, amountW)}${tail}`);
+
   const out = [];
-  out.push(`Usage statement ${data.account} ${data.customer} ${data.period}`);
-  let total = 0;
-  for (const line of data.lines) {
-    out.push(`${line.service} ${line.quantity} ${line.unit} ${line.amount_cents}`);
-    total += line.amount_cents;
+  const account = `Account ${data.account}`;
+  out.push(`${padRight(data.customer, Math.max(1, width - account.length))}${account}`);
+  out.push(`Usage statement for ${monthName(data.period)}`);
+  out.push("");
+  out.push(row("Service", "Usage", "Share", `Amount (${data.currency})`));
+  out.push(rule);
+  for (const l of used) {
+    out.push(row(l.service, usageOf(l), percent(l.amount_cents, charges), money(l.amount_cents)));
+  }
+  out.push(rule);
+  out.push(row("Charges", "", percent(charges, charges), money(charges)));
+  out.push("");
+  out.push("Credits");
+  for (const c of credits) {
+    // Credits are stored as negative amounts and shown as (amount), decimal point in the column.
+    const label = `  ${c.reason}`;
+    out.push(
+      c.amount_cents < 0
+        ? summary(label, `(${money(-c.amount_cents)}`, ")")
+        : summary(label, money(c.amount_cents)),
+    );
   }
-  for (const credit of data.credits) {
-    out.push(`${credit.reason} ${credit.amount_cents}`);
-    total += credit.amount_cents;
+  out.push(rule);
+  out.push(summary("Total due", money(total)));
+  if (unused.length > 0) {
+    const n = unused.length;
+    const names = listNames(unused.map((l) => l.service));
+    out.push("");
+    out.push(...wrap(`${n} ${n === 1 ? "service" : "services"} with no usage ${n === 1 ? "is" : "are"} not listed: ${names}.`, width));
   }
-  out.push(`Total ${total} ${data.currency} cents`);
   return `${out.join("\n")}\n`;
 }
```

### What candidate R renders

```text
Northwind Robotics                           Account NW-20418
Usage statement for September 2026

Service             Usage                Share  Amount (USD)
-------------------------------------------------------------
Compute             18,250 vCPU-hours    39.5%      1,642.50
Managed database    720 instance-hours   31.2%      1,296.00
Dedicated support   1 plan               12.0%        500.00
Data transfer out   4,380 GB              9.5%        394.20
Object storage      9,120 GB-months       5.0%        209.76
Container registry  412 GB-months         1.0%         41.20
Key management      36 keys               0.9%         36.00
Load balancing      1,440 hours           0.9%         36.00
-------------------------------------------------------------
Charges                                 100.0%      4,155.66

Credits
  Committed-use discount                             (410.63)
  Service credit, 14 Sep outage                      (164.25)
-------------------------------------------------------------
Total due                                           3,580.78

2 services with no usage are not listed: Machine learning
inference and Monitoring.
```

# What to do

For each candidate, score it from 1 to 5 against the task and the acceptance material (5: every requirement clearly met with tests that would catch a regression; 3: the main behaviour is right but a requirement is unmet, untested or fragile; 1: does not do the task), with two or three sentences of reasons that cite the diff. Then rank all candidates from best to worst; ties are allowed only when you can say why two are indistinguishable. Judge the deliverable, not its volume: more lines are not more credit.

End your reply with exactly one fenced JSON block of this shape, and nothing after it:

```json
{
  "scores": { "F": { "score": <1-5>, "reasons": "<two or three sentences>" }, "W": { "score": <1-5>, "reasons": "<two or three sentences>" }, "G": { "score": <1-5>, "reasons": "<two or three sentences>" }, "M": { "score": <1-5>, "reasons": "<two or three sentences>" }, "S": { "score": <1-5>, "reasons": "<two or three sentences>" }, "Y": { "score": <1-5>, "reasons": "<two or three sentences>" }, "J": { "score": <1-5>, "reasons": "<two or three sentences>" }, "R": { "score": <1-5>, "reasons": "<two or three sentences>" } },
  "ranking": ["F", "W", "G", "M", "S", "Y", "J", "R"],
  "notes": "<anything that applied to several candidates, in at most three sentences>"
}
```


## Reply

**Candidate F (4).** The render meets every STYLE.md point.
- The heading carries the customer, account and month.
- Columns line up, and the `amountCell` trailing-slot trick keeps decimal points level between `1,642.50` and `(410.63)`.
- Credits get their own block with a "Total credits" line, and TOTAL DUE sits between `=` rules.
- The final `replace(/\s+$/, "")` strips trailing spaces.
- Zero-usage services move to a footnote, and the `\u0000` placeholder stops a name from splitting across lines.

It adds no tests. The width comes from the content (`labelWidth`, `wService`), and nothing caps it at 72 or wraps a long service name.

**Candidate S (4).** This is the most complete layout.
- A Qty/Unit/Share/Amount table.
- Indented credits followed by "Total credits".
- TOTAL DUE between full `=` rules.
- The closing parenthesis hangs in column 72 via `edge = WIDTH - 1`.

It renders at exactly 72 characters, so it has no margin. `svcW` is whatever room is left after the other columns, and a service name longer than that is not wrapped, so it pushes the row past 72. No tests were added.

**Candidate M (4).** The output is clean.
- The parenthesis slot from `wCol = wAmount + 1` keeps credit and charge decimals aligned.
- A credits subtotal is shown, and the total due sits between `=` rules.
- The footnote joins names with "and" and keeps each name whole.

The credits block has no heading; its subtotal is labelled just "Credits" below the rule. The footnote's wrap relies on a non-breaking space placeholder in `.replace(/ /g, " ")`, which is invisible in source. Width grows with content and there are no tests.

**Candidate W (4).** It uses a fixed 68-column layout (`WIDTH = 68`) and wraps labels, so long names cannot break the 72-character limit.
- The heading carries customer, account and month.
- Credits come with their own underline and total, and the total due sits between `=` rules.
- Amounts are exact via integer `money()`.

It lists the 0.00 services in the table, shows credits with a minus sign, and keeps data order rather than ordering by size. That is plain, though less refined than F. No tests were added.

**Candidate J (4).** J is the only candidate that adds tests in `tests/statement.test.mjs`.
- One test checks the 72-character limit, trailing spaces and ASCII-only content.
- One checks the exact amounts.
- One checks that a long service name wraps.

`labelWidth` is capped through `MAX_WIDTH`, and `wrap` keeps long labels inside the limit. The render is the least polished, though.
- The heading is a sentence.
- The column header just says "Amount", with the currency moved to line 2.
- There is no rule under the column header.
- The total due is set off only by a short `========` over the amount.

**Candidate Y (3).** The table and credits render well, and the `throw` when `widest > MAX_WIDTH` enforces the width limit loudly. The total due is separated only by an ordinary `-` rule, the same rule used inside the table, so it does not stand out "at once". There is no credits subtotal and no tests.

**Candidate R (3).** It has the same weak total-due treatment as Y: a single `-` rule, then "Total due", with no emphasis and no credits subtotal. The footnote splits "Machine / learning inference" across lines. Width is content-driven with no cap, and there are no tests.

**Candidate G (3).** The render looks good. However, `isUnused = (l) => l.quantity === 0 || l.amount_cents === 0` combines with `chargeCents` summing only `listed`. A zero-quantity line with a nonzero fee would therefore vanish from both the table and the total due, which breaks "numbers exact to the data". It also wraps any credit in parentheses regardless of sign, splits a service name in the footnote, and adds no tests.

**Ranking, best to worst:** F, S, M, W, J, Y, R, G.

```json
{
  "scores": {
    "F": { "score": 4, "reasons": "The render meets every STYLE.md point: a heading with customer, account and month; aligned columns whose decimals line up through the trailing-slot `amountCell`; credits with their own total; TOTAL DUE between `=` rules; trailing spaces stripped by the final `replace(/\\s+$/, \"\")`. Zero-usage services move to a footnote whose `\\u0000` placeholder keeps names whole. No tests were added, and width comes from the content with no cap or wrap at 72." },
    "W": { "score": 4, "reasons": "A fixed `WIDTH = 68` and a label `wrap` make the 72-character limit robust, and integer `money()` keeps amounts exact. Credits have their own underline and total, and the total due sits between `=` rules. It lists 0.00 services, uses minus signs for credits, keeps data order, and adds no tests." },
    "G": { "score": 3, "reasons": "The render is clean, but `isUnused` uses `quantity === 0 || amount_cents === 0` and `chargeCents` sums only `listed`, so a zero-quantity line with a nonzero fee would silently drop out of the total due. Every credit is wrapped in parentheses regardless of sign, and the footnote splits a service name across lines. No tests were added." },
    "M": { "score": 4, "reasons": "Decimals align through `wCol = wAmount + 1`, a credits subtotal is shown, the total due sits between `=` rules, and the footnote keeps names whole. The credits rows have no heading, and the wrap relies on an invisible non-breaking-space placeholder in `.replace(/ /g, \" \")`. Width grows with content and there are no tests." },
    "S": { "score": 4, "reasons": "This is the most complete layout: a Qty/Unit/Share table, indented credits with \"Total credits\", and TOTAL DUE between full `=` rules, with the closing parenthesis hanging at `edge = WIDTH - 1`. It renders at exactly 72 columns, and `svcW` is only the leftover room, so a longer service name would push the row past the limit. No tests were added." },
    "Y": { "score": 3, "reasons": "The table and credits render well, and the `throw` when `widest > MAX_WIDTH` guards the 72-character limit. The total due is set off only by the same `-` rule used inside the table, which falls short of letting the reader find it at once. There is no credits subtotal and no tests." },
    "J": { "score": 4, "reasons": "J is the only candidate with tests: width, trailing-space and ASCII checks, exact amounts, and long-name wrapping, all backed by the `MAX_WIDTH` cap on `labelWidth`. The render is the least polished, with a sentence heading, an \"Amount\" column without its currency, no rule under the column header, and only a short `========` marking the total due. Credits shown with minus signs and the 0.00 services left in the table add to the plain look." },
    "R": { "score": 3, "reasons": "The charges table is aligned and credits sit in a parenthesis slot, but the total due follows a single plain `-` rule with no emphasis and there is no credits subtotal. The footnote breaks \"Machine learning inference\" across lines. Width is content-driven with no 72-character guard, and no tests were added." }
  },
  "ranking": ["F", "S", "M", "W", "J", "Y", "R", "G"],
  "notes": "Only J added tests, so for every other candidate no regression in width, trailing spaces or exact totals would be caught. F, G, M, R and S size columns from content without wrapping or capping long names; only W and J wrap, and Y refuses to render. Every candidate keeps the money arithmetic in integer cents, and all eight renders are exact to the data."
}
```
