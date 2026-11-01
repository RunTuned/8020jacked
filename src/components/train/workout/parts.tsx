"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Button, Icon, ProgressBar } from "@/components/ui";
import { createWorkoutAudio, keepScreenOn, type WakeLockHandle, type WorkoutAudio } from "@/lib/device";
import type { ActiveWorkout } from "@/lib/store";

/* ------------------------------------------------------------------ sound and screen */

let audioSingleton: WorkoutAudio | null = null;
export function workoutAudio(): WorkoutAudio {
  if (!audioSingleton) audioSingleton = createWorkoutAudio();
  return audioSingleton;
}

/** 3-2-1: two short beeps then a higher one. */
export function countBeep(secondsLeft: number) {
  if (secondsLeft >= 1 && secondsLeft <= 3) workoutAudio().beep({ frequency: 660 });
  else if (secondsLeft === 0) workoutAudio().beep({ frequency: 990, durationMs: 300 });
}

/** Calls fn once each time the whole-second count changes (for beeps and voice cues). */
export function useEachSecond(seconds: number, active: boolean, fn: (s: number) => void) {
  const last = useRef<number | null>(null);
  const cb = useRef(fn);
  useEffect(() => {
    cb.current = fn;
  }, [fn]);
  useEffect(() => {
    if (!active) {
      last.current = null;
      return;
    }
    if (last.current !== seconds) {
      last.current = seconds;
      cb.current(seconds);
    }
  }, [seconds, active]);
}

/**
 * Beeps and keep-screen-on. start() must run inside the Start tap. After a reload, the next tap
 * anywhere turns them back on.
 */
export function useWorkoutDevice(active: boolean) {
  const lock = useRef<WakeLockHandle | null>(null);
  
  const start = async () => {
    const a = workoutAudio().unlock();
    if (!lock.current) {
      lock.current = await keepScreenOn();
    }
    await a;
  };

  useEffect(() => {
    if (!active) return;
    const onTap = () => void start();
    document.addEventListener("pointerdown", onTap, { once: true });
    return () => document.removeEventListener("pointerdown", onTap);
  }, [active]);

  useEffect(
    () => () => {
      void lock.current?.release();
      lock.current = null;
    },
    [],
  );

  const release = () => {
    void lock.current?.release();
    lock.current = null;
  };
  return { start, release };
}

/* ------------------------------------------------------------------ top rows */

const circle =
  "shrink-0 inline-flex size-12 items-center justify-center rounded-full border-0 bg-neutral text-ink p-0";

export function PauseCircle({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Pause the workout" className={circle} onClick={onClick}>
      <Icon name="pause" size={22} />
    </button>
  );
}

export function HurtsPill({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" icon="swap" onClick={onClick} className="self-start">
      Hurts? Swap this move
    </Button>
  );
}

export function Progress({ a }: { a: ActiveWorkout }) {
  return (
    <ProgressBar
      value={a.doneSets}
      max={a.totalSets}
      label="Workout progress"
      valueText={`${a.doneSets} of ${a.totalSets} sets done`}
    />
  );
}

/** W3 / W3b / W3d top: Pause · Move 3 of 5, About 11 min left. Progress bar under it. */
export function TopRow({
  a,
  moveIndex,
  onPause,
  children,
}: {
  a: ActiveWorkout;
  moveIndex: number;
  onPause: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PauseCircle onClick={onPause} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-bold leading-[1.3]">
            Move {moveIndex + 1} of {a.moves.length}
          </span>
          <span className="text-label leading-[1.3] text-ink-muted">About {a.minutesLeft} min left</span>
        </div>
      </div>
      <Progress a={a} />
      {children}
    </div>
  );
}

/** The rest and hold clocks: big, but capped by the screen width so 200% text still fits. */
export const bigClock: CSSProperties = { fontSize: "min(4.5rem, 24vw)", lineHeight: 1 };

export const SAFETY = "Stop if you get chest pain, feel dizzy, or a joint hurts sharply.";
export const RINGER_TIP =
  "iPhone: turn your ringer on to hear the beeps. To keep the screen on: Settings › Display & Brightness › Auto-Lock.";
