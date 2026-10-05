// A plain first pass written from the task text and the checklist alone, without the held-out suite: the
// shortest honest reading. A plain object is one whose prototype is Object.prototype; plain objects and
// arrays are copied at every depth and the three unsafe keys are skipped, which is what checklist items
// 4 and 5 ask of settings as they come out of JSON; whatever `over` holds under a key replaces what
// `base` holds, an undefined included; and a value it has no way to copy is handed over as it is. That
// last choice breaks item 4 for such values, which this pass never thought of: the four groups of the
// suite it fails (undefined, null prototype, dates, not plain data) are the values it did not consider.
// It is one author's reading, not a model's, and is never copied into a run.

const UNSAFE = ["__proto__", "constructor", "prototype"];

const isPlain = (value) => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
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
