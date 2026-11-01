// SPEC 3.4 Workouts: schedule, sessions, exercise picks, progression, hurts, Not today.
import {
  CREATOR_ID,
  type DaysPerWeek,
  type Effort,
  type Equipment,
  type Exercise,
  type ExerciseKit,
  type HurtLog,
  type ISODate,
  type PlannedMove,
  type PlannedSession,
  type ScheduleMove,
  type SessionLetter,
  type SessionMinutes,
  type SetAside,
  type SetLog,
  type TrainingArea,
  type WorkoutSession,
} from "../types";
import { addDays, diffDays, weekDates, weekStart, weekday } from "./dates";

export const REST_SECONDS = 45;
export const HOLD_STEP_SECONDS = 5;
export const HURTS_TO_SET_ASIDE = 2;

export const SESSION_NAMES: Record<SessionLetter, string> = {
  A: "Legs and push",
  B: "Hips and pull",
  C: "Legs and core",
};

/** Moves × sets by session length. */
export const LENGTH_SHAPE: Record<SessionMinutes, { moves: number; sets: number }> = {
  10: { moves: 3, sets: 2 },
  20: { moves: 5, sets: 3 },
  35: { moves: 7, sets: 3 },
};

/** Full-body sessions: pattern order per session; the first N are used. */
export const SESSION_PATTERNS: Record<SessionLetter, string[]> = {
  A: ["squat", "horizontal_push", "horizontal_pull", "lunge", "vertical_push", "core", "hinge"],
  B: ["hinge", "horizontal_pull", "horizontal_push", "lunge", "vertical_pull", "core", "squat"],
  C: ["squat", "core", "horizontal_push", "lunge", "hinge", "horizontal_pull", "core"],
};

const FALLBACK_PATTERNS = [
  "squat",
  "hinge",
  "lunge",
  "horizontal_push",
  "horizontal_pull",
  "vertical_push",
  "vertical_pull",
  "core",
];

export function patternArea(pattern: string): TrainingArea {
  if (pattern === "squat" || pattern === "hinge" || pattern === "lunge") return "legs";
  if (pattern.endsWith("_push")) return "push";
  if (pattern.endsWith("_pull")) return "pull";
  return "core";
}

export const AREA_WORDS: Record<TrainingArea, string> = {
  legs: "Legs",
  push: "Arms and chest",
  pull: "Back",
  core: "Core",
};

// ---------- Equipment ----------

/** Kits she can use. Chair, wall and no kit are always there; there's no pull-up bar option. */
export function allowedKits(equipment: Equipment[]): Set<ExerciseKit> {
  const kits = new Set<ExerciseKit>(["none", "chair", "wall"]);
  if (equipment.includes("bands")) kits.add("band");
  if (equipment.includes("dumbbells")) kits.add("dumbbell");
  return kits;
}

/** "No floor" means chair and wall moves only, even if floor space is also ticked. */
export function floorAllowed(equipment: Equipment[]): boolean {
  return !equipment.includes("noFloor");
}

export function isAllowed(ex: Exercise, equipment: Equipment[]): boolean {
  if (!allowedKits(equipment).has(ex.kit)) return false;
  if (!floorAllowed(equipment) && ex.position === "floor") return false;
  return true;
}

// ---------- Picking moves ----------

export interface PickContext {
  exercises: Exercise[];
  equipment: Equipment[];
  ladderSteps: Record<string, number>;
  setAside: string[];
}

function byId(exercises: Exercise[]): Map<string, Exercise> {
  return new Map(exercises.map((e) => [e.id, e]));
}

/** Rank ladders for a pattern: longest usable ladder first (the skills), then name. */
function laddersFor(pattern: string, ctx: PickContext): Map<string, Exercise[]> {
  const out = new Map<string, Exercise[]>();
  for (const ex of ctx.exercises) {
    if (ex.pattern !== pattern || !isAllowed(ex, ctx.equipment)) continue;
    const l = out.get(ex.ladder) ?? [];
    l.push(ex);
    out.set(ex.ladder, l);
  }
  for (const l of out.values()) l.sort((a, b) => a.ladderStep - b.ladderStep || a.id.localeCompare(b.id));
  return new Map(
    [...out.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])),
  );
}

/** The move on her current step of a ladder (beginner rung to start), among usable moves. */
export function exerciseOnLadder(steps: Exercise[], current: number | undefined): Exercise {
  if (current === undefined) return steps[0];
  const atOrBelow = steps.filter((e) => e.ladderStep <= current);
  return atOrBelow[atOrBelow.length - 1] ?? steps[0];
}

/** A set-aside move is replaced using its `swaps`, else nothing. */
function replacement(ex: Exercise, ctx: PickContext, used: Set<string>): Exercise | null {
  const map = byId(ctx.exercises);
  for (const id of ex.swaps) {
    const s = map.get(id);
    if (s && isAllowed(s, ctx.equipment) && !ctx.setAside.includes(s.id) && !used.has(s.id)) return s;
  }
  return null;
}

export function pickForPattern(
  pattern: string,
  ctx: PickContext,
  usedIds: Set<string>,
  usedLadders: Set<string>,
): Exercise | null {
  for (const [ladder, steps] of laddersFor(pattern, ctx)) {
    if (usedLadders.has(ladder)) continue;
    let ex = exerciseOnLadder(steps, ctx.ladderSteps[ladder]);
    if (ctx.setAside.includes(ex.id)) {
      const r = replacement(ex, ctx, usedIds);
      if (!r) continue;
      ex = r;
    }
    if (usedIds.has(ex.id)) continue;
    return ex;
  }
  return null;
}

export interface SessionInput extends PickContext {
  letter: SessionLetter;
  minutes: SessionMinutes;
  extraSets: Record<TrainingArea, number>;
  targets: Record<string, number>;
  easy: boolean;
  /** Swaps for today (W6, W5): fromId -> toId. */
  swaps?: Record<string, string>;
  /** Body parts that hurt today: left out for the rest of today. */
  hurtBodyParts?: string[];
}

export function buildSession(i: SessionInput): PlannedSession {
  const shape = LENGTH_SHAPE[i.minutes];
  const usedIds = new Set<string>();
  const usedLadders = new Set<string>();
  const picked: Exercise[] = [];
  const queue = [...SESSION_PATTERNS[i.letter], ...FALLBACK_PATTERNS];
  const hurt = new Set(i.hurtBodyParts ?? []);
  const map = byId(i.exercises);
  for (const pattern of queue) {
    if (picked.length >= shape.moves) break;
    let ex = pickForPattern(pattern, i, usedIds, usedLadders);
    if (!ex) continue;
    const swapTo = i.swaps?.[ex.id] ? map.get(i.swaps[ex.id]) : undefined;
    if (swapTo) ex = swapTo;
    if (hurt.has(ex.primaryMuscle) || usedIds.has(ex.id)) continue;
    picked.push(ex);
    usedIds.add(ex.id);
    usedLadders.add(ex.ladder);
  }
  const areaFirst = new Set<TrainingArea>();
  const moves: PlannedMove[] = picked.map((ex) => {
    const area = patternArea(ex.pattern);
    let sets = shape.sets;
    if (!areaFirst.has(area)) {
      areaFirst.add(area);
      sets += i.extraSets[area] ?? 0;
    }
    if (i.easy) sets = Math.max(1, sets - 1);
    const target = i.targets[ex.id] ?? ex.repMin;
    return {
      exerciseId: ex.id,
      name: ex.name,
      pattern: ex.pattern,
      unit: ex.unit,
      sets: Array.from({ length: sets }, (_, s) => ({ setIndex: s, target })),
      restSeconds: REST_SECONDS,
      cues: ex.cues,
      perSide: ex.perSide === true,
    };
  });
  return {
    letter: i.letter,
    name: SESSION_NAMES[i.letter],
    minutes: i.minutes,
    moves,
    totalSets: moves.reduce((a, m) => a + m.sets.length, 0),
    easy: i.easy,
  };
}

// ---------- Weekly schedule ----------

function combos(xs: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (xs.length < k) return [];
  const [h, ...t] = xs;
  return [...combos(t, k - 1).map((c) => [h, ...c]), ...combos(t, k)];
}

/**
 * Pick n training weekdays (0 = Mon) from the free ones: fewest back-to-back pairs,
 * then the widest smallest gap (counting Sunday to Monday), then earliest.
 */
export function chooseTrainingDays(free: number[], n: number): number[] {
  const days = [...new Set(free)].sort((a, b) => a - b);
  if (days.length <= n) return days;
  let best: number[] = [];
  let bestScore: [number, number] | null = null;
  for (const c of combos(days, n)) {
    let adj = 0;
    let minGap = 7;
    for (let i = 0; i < c.length; i++) {
      const next = i + 1 < c.length ? c[i + 1] : c[0] + 7;
      const gap = next - c[i];
      if (i + 1 < c.length && gap === 1) adj++;
      if (c.length > 1) minGap = Math.min(minGap, gap);
    }
    const score: [number, number] = [adj, -minGap];
    if (!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

export function lettersFor(days: DaysPerWeek): SessionLetter[] {
  return days === 4 ? ["A", "B", "C"] : ["A", "B"];
}

export interface ScheduleInput {
  weekStart: ISODate;
  planStart: ISODate;
  daysPerWeek: DaysPerWeek;
  awayDates: Set<ISODate>;
  moves: ScheduleMove[];
}

/** date -> session letter or null. Away days are skipped. Letters rotate across weeks. */
export function weekSchedule(i: ScheduleInput): Record<ISODate, SessionLetter | null> {
  const dates = weekDates(i.weekStart);
  const out: Record<ISODate, SessionLetter | null> = {};
  for (const d of dates) out[d] = null;
  const free = dates
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => d >= i.planStart && !i.awayDates.has(d))
    .map(({ idx }) => idx);
  const chosen = chooseTrainingDays(free, i.daysPerWeek);
  const letters = lettersFor(i.daysPerWeek);
  const weekIndex = Math.max(0, Math.floor(diffDays(weekStart(i.planStart), i.weekStart) / 7));
  chosen.forEach((idx, k) => {
    out[dates[idx]] = letters[(weekIndex * i.daysPerWeek + k) % letters.length];
  });
  for (const m of i.moves.filter((x) => x.weekStart === i.weekStart)) {
    const letter = out[m.from];
    if (!letter) continue;
    out[m.from] = null;
    if (m.to && out[m.to] === null && !i.awayDates.has(m.to)) out[m.to] = letter;
  }
  return out;
}

export function doneOn(workouts: WorkoutSession[], date: ISODate): WorkoutSession | undefined {
  return workouts.find((w) => w.date === date && !w.taster && (w.status === "done" || w.status === "part"));
}

/** One workout per day. */
export function canStartWorkout(workouts: WorkoutSession[], date: ISODate): boolean {
  return !doneOn(workouts, date);
}

/**
 * "Not today": move today's workout to the next free home day this week (not away,
 * no workout planned or done). None left: dropped, no mark.
 */
export function notToday(
  schedule: Record<ISODate, SessionLetter | null>,
  today: ISODate,
  awayDates: Set<ISODate>,
  workouts: WorkoutSession[],
): ScheduleMove | null {
  if (!schedule[today]) return null;
  const ws = weekStart(today);
  let to: ISODate | null = null;
  for (let d = addDays(today, 1); weekday(d) !== 0; d = addDays(d, 1)) {
    if (!awayDates.has(d) && !schedule[d] && !doneOn(workouts, d)) {
      to = d;
      break;
    }
  }
  return { creatorId: CREATOR_ID, weekStart: ws, from: today, to };
}

export interface WeekCount {
  planned: number;
  done: number;
}

/** Weekly count: home days only. A part workout counts as done. */
export function weekCount(
  schedule: Record<ISODate, SessionLetter | null>,
  workouts: WorkoutSession[],
  awayDates: Set<ISODate>,
): WeekCount {
  const dates = Object.keys(schedule).filter((d) => !awayDates.has(d));
  return {
    planned: dates.filter((d) => schedule[d]).length,
    done: dates.filter((d) => doneOn(workouts, d)).length,
  };
}

/** Next planned workout from today (not done). */
export function nextWorkout(
  schedule: Record<ISODate, SessionLetter | null>,
  today: ISODate,
  workouts: WorkoutSession[],
): { date: ISODate; letter: SessionLetter } | null {
  for (const d of Object.keys(schedule).sort()) {
    const l = schedule[d];
    if (d >= today && l && !doneOn(workouts, d)) return { date: d, letter: l };
  }
  return null;
}

// ---------- Progression ----------

export interface ProgressionInput {
  exercise: Exercise;
  /** All usable moves on the same ladder (any order). */
  ladderMoves: Exercise[];
  sets: SetLog[];
  effort: Effort | undefined;
  target: number;
  status: WorkoutSession["status"];
  easy: boolean;
}

export interface ProgressionResult {
  target: number;
  stepUp: boolean;
  nextExerciseId: string;
  nextStep: number;
}

/**
 * reps_then_step / holds: if every set reaches the target, the target goes up (1 rep or
 * 5 seconds) toward rep_max. When every set hits rep_max (or the hold max) and the move
 * was rated Just right or Too easy, go to the next ladder step at its rep_min.
 * Big screen sets save the planned number, so any increase there needs that rating.
 * Part workouts and easy weeks don't move the plan up.
 */
export function progress(i: ProgressionInput): ProgressionResult {
  const ex = i.exercise;
  const same: ProgressionResult = {
    target: i.target,
    stepUp: false,
    nextExerciseId: ex.id,
    nextStep: ex.ladderStep,
  };
  if (i.status !== "done" || i.easy || i.sets.length === 0) return same;
  const rated = i.effort === "just_right" || i.effort === "too_easy";
  const bigScreen = i.sets.some((s) => s.planned);
  const low = Math.min(...i.sets.map((s) => s.value));
  if (rated && low >= ex.repMax) {
    const next = i.ladderMoves
      .filter((m) => m.ladderStep > ex.ladderStep)
      .sort((a, b) => a.ladderStep - b.ladderStep)[0];
    if (next) return { target: next.repMin, stepUp: true, nextExerciseId: next.id, nextStep: next.ladderStep };
    return { ...same, target: ex.repMax };
  }
  if (bigScreen && !rated) return same;
  if (i.effort === "too_hard") return same;
  if (low >= i.target) {
    const inc = ex.unit === "seconds" ? HOLD_STEP_SECONDS : 1;
    return { ...same, target: Math.min(ex.repMax, Math.max(i.target, low) + inc) };
  }
  return same;
}

// ---------- Hurts ----------

export function hurtCount(hurts: HurtLog[], exerciseId: string): number {
  return hurts.filter((h) => h.exerciseId === exerciseId).length;
}

/** "Hurts" twice on the same move: it's set aside. */
export function shouldSetAside(hurts: HurtLog[], exerciseId: string, setAside: SetAside[]): boolean {
  return (
    hurtCount(hurts, exerciseId) >= HURTS_TO_SET_ASIDE && !setAside.some((s) => s.exerciseId === exerciseId)
  );
}

/** W5 options: a different body part, never one already in today's workout, max 2. */
export function hurtSwapOptions(
  hurtEx: Exercise,
  todayIds: string[],
  ctx: PickContext,
  hurtBodyParts: string[] = [],
  max = 2,
): Exercise[] {
  const avoid = new Set([hurtEx.primaryMuscle, ...hurtBodyParts]);
  return ctx.exercises
    .filter(
      (e) =>
        isAllowed(e, ctx.equipment) &&
        !avoid.has(e.primaryMuscle) &&
        !todayIds.includes(e.id) &&
        !ctx.setAside.includes(e.id),
    )
    .sort(
      (a, b) =>
        Number(b.pattern === hurtEx.pattern) - Number(a.pattern === hurtEx.pattern) ||
        a.ladderStep - b.ladderStep ||
        a.id.localeCompare(b.id),
    )
    .slice(0, max);
}

/** Sets in a session for one move. */
export function setsFor(session: WorkoutSession, exerciseId: string): SetLog[] {
  return session.sets.filter((s) => s.exerciseId === exerciseId);
}

/** W4/W3: minutes left, roughly — sets left × (45 s work + 45 s rest). */
export function minutesLeft(totalSets: number, doneSets: number): number {
  return Math.max(0, Math.ceil(((totalSets - doneSets) * (REST_SECONDS + 45)) / 60));
}
