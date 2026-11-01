"use client";

import { useSyncExternalStore } from "react";
import { useAppStore } from "@/lib/store";

const subscribe = (cb: () => void) => useAppStore.persist.onFinishHydration(cb);

/** True once the store has loaded from the phone. Until then screens show the bento skeleton. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}

/** Only allow paths inside the app as a "go back to" target. */
export function safeBack(v: string | null | undefined, fallback: string): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}
