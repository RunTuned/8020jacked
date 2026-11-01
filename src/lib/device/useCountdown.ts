"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as cd from "./countdown";

export type UseCountdown = {
  remainingMs: number;
  status: cd.CountdownState["status"];
  /** "0:45" */
  clock: string;
  start: (durationMs?: number) => void;
  pause: () => void;
  resume: () => void;
  add: (ms: number) => void;
  /** Stop and set a fresh duration. */
  reset: (durationMs: number) => void;
  /** End now (Skip). Fires onDone. */
  finish: () => void;
};

/**
 * A countdown that keeps the end time, not a tick count, so it is right after the phone locks.
 * Re-reads the clock on every tick and whenever the page becomes visible again.
 */
export function useCountdown(durationMs: number, opts: { onDone?: () => void; tickMs?: number } = {}): UseCountdown {
  const { onDone, tickMs = 250 } = opts;
  const [state, setState] = useState<cd.CountdownState>(() => cd.idle(durationMs));
  const [now, setNow] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const running = state.status === "running";

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setState((s) => {
        const next = cd.settle(s, t);
        if (next !== s && next.status === "done") queueMicrotask(() => doneRef.current?.());
        return next;
      });
    };
    tick();
    const id = window.setInterval(tick, tickMs);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
    };
  }, [running, tickMs]);

  const start = useCallback((ms?: number) => {
    const t = Date.now();
    setNow(t);
    setState((s) => cd.start(s, t, ms));
  }, []);
  const pause = useCallback(() => setState((s) => cd.pause(s, Date.now())), []);
  const resume = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setState((s) => (s.status === "paused" ? cd.start(s, t) : s));
  }, []);
  const add = useCallback((ms: number) => {
    const t = Date.now();
    setNow(t);
    setState((s) => cd.addTime(s, t, ms));
  }, []);
  const reset = useCallback((ms: number) => setState(cd.idle(ms)), []);
  const finish = useCallback(() => {
    setState({ status: "done" });
    doneRef.current?.();
  }, []);

  const remainingMs = state.status === "running" ? Math.max(0, state.endsAt - now) : cd.remaining(state, now);
  return {
    remainingMs,
    status: state.status,
    clock: cd.formatClock(remainingMs),
    start,
    pause,
    resume,
    add,
    reset,
    finish,
  };
}
