import type { TemplateCredit } from "@grooph/core";

/**
 * Whose published work a template's shape or name comes from (decision 0010):
 * one short line per credit with the link and what was taken. Never an
 * endorsement, so the wording stays "inspired by".
 */
export function Credits({ credits, className = "credits" }: { credits: readonly TemplateCredit[] | undefined; className?: string }) {
  if (!credits || credits.length === 0) return null;
  return (
    <ul className={className} aria-label="Credits">
      {credits.map((credit) => (
        <li key={credit.url + credit.name}>
          Inspired by{" "}
          <a href={credit.url} target="_blank" rel="noreferrer noopener">
            {credit.name}
          </a>
          : {credit.note}
        </li>
      ))}
    </ul>
  );
}
