# GAPS: round 0

Evidence read: captures/statement.txt (24 lines), captures/CAPTURE.md (capture
check passed, 66 columns at the widest, ASCII only, no trailing whitespace), and
the billing team's statement with its notes (held out from the owner).

## Blind comparison

I stripped the labels and drew the order at random. **Statement A** is the
billing team's. **Statement B** is the current capture.

Both statements carry the same figures: Charges 4,155.66, two credits, and a
total due of 3,580.78. Both name the month ("September 2026"), put commas
between thousands, line up the decimal points, add up the charges in their own
line, and close on the total under a rule. B gets that structure right
(captures/statement.txt:17-24).

**A is better.** A customer reading A sees at once where the money went,
because the charges run largest first and each one has a percentage share. A
lists only services that were used and gives the unused ones in one closing
sentence. Its credits look like credits. B lists the charges alphabetically,
gives two lines to services that billed 0.00, writes the credits with minus
signs, and has no share column. Someone glancing at B has to scan all ten rows
to find the big costs.

## Ranked gaps

1. **MAJOR: charges are in alphabetical order, not by amount.**
   Where: captures/statement.txt:7-16. The order goes Compute, Container
   registry, Data transfer out, and so on, which puts 41.20 second and
   1,296.00 eighth.
   To close it: sort the charge rows by amount, largest first. When two amounts
   are equal, sort those rows by name. Here that means Key management
   (36.00) comes before Load balancing (36.00). The first three rows should be
   Compute 1,642.50, Managed database 1,296.00, and Dedicated support 500.00.

2. **MAJOR: services with no usage appear as table rows.**
   Where: captures/statement.txt:13 (Machine learning inference, 0, 0.00) and
   :15 (Monitoring, 0, 0.00).
   To close it: take every zero-usage service out of the table. Below the
   total, add one sentence that gives how many services were left out and
   names them (here: 2 services, Machine learning inference and Monitoring).
   Charges stays 4,155.66.

3. **MAJOR: credits use minus signs, and the smaller credit comes first.**
   Where: captures/statement.txt:21 (`-164.25`) and :22 (`-410.63`).
   To close it: write each credit in parentheses, for example (410.63), with no
   minus sign. Keep the digits and decimal point in the same column as the
   amounts above. The closing parenthesis can sit one character past the
   column, but the decimal point must not move. Order the credits largest
   first, so the committed-use discount (410.63) comes before the outage
   service credit (164.25).

4. **MAJOR: there is no share column.**
   Where: the header at captures/statement.txt:5 has Service, Quantity, Unit,
   and Amount, but no share. No row from :7 to :16 shows a percentage.
   To close it: add a column that gives each charge as a percentage of Charges
   (4,155.66), to one decimal, for example Compute 39.5%. Put 100.0% on the
   Charges line. Right-align the column so the decimal points line up.

5. **minor: usage and unit are split, the account number has its own line, and
   the currency appears twice.**
   Where: captures/statement.txt:5 and :7-16 put the quantity and the unit in
   separate columns (`18,250  vCPU-hours`, with the quantity right-aligned).
   :3 puts the account number on its own line. :24 says "Total due (USD)"
   even though the amount heading at :5 already names USD.
   To close it: make usage one left-aligned field that reads as a phrase
   ("18,250 vCPU-hours"). Put the account number at the right end of the line
   that opens with the customer name (line 1). Name the currency only in the
   amount column heading, so the total line just says "Total due".

## What already meets the bar (no action)

- The month is given by name: captures/statement.txt:2.
- Thousands have commas, and every amount has two decimals: :7-24.
- The decimal points line up all the way down. Every amount line is 66
  characters and right-aligned (CAPTURE.md:18-35).
- No amount has a currency sign: :7-24.
- A Charges line adds up the charges, under a rule, before the credits: :17-18.
  The credits come after it: :20-22.
- The statement ends with the total due under a rule, in the amount column:
  :23-24.

verdict: fail
