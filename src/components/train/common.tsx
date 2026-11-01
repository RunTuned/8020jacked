"use client";

import { useSyncExternalStore } from "react";
import { toMs } from "@/lib/engine";
import { useAppStore } from "@/lib/store";
import type { Effort, ExerciseUnit, ISODate } from "@/lib/types";

/** True once the store has loaded from the phone. Screens show a skeleton until then. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}

/** Bento-shaped placeholder while the store loads. */
export function Skeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
      <div className="h-10 w-2/3 rounded-full bg-neutral" />
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="h-28 rounded-card bg-neutral" />
      ))}
    </div>
  );
}

export const EFFORT_OPTIONS: ReadonlyArray<{ value: Effort; label: string }> = [
  { value: "too_easy", label: "Too easy" },
  { value: "just_right", label: "Just right" },
  { value: "too_hard", label: "Too hard" },
];

const LEG_PATTERNS = new Set(["squat", "hinge", "lunge"]);
/** "each leg" / "each side" for one-side moves. */
export function sideWords(perSide: boolean, pattern: string): string {
  if (!perSide) return "";
  return LEG_PATTERNS.has(pattern) ? "each leg" : "each side";
}

/** "8 reps", "30 sec". */
export function amount(value: number, unit: ExerciseUnit): string {
  return unit === "seconds" ? `${value} sec` : `${value} ${value === 1 ? "rep" : "reps"}`;
}

/** "12 Oct" (the calendar day as stored, never shifted by time zone). */
export function shortDay(d: ISODate): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(toMs(d)));
}
