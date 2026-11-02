# CHANGES: round 1

All five ranked gaps closed in src/statement.mjs. `npm test` passes (3/3, no test
edits needed); `npm run capture` rerun (24 lines, widest 61 characters).

1. Charges sorted largest first, ties by name (Key management before Load
   balancing). Top three: Compute 1,642.50, Managed database 1,296.00,
   Dedicated support 500.00.
2. Zero-usage services removed from the table. A closing sentence under the
   total gives the count and names them: "2 services with no usage are not
   listed: Machine learning inference and Monitoring." Charges stays 4,155.66.
   A service counts as unused only if quantity and amount are both 0.
3. Credits written as (410.63) and (164.25), no minus sign, largest first. The
   closing parenthesis sits in a one-character slot past the amount column, so
   decimal points stay aligned with the amounts above.
4. Added a right-aligned Share column (percent of Charges, one decimal,
   computed from whole cents); 100.0% on the Charges line.
5. Usage is one left-aligned phrase ("18,250 vCPU-hours"); the account number
   is at the right end of line 1 with the customer name; the total line reads
   "Total due" (USD only in the amount heading).

Left on purpose: nothing from GAPS.md. Kept as-is because they already met the
bar: month by name, comma thousands, two decimals, aligned decimal points, no
currency signs, Charges line under a rule, total due under a rule. Shares are
rounded to one decimal each and may not sum to exactly 100.0%.
