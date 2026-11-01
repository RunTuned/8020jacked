"use client";

import { useEffect, useState } from "react";
import { Banner, Button, IconCircle, Screen, Stepper } from "@/components/ui";
import { countdown, useCountdown, wakeLockSupported } from "@/lib/device";
import type { ActiveWorkout, WorkoutCursor } from "@/lib/store";
import { sideWords } from "../common";
import { RINGER_TIP, SAFETY, TopRow, HurtsPill, bigClock, countBeep, useEachSecond } from "./parts";

export type SetProps = {
  a: ActiveWorkout;
  c: WorkoutCursor;
  paused: boolean;
  showTip: boolean;
  onTipSeen: () => void;
  onPause: () => void;
  onHurts: () => void;
  onHow: () => void;
  onDone: (value: number) => void;
};

const POSITION_MS = 10_000;

const setLine = (c: WorkoutCursor) => `Set ${c.setIndex + 1} of ${c.move.sets.length}`;

/** "Reps each leg · Last time 8" / "Seconds · Last time 25 sec". */
function detailLine(c: WorkoutCursor) {
  const what = [c.move.unit === "seconds" ? "Seconds" : "Reps", sideWords(c.move.perSide, c.move.pattern)].filter(Boolean).join(" ");
  const last = c.lastTime === null ? null : `Last time ${c.lastTime}${c.move.unit === "seconds" ? " sec" : ""}`;
  return [what, last].filter(Boolean).join(" · ");
}

/** First workout only: the ringer and Auto-Lock tip. "Keep your screen on" where there's no wake lock. */
function Tips({ show, onSeen }: { show: boolean; onSeen: () => void }) {
  const noLock = !wakeLockSupported();
  if (!show && !noLock) return null;
  return (
    <div role="note" className="flex flex-col gap-2 rounded-card bg-neutral p-5 text-body">
      {show ? <p className="m-0">{RINGER_TIP}</p> : null}
      {noLock ? <p className="m-0 font-bold">Keep your screen on.</p> : null}
      {show ? (
        <Button variant="text" onClick={onSeen} className="self-start">
          Got it
        </Button>
      ) : null}
    </div>
  );
}

/** Top of every set screen: Pause, progress, Hurts (far from Done set), tips, the move name (→ W6). */
function Head({ p, sub }: { p: SetProps; sub: string | null }) {
  return (
    <>
      <TopRow a={p.a} moveIndex={p.c.moveIndex} onPause={p.onPause}>
        <HurtsPill onClick={p.onHurts} />
      </TopRow>
      <Tips show={p.showTip} onSeen={p.onTipSeen} />
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-display-l font-extrabold tracking-[-0.02em]">
          <button
            type="button"
            onClick={p.onHow}
            className="inline-flex min-h-12 items-center border-0 bg-transparent p-0 text-left underline decoration-2 underline-offset-[5px]"
            style={{ font: "inherit", letterSpacing: "inherit" }}
          >
            {p.c.move.name}
          </button>
        </h1>
        {sub ? <p className="m-0 text-body text-ink-muted">{sub}</p> : null}
      </div>
    </>
  );
}

function SetCard({ c, title, children }: { c: WorkoutCursor; title: string; children: React.ReactNode }) {
  return (
    <section aria-label="This set" className="flex flex-col gap-3 rounded-card bg-blue p-5">
      <div className="flex items-center gap-3">
        <IconCircle name="train" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-body font-bold">{title}</div>
          <div className="text-label text-ink-muted">{detailLine(c)}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ W3 (reps) */

export function LiftSet(p: SetProps) {
  const { c } = p;
  const [value, setValue] = useState(c.target);
  return (
    <Screen>
      <Head p={p} sub={c.move.cues[0] ?? null} />
      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-label={`How to do ${c.move.name}`}
          onClick={p.onHow}
          className="block h-[140px] w-full rounded-card border-0 bg-neutral"
        />
        <SetCard c={c} title={setLine(c)}>
          <Stepper value={value} onChange={setValue} min={0} max={200} unit="reps" />
          <Button block onClick={() => p.onDone(value)}>
            Done set
          </Button>
        </SetCard>
        <Banner role="note" icon="hurts">
          {SAFETY}
        </Banner>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ W3d held move */

type Phase = "idle" | "position" | "hold";

export function HoldSet(p: SetProps) {
  const { c } = p;
  const [value, setValue] = useState(c.target);
  const [phase, setPhase] = useState<Phase>("idle");
  const [holdSecs, setHoldSecs] = useState(c.target);

  const hold = useCountdown(c.target * 1000, { onDone: () => p.onDone(holdSecs) });
  const lead = useCountdown(POSITION_MS, {
    onDone: () => {
      setPhase("hold");
      hold.start(holdSecs * 1000);
    },
  });

  useEffect(() => {
    if (p.paused) {
      lead.pause();
      hold.pause();
    } else {
      lead.resume();
      hold.resume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.paused]);

  const leadS = countdown.secondsLeft(lead.remainingMs);
  const holdS = countdown.secondsLeft(hold.remainingMs);
  useEachSecond(leadS, phase === "position", countBeep);
  useEachSecond(holdS, phase === "hold", (s) => {
    if (s <= 3) countBeep(s);
  });

  const begin = () => {
    setHoldSecs(value);
    setPhase("position");
    lead.start(POSITION_MS);
  };
  const stopEarly = () => {
    hold.pause();
    p.onDone(Math.max(0, holdSecs - holdS));
  };

  const clock = phase === "idle" ? countdown.formatClock(value * 1000) : phase === "position" ? lead.clock : hold.clock;
  const status = phase === "position" ? "Get into position" : phase === "hold" ? "Hold" : null;

  return (
    <Screen>
      <Head p={p} sub="Tap for how" />
      <SetCard c={c} title={`${setLine(c)} · hold ${phase === "idle" ? value : holdSecs} sec`}>
        {phase === "idle" ? (
          <Stepper
            value={value}
            onChange={setValue}
            min={5}
            max={300}
            step={5}
            unit="seconds"
            decreaseLabel="5 seconds fewer"
            increaseLabel="5 seconds more"
          />
        ) : null}
        <div role="timer" aria-live="off" aria-label={status ?? "Hold time"} className="flex flex-col items-center gap-1">
          {status ? <span className="text-label font-semibold text-ink-muted">{status}</span> : null}
          <span className="font-extrabold tabular tracking-[-0.02em]" style={bigClock}>
            {clock}
          </span>
        </div>
        {phase === "idle" ? (
          <Button block onClick={begin}>
            Start
          </Button>
        ) : phase === "hold" ? (
          <Button block onClick={stopEarly}>
            Stop
          </Button>
        ) : null}
      </SetCard>
      <Banner role="note" icon="hurts">
        {SAFETY}
      </Banner>
    </Screen>
  );
}
