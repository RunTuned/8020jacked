"use client";

import { useSyncExternalStore } from "react";
import { useAppStore } from "@/lib/store";

/** True once the store has loaded from the phone. Screens show a skeleton until then. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}
