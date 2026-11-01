/**
 * Timestamp-based countdown maths. The clock is "end time minus now", never "count ticks",
 * so it is still right after the phone locks or the tab sleeps.
 */

export type CountdownState =
  | { status: "idle"; remainingMs: number }
  | { status: "running"; endsAt: number }
  | { status: "paused"; remainingMs: number }
  | { status: "done" };

export function idle(durationMs: number): CountdownState {
  return { status: "idle", remainingMs: Math.max(0, durationMs) };
}

export function start(state: CountdownState, now: number, durationMs?: number): CountdownState {
  const ms = durationMs ?? (state.status === "idle" || state.status === "paused" ? state.remainingMs : 0);
  return ms > 0 ? { status: "running", endsAt: now + ms } : { status: "done" };
}

export function remaining(state: CountdownState, now: number): number {
  switch (state.status) {
    case "running":
      return Math.max(0, state.endsAt - now);
    case "idle":
    case "paused":
      return state.remainingMs;
    case "done":
      return 0;
  }
}

export function pause(state: CountdownState, now: number): CountdownState {
  return state.status === "running" ? { status: "paused", remainingMs: remaining(state, now) } : state;
}

/** Add (or with a negative number, take off) time. "+15 sec" on the rest screen. */
export function addTime(state: CountdownState, now: number, ms: number): CountdownState {
  switch (state.status) {
    case "running": {
      const left = remaining(state, now) + ms;
      return left > 0 ? { status: "running", endsAt: now + left } : { status: "done" };
    }
    case "idle":
    case "paused":
      return { ...state, remainingMs: Math.max(0, state.remainingMs + ms) };
    case "done":
      return ms > 0 ? { status: "running", endsAt: now + ms } : state;
  }
}

/** Move to "done" once the end time has passed. */
export function settle(state: CountdownState, now: number): CountdownState {
  return state.status === "running" && now >= state.endsAt ? { status: "done" } : state;
}

/** Whole seconds left, rounded up, so "0:01" shows until the very end. */
export function secondsLeft(ms: number): number {
  return Math.ceil(Math.max(0, ms) / 1000);
}

/** "0:45", "1:05", "12:00". */
export function formatClock(ms: number): string {
  const s = secondsLeft(ms);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "45 seconds", "1 minute 5 seconds" — for screen readers. */
export function spokenClock(ms: number): string {
  const s = secondsLeft(ms);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (r || !m) parts.push(`${r} second${r === 1 ? "" : "s"}`);
  return parts.join(" ");
}
