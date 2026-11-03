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
  A: "Full body A",
  B: "Full body B",
};

// ---------- Session length (minimum effective dose) ----------

/** Short, Standard (the default) and Long. Length changes the sets only, never the moves. */
export const SHORT: SessionMinutes = 8;
export const STANDARD: SessionMinutes = 15;
export const LONG: SessionMinutes = 25;
export const SESSION_LENGTHS: readonly SessionMinutes[] = [SHORT, STANDARD, LONG];
export const DEFAULT_MINUTES: SessionMinutes = STANDARD;

export const LENGTH_NAMES: Record<SessionMinutes, string> = { 8: "Short", 15: "Standard", 25: "Long" };

/** Sets of each main move by session length. */
export const SETS_BY_LENGTH: Record<SessionMinutes, number> = { 8: 1, 15: 2, 25: 3 };

/** Long only: one core move at this many sets. */
export const CORE_SETS_LONG = 2;

/** Time one set takes: the work (about a minute) plus the rest. */
export const SET_WORK_SECONDS = 60;
/** Getting set up before the first set. */
export const SETUP_SECONDS = 60;

/** Old stored lengths (before the minimum-dose change) to the new ones. */
const OLD_MINUTES: Record<number, SessionMinutes> = { 10: SHORT, 20: STANDARD, 35: LONG };

/** A stored or linked minutes value as a session length: 10/20/35 map to 8/15/25. Unknown = undefined. */
export function toSessionMinutes(v: unknown): SessionMinutes | undefined {
  const n = Number(v);
  if ((SESSION_LENGTHS as readonly number[]).includes(n)) return n as SessionMinutes;
  return OLD_MINUTES[n];
}

/** Weekly check-in "step up": Short → Standard → Long. Null at Long (never above). */
export function stepUpMinutes(m: SessionMinutes): SessionMinutes | null {
  const i = SESSION_LENGTHS.indexOf(m);
  return i >= 0 && i < SESSION_LENGTHS.length - 1 ? SESSION_LENGTHS[i + 1] : null;
}

/** The easier option: Long → Standard → Short. Null at Short. */
export function stepDownMinutes(m: SessionMinutes): SessionMinutes | null {
  const i = SESSION_LENGTHS.indexOf(m);
  return i > 0 ? SESSION_LENGTHS[i - 1] : null;
}

/**
 * The 4 main moves, one per pattern family, in order. Each slot lists what to try:
 * the version for this workout first, then the fallback when the content has nothing suitable.
 * `alt` = a different ladder from the one workout A uses (the hinge variant).
 * `beginner` = only if her start rung there is a beginner move.
 */
interface SlotTry {
  pattern: string;
  alt?: boolean;
  beginner?: boolean;
}
export const SESSION_SLOTS: Record<SessionLetter, SlotTry[][]> = {
  A: [[{ pattern: "squat" }], [{ pattern: "horizontal_push" }], [{ pattern: "horizontal_pull" }], [{ pattern: "hinge" }]],
  B: [
    [{ pattern: "lunge" }, { pattern: "squat" }],
    [{ pattern: "vertical_push", beginner: true }, { pattern: "horizontal_push" }],
    [{ pattern: "vertical_pull", beginner: true }, { pattern: "horizontal_pull" }],
    [{ pattern: "hinge", alt: true, beginner: true }, { pattern: "hinge" }],
  ],
};

/** Core ladders for Long, by kit and floor: Pallof press (band), dead bug (floor), wall plank. */
export const CORE_LADDERS = ["band_pallof_press", "core_front", "core_standing"];

/** Squat or lunge, hinge, push, pull (and core): what the weekly dose is counted in. */
export function patternFamily(pattern: string): "squat_lunge" | "hinge" | "push" | "pull" | "core" {
  if (pattern === "squat" || pattern === "lunge") return "squat_lunge";
  if (pattern === "hinge") return "hinge";
  if (pattern.endsWith("_push")) return "push";
  if (pattern.endsWith("_pull")) return "pull";
  return "core";
}

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

/**
 * How much she'd want a kit for a main move: her dumbbells first, then her band, then no kit
 * (wall counts as no kit). A chair is last for a floor user: it's only used when nothing else
 * fits a beginner (QA A). With no floor, a chair is as good as no kit.
 */
export function kitRank(kit: ExerciseKit, equipment: Equipment[]): number {
  if (kit === "dumbbell") return 0;
  if (kit === "band") return 1;
  if (kit === "chair" && floorAllowed(equipment)) return 3;
  return 2;
}

const LEVEL_RANK: Record<Exercise["level"], number> = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Where she starts on a ladder (no step saved yet): the beginner rung. A floor user starts on the
 * first beginner rung that needs no chair, if there is one (bodyweight squat, not sit-to-stand).
 */
export function startRung(steps: Exercise[], equipment: Equipment[]): Exercise {
  if (floorAllowed(equipment)) {
    const noChair = steps.find((e) => e.kit !== "chair" && e.level === "beginner");
    if (noChair) return noChair;
  }
  return steps[0];
}

/** Usable moves of each ladder for a pattern, rungs in order. */
function laddersFor(pattern: string, ctx: PickContext): Map<string, Exercise[]> {
  const out = new Map<string, Exercise[]>();
  for (const ex of ctx.exercises) {
    if (ex.pattern !== pattern || !isAllowed(ex, ctx.equipment)) continue;
    const l = out.get(ex.ladder) ?? [];
    l.push(ex);
    out.set(ex.ladder, l);
  }
  for (const l of out.values()) l.sort((a, b) => a.ladderStep - b.ladderStep || a.id.localeCompare(b.id));
  return out;
}

/** The move on her current step of a ladder (beginner rung to start), among usable moves. */
export function exerciseOnLadder(steps: Exercise[], current: number | undefined, equipment: Equipment[] = []): Exercise {
  if (current === undefined) return startRung(steps, equipment);
  const atOrBelow = steps.filter((e) => e.ladderStep <= current);
  return atOrBelow[atOrBelow.length - 1] ?? steps[0];
}

/**
 * Ladders for a pattern with the move she'd do on each, best first, judged by the ladder's start
 * rung so progress never makes her lose a ladder: her kit (dumbbells, band, no kit, chair last for
 * floor users), then a beginner start, then the longest ladder (the skills), then the lowest id.
 */
export function rankedLadders(
  pattern: string,
  ctx: PickContext,
): { ladder: string; steps: Exercise[]; start: Exercise; move: Exercise }[] {
  return [...laddersFor(pattern, ctx).entries()]
    .map(([ladder, steps]) => ({
      ladder,
      steps,
      start: startRung(steps, ctx.equipment),
      move: exerciseOnLadder(steps, ctx.ladderSteps[ladder], ctx.equipment),
    }))
    .sort(
      (a, b) =>
        kitRank(a.start.kit, ctx.equipment) - kitRank(b.start.kit, ctx.equipment) ||
        LEVEL_RANK[a.start.level] - LEVEL_RANK[b.start.level] ||
        b.steps.length - a.steps.length ||
        a.start.id.localeCompare(b.start.id),
    );
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

export interface PickOptions {
  /** Ladders not to use (the hinge variant skips workout A's ladder). */
  skipLadders?: Set<string>;
  /** Only a ladder whose start rung is a beginner move ("a suitable beginner one"). */
  beginner?: boolean;
}

export function pickForPattern(
  pattern: string,
  ctx: PickContext,
  usedIds: Set<string>,
  usedLadders: Set<string>,
  opts: PickOptions = {},
): Exercise | null {
  for (const { ladder, start, move } of rankedLadders(pattern, ctx)) {
    if (usedLadders.has(ladder) || opts.skipLadders?.has(ladder)) continue;
    if (opts.beginner && start.level !== "beginner") continue;
    let ex = move;
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

/** Long only: the core move by kit and floor (Pallof press, dead bug, wall plank), on her ladder step. */
export function pickCore(ctx: PickContext, usedIds: Set<string>): Exercise | null {
  const ladders = laddersFor("core", ctx);
  for (const name of CORE_LADDERS) {
    const steps = ladders.get(name);
    if (!steps?.length) continue;
    let ex = exerciseOnLadder(steps, ctx.ladderSteps[name], ctx.equipment);
    if (ctx.setAside.includes(ex.id)) {
      const r = replacement(ex, ctx, usedIds);
      if (!r) continue;
      ex = r;
    }
    if (!usedIds.has(ex.id)) return ex;
  }
  return null;
}

export interface SessionInput extends PickContext {
  letter: SessionLetter;
  minutes: SessionMinutes;
  targets: Record<string, number>;
  easy: boolean;
  /** Swaps for today (W6, W5): fromId -> toId. */
  swaps?: Record<string, string>;
  /** Body parts that hurt today: left out for the rest of today. */
  hurtBodyParts?: string[];
}

/**
 * Every session: the same 4 main moves, one per pattern family (squat or lunge, push, pull, hinge).
 * A and B alternate the version where the content allows. Length changes the sets only:
 * Short 1, Standard 2, Long 3 plus one core move.
 */
export function buildSession(i: SessionInput): PlannedSession {
  const usedIds = new Set<string>();
  const usedLadders = new Set<string>();
  const hurt = new Set(i.hurtBodyParts ?? []);
  const map = byId(i.exercises);
  const picked: Exercise[] = [];
  /** Today's swap (W6, W5), then the hurt and duplicate checks. */
  const take = (found: Exercise | null): Exercise | null => {
    if (!found) return null;
    const swapTo = i.swaps?.[found.id] ? map.get(i.swaps[found.id]) : undefined;
    const ex = swapTo ?? found;
    if (hurt.has(ex.primaryMuscle) || usedIds.has(ex.id)) return null;
    return ex;
  };
  for (const slot of SESSION_SLOTS[i.letter]) {
    for (const t of slot) {
      let skipLadders: Set<string> | undefined;
      if (t.alt) {
        const aMove = pickForPattern(t.pattern, i, new Set(), new Set());
        if (!aMove) continue;
        skipLadders = new Set([aMove.ladder]);
      }
      const ex = take(pickForPattern(t.pattern, i, usedIds, usedLadders, { skipLadders, beginner: t.beginner }));
      if (!ex) continue;
      picked.push(ex);
      usedIds.add(ex.id);
      usedLadders.add(ex.ladder);
      break;
    }
  }
  const mainSets = SETS_BY_LENGTH[i.minutes];
  const sized = picked.map((ex) => ({ ex, sets: mainSets }));
  if (i.minutes === LONG) {
    const core = take(pickCore(i, usedIds));
    if (core) sized.push({ ex: core, sets: CORE_SETS_LONG });
  }
  const moves: PlannedMove[] = sized.map(({ ex, sets: n }) => {
    const sets = i.easy ? Math.max(1, n - 1) : n;
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
  const totalSets = moves.reduce((a, m) => a + m.sets.length, 0);
  return {
    letter: i.letter,
    name: SESSION_NAMES[i.letter],
    minutes: i.minutes,
    moves,
    totalSets,
    estMinutes: sessionMinutes(totalSets),
    easy: i.easy,
  };
}

/** Sets per pattern family across sessions (the weekly dose). */
export function setsPerFamily(sessions: PlannedSession[]): Record<ReturnType<typeof patternFamily>, number> {
  const out = { squat_lunge: 0, hinge: 0, push: 0, pull: 0, core: 0 };
  for (const s of sessions) for (const m of s.moves) out[patternFamily(m.pattern)] += m.sets.length;
  return out;
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

/** Full body A and B, alternating (4-day plans too: there is no C). */
export function lettersFor(days: DaysPerWeek): SessionLetter[] {
  void days;
  return ["A", "B"];
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

const PATTERNS_BY_AREA: Record<TrainingArea, string[]> = {
  legs: ["squat", "lunge", "hinge"],
  push: ["horizontal_push", "vertical_push"],
  pull: ["horizontal_pull", "vertical_pull"],
  core: ["core"],
};

/**
 * W5 options: the same body area only, never a cross-area swap (QA). Order: the move's own swaps,
 * then the same pattern (an easier rung of its ladder, the move on her other ladders), then the
 * other patterns of the area. Never a harder rung of the same ladder, a move already in today's
 * workout, a set-aside move, or a body part that hurt earlier today. Max 2.
 */
export function hurtSwapOptions(
  hurtEx: Exercise,
  todayIds: string[],
  ctx: PickContext,
  hurtBodyParts: string[] = [],
  max = 2,
): Exercise[] {
  const area = patternArea(hurtEx.pattern);
  const avoid = new Set(hurtBodyParts.filter((p) => p !== hurtEx.primaryMuscle));
  const map = byId(ctx.exercises);
  const ok = (e: Exercise | undefined): e is Exercise =>
    !!e &&
    e.id !== hurtEx.id &&
    patternArea(e.pattern) === area &&
    isAllowed(e, ctx.equipment) &&
    !avoid.has(e.primaryMuscle) &&
    !todayIds.includes(e.id) &&
    !ctx.setAside.includes(e.id) &&
    !(e.ladder === hurtEx.ladder && e.ladderStep >= hurtEx.ladderStep);
  const candidates: (Exercise | undefined)[] = hurtEx.swaps.map((id) => map.get(id));
  const patterns = [hurtEx.pattern, ...PATTERNS_BY_AREA[area].filter((p) => p !== hurtEx.pattern)];
  for (const pattern of patterns) {
    for (const { ladder, steps, move } of rankedLadders(pattern, ctx)) {
      if (ladder === hurtEx.ladder) candidates.push(...steps.filter((e) => e.ladderStep < hurtEx.ladderStep).reverse());
      else candidates.push(move);
    }
  }
  const out: Exercise[] = [];
  for (const e of candidates) {
    if (out.length >= max) break;
    if (ok(e) && !out.some((x) => x.id === e.id)) out.push(e);
  }
  return out;
}

/** Sets in a session for one move. */
export function setsFor(session: WorkoutSession, exerciseId: string): SetLog[] {
  return session.sets.filter((s) => s.exerciseId === exerciseId);
}

/** Raw minutes for this many sets: setting up, then each set's work and rest. */
export function rawSessionMinutes(totalSets: number): number {
  if (totalSets <= 0) return 0;
  return (SETUP_SECONDS + totalSets * (SET_WORK_SECONDS + REST_SECONDS)) / 60;
}

/** "About" minutes: whole minutes up to 10, then the nearest 5. */
export function aboutMinutes(raw: number): number {
  if (raw <= 0) return 0;
  if (raw <= 10) return Math.max(1, Math.round(raw));
  return Math.round(raw / 5) * 5;
}

/**
 * Real length of a session with this many sets, from the engine's own maths:
 * Short 4 sets = 8, Standard 8 sets = 15, Long 12 + 2 core sets = 25.5, about 25.
 */
export function sessionMinutes(totalSets: number): number {
  return aboutMinutes(rawSessionMinutes(totalSets));
}

/** W4/W3: minutes left. At the start it is the session's own length (QA 19). */
export function minutesLeft(totalSets: number, doneSets: number): number {
  if (doneSets <= 0) return sessionMinutes(totalSets);
  const left = Math.max(0, totalSets - doneSets);
  return Math.max(0, Math.ceil((left * (SET_WORK_SECONDS + REST_SECONDS)) / 60 - 1e-9));
}
