/** graph-ir §1: ids are kebab-case. */
export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** A kebab-case id from free text: "Merge approval" → "merge-approval". */
export function slugify(text: string, fallback = "item"): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "");
  return slug === "" ? fallback : slug;
}

/** `base`, or `base-2`, `base-3`, … — the first one not in `taken`. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
