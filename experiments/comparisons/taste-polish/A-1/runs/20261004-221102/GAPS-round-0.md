# Gaps: monthly usage statement, round 0

Evidence judged: captures/statement.txt (27 lines) and captures/CAPTURE.md. CAPTURE.md:3 says it was rendered 2026-10-04T22:12:56Z from src/statement.mjs at sha256 f62c43e4cca8, which matches the revision handed over. Both files, and the yardstick, were readable.

## Comparison (labels removed, order shuffled)

- **Statement P** lists the charges by amount, largest first. It shows each charge's share of the charges, writes credits in parentheses, leaves out services with no usage and names them in a sentence at the foot, and opens with the customer's name and the account number on one line.
- **Statement Q** lists the charges alphabetically. It writes credits with a minus sign, lists two services with no usage as zero lines, and has no share column. Its title line comes before the customer line.

Both statements end with the total due, set off by rules and placed in the amount column. In both, a "Charges" line adds up the charges and the credits come after it. Both use thousands commas, line up the decimal points and give the month by name.

**P is better.** A reader of P sees where the money went straight away. A reader of Q has to scan the whole alphabetical list to find the biggest charges, and the minus signs and zero lines get in the way. Q is the capture.

What the capture already does well:
- The total due is set off by a rule and sits in the amount column (statement.txt:25-27).
- A "Charges" line comes before the credits (statement.txt:17, 19-23).
- The decimal points fall in one column: every amount line is 66 characters wide and ends at the same column (CAPTURE.md:17-37).
- Thousands have commas (statement.txt:6, 8, 11, 13, 15, 17, 26).
- No amount carries a currency sign, and the month is written by name (statement.txt:1).

## Ranked gaps

1. **major: charges and credits are not ordered by amount.**
   - Where it shows: statement.txt:6-15 lists the charges alphabetically. For example, Compute 1,642.50 comes first, but Container registry 41.20 comes before Managed database 1,296.00 (statement.txt:7, 13). The credits run smallest first: 164.25 at statement.txt:20 comes before 410.63 at statement.txt:21.
   - Closing it: sort the charges by amount, largest first, and break ties by name. Key management and Load balancing are both 36.00 (statement.txt:10-11), so Key management goes first. Sort the credits the same way, largest credit first.

2. **major: credits are written with a minus sign.**
   - Where it shows: statement.txt:20, 21 and 23 (-164.25, -410.63, -574.88).
   - Closing it: write each credit in parentheses with no minus sign. The digits and the decimal point must stay in line with the amounts above, which means the closing parenthesis hangs one column to the right of where a plain amount ends.

3. **major: services with no usage are listed as table lines.**
   - Where it shows: statement.txt:12 (Machine learning inference, 0, 0.00) and statement.txt:14 (Monitoring, 0, 0.00).
   - Closing it: drop zero-usage services from the table. Add one sentence at the foot of the statement, after the total, that says how many were left out and names them.

4. **major: there is no share column.**
   - Where it shows: the heading at statement.txt:4 and every charge line at statement.txt:6-15 have no share column.
   - Closing it: add a column that gives each charge as a percentage of total charges, to one decimal (Compute is 1,642.50 / 4,155.66 = 39.5%). The Charges line should show 100.0%.

5. **minor: the opening line and the usage column.**
   - Where it shows: statement.txt:1-2 opens with a title. The customer's name only comes on the second line, with the account number right after it rather than at the right-hand edge. Quantity and unit are also split into separate columns (statement.txt:4, 6-15), so they don't read as one phrase like "18,250 vCPU-hours".
   - Closing it: open with the customer's name, with the account number right-aligned on the same line, and put the month line under it. Merge quantity and unit into one left-aligned usage column ("18,250 vCPU-hours"), keeping the thousands commas.
   - A smaller point: "Total due (USD)" at statement.txt:26 names the currency a second time. It should be named only once, in the amount column heading at statement.txt:4.

Four major gaps remain, so this does not pass.

verdict: fail
