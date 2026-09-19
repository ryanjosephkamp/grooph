/**
 * A tiny schema combinator library.
 *
 * One declaration per type yields three things that must never drift apart:
 *
 *  - `check()`   — structural validation with JSON Pointer paths (`E_SCHEMA`)
 *  - `json()`    — the published JSON Schema (`schema/grooph-0.schema.json`)
 *  - `canon()`   — canonical key order (graph-ir §7)
 *  - `unknownKeys()` — keys the schema does not declare (`W_UNKNOWN_KEY`)
 *
 * It also carries the TypeScript type it describes as a phantom field, so
 * `src/schema/graph.ts` can assert at compile time that the schema and the
 * normative types in `src/types.ts` describe the same shape.
 *
 * Dependency-free on purpose: core runs in the browser in slice 0002.
 */

export type SchemaIssue = { path: string; message: string };

/** A key the schema does not declare, where it sits, and the keys that object does declare. */
export type UnknownKey = { path: string; key: string; known: string[] };

export type JsonSchema = Record<string, unknown>;

export type EmitContext = {
  defs: Record<string, JsonSchema>;
};

export interface Sch<T> {
  /** phantom: never present at runtime */
  readonly __t?: T;
  /** human description used in messages, e.g. "string", "one of pass | fail" */
  readonly describe: string;
  check(value: unknown, path: string, out: SchemaIssue[]): void;
  json(ctx: EmitContext): JsonSchema;
  /** returns `value` with object keys in canonical order; never mutates */
  canon(value: unknown): unknown;
  /** true when this schema accepts the value (used to pick a union branch) */
  accepts(value: unknown): boolean;
  /** collect keys the schema does not declare; record-valued objects hold data, not keys */
  unknownKeys(value: unknown, path: string, out: UnknownKey[]): void;
}

export type Opt<T> = Sch<T> & { readonly __optional: true };

export type Fields = Record<string, Sch<unknown> | Opt<unknown>>;

export type TypeOf<S> = S extends Sch<infer T> ? T : never;

type OptionalKeys<F extends Fields> = {
  [K in keyof F]: F[K] extends Opt<unknown> ? K : never;
}[keyof F];
type RequiredKeys<F extends Fields> = Exclude<keyof F, OptionalKeys<F>>;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ObjType<F extends Fields> = Prettify<
  { [K in RequiredKeys<F>]: TypeOf<F[K]> } & { [K in OptionalKeys<F>]?: TypeOf<F[K]> }
>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const typeName = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v;

function base<T>(
  describe: string,
  impl: Pick<Sch<T>, "check" | "json"> & Partial<Pick<Sch<T>, "canon" | "unknownKeys">>,
): Sch<T> {
  const self: Sch<T> = {
    describe,
    check: impl.check,
    json: impl.json,
    canon: impl.canon ?? ((value) => value),
    unknownKeys: impl.unknownKeys ?? (() => {}),
    accepts(value) {
      const out: SchemaIssue[] = [];
      self.check(value, "", out);
      return out.length === 0;
    },
  };
  return self;
}

/** Marks a field optional inside `obj`. */
export function opt<T>(sch: Sch<T>): Opt<T> {
  return { ...sch, __optional: true } as Opt<T>;
}

export function str(options: { pattern?: RegExp; patternName?: string; minLength?: number } = {}): Sch<string> {
  const describe = options.patternName ?? "string";
  return base<string>(describe, {
    check(value, path, out) {
      if (typeof value !== "string") {
        out.push({ path, message: `expected ${describe}, got ${typeName(value)}` });
        return;
      }
      if (options.minLength !== undefined && value.length < options.minLength) {
        out.push({ path, message: `expected ${describe} of at least ${options.minLength} character(s)` });
        return;
      }
      if (options.pattern && !options.pattern.test(value)) {
        out.push({ path, message: `expected ${describe} matching ${options.pattern.source}, got ${JSON.stringify(value)}` });
      }
    },
    json() {
      const s: JsonSchema = { type: "string" };
      if (options.pattern) s["pattern"] = options.pattern.source;
      if (options.minLength !== undefined) s["minLength"] = options.minLength;
      return s;
    },
  });
}

export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Kebab-case id (graph-ir §1). */
export function id(): Sch<string> {
  return str({ pattern: ID_PATTERN, patternName: "kebab-case id" });
}

export function num(options: { integer?: boolean; minimum?: number } = {}): Sch<number> {
  const describe = options.integer ? "integer" : "number";
  return base<number>(describe, {
    check(value, path, out) {
      if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        out.push({ path, message: `expected ${describe}, got ${typeName(value)}` });
        return;
      }
      if (options.integer && !Number.isInteger(value)) {
        out.push({ path, message: `expected ${describe}, got ${value}` });
        return;
      }
      if (options.minimum !== undefined && value < options.minimum) {
        out.push({ path, message: `expected ${describe} >= ${options.minimum}, got ${value}` });
      }
    },
    json() {
      const s: JsonSchema = { type: options.integer ? "integer" : "number" };
      if (options.minimum !== undefined) s["minimum"] = options.minimum;
      return s;
    },
  });
}

export function bool(): Sch<boolean> {
  return base<boolean>("boolean", {
    check(value, path, out) {
      if (typeof value !== "boolean") out.push({ path, message: `expected boolean, got ${typeName(value)}` });
    },
    json: () => ({ type: "boolean" }),
  });
}

export function nul(): Sch<null> {
  return base<null>("null", {
    check(value, path, out) {
      if (value !== null) out.push({ path, message: `expected null, got ${typeName(value)}` });
    },
    json: () => ({ type: "null" }),
  });
}

/**
 * A schema published elsewhere: checks, orders and reports keys exactly as `sch`
 * does, but the JSON Schema names it by `$ref` instead of repeating it.
 */
export function external<T>(sch: Sch<T>, $ref: string): Sch<T> {
  return { ...sch, json: () => ({ $ref }) };
}

export function lit<const V extends string | number | boolean>(value: V): Sch<V> {
  return base<V>(JSON.stringify(value), {
    check(v, path, out) {
      if (v !== value) out.push({ path, message: `expected ${JSON.stringify(value)}, got ${JSON.stringify(v) ?? typeName(v)}` });
    },
    json: () => ({ const: value }),
  });
}

export function enumOf<const V extends string>(...values: V[]): Sch<V> {
  const describe = `one of ${values.join(" | ")}`;
  return base<V>(describe, {
    check(value, path, out) {
      if (typeof value !== "string" || !values.includes(value as V)) {
        out.push({ path, message: `expected ${describe}, got ${JSON.stringify(value) ?? typeName(value)}` });
      }
    },
    json: () => ({ enum: [...values] }),
  });
}

/** An open string union: named values documented, any string accepted (graph-ir §1). */
export function openEnum<T extends string>(known: readonly string[], label: string): Sch<T> {
  return base<T>(label, {
    check(value, path, out) {
      if (typeof value !== "string" || value.length === 0) {
        out.push({ path, message: `expected ${label} (non-empty string), got ${typeName(value)}` });
      }
    },
    json: () => ({ type: "string", minLength: 1, examples: [...known] }),
  });
}

export function arr<T>(item: Sch<T>, options: { minItems?: number; maxItems?: number } = {}): Sch<T[]> {
  const describe = `array of ${item.describe}`;
  return base<T[]>(describe, {
    check(value, path, out) {
      if (!Array.isArray(value)) {
        out.push({ path, message: `expected ${describe}, got ${typeName(value)}` });
        return;
      }
      if (options.minItems !== undefined && value.length < options.minItems) {
        out.push({ path, message: `expected at least ${options.minItems} item(s), got ${value.length}` });
      }
      if (options.maxItems !== undefined && value.length > options.maxItems) {
        out.push({ path, message: `expected at most ${options.maxItems} item(s), got ${value.length}` });
      }
      value.forEach((entry, i) => item.check(entry, `${path}/${i}`, out));
    },
    json(ctx) {
      const s: JsonSchema = { type: "array", items: item.json(ctx) };
      if (options.minItems !== undefined) s["minItems"] = options.minItems;
      if (options.maxItems !== undefined) s["maxItems"] = options.maxItems;
      return s;
    },
    canon(value) {
      return Array.isArray(value) ? value.map((entry) => item.canon(entry)) : value;
    },
    unknownKeys(value, path, out) {
      if (Array.isArray(value)) value.forEach((entry, i) => item.unknownKeys(entry, `${path}/${i}`, out));
    },
  });
}

/** Any JSON value; unknown object keys are ordered alphabetically by `canon`. */
export function any(describe = "any JSON value"): Sch<unknown> {
  const self: Sch<unknown> = base<unknown>(describe, {
    check: () => {},
    json: () => ({}),
    canon(value) {
      if (Array.isArray(value)) return value.map((v) => self.canon(v));
      if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) out[key] = self.canon(value[key]);
        return out;
      }
      return value;
    },
  });
  return self;
}

/** `Record<string, V>`; keys are data, so `canon` sorts them alphabetically. */
export function rec<T>(value: Sch<T>, options: { keyPattern?: RegExp; keyName?: string } = {}): Sch<Record<string, T>> {
  const describe = `object of ${value.describe}`;
  return base<Record<string, T>>(describe, {
    check(v, path, out) {
      if (!isPlainObject(v)) {
        out.push({ path, message: `expected ${describe}, got ${typeName(v)}` });
        return;
      }
      for (const [key, entry] of Object.entries(v)) {
        if (options.keyPattern && !options.keyPattern.test(key)) {
          out.push({
            path: `${path}/${escapePointer(key)}`,
            message: `expected ${options.keyName ?? "key"} matching ${options.keyPattern.source}, got ${JSON.stringify(key)}`,
          });
        }
        value.check(entry, `${path}/${escapePointer(key)}`, out);
      }
    },
    json(ctx) {
      const s: JsonSchema = { type: "object", additionalProperties: value.json(ctx) };
      if (options.keyPattern) s["propertyNames"] = { pattern: options.keyPattern.source };
      return s;
    },
    canon(v) {
      if (!isPlainObject(v)) return v;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) out[key] = value.canon(v[key]);
      return out;
    },
    unknownKeys(v, path, out) {
      if (!isPlainObject(v)) return;
      for (const [key, entry] of Object.entries(v)) value.unknownKeys(entry, `${path}/${escapePointer(key)}`, out);
    },
  });
}

function escapePointer(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

const unknownValue = any();

export function obj<F extends Fields>(fields: F, options: { name?: string; describe?: string } = {}): Sch<ObjType<F>> {
  const keys = Object.keys(fields);
  const required = keys.filter((k) => !("__optional" in (fields[k] as object)));
  const describe = options.describe ?? options.name ?? "object";
  const self = base<ObjType<F>>(describe, {
    check(value, path, out) {
      if (!isPlainObject(value)) {
        out.push({ path, message: `expected ${describe}, got ${typeName(value)}` });
        return;
      }
      for (const key of required) {
        if (!(key in value) || value[key] === undefined) {
          out.push({ path: `${path}/${key}`, message: `missing required property "${key}"` });
        }
      }
      for (const key of keys) {
        const entry = value[key];
        if (entry === undefined) continue;
        fields[key]!.check(entry, `${path}/${key}`, out);
      }
    },
    json(ctx) {
      const properties: Record<string, JsonSchema> = {};
      for (const key of keys) properties[key] = fields[key]!.json(ctx);
      const s: JsonSchema = { type: "object", properties, required };
      if (required.length === 0) delete s["required"];
      if (options.name) {
        ctx.defs[options.name] = s;
        return { $ref: `#/$defs/${options.name}` };
      }
      return s;
    },
    canon(value) {
      if (!isPlainObject(value)) return value;
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (value[key] === undefined) continue;
        out[key] = fields[key]!.canon(value[key]);
      }
      // graph-ir §7: unknown keys last, alphabetical.
      for (const key of Object.keys(value).sort()) {
        if (keys.includes(key) || value[key] === undefined) continue;
        out[key] = unknownValue.canon(value[key]);
      }
      return out;
    },
    unknownKeys(value, path, out) {
      if (!isPlainObject(value)) return;
      for (const key of Object.keys(value)) {
        if (value[key] === undefined) continue;
        const where = `${path}/${escapePointer(key)}`;
        if (keys.includes(key)) fields[key]!.unknownKeys(value[key], where, out);
        else out.push({ path: where, key, known: keys });
      }
    },
  });
  return self;
}

/** Discriminated union: the tag picks the branch, so messages stay specific. */
export function tagged<B extends Record<string, Sch<unknown>>>(
  tag: string,
  branches: B,
  options: { name?: string; label?: string } = {},
): Sch<TypeOf<B[keyof B]>> {
  const tags = Object.keys(branches);
  const label = options.label ?? "object";
  const describe = `${label} with ${tag} one of ${tags.join(" | ")}`;
  return base<TypeOf<B[keyof B]>>(describe, {
    check(value, path, out) {
      if (!isPlainObject(value)) {
        out.push({ path, message: `expected ${describe}, got ${typeName(value)}` });
        return;
      }
      const key = value[tag];
      if (typeof key !== "string" || !(key in branches)) {
        out.push({
          path: `${path}/${tag}`,
          message: `expected ${tag} to be one of ${tags.join(" | ")}, got ${JSON.stringify(key) ?? "nothing"}`,
        });
        return;
      }
      branches[key]!.check(value, path, out);
    },
    json(ctx) {
      const s: JsonSchema = { oneOf: tags.map((t) => branches[t]!.json(ctx)) };
      if (options.name) {
        ctx.defs[options.name] = s;
        return { $ref: `#/$defs/${options.name}` };
      }
      return s;
    },
    canon(value) {
      if (!isPlainObject(value)) return value;
      const key = value[tag];
      if (typeof key === "string" && key in branches) return branches[key]!.canon(value);
      return unknownValue.canon(value);
    },
    unknownKeys(value, path, out) {
      if (!isPlainObject(value)) return;
      const key = value[tag];
      if (typeof key === "string" && key in branches) branches[key]!.unknownKeys(value, path, out);
    },
  });
}

/**
 * Two shapes told apart by a test on the value, so a failure is reported against
 * the shape the value was evidently meant to be, with that shape's own paths.
 */
export function either<A, B>(
  isFirst: (value: unknown) => boolean,
  first: Sch<A>,
  second: Sch<B>,
  options: { describe?: string } = {},
): Sch<A | B> {
  const pick = (value: unknown): Sch<unknown> => (isFirst(value) ? first : second);
  return base<A | B>(options.describe ?? `${first.describe} | ${second.describe}`, {
    check: (value, path, out) => pick(value).check(value, path, out),
    json: (ctx) => ({ anyOf: [first.json(ctx), second.json(ctx)] }),
    canon: (value) => pick(value).canon(value),
    unknownKeys: (value, path, out) => pick(value).unknownKeys(value, path, out),
  });
}

/** Untagged union; first accepting branch wins for canonical ordering. */
export function anyOf<B extends Sch<unknown>[]>(
  branches: [...B],
  options: { describe?: string } = {},
): Sch<TypeOf<B[number]>> {
  const describe = options.describe ?? branches.map((b) => b.describe).join(" | ");
  return base<TypeOf<B[number]>>(describe, {
    check(value, path, out) {
      if (branches.some((b) => b.accepts(value))) return;
      out.push({ path, message: `expected ${describe}, got ${JSON.stringify(value) ?? typeName(value)}` });
    },
    json(ctx) {
      return { anyOf: branches.map((b) => b.json(ctx)) };
    },
    canon(value) {
      const branch = branches.find((b) => b.accepts(value));
      return branch ? branch.canon(value) : unknownValue.canon(value);
    },
    unknownKeys(value, path, out) {
      branches.find((b) => b.accepts(value))?.unknownKeys(value, path, out);
    },
  });
}

export function toJsonSchema(root: Sch<unknown>, meta: JsonSchema): string {
  const ctx: EmitContext = { defs: {} };
  const body = root.json(ctx);
  const schema: JsonSchema = { ...meta, ...body };
  const defNames = Object.keys(ctx.defs).sort();
  if (defNames.length > 0) {
    const defs: Record<string, JsonSchema> = {};
    for (const name of defNames) defs[name] = ctx.defs[name]!;
    schema["$defs"] = defs;
  }
  return `${JSON.stringify(schema, null, 2)}\n`;
}
