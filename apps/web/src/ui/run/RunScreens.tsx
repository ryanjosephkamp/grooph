import { parseRunBundleText, summarizeRun, type RunBundle } from "@grooph/core";
import { useEffect, useState } from "react";

import type { RunRecord } from "../../store/db.js";
import { getRun } from "../../store/runs.js";
import { RunView } from "./RunView.js";

/** How often a live view asks `grooph watch` again (docs/runs.md §4). */
export const POLL_MS = 2000;

/**
 * The endpoint `grooph watch` serves beside the app. Always this origin and
 * this path: nothing in the URL can point the app anywhere else, so the only
 * request it makes beyond its own files is to the server it was opened from.
 */
export const liveEndpoint = (): string => new URL("api/run.json", document.baseURI).href;

type Live = { bundle?: RunBundle; updatedAt: number; error?: string; polling: boolean };

/** `#/run?live`: the run `grooph watch` serves, asked again every two seconds until it ends. */
export function LiveRun() {
  const [live, setLive] = useState<Live>({ updatedAt: Date.now(), polling: true });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let ended = false;
      try {
        const res = await fetch(liveEndpoint(), { cache: "no-store" });
        const text = await res.text();
        const json = (res.headers.get("content-type") ?? "").includes("application/json");
        if (!json) {
          setLive((l) => ({ ...l, error: "There is no grooph watch here. A live run opens from the address grooph watch prints on your computer." }));
        } else if (!res.ok) {
          let message = `grooph watch answered ${res.status}.`;
          try {
            message = `${String((JSON.parse(text) as { error?: string }).error ?? message)}.`;
          } catch {
            // keep the status line
          }
          setLive((l) => ({ ...l, error: message.replace(/\.\.$/, ".") }));
        } else {
          const parsed = parseRunBundleText(text);
          if (!parsed.bundle) {
            setLive((l) => ({ ...l, error: "grooph watch sent something that is not a run; it may be a different version of grooph." }));
          } else {
            ended = summarizeRun(parsed.bundle.notes, parsed.bundle.working).state === "ended";
            setLive({ bundle: parsed.bundle, updatedAt: Date.now(), polling: !ended });
          }
        }
      } catch {
        setLive((l) => ({ ...l, error: "grooph watch is not answering. Is it still running?" }));
      }
      if (!stopped && !ended) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (!live.bundle) {
    return (
      <main className="link-problem" aria-live="polite">
        <h1>{live.error ? "No run to show yet" : "Waiting for grooph watch"}</h1>
        <p>{live.error ?? "Asking the server this page came from for the run."}</p>
        {live.error ? <p className="muted">Still asking every two seconds.</p> : null}
        <a className="btn btn-large" href="#/">
          Back to your graphs
        </a>
      </main>
    );
  }
  return <RunView bundle={live.bundle} origin={{ kind: "live", updatedAt: live.updatedAt, polling: live.polling, ...(live.error ? { error: live.error } : {}) }} />;
}

/** `#/run/<key>`: a run kept on this device. */
export function StoredRun({ runKey }: { runKey: string }) {
  const [record, setRecord] = useState<RunRecord | null | undefined>(undefined);
  useEffect(() => {
    void getRun(runKey).then((r) => setRecord(r ?? null));
  }, [runKey]);
  if (record === undefined) return <div className="loading">Loading…</div>;
  if (record === null) {
    return (
      <main className="link-problem">
        <h1>That run is not on this device</h1>
        <p>It may have been removed. Runs are kept per browser; import its .grooph-run.json file to see it here.</p>
        <a className="btn btn-primary btn-large" href="#/">
          Back to your graphs
        </a>
      </main>
    );
  }
  return <RunView bundle={record.bundle} origin={{ kind: "stored", key: record.key, savedAt: record.savedAt }} />;
}
