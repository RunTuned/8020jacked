"use client";

import { useEffect, useState } from "react";
import { ChoicePills, IconCircle, Screen } from "@/components/ui";
import { countdown, useCountdown } from "@/lib/device";
import { undoVisible, useAppStore, type ActiveWorkout } from "@/lib/store";
import type { Effort } from "@/lib/types";
import { EFFORT_OPTIONS, sideWords } from "../common";
import { TopRow, countBeep, useEachSecond } from "./parts";

import { addRest, pauseRest, restLeft, resumeRest, type RestSaved } from "./restClock";

export type { RestSaved };

const KEY = "8020jacked:rest";
/** The rest end time is kept for this tab so a reload resumes the same clock. */
export const restStore = {
  read(workoutId: string): RestSaved | null {
    try {
      const r = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as RestSaved | null;
      return r && r.workoutId === workoutId ? r : null;
    } catch {
      return null;
    }
  },
  write(r: RestSaved) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(r));
    } catch {
      // private mode: the clock still works, it just won't survive a reload
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

export function Rest({
  a,
  saved,
  paused,
  onPause,
  onUndo,
  onEnd,
}: {
  a: ActiveWorkout;
  saved: RestSaved;
  paused: boolean;
  onPause: () => void;
  onUndo: () => void;
  onEnd: () => void;
}) {
  const s = useAppStore();
  const rateMove = useAppStore((x) => x.rateMove);
  const c = a.cursor!;
  const rest = useCountdown(c.move.restSeconds * 1000, { onDone: onEnd });
  const effort: Effort | null = a.workout.moveEffort[saved.exerciseId] ?? null;
  // Effort is asked once per move: shown while the move has no rating, and on the rest where she picks one.
  const [ask] = useState(effort === null);
  const [undoOn, setUndoOn] = useState(() => undoVisible(s.ui.undo) && s.ui.undo?.kind === "set");

  useEffect(() => {
    const left = restLeft(restStore.read(saved.workoutId) ?? saved, Date.now());
    if (left <= 0) onEnd();
    else rest.start(left);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Pausing keeps the time left, resuming moves the saved end time, so a reload is right (QA 12).
  useEffect(() => {
    const cur = restStore.read(saved.workoutId) ?? saved;
    if (paused) {
      rest.pause();
      restStore.write(pauseRest(cur, Date.now()));
    } else {
      rest.resume();
      restStore.write(resumeRest(cur, Date.now()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  useEffect(() => {
    if (!undoOn || !s.ui.undo) return;
    const t = window.setTimeout(() => setUndoOn(false), Math.max(0, s.ui.undo.expiresAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [undoOn, s.ui.undo]);

  const secs = countdown.secondsLeft(rest.remainingMs);
  useEachSecond(secs, rest.status === "running", (x) => {
    if (x <= 3) countBeep(x);
  });

  const add = () => {
    rest.add(15_000);
    restStore.write(addRest(restStore.read(saved.workoutId) ?? saved, Date.now(), 15_000));
  };

  const savedPill = (
    <div
      role="status"
      className="on-bar flex min-h-12 flex-wrap items-center justify-between gap-x-2 rounded-full bg-ink py-0 pl-4 pr-1 text-label text-on-ink"
    >
      <span className="py-2">{saved.label}</span>
      {undoOn ? (
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex min-h-12 items-center border-0 bg-transparent px-3 font-bold text-on-ink underline underline-offset-[3px] whitespace-nowrap"
        >
          Undo (5 sec)
        </button>
      ) : null}
    </div>
  );

  const textBtn =
    "inline-flex min-h-12 min-w-12 items-center border-0 bg-transparent px-1 text-body font-semibold text-ink underline underline-offset-[3px]";

  const rate = ask ? (
    <section aria-label="How the set felt" className="flex flex-col gap-3 rounded-card bg-blue p-5">
      <div className="flex items-center gap-3">
        <IconCircle name="heart" />
        <div className="text-body font-bold">That set was…</div>
      </div>
      <ChoicePills
        label="That set was"
        options={EFFORT_OPTIONS}
        value={effort}
        onChange={(v) => rateMove(saved.exerciseId, v)}
      />
    </section>
  ) : null;

  const side = sideWords(c.move.perSide, c.move.pattern);
  const next = (
    <section aria-label="Next" className="flex items-center gap-3 rounded-card bg-neutral p-5">
      <IconCircle name="train" />
      <div className="flex min-w-0 flex-col">
        <div className="text-label font-semibold text-ink-muted">Next</div>
        <div className="text-body font-bold">
          Set {c.setIndex + 1} of {c.move.sets.length}, {c.move.name.toLowerCase()}
        </div>
        {c.lastTime !== null ? (
          <div className="text-label text-ink-muted">
            Last time {c.lastTime}
            {c.move.unit === "seconds" ? " sec" : ""}
            {side ? ` ${side}` : ""}
          </div>
        ) : null}
      </div>
    </section>
  );

  const timer = (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${countdown.spokenClock(rest.remainingMs)} of rest left`}
      className="font-extrabold tabular tracking-[-0.02em]"
      style={{ fontSize: "min(var(--fs-timer), 24vw)", lineHeight: 1 }}
    >
      {rest.clock}
    </div>
  );

  return (
    <Screen>
      <TopRow a={a} moveIndex={c.moveIndex} onPause={onPause} />
      <div className="flex flex-col gap-3">
        <section aria-label="Rest" className="flex flex-col gap-3 rounded-card bg-neutral p-5">
          {savedPill}
          <div className="text-label font-semibold text-ink-muted">Rest</div>
          {timer}
          <div className="flex gap-4">
            <button type="button" className={textBtn} onClick={add}>
              +15 sec
            </button>
            <button type="button" className={textBtn} onClick={() => rest.finish()}>
              Skip
            </button>
          </div>
        </section>
        {rate}
        {next}
      </div>
    </Screen>
  );
}
