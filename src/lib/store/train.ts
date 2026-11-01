// Train selectors for the workout flow (W1–W11). Pure functions of state + content + clock.
import * as E from "../engine";
import type { AppState, Effort, ExerciseKit, ExerciseUnit, PlannedMove, PlannedSession, SessionLetter, SetLog, WorkoutSession } from "../types";
import { getContent } from "./content";
import { now } from "./clock";
import { pickContext, selectSchedule, selectToday, selectWorkoutInProgress, sessionFor } from "./selectors";

const finished = (w: WorkoutSession) => w.status === "done" || w.status === "part";

/** The value she did last time for this move (same set if there is one), from earlier workouts. */
export function lastTime(s: AppState, exerciseId: string, setIndex: number, excludeId?: string): number | null {
  const past = s.workouts.filter((w) => finished(w) && w.id !== excludeId).sort((a, b) => b.startedAt - a.startedAt);
  for (const w of past) {
    const sets = w.sets.filter((x) => x.exerciseId === exerciseId);
    if (!sets.length) continue;
    const same = sets.find((x) => x.setIndex === setIndex);
    return (same ?? sets[sets.length - 1]).value;
  }
  return null;
}

/** Kits a session needs beyond the always-there chair, wall and no kit (W2 line). */
export function sessionKits(session: PlannedSession): ExerciseKit[] {
  const byId = new Map(getContent().exercises.map((e) => [e.id, e]));
  const kits = new Set<ExerciseKit>();
  for (const m of session.moves) {
    const k = byId.get(m.exerciseId)?.kit;
    if (k && k !== "none" && k !== "chair" && k !== "wall") kits.add(k);
  }
  return [...kits];
}

export interface ActiveMove extends PlannedMove {
  /** Pass this to swapToday as `fromId` to swap the move in this slot. */
  originId: string;
  logged: SetLog[];
}

export interface WorkoutCursor {
  moveIndex: number;
  setIndex: number;
  move: ActiveMove;
  target: number;
  lastTime: number | null;
  /** The very last set of the workout. */
  lastOfWorkout: boolean;
}

/** The workout in progress: its session, what's logged, and the next set (null = all sets done). */
export function selectActiveWorkout(s: AppState) {
  const w = selectWorkoutInProgress(s);
  if (!w) return null;
  const session = w.taster ? sessionFor(s, "A", w.date, 10) : sessionFor(s, w.letter, w.date, w.minutes);
  const back = new Map(s.todaySwaps.filter((x) => x.date === w.date).map((x) => [x.toId, x.fromId]));
  const moves: ActiveMove[] = session.moves.map((m) => ({
    ...m,
    originId: back.get(m.exerciseId) ?? m.exerciseId,
    logged: w.sets.filter((x) => x.exerciseId === m.exerciseId && x.setIndex < m.sets.length),
  }));
  const open: { moveIndex: number; setIndex: number }[] = [];
  moves.forEach((m, i) =>
    m.sets.forEach((set) => {
      if (!m.logged.some((x) => x.setIndex === set.setIndex)) open.push({ moveIndex: i, setIndex: set.setIndex });
    }),
  );
  const first = open[0];
  const cursor: WorkoutCursor | null = first
    ? {
        ...first,
        move: moves[first.moveIndex],
        target: moves[first.moveIndex].sets[first.setIndex].target,
        lastTime: lastTime(s, moves[first.moveIndex].exerciseId, first.setIndex, w.id),
        lastOfWorkout: open.length === 1,
      }
    : null;
  const doneSets = moves.reduce((a, m) => a + m.logged.length, 0);
  return {
    workout: w,
    session,
    moves,
    cursor,
    doneSets,
    totalSets: session.totalSets,
    minutesLeft: E.minutesLeft(session.totalSets, doneSets),
    minutesDone: Math.max(1, Math.round((now() - w.startedAt) / 60_000)),
  };
}
export type ActiveWorkout = NonNullable<ReturnType<typeof selectActiveWorkout>>;

/** W5 for the workout in progress: a different body part, never a move already in it. */
export function selectActiveHurtOptions(s: AppState, exerciseId: string) {
  const a = selectActiveWorkout(s);
  const ex = getContent().exercises.find((e) => e.id === exerciseId);
  if (!a || !ex) return [];
  const hurtParts = s.hurts.filter((h) => h.date === a.workout.date && h.exerciseId !== exerciseId).map((h) => h.bodyPart);
  return E.hurtSwapOptions(ex, a.moves.map((m) => m.exerciseId), pickContext(s), hurtParts);
}

/** W7: what she did in the workout in progress, new bests, and text to share. */
export function selectWorkoutSummary(s: AppState) {
  const a = selectActiveWorkout(s);
  if (!a) return null;
  const byId = new Map(getContent().exercises.map((e) => [e.id, e]));
  const ids = [...new Set(a.workout.sets.map((x) => x.exerciseId))];
  const moves = ids.map((id) => ({
    exerciseId: id,
    name: byId.get(id)?.name ?? id,
    unit: (byId.get(id)?.unit ?? "reps") as ExerciseUnit,
    sets: a.workout.sets.filter((x) => x.exerciseId === id).sort((x, y) => x.setIndex - y.setIndex),
  }));
  const newBests = moves
    .map((m) => {
      const prev = bestBefore(s, m.exerciseId, a.workout.id);
      const best = Math.max(...m.sets.map((x) => x.value));
      return prev !== null && best > prev ? { exerciseId: m.exerciseId, name: m.name, value: best, unit: m.unit } : null;
    })
    .filter((x) => x !== null);
  const setsDone = a.workout.sets.length;
  const name = a.session.name;
  const shareText = [`${name} · ${a.minutesDone} min · ${setsDone} sets`, ...newBests.map((b) => `New best: ${b.name} ${b.value}`)].join("\n");
  return { workoutId: a.workout.id, taster: a.workout.taster, name, minutesDone: a.minutesDone, setsDone, moves, newBests, shareText };
}

function bestBefore(s: AppState, exerciseId: string, excludeId: string): number | null {
  const vals = s.workouts
    .filter((w) => finished(w) && w.id !== excludeId)
    .flatMap((w) => w.sets.filter((x) => x.exerciseId === exerciseId).map((x) => x.value));
  return vals.length ? Math.max(...vals) : null;
}

/** W1 "Pick another workout": the other sessions in her plan. */
export function selectOtherWorkouts(s: AppState, current: SessionLetter | null): { letter: SessionLetter; name: string }[] {
  return E.lettersFor(s.training.daysPerWeek)
    .filter((l) => l !== current)
    .map((l) => ({ letter: l, name: E.SESSION_NAMES[l] }));
}

/** W1 top card: in progress, done today, or the next workout. */
export function selectTrainHome(s: AppState) {
  const today = selectToday(s);
  const done = E.doneOn(s.workouts, today);
  const inProgress = selectWorkoutInProgress(s);
  const letter: SessionLetter =
    inProgress && !inProgress.taster
      ? inProgress.letter
      : (selectSchedule(s)[today] ?? E.nextWorkout(selectSchedule(s), today, s.workouts)?.letter ?? "A");
  return {
    doneToday: !!done,
    doneName: done ? E.SESSION_NAMES[done.letter] : null,
    inProgress: !!inProgress,
    letter,
    name: E.SESSION_NAMES[letter],
    minutes: s.training.minutes,
  };
}

export const EFFORTS: readonly Effort[] = ["too_easy", "just_right", "too_hard"];
