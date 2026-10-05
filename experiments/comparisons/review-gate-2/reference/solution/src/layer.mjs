// A solution that passes the held-out suite, kept to show the suite can be passed.
// It is never copied into a run: a scratch project is built from task/ alone.

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

const isPlain = (value) => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** A copy of one value that shares nothing with it; a value that is not plain data is refused. */
function copy(value, path) {
  if (typeof value === "function" || typeof value === "symbol") throw new TypeError(`layer: ${path} is not plain data`);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item, i) => copy(item, `${path}[${i}]`));
  if (value instanceof Date) return new Date(value.getTime());
  if (!isPlain(value)) throw new TypeError(`layer: ${path} is not plain data`);
  const out = {};
  for (const key of Object.keys(value)) {
    if (UNSAFE.has(key) || value[key] === undefined) continue;
    out[key] = copy(value[key], `${path}.${key}`);
  }
  return out;
}

function lay(base, over, path) {
  const out = copy(base, path);
  for (const key of Object.keys(over)) {
    const value = over[key];
    if (UNSAFE.has(key) || value === undefined) continue;
    const under = Object.hasOwn(base, key) ? base[key] : undefined;
    out[key] = isPlain(value) && isPlain(under) ? lay(under, value, `${path}.${key}`) : copy(value, `${path}.${key}`);
  }
  return out;
}

export function layer(base, over) {
  if (!isPlain(base) || !isPlain(over)) throw new TypeError("layer: both arguments must be plain objects");
  return lay(base, over, "settings");
}
