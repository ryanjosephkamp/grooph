# The reference chart, and what matters about it

`reference.svg` beside this file is the chart the printed report already uses.
The critic compares each capture against it. What matters, most first:

1. **Hierarchy.** The eye lands on the title, then the bars, then the scale.
   Title 18px semi-bold dark grey at the top left, a 12px muted line under it
   naming the unit and the scale ("USD, thousands"). Nothing else competes.
2. **A usable scale.** Horizontal gridlines at round steps (every 20k), each
   labelled at the left in compact form (`0`, `20k`, … `160k`), light grey
   lines, a darker baseline at zero. The top gridline sits at or just above the
   highest bar; the scale starts at zero.
3. **Months by name**, centred under their bars, 11px, in calendar order.
4. **One accent colour** for the bars (a single blue), neutral greys for text
   and lines, a white background, no legend, no frame, no gradients, no shadow.
5. **Spacing.** Generous margins (the plot does not touch the edge), bars
   separated by a gap of about a third of a bar's width, labels that never
   overlap.
6. **Exactness.** Values map to the scale; the highest month is called out
   with its value in the same compact form (`142.3k`), and it is the right
   month and value.

A **major** gap is one a reader notices at a glance: no title or unit, raw
numbers instead of a scale, no gridlines or baseline, month numbers instead of
names, bars that touch, text that overlaps or runs off the edge, more than one
data colour, or a wrong value. Exact pixel positions, the particular grey, the
font family, and the corner treatment of bars are not gaps at all unless they
break one of the six points above.
