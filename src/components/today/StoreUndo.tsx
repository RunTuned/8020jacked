"use client";

import { useState, type ReactNode } from "react";
import { UndoToast } from "@/components/ui";
import { undoVisible, useAppStore, type UndoEntry } from "@/lib/store";

function Toast({ entry, message, floating }: { entry: UndoEntry; message: ReactNode; floating?: boolean }) {
  const undo = useAppStore((s) => s.undo);
  const clearUndo = useAppStore((s) => s.clearUndo);
  // The toast may open on the screen she lands on (after F2 or F7), so it runs to the store's own deadline.
  const [duration] = useState(() => Math.max(0, entry.expiresAt - Date.now()));
  const toast = (
    <UndoToast
      id={entry.id}
      message={message}
      duration={duration}
      onUndo={() => undo()}
      onExpire={() => {
        if (useAppStore.getState().ui.undo?.id === entry.id) clearUndo();
      }}
    />
  );
  if (!floating) return toast;
  // Our own fixed box above the tab bar (UndoToast's floating mode also sets "relative", which wins).
  return (
    <div
      className="fixed z-50 mx-auto max-w-[38rem]"
      style={{
        left: "max(16px, env(safe-area-inset-left))",
        right: "max(16px, env(safe-area-inset-right))",
        bottom: "calc(var(--bar-h) + 28px + env(safe-area-inset-bottom))",
      }}
    >
      {toast}
    </div>
  );
}

/** "Saved. Undo" / "Moved. Undo" for the store's live undo, for 5 seconds. */
export function StoreUndo({
  kinds,
  floating,
  message,
}: {
  kinds: UndoEntry["kind"][];
  floating?: boolean;
  message?: (e: UndoEntry) => ReactNode;
}) {
  const entry = useAppStore((s) => s.ui.undo);
  if (!entry || !undoVisible(entry) || !kinds.includes(entry.kind)) return null;
  return <Toast key={entry.id} entry={entry} floating={floating} message={message ? message(entry) : entry.label.replace(/\s*Undo$/, "")} />;
}
