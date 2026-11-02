# Gaps, round 1

Capture judged: captures/statement.txt (27 lines, widest 61 columns), rendered
2026-10-04T22:15:39Z from src/statement.mjs, sha256 3cd529c434b2
(captures/CAPTURE.md:3-4). I read it next to the billing team's statement with
both labels removed and in random order. Then I checked each one against the
same seven points, listed below.

## Comparison

Both statements have the same figures, rows, row order and shares. Everything
below is about layout.

1. **Is the total easy to find?** Both end with the total due in the amount
   column, with a rule above it. The order is charges, then the "Charges"
   subtotal (statement.txt:15), then the credits (statement.txt:17-18). The
   capture also has a "Credits" subtotal line (statement.txt:20), placed after
   the credit lines. It also puts a double rule both above and below the total
   (statement.txt:22, 24). The other statement puts a heading over the credits
   and has no credits subtotal. Its figures go straight from the last credit,
   through a single rule, to the total. Both orders are acceptable. The other
   statement is slightly clearer, because the reader knows the lines are
   credits before reading them.
2. **Largest first.** Met. Charges run from 1,642.50 down to 36.00
   (statement.txt:6-13). The two 36.00 charges are in name order: Key
   management, then Load balancing (statement.txt:12-13). The larger credit
   comes first (statement.txt:17-18).
3. **Amounts read as money.** Met. Every amount has dollars, cents and a comma
   between thousands. The decimal point is in column 58 on every figure line
   (statement.txt:6-15, 17-18, 20, 23; line lengths are in
   captures/CAPTURE.md:17-34). Credits are in parentheses, and the closing
   parenthesis sits just past the column. The currency is named only in the
   heading, "Amount (USD)" (statement.txt:4). No amount has a currency sign
   or a minus sign.
4. **Nothing that says nothing.** Met. No service with zero usage appears as
   a row. One sentence at the foot gives the count and the names
   (statement.txt:26-27). The capture breaks this sentence between items. The
   other statement breaks it in the middle of a service name, so the capture
   does this a little better.
5. **Each charge's share.** Met. Shares have one decimal, are right-aligned
   under "Share", and add up to 100.0% (statement.txt:4-15).
6. **Month by name.** Met. The heading says "September 2026"
   (statement.txt:2). The customer's name is at the left of line 1 and the
   account number at the right (statement.txt:1).
7. **Usage with its unit.** Met, for example "18,250 vCPU-hours"
   (statement.txt:6).

Overall, the other statement is slightly better because of how its credits
block is labelled. Neither has a gap a customer would notice at a glance, and
neither has anything misleading.

## Ranked gaps

1. **minor: the credits are labelled only after they are listed.** See
   statement.txt:17-20. The two credit lines come with no heading. The word
   "Credits" first appears on line 20, as a subtotal. To fix it, put a
   "Credits" heading line directly above the credit lines. Then either drop
   the credits subtotal, or keep it only if it clearly totals the credits and
   does not read like a second total.
2. **minor: an extra figure and heavy rules around the total.** See
   statement.txt:20-24. The bracketed credits subtotal sits just above the
   total, and the double rules above and below make that whole area busy. The
   total should come straight after the last credit, behind one rule, with
   nothing after it except the footnote. This is fine to leave as it is; it is
   a matter of taste.

No major gap remains.

verdict: pass
