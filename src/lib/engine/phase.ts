// 12-week blocks: counter that skips inactive weeks, goal changes, end-of-block summary (C6).
import {
  CREATOR_ID,
  type Block,
  type DaysPerWeek,
  type Exercise,
  type Goal,
  type ISODate,
  type MealLog,
  type WalkTick,
  type WeighIn,
  type WorkoutSession,
} from "../types";
import { addDays, diffDays, weekStart } from "./dates";
import { mean } from "./weighins";

export const BLOCK_WEEKS = 12;
export const LOSE_BLOCKS_PER_YEAR = 2;

export interface ActivityLogs {
  mealLogs: MealLog[];
  workouts: WorkoutSession[];
  weighIns: WeighIn[];
  walks: WalkTick[];
}

/** Anything logged in the 7 days from `from`. */
export function hasActivity(logs: ActivityLogs, from: ISODate): boolean {
  const to = addDays(from, 6);
  const inW = (d: ISODate) => d >= from && d <= to;
  return (
    logs.mealLogs.some((l) => inW(l.date)) ||
    logs.workouts.some((w) => inW(w.date) && !w.taster && w.status !== "in_progress") ||
    logs.weighIns.some((w) => inW(w.date)) ||
    logs.walks.some((w) => inW(w.date))
  );
}

export function currentBlock(blocks: Block[]): Block | null {
  return [...blocks].reverse().find((b) => !b.end) ?? null;
}

/**
 * Active weeks (Mon–Sun) in a block, up to the week of `today`. Weeks with no activity
 * don't count. `includeCurrent` counts this week if it already has activity.
 */
export function activeWeeks(block: Block, today: ISODate, logs: ActivityLogs, includeCurrent: boolean): number {
  const thisWeek = weekStart(today);
  let n = 0;
  for (let w = weekStart(block.start); w <= thisWeek; w = addDays(w, 7)) {
    if (w === thisWeek && !includeCurrent) break;
    if (block.end && w > block.end) break;
    if (hasActivity(logs, w)) n++;
  }
  return n;
}

export interface BlockProgress {
  weekNumber: number; // "week 9 of your 12 weeks"
  activeWeeks: number;
  done: boolean;
}

export function blockProgress(block: Block, today: ISODate, logs: ActivityLogs): BlockProgress {
  const before = activeWeeks(block, today, logs, false);
  const withNow = activeWeeks(block, today, logs, true);
  return { weekNumber: Math.min(BLOCK_WEEKS, before + 1), activeWeeks: withNow, done: withNow >= BLOCK_WEEKS };
}

/** A goal change (or a new 12 weeks) ends the current block and starts a new one. */
export function startBlock(blocks: Block[], goal: Goal, date: ISODate, id: string): Block[] {
  const ended = blocks.map((b) => (b.end ? b : { ...b, end: addDays(date, -1) < b.start ? b.start : addDays(date, -1) }));
  return [...ended, { creatorId: CREATOR_ID, id, goal, start: date }];
}

/** "Lose some weight" is hidden at low BMI, or after 2 Lose blocks in the last 12 months. */
export function loseOffered(bmiAllows: boolean, blocks: Block[], today: ISODate, currentGoal: Goal | null): boolean {
  if (!bmiAllows) return false;
  if (currentGoal === "lose") return true;
  const recent = blocks.filter((b) => b.goal === "lose" && diffDays(b.start, today) < 365).length;
  return recent < LOSE_BLOCKS_PER_YEAR;
}

export function goalOptions(loseOk: boolean): Goal[] {
  return loseOk ? ["stronger", "lose", "steady"] : ["stronger", "steady"];
}

// ---------- C6 summary ----------

export interface StrengthUp {
  exerciseId: string;
  name: string;
  from: number;
  to: number;
}

export interface BlockSummary {
  workoutsDone: number;
  goodWeeks: number;
  activeWeeks: number;
  strengthUps: StrengthUp[];
  averageChangeKg: number | null;
  newSkills: string[]; // exercise names first done this block, above the starter step
}

export function blockSummary(
  block: Block,
  today: ISODate,
  logs: ActivityLogs,
  exercises: Exercise[],
  daysPerWeek: DaysPerWeek,
): BlockSummary {
  const end = block.end ?? today;
  const inB = (d: ISODate) => d >= block.start && d <= end;
  const done = logs.workouts.filter((w) => inB(w.date) && !w.taster && (w.status === "done" || w.status === "part"));
  let goodWeeks = 0;
  for (let w = weekStart(block.start); w <= weekStart(end); w = addDays(w, 7)) {
    const n = done.filter((x) => x.date >= w && x.date <= addDays(w, 6)).length;
    if (n >= daysPerWeek) goodWeeks++;
  }
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const first = new Map<string, number>();
  const best = new Map<string, number>();
  for (const w of [...done].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const s of w.sets) {
      if (!first.has(s.exerciseId)) first.set(s.exerciseId, s.value);
      best.set(s.exerciseId, Math.max(best.get(s.exerciseId) ?? 0, s.value));
    }
  }
  const strengthUps = [...first.entries()]
    .filter(([id, v]) => (best.get(id) ?? 0) > v)
    .map(([id, v]) => ({ exerciseId: id, name: byId.get(id)?.name ?? id, from: v, to: best.get(id)! }));
  const before = new Set(
    logs.workouts.filter((w) => w.date < block.start).flatMap((w) => w.sets.map((s) => s.exerciseId)),
  );
  const newSkills = [...first.keys()]
    .filter((id) => !before.has(id) && (byId.get(id)?.ladderStep ?? 1) > 1)
    .map((id) => byId.get(id)!.name);
  const wi = logs.weighIns.filter((w) => inB(w.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastWeek = wi.filter((w) => w.date >= addDays(end, -6)).map((w) => w.kg);
  const avgNow = mean(lastWeek) ?? wi[wi.length - 1]?.kg ?? null;
  return {
    workoutsDone: done.length,
    goodWeeks,
    activeWeeks: activeWeeks({ ...block, end }, end, logs, true),
    strengthUps,
    averageChangeKg: wi.length && avgNow !== null ? avgNow - wi[0].kg : null,
    newSkills,
  };
}
