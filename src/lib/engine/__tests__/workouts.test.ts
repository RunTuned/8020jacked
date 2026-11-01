import { describe, expect, it } from "vitest";
import { CREATOR_ID, type HurtLog, type SetLog, type WorkoutSession } from "../../types";
import {
  buildSession,
  canStartWorkout,
  chooseTrainingDays,
  hurtSwapOptions,
  isAllowed,
  nextWorkout,
  notToday,
  progress,
  REST_SECONDS,
  SESSION_NAMES,
  shouldSetAside,
  weekCount,
  weekSchedule,
  type SessionInput,
} from "../workouts";
import { EXERCISES } from "./fixtures";

const MON = "2026-11-02";
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const sessionIn = (p: Partial<SessionInput> = {}): SessionInput => ({
  exercises: EXERCISES,
  equipment: ["floor"],
  ladderSteps: {},
  setAside: [],
  letter: "A",
  minutes: 20,
  extraSets: { legs: 0, push: 0, pull: 0, core: 0 },
  targets: {},
  easy: false,
  ...p,
});
const sets = (id: string, values: number[], planned = false): SetLog[] =>
  values.map((value, setIndex) => ({ creatorId: CREATOR_ID, exerciseId: id, setIndex, value, unit: byId(id).unit, planned, at: 0 }));
const workout = (date: string, status: WorkoutSession["status"] = "done"): WorkoutSession => ({
  creatorId: CREATOR_ID,
  id: date,
  date,
  letter: "A",
  minutes: 20,
  status,
  sets: [],
  moveEffort: {},
  bigScreen: false,
  taster: false,
  startedAt: 0,
});

describe("3.4 days: 2, 3 or 4 a week, never back to back where possible", () => {
  const all = [0, 1, 2, 3, 4, 5, 6];
  it("picks spread-out days", () => {
    expect(chooseTrainingDays(all, 2)).toEqual([0, 3]); // Mon, Thu
    expect(chooseTrainingDays(all, 3)).toEqual([0, 2, 4]); // Mon, Wed, Fri
    expect(chooseTrainingDays(all, 4)).toEqual([0, 2, 4, 6]); // Mon, Wed, Fri, Sun
  });

  it("skips away days and still avoids back to back", () => {
    const d = chooseTrainingDays([0, 1, 3, 4, 5, 6], 3); // Wed away
    expect(d).not.toContain(2);
    for (let i = 1; i < d.length; i++) expect(d[i] - d[i - 1]).toBeGreaterThan(1);
  });

  it("back to back only when it can't be helped", () => {
    expect(chooseTrainingDays([3, 4], 2)).toEqual([3, 4]);
    expect(chooseTrainingDays([3], 2)).toEqual([3]);
  });

  it("weekSchedule: A/B for 3 days, C in 4-day plans, away days skipped", () => {
    const s3 = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });
    expect(Object.values(s3).filter(Boolean)).toEqual(["A", "B", "A"]);
    const next = weekSchedule({ weekStart: "2026-11-09", planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });
    expect(Object.values(next).filter(Boolean)).toEqual(["B", "A", "B"]);
    const s4 = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 4, awayDates: new Set(), moves: [] });
    expect(Object.values(s4).filter(Boolean)).toEqual(["A", "B", "C", "A"]);
    const away = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set([MON]), moves: [] });
    expect(away[MON]).toBeNull();
    expect(Object.values(away).filter(Boolean)).toHaveLength(3);
  });

  it("no workouts before the plan starts", () => {
    const s = weekSchedule({ weekStart: MON, planStart: "2026-11-05", daysPerWeek: 3, awayDates: new Set(), moves: [] });
    expect(s[MON]).toBeNull();
    expect(s["2026-11-03"]).toBeNull();
  });
});

describe("3.4 sessions", () => {
  it("named by body area", () => {
    expect(SESSION_NAMES).toEqual({ A: "Legs and push", B: "Hips and pull", C: "Legs and core" });
  });

  it("10 min: 3 moves × 2 sets; 20 min: 5 × 3; 35 min: 7 × 3; rest 45 s", () => {
    for (const [minutes, moves, setsN] of [
      [10, 3, 2],
      [20, 5, 3],
      [35, 7, 3],
    ] as const) {
      const s = buildSession(sessionIn({ minutes }));
      expect(s.moves).toHaveLength(moves);
      for (const m of s.moves) {
        expect(m.sets).toHaveLength(setsN);
        expect(m.restSeconds).toBe(REST_SECONDS);
      }
      expect(s.totalSets).toBe(moves * setsN);
    }
    expect(REST_SECONDS).toBe(45);
  });

  it("starts on the beginner rung of each ladder, by pattern", () => {
    const s = buildSession(sessionIn({ minutes: 10 }));
    // squat, push, pull. A floor user starts on the bodyweight squat, not the chair (QA A).
    expect(s.moves.map((m) => m.exerciseId)).toEqual(["SQ2", "PU1", "RW1"]);
    expect(s.moves[0].sets[0].target).toBe(10); // rep_min
    // With no floor, sit-to-stand (a chair) is the beginner squat.
    expect(buildSession(sessionIn({ equipment: ["noFloor"], minutes: 10 })).moves[0].exerciseId).toBe("SQ1");
  });

  it("session B leads with hips and pull", () => {
    const s = buildSession(sessionIn({ letter: "B", minutes: 10 }));
    expect(s.moves.map((m) => m.pattern)).toEqual(["hinge", "horizontal_pull", "horizontal_push"]);
  });

  it("no moves twice, never the same ladder twice", () => {
    const s = buildSession(sessionIn({ minutes: 35 }));
    const ids = s.moves.map((m) => m.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no floor = no floor-position moves", () => {
    const s = buildSession(sessionIn({ equipment: ["noFloor"], minutes: 35 }));
    for (const m of s.moves) expect(byId(m.exerciseId).position).not.toBe("floor");
    expect(s.moves.map((m) => m.exerciseId)).toContain("RW2"); // standing row, not the floor Y-T raise
  });

  it("filters by kit: bands and dumbbells only when she has them; never the bar", () => {
    expect(isAllowed(byId("OP1"), ["floor"])).toBe(false);
    expect(isAllowed(byId("OP1"), ["floor", "bands"])).toBe(true);
    expect(isAllowed(byId("DB1"), ["dumbbells"])).toBe(true);
    expect(isAllowed(byId("PB1"), ["floor", "bands", "dumbbells"])).toBe(false);
    const s = buildSession(sessionIn({ equipment: ["floor", "bands"], minutes: 35 }));
    expect(s.moves.map((m) => m.exerciseId)).toContain("OP1");
  });

  it("held moves use seconds", () => {
    const s = buildSession(sessionIn({ equipment: ["noFloor"], minutes: 35, letter: "C" }));
    const hold = s.moves.find((m) => m.exerciseId === "CS1")!;
    expect(hold.unit).toBe("seconds");
    expect(hold.sets[0].target).toBe(20);
  });

  it("a check-in step up adds one set to the first move of that area", () => {
    const s = buildSession(sessionIn({ extraSets: { legs: 1, push: 0, pull: 0, core: 0 } }));
    expect(s.moves[0].sets).toHaveLength(4); // squat
    expect(s.moves.find((m) => m.pattern === "lunge")!.sets).toHaveLength(3);
  });

  it("easy week: one set fewer, at least one", () => {
    expect(buildSession(sessionIn({ easy: true, minutes: 10 })).moves[0].sets).toHaveLength(1);
  });

  it("current ladder steps are used", () => {
    const s = buildSession(sessionIn({ ladderSteps: { squat_bw: 2 }, minutes: 10 }));
    expect(s.moves[0].exerciseId).toBe("SQ2");
  });
});

describe("3.4 progression (reps_then_step, holds)", () => {
  const ladder = EXERCISES.filter((e) => e.ladder === "squat_bw");
  const base = { exercise: byId("SQ1"), ladderMoves: ladder, effort: "just_right" as const, target: 8, status: "done" as const, easy: false };

  it("all sets at rep_max and rated Just right → next ladder step at its rep_min", () => {
    const r = progress({ ...base, target: 15, sets: sets("SQ1", [15, 15, 15]) });
    expect(r).toEqual({ target: 10, stepUp: true, nextExerciseId: "SQ2", nextStep: 2 });
  });

  it("Too easy also steps up", () => {
    expect(progress({ ...base, effort: "too_easy", target: 15, sets: sets("SQ1", [15, 16, 15]) }).stepUp).toBe(true);
  });

  it("Too hard, or no rating → no step up", () => {
    expect(progress({ ...base, effort: "too_hard", target: 15, sets: sets("SQ1", [15, 15, 15]) }).stepUp).toBe(false);
    expect(progress({ ...base, effort: undefined, target: 15, sets: sets("SQ1", [15, 15, 15]) }).stepUp).toBe(false);
  });

  it("not every set at rep_max → no step up", () => {
    expect(progress({ ...base, target: 15, sets: sets("SQ1", [15, 15, 14]) }).stepUp).toBe(false);
  });

  it("every set hit the target → one more rep next time, up to rep_max", () => {
    expect(progress({ ...base, sets: sets("SQ1", [8, 8, 8]) }).target).toBe(9);
    expect(progress({ ...base, sets: sets("SQ1", [8, 9, 8]) }).target).toBe(9);
    expect(progress({ ...base, sets: sets("SQ1", [8, 7, 8]) }).target).toBe(8);
    expect(progress({ ...base, effort: undefined, target: 14, sets: sets("SQ1", [14, 14, 14]) }).target).toBe(15);
  });

  it("holds go up 5 seconds", () => {
    const plank = byId("CO2");
    const r = progress({ ...base, exercise: plank, ladderMoves: [byId("CO1"), plank], target: 20, sets: sets("CO2", [20, 20, 20]) });
    expect(r.target).toBe(25);
    // top of the ladder at hold max: stays
    const top = progress({ ...base, exercise: plank, ladderMoves: [byId("CO1"), plank], target: 60, sets: sets("CO2", [60, 60, 60]) });
    expect(top).toMatchObject({ stepUp: false, target: 60, nextExerciseId: "CO2" });
  });

  it("big screen saves the planned number: a step up needs the rating", () => {
    const planned = sets("SQ1", [15, 15, 15], true);
    expect(progress({ ...base, effort: undefined, target: 15, sets: planned }).stepUp).toBe(false);
    expect(progress({ ...base, effort: "just_right", target: 15, sets: planned }).stepUp).toBe(true);
    // below rep_max, unrated → nothing changes
    expect(progress({ ...base, effort: undefined, target: 10, sets: sets("SQ1", [10, 10], true) }).target).toBe(10);
    expect(progress({ ...base, effort: "just_right", target: 10, sets: sets("SQ1", [10, 10], true) }).target).toBe(11);
  });

  it("a part workout or an easy week doesn't move the plan up", () => {
    expect(progress({ ...base, status: "part", target: 15, sets: sets("SQ1", [15, 15, 15]) }).stepUp).toBe(false);
    expect(progress({ ...base, easy: true, sets: sets("SQ1", [8, 8, 8]) }).target).toBe(8);
  });
});

describe("3.4 Hurts", () => {
  const hurt = (exerciseId: string, date = MON): HurtLog => ({ creatorId: CREATOR_ID, date, exerciseId, bodyPart: byId(exerciseId).primaryMuscle });

  it("twice on the same move → set aside", () => {
    expect(shouldSetAside([hurt("SQ1")], "SQ1", [])).toBe(false);
    expect(shouldSetAside([hurt("SQ1"), hurt("SQ1", "2026-11-04")], "SQ1", [])).toBe(true);
    expect(shouldSetAside([hurt("SQ1"), hurt("PU1")], "SQ1", [])).toBe(false);
  });

  it("a set-aside move is swapped using its swaps", () => {
    const s = buildSession(sessionIn({ equipment: ["noFloor"], setAside: ["SQ1"], minutes: 10 }));
    expect(s.moves[0].exerciseId).toBe("WS1");
    expect(s.moves.map((m) => m.exerciseId)).not.toContain("SQ1");
  });

  it("bring it back: no longer set aside → back in the workout", () => {
    expect(buildSession(sessionIn({ equipment: ["noFloor"], setAside: [], minutes: 10 })).moves[0].exerciseId).toBe("SQ1");
  });

  it("W5 options: the same body area only, never one already in today's workout", () => {
    const ctx = { exercises: EXERCISES, equipment: ["floor" as const], ladderSteps: {}, setAside: [] };
    const opts = hurtSwapOptions(byId("SQ2"), ["SQ2", "PU1", "RW1"], ctx);
    expect(opts.map((o) => o.id)).toEqual(["SQ1", "WS1"]); // an easier rung, then the other squat ladder
    for (const o of opts) {
      expect(["squat", "lunge", "hinge"]).toContain(o.pattern);
      expect(["SQ2", "PU1", "RW1"]).not.toContain(o.id);
    }
    // A pull move gets a pull move, never legs or push.
    for (const o of hurtSwapOptions(byId("RW1"), ["SQ2", "PU1", "RW1"], ctx)) expect(o.pattern).toMatch(/_pull$/);
  });
});

describe("3.4 Not today, one workout per day", () => {
  const sched = () => weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });

  it("moves to the next free home day", () => {
    // plan: Mon, Wed, Fri. Not today on Mon → Tue
    expect(notToday(sched(), MON, new Set(), [])).toMatchObject({ from: MON, to: "2026-11-03" });
  });

  it("skips away days", () => {
    expect(notToday(sched(), MON, new Set(["2026-11-03"]), [])?.to).toBe("2026-11-05");
  });

  it("with no free day left, it's dropped with no mark", () => {
    const fri = "2026-11-06";
    const m = notToday(sched(), fri, new Set(["2026-11-07"]), [])!;
    expect(m.to).toBe("2026-11-08"); // Sunday is free
    const none = notToday(sched(), fri, new Set(["2026-11-07", "2026-11-08"]), []);
    expect(none).toMatchObject({ from: fri, to: null });
    const after = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(["2026-11-07", "2026-11-08"]), moves: [none!] });
    expect(after[fri]).toBeNull();
    expect(Object.values(after).filter(Boolean)).toHaveLength(2);
  });

  it("a moved workout keeps its session", () => {
    const m = notToday(sched(), MON, new Set(), [])!;
    const after = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [m] });
    expect(after[MON]).toBeNull();
    expect(after["2026-11-03"]).toBe("A");
  });

  it("never two workouts on one day", () => {
    expect(canStartWorkout([workout(MON)], MON)).toBe(false);
    expect(canStartWorkout([workout(MON, "part")], MON)).toBe(false);
    expect(canStartWorkout([workout(MON, "in_progress")], MON)).toBe(true);
    expect(canStartWorkout([workout(MON)], "2026-11-03")).toBe(true);
  });

  it("weekly count: home days only; a part workout counts", () => {
    const s = sched();
    expect(weekCount(s, [workout(MON, "part")], new Set())).toEqual({ planned: 3, done: 1 });
    const away = new Set(["2026-11-04"]);
    const s2 = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: away, moves: [] });
    expect(weekCount(s2, [], away).planned).toBe(3);
  });

  it("next workout skips done ones", () => {
    expect(nextWorkout(sched(), MON, [workout(MON)])).toEqual({ date: "2026-11-04", letter: "B" });
  });
});
