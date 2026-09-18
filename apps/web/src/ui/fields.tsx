/**
 * Form controls for the inspector. Phone first: native selects, segmented
 * buttons for short enums, one-item-per-line text areas for lists, and every
 * target at least 44 px tall. No control needs a hardware key.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Field(props: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={props.wide ? "field field-wide" : "field"}>
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      {props.children(id)}
      {props.hint ? <div className="field-hint">{props.hint}</div> : null}
    </div>
  );
}

export function TextInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  const arrived = useRef(false);
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <input
          id={id}
          className={props.mono ? "input mono" : "input"}
          value={props.value}
          placeholder={props.placeholder}
          autoFocus={props.autoFocus}
          // A default name ("Agent", "Untitled graph") is selected on arrival, so typing replaces it.
          onFocus={(e) => {
            if (!props.autoFocus || arrived.current) return;
            arrived.current = true;
            e.target.select();
          }}
          autoComplete="off"
          autoCapitalize={props.mono ? "off" : "sentences"}
          spellCheck={!props.mono}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/** A text area that grows with its content, so a brief reads without scrolling twice. */
export function TextArea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  rows?: number;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <AutoGrow id={id} value={props.value} placeholder={props.placeholder} rows={props.rows ?? 3} onChange={props.onChange} />
      )}
    </Field>
  );
}

function AutoGrow(props: {
  id: string;
  value: string;
  placeholder?: string;
  rows: number;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      id={props.id}
      className="input textarea"
      rows={props.rows}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
    />
  );
}

/**
 * A list of strings, one per line. The raw text is kept locally while the
 * field has focus so a trailing newline survives typing; the document gets
 * the trimmed, non-empty lines on every keystroke.
 */
export function ListInput(props: {
  label: string;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  placeholder?: string;
  hint?: ReactNode;
}) {
  const joined = (props.value ?? []).join("\n");
  const [text, setText] = useState(joined);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(joined);
  }, [joined]);
  return (
    <Field label={props.label} hint={props.hint ?? "One per line."}>
      {(id) => (
        <AutoGrow
          id={id}
          rows={2}
          value={text}
          placeholder={props.placeholder}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setText(joined);
          }}
          onChange={(value) => {
            setText(value);
            props.onChange(
              value
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line !== ""),
            );
          }}
        />
      )}
    </Field>
  );
}

/**
 * A number, or nothing. Kept as text while typing so "1." or "-" can be
 * entered on a phone keyboard; the document gets the parsed value, or loses
 * the key when the field is empty.
 */
export function NumberInput(props: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  integer?: boolean;
  placeholder?: string;
  hint?: ReactNode;
}) {
  const shown = props.value === undefined ? "" : String(props.value);
  const [text, setText] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <input
          id={id}
          className="input"
          inputMode={props.integer ? "numeric" : "decimal"}
          value={text}
          placeholder={props.placeholder}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            setText(shown);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const n = Number(raw);
            if (raw.trim() === "") props.onChange(undefined);
            else if (Number.isFinite(n)) props.onChange(props.integer ? Math.trunc(n) : n);
          }}
        />
      )}
    </Field>
  );
}

export type Choice<T extends string> = { value: T; label: string };

/** Segmented buttons: one tap to choose among a few options. */
export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="field">
      <div className="field-label" id={labelId}>
        {props.label}
      </div>
      <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={props.value === option.value}
            className={props.value === option.value ? "seg seg-on" : "seg"}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {props.hint ? <div className="field-hint">{props.hint}</div> : null}
    </div>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <select id={id} className="input select" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label className="toggle" htmlFor={id}>
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
        <span className="toggle-track" aria-hidden="true" />
        <span className="toggle-label">{props.label}</span>
      </label>
      {props.hint ? <div className="field-hint">{props.hint}</div> : null}
    </div>
  );
}

/**
 * A set of strings chosen from a catalog, plus custom entries. Catalog items
 * are toggle chips; anything else the document holds shows as a removable
 * chip, and a small field adds more.
 */
export function ChipSet(props: {
  label: string;
  value: string[] | undefined;
  catalog: readonly string[];
  onChange: (value: string[]) => void;
  hint?: ReactNode;
  customPlaceholder?: string;
}) {
  const value = props.value ?? [];
  const [custom, setCustom] = useState("");
  const labelId = useId();
  const toggle = (item: string) =>
    props.onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);
  const extras = value.filter((v) => !props.catalog.includes(v));
  const addCustom = () => {
    const item = custom.trim();
    if (item !== "" && !value.includes(item)) props.onChange([...value, item]);
    setCustom("");
  };
  return (
    <div className="field">
      <div className="field-label" id={labelId}>
        {props.label}
      </div>
      <div className="chips" role="group" aria-labelledby={labelId}>
        {props.catalog.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={value.includes(item)}
            className={value.includes(item) ? "chip chip-on" : "chip"}
            onClick={() => toggle(item)}
          >
            {item}
          </button>
        ))}
        {extras.map((item) => (
          <button key={item} type="button" aria-pressed="true" className="chip chip-on" onClick={() => toggle(item)}>
            {item} <span aria-hidden="true">×</span>
            <span className="sr-only"> (remove)</span>
          </button>
        ))}
      </div>
      <div className="inline-add">
        <input
          className="input mono"
          value={custom}
          aria-label={`Custom ${props.label.toLowerCase()}`}
          placeholder={props.customPlaceholder ?? "custom…"}
          autoCapitalize="off"
          onChange={(e) => setCustom(e.target.value)}
        />
        <button type="button" className="btn" disabled={custom.trim() === ""} onClick={addCustom}>
          Add
        </button>
      </div>
      {props.hint ? <div className="field-hint">{props.hint}</div> : null}
    </div>
  );
}

/** A section heading inside the inspector. */
export function Section(props: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h3>{props.title}</h3>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

/** Collapsed by default: fields most graphs never set. */
export function More(props: { title?: string; children: ReactNode }) {
  return (
    <details className="more">
      <summary>{props.title ?? "More fields"}</summary>
      <div className="more-body">{props.children}</div>
    </details>
  );
}
