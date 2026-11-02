# GAPS, round 1

Evidence read: captures/statement.txt (24 lines), captures/CAPTURE.md (line
lengths), and the billing team's statement with its notes. Nothing was missing
or unreadable.

## Blind side by side

I read the two statements as X and Y, labels stripped, order picked at random.
X turned out to be the capture and Y the billing team's statement.

They carry the same figures in the same order: eight charges, a Charges line of
4,155.66, two credits, and Total due 3,580.78. I checked the sums.
1,642.50 + 1,296.00 + 500.00 + 394.20 + 209.76 + 41.20 + 36.00 + 36.00 = 4,155.66,
and 4,155.66 - 410.63 - 164.25 = 3,580.78. Every share rounds correctly to one
decimal, and the shares add to 100.0%.

The differences are only in layout and wording:

- X is narrower. It is 61 columns wide and Y is 69, because X's service column
  is fitted to the longest name. Neither width is a gap.
- X indents the two credit lines by two spaces (statement.txt:18-19). Y sets
  them flush left. Both keep the credit digits in the amount column.
- The footer sentences are worded differently. Both give the count and both
  names (statement.txt:23-24).

**Which is better.** X, slightly. It is as easy to read, it is more compact,
and the indent shows at a glance which lines belong under "Credits". Neither
statement breaks any of the points that matter.

## Checks against what matters

1. **The total is found at once.** Met. The order is charges (statement.txt:6-13),
   a rule (:14), Charges (:15), Credits (:17-19), a rule (:20), then Total due
   (:21). The total's amount sits in the amount column.
2. **Largest first.** Met. Charges run from 1,642.50 down to 36.00
   (statement.txt:6-13). The two 36.00 charges are in name order, Key management
   and then Load balancing (:12-13). The credits are largest first, 410.63 and
   then 164.25 (:18-19).
3. **Amounts read as money.** Met. Every amount's last digit falls in column 60
   (CAPTURE.md:17-32: amount lines are 60 characters, and the credit lines are
   61 with the closing parenthesis outside). Thousands have commas (:6, :7, :15,
   :21). The currency appears only in the heading "Amount (USD)" (:4). There is
   no "$" and no minus sign, and credits are in parentheses (:18-19).
4. **Nothing that says nothing.** Met. No zero-usage service has a table line.
   One sentence at the foot gives the count and both names (statement.txt:23-24).
5. **Each charge's share.** Met. A Share column gives one decimal on every
   charge (statement.txt:6-13), and the Charges line shows 100.0% (:15).
6. **The month by name.** Met. "September 2026" (statement.txt:2). The customer
   name opens line 1 and the account number is at the right of it (:1).
7. **Usage with its unit.** Met. Each quantity has a thousands comma where
   needed and its unit beside it, e.g. "18,250 vCPU-hours" (statement.txt:6).

## Ranked gaps

1. **Minor: the footer sentence wraps mid-name.** At statement.txt:23-24,
   "Machine learning / inference" is split across the line break. To close it,
   break the line before the service name so "Machine learning inference" stays
   on one line, or reword it so the break falls between names. A slightly fuller
   wording, saying the services had no usage *this month*, would also tie the
   note to the period on line 2.
2. **Minor, optional: the indented credit lines.** At statement.txt:18-19 the
   credit labels are indented two spaces, while the charge labels above are not.
   This is a choice, not a fault: the digits still line up. Leave it as it is
   unless STYLE.md asks for every label to start at the left margin.

No major gap remains.

verdict: pass
