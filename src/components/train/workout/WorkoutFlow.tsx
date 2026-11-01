"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import {
  selectActiveWorkout,
  selectSession,
  selectToday,
  selectTodayWorkout,
  useAppStore,
  type ActiveWorkout,
} from "@/lib/store";
import type { Effort, SessionLetter, SessionMinutes } from "@/lib/types";
import { MoveHowTo } from "../MoveHowTo";
import { Skeleton, amount, useHydrated } from "../common";
import { useWorkoutDevice } from "./parts";
import { Done, Ready } from "./ReadyDone";
import { Rest, restStore, type RestSaved } from "./Rest";
import { HoldSet, LiftSet } from "./SetViews";
import { HurtSheet, PauseSheet } from "./Sheets";

type View = "ready" | "set" | "rest" | "done" | "how";
type Overlay = null | { kind: "pause" } | { kind: "hurts"; hurtId: string; slot: number; setAside: boolean };
type How = { exerciseId: string; originId: string; back: View };

const LETTERS: SessionLetter[] = ["A", "B", "C"];
const MINUTES: SessionMinutes[] = [10, 20, 35];

/** Only same-site paths are followed ("/start/save?from=taster"), never another site. */
function safeNext(v: string | null): string | null {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export function WorkoutFlow() {
  const hydrated = useHydrated();
  if (!hydrated)
    return (
      <Screen>
        <Skeleton />
      </Screen>
    );
  return <Flow />;
}

function Flow() {
  const params = useSearchParams();
  const router = useRouter();
  const s = useAppStore();
  const act = useAppStore.getState;
  const a = selectActiveWorkout(s);

  const taster = params.get("taster") === "1";
  const lp = params.get("letter") as SessionLetter | null;
  const letter = lp && LETTERS.includes(lp) ? lp : undefined;
  const mp = Number(params.get("minutes"));
  const minutes = MINUTES.find((m) => m === mp);
  const from = params.get("from");
  const next = safeNext(params.get("next"));
  const backHref = from === "today" ? "/today" : "/train";
  /** Where the workout ends: `next` if given, else A10 for the taster, else Today. */
  const endHref = (wasTaster: boolean) => next ?? (wasTaster ? "/start/save" : "/today");

  // ----- where a reload resumes (?step=)
  const [view, setView] = useState<View>(() => {
    const step = params.get("step");
    if (!a) return "ready";
    if (step === "done" || !a.cursor) return "done";
    if (step === "rest" && restStore.read(a.workout.id)) return "rest";
    if (step === "how" && params.get("move")) return "how";
    return "set";
  });
  const [rest, setRest] = useState<RestSaved | null>(() => (a ? restStore.read(a.workout.id) : null));
  const [overlay, setOverlay] = useState<Overlay>(() => {
    const step = params.get("step");
    if (!a?.cursor) return null;
    if (step === "pause") return { kind: "pause" };
    if (step === "hurts") return { kind: "hurts", hurtId: a.cursor.move.exerciseId, slot: a.cursor.moveIndex, setAside: false };
    return null;
  });
  const [how, setHow] = useState<How | null>(() => {
    const id = params.get("move");
    return id ? { exerciseId: id, originId: id, back: a ? "set" : "ready" } : null;
  });
  const [leaving, setLeaving] = useState(false);
  const device = useWorkoutDevice(!!a);

  const shown: View = leaving ? view : !a && view !== "how" ? "ready" : a && view === "set" && !a.cursor ? "done" : view;
  const step =
    overlay?.kind === "pause"
      ? "pause"
      : overlay?.kind === "hurts"
        ? "hurts"
        : shown === "set"
          ? a?.cursor?.move.unit === "seconds"
            ? "hold"
            : "lift"
          : shown;

  useEffect(() => {
    if (leaving) return;
    const q = new URLSearchParams();
    if (taster) q.set("taster", "1");
    if (letter) q.set("letter", letter);
    if (minutes) q.set("minutes", String(minutes));
    if (from) q.set("from", from);
    if (next) q.set("next", next);
    q.set("step", step);
    if (shown === "how" && how) q.set("move", how.exerciseId);
    const url = `${window.location.pathname}?${q.toString()}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [step, shown, how, taster, letter, minutes, from, next, leaving]);

  if (leaving) {
    return (
      <Screen>
        <Skeleton />
      </Screen>
    );
  }

  const leave = (href: string) => {
    restStore.clear();
    device.release();
    setLeaving(true);
    router.replace(href);
  };
  const today = selectToday(s);
  const originOf = (id: string) => s.todaySwaps.find((x) => x.date === today && x.toId === id)?.fromId ?? id;
  const fresh = () => selectActiveWorkout(act());

  // ----- actions
  const start = () => {
    void device.start(); // inside the tap: beeps and keep-screen-on
    if (act().startWorkout({ taster, letter, minutes })) setView("set");
  };

  const doneSet = (cur: ActiveWorkout, value: number) => {
    const c = cur.cursor!;
    if (!act().logSet(c.move.exerciseId, c.setIndex, value)) return;
    if (c.lastOfWorkout) {
      restStore.clear();
      setView("done");
      return;
    }
    const saved: RestSaved = {
      workoutId: cur.workout.id,
      exerciseId: c.move.exerciseId,
      label: `Set ${c.setIndex + 1} saved: ${amount(Math.max(0, Math.round(value)), c.move.unit)}`,
      endsAt: Date.now() + c.move.restSeconds * 1000,
    };
    restStore.write(saved);
    setRest(saved);
    setView("rest");
  };

  const restEnd = () => {
    restStore.clear();
    setRest(null);
    setView("set");
  };

  const finish = (effort: Effort | undefined) => {
    const cur = fresh();
    act().finishWorkout(cur?.cursor ? "part" : "done", effort);
    leave(endHref(taster || !!cur?.workout.taster));
  };

  // ----- views
  let body: React.ReactNode = null;
  if (shown === "how" && how) {
    body = (
      <MoveHowTo
        key={how.exerciseId}
        exerciseId={how.exerciseId}
        back={{ onClick: () => setView(how.back) }}
        onUse={(toId) => {
          act().swapToday(how.originId, toId);
          setView(how.back);
        }}
      />
    );
  } else if (shown === "ready" || !a) {
    const session = selectSession(s, { taster, letter, minutes });
    body = (
      <Ready
        session={session}
        backHref={backHref}
        canStart={taster || selectTodayWorkout(s).canStart}
        onHow={(id) => {
          setHow({ exerciseId: id, originId: originOf(id), back: "ready" });
          setView("how");
        }}
        onStart={start}
      />
    );
  } else if (shown === "done") {
    body = <Done part={!!a.cursor} onFinish={finish} />;
  } else if (shown === "rest" && rest && a.cursor) {
    body = (
      <Rest
        a={a}
        saved={rest}
        paused={overlay !== null}
        onPause={() => setOverlay({ kind: "pause" })}
        onUndo={() => {
          act().undo();
          restStore.clear();
          setRest(null);
          setView("set");
        }}
        onEnd={restEnd}
      />
    );
  } else if (a.cursor) {
    const c = a.cursor;
    const props = {
      a,
      c,
      paused: overlay !== null,
      showTip: !s.settings.ringerTipShown,
      onTipSeen: () => act().markRingerTipShown(),
      onPause: () => setOverlay({ kind: "pause" }),
      onHurts: () => {
        const r = act().tapHurts(c.move.exerciseId);
        setOverlay({ kind: "hurts", hurtId: c.move.exerciseId, slot: c.moveIndex, setAside: r.setAside });
      },
      onHow: () => {
        setHow({ exerciseId: c.move.exerciseId, originId: c.move.originId, back: "set" });
        setView("how");
      },
      onDone: (v: number) => doneSet(a, v),
    };
    const key = `${a.workout.id}-${c.moveIndex}-${c.setIndex}-${c.move.exerciseId}`;
    body = c.move.unit === "seconds" ? <HoldSet key={key} {...props} /> : <LiftSet key={key} {...props} />;
  }

  return (
    <>
      {body}
      {a && overlay?.kind === "pause" ? (
        <PauseSheet
          open
          a={a}
          onKeepGoing={() => setOverlay(null)}
          onKeep={() => {
            if (a.workout.taster) {
              act().finishWorkout("part");
              leave(endHref(true));
              return;
            }
            setOverlay(null);
            restStore.clear();
            setView("done");
          }}
          onDiscard={() => {
            const t = a.workout.taster;
            act().discardWorkout();
            leave(endHref(t));
          }}
        />
      ) : null}
      {a && overlay?.kind === "hurts" ? (
        <HurtSheet
          open
          a={a}
          hurtId={overlay.hurtId}
          slot={overlay.slot}
          setAside={overlay.setAside}
          onUndo={() => {
            act().undo();
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </>
  );
}
