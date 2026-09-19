import type { Graph } from "@grooph/core";
import { useCallback, useState } from "react";

import { openStore } from "../../store/db.js";
import { saveFromLink } from "../../store/library.js";

export type Saved = { key: string; existed: boolean; persistent: boolean };

/**
 * Saving from a link: the one moment a link's content reaches storage, and
 * only on the person's tap. Keyed by slot (a candidate id, or "graph") so each
 * card knows whether its graph is on the device yet.
 */
export function useSaveFromLink() {
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = useCallback(async (slot: string, doc: Graph): Promise<Saved> => {
    setBusy(slot);
    try {
      const { record, existed } = await saveFromLink(doc);
      const result = { key: record.key, existed, persistent: (await openStore()).persistent };
      setSaved((s) => ({ ...s, [slot]: result }));
      return result;
    } finally {
      setBusy(null);
    }
  }, []);

  return { saved, busy, save };
}

export const editorHref = (key: string): string => `#/g/${encodeURIComponent(key)}`;
