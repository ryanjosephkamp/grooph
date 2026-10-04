// A careful first pass written from the task text and the checklist alone, without the held-out suite.
// It meets every checklist item as written (it copies plain objects, arrays and Dates, and skips the
// three unsafe keys at any depth), and where both are silent it takes the plain reading: a value in
// `over` wins even when it is undefined, a plain object is one whose prototype is Object.prototype,
// and a value it cannot copy is handed over as it is. Kept to show that the suite separates such a
// pass from one that knows the open points; it is one author's reading, not a model's, and is never
// copied into a run.

const UNSAFE = ["__proto__", "constructor", "prototype"];

const isPlain = (value) => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value.getTime());
  if (!isPlain(value)) return value;
  const out = {};
  for (const key of Object.keys(value)) if (!UNSAFE.includes(key)) out[key] = clone(value[key]);
  return out;
}

export function layer(base, over) {
  if (!isPlain(base) || !isPlain(over)) throw new TypeError("layer: both arguments must be plain objects");
  const out = clone(base);
  for (const key of Object.keys(over)) {
    if (UNSAFE.includes(key)) continue;
    out[key] = isPlain(over[key]) && Object.hasOwn(base, key) && isPlain(base[key]) ? layer(base[key], over[key]) : clone(over[key]);
  }
  return out;
}
