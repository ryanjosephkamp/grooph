import { useEffect } from "react";

import { dismissPersistence, usePersistenceNotice } from "../store/persist.js";

/**
 * What the browser answered when grooph asked to keep its storage (criterion
 * 7). Shown once, after the first save, until dismissed; never again.
 */
export function PersistNotice({ className = "" }: { className?: string }) {
  const notice = usePersistenceNotice();
  if (!notice) return null;
  const granted = notice.result === "granted";
  return (
    <div className={`persist-notice ${granted ? "is-granted" : "is-denied"} ${className}`} role="status">
      <p>
        {granted ? (
          <>
            <strong>Storage kept.</strong> This browser agreed not to clear grooph&rsquo;s data to free space.
          </>
        ) : (
          <>
            <strong>Storage not guaranteed.</strong> This browser may clear grooph&rsquo;s data when space runs low. Keep backups: Export, then Download graph.
          </>
        )}
      </p>
      <button type="button" className="btn btn-small" onClick={dismissPersistence}>
        Got it
      </button>
    </div>
  );
}

export type ToastMessage = { id: number; text: string; undo?: () => void };

/** A brief message at the foot of the canvas, with Undo when there is something to take back. */
export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.undo ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.undo!();
            onDone();
          }}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
