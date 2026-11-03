// QA fix A / 23: the equipment she has picks the main move of each pattern.
// These tests use the real exercise library on purpose: the bug was in how the engine ranks
// the real ladders (bodyweight ladders are longer, so they always won).
import { describe, expect, it } from "vitest";
import exercisesRaw from "@/content/exercises.json";
import { parseExercises } from "../content";
import type { Equipment, ISODate, SessionLetter, SessionMinutes } from "../../types";
import { buildSession, hurtSwapOptions, patternArea, patternFamily, setsPerFamily, weekSchedule, type SessionInput } from "../workouts";

const EXERCISES = parseExercises(exercisesRaw);
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const MON = "2026-11-02";

const session = (equipment: Equipment[], letter: SessionLetter, minutes: SessionMinutes = 15, p: Partial<SessionInput> = {}) =>
  buildSession({
    exercises: EXERCISES,
    equipment,
    ladderSteps: {},
    setAside: [],
    letter,
    minutes,
    targets: {},
    easy: false,
    ...p,
  });

const LENGTHS: SessionMinutes[] = [8, 15, 25];

/** A full week (3 days) for one setup: date -> move ids. */
function week(equipment: Equipment[], minutes: SessionMinutes = 15): Record<ISODate, string[]> {
  const sched = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });
  const out: Record<ISODate, string[]> = {};
  for (const [d, l] of Object.entries(sched)) if (l) out[d] = session(equipment, l, minutes).moves.map((m) => m.exerciseId);
  return out;
}

/** The 4 main moves: squat or lunge, push, pull, hinge. */
const SETUPS: { name: string; equipment: Equipment[]; A: string[]; B: string[]; core: string }[] = [
  {
    name: "no equipment + floor",
    equipment: ["floor"],
    // bodyweight squat, wall push-up, prone Y-T raise, glute bridge
    A: ["EX-002", "EX-031", "EX-090", "EX-010"],
    // supported split squat, elevated pike push-up (the only beginner vertical push: needs a chair),
    // floor lat pull, wall hip hinge (the other hinge ladder)
    B: ["EX-021", "EX-044", "EX-069", "EX-091"],
    core: "EX-073", // dead bug
  },
  {
    name: "bands + floor",
    equipment: ["floor", "bands"],
    A: ["EX-007", "EX-039", "EX-057", "EX-018"], // band squat, chest press, row, pull-through
    // supported split squat (no band lunge), band overhead press, band lat pulldown, glute bridge
    B: ["EX-021", "EX-047", "EX-070", "EX-010"],
    core: "EX-081", // Pallof press
  },
  {
    name: "dumbbells + floor",
    equipment: ["floor", "dumbbells"],
    A: ["EX-005", "EX-040", "EX-055", "EX-015"], // goblet squat, floor press, row, Romanian deadlift
    // reverse lunge, overhead press, floor lat pull (no dumbbell vertical pull), hip thrust
    B: ["EX-027", "EX-048", "EX-069", "EX-019"],
    core: "EX-073",
  },
  {
    name: "dumbbells + no floor",
    equipment: ["dumbbells", "noFloor"],
    A: ["EX-005", "EX-041", "EX-055", "EX-015"], // bench press (seated) instead of the floor press
    // no vertical pull without the floor or a band: the same row; wall hip hinge (hip thrust is on the floor)
    B: ["EX-027", "EX-048", "EX-055", "EX-091"],
    core: "EX-093", // wall plank
  },
  {
    name: "no equipment + no floor",
    equipment: ["noFloor"],
    A: ["EX-001", "EX-031", "EX-090", "EX-091"], // sit-to-stand, wall push-up, door-frame row, wall hip hinge
    // only the lunge changes: no beginner vertical push or pull, no other beginner hinge
    B: ["EX-021", "EX-031", "EX-090", "EX-091"],
    core: "EX-093",
  },
];

describe("minimum dose: the same 4 moves, A and B, sets by length", () => {
  for (const s of SETUPS) {
    it(`${s.name}: workout A and B over a week`, () => {
      const w = week(s.equipment);
      const days = Object.keys(w).sort();
      expect(days).toHaveLength(3);
      // Mon A, Wed B, Fri A
      expect(w[days[0]]).toEqual(s.A);
      expect(w[days[1]]).toEqual(s.B);
      expect(w[days[2]]).toEqual(s.A);
    });

    it(`${s.name}: 4 main moves in every session, one per pattern, at every length`, () => {
      for (const letter of ["A", "B"] as const) {
        for (const minutes of LENGTHS) {
          const main = session(s.equipment, letter, minutes).moves.filter((m) => m.pattern !== "core");
          expect(main.map((m) => m.exerciseId), `${letter} ${minutes}`).toEqual(s[letter]);
          expect(main.map((m) => patternFamily(m.pattern))).toEqual(["squat_lunge", "push", "pull", "hinge"]);
        }
      }
    });

    it(`${s.name}: length changes the sets only; the core move only on Long`, () => {
      for (const letter of ["A", "B"] as const) {
        const short = session(s.equipment, letter, 8);
        const std = session(s.equipment, letter, 15);
        const long = session(s.equipment, letter, 25);
        for (const m of short.moves) expect(m.sets).toHaveLength(1);
        for (const m of std.moves) expect(m.sets).toHaveLength(2);
        const longMain = long.moves.slice(0, 4);
        for (const m of longMain) expect(m.sets).toHaveLength(3);
        expect(short.moves).toHaveLength(4);
        expect(std.moves).toHaveLength(4);
        expect(long.moves).toHaveLength(5);
        expect(long.moves[4].exerciseId).toBe(s.core);
        expect(long.moves[4].sets.length).toBeGreaterThanOrEqual(2);
        expect(long.moves[4].sets.length).toBeLessThanOrEqual(3);
        for (const x of [short, std]) expect(x.moves.some((m) => m.pattern === "core")).toBe(false);
        for (const m of [...short.moves, ...std.moves, ...long.moves]) expect(m.restSeconds).toBe(45);
      }
    });

    it(`${s.name}: about 8, 15 and 25 minutes`, () => {
      for (const letter of ["A", "B"] as const) {
        expect(session(s.equipment, letter, 8).estMinutes).toBe(8);
        expect(session(s.equipment, letter, 15).estMinutes).toBe(15);
        expect(session(s.equipment, letter, 25).estMinutes).toBe(25);
      }
    });

    it(`${s.name}: 3 Standard days give 6 sets a week per pattern`, () => {
      const sched = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });
      const sessions = Object.values(sched)
        .filter((l): l is SessionLetter => !!l)
        .map((l) => session(s.equipment, l, 15));
      expect(sessions).toHaveLength(3);
      const per = setsPerFamily(sessions);
      expect(per.squat_lunge).toBe(6);
      expect(per.push).toBe(6);
      expect(per.pull).toBe(6);
      expect(per.hinge).toBe(6);
      expect(per.core).toBe(0);
    });
  }

  it("A and B differ where the content allows", () => {
    for (const s of SETUPS) {
      const a = session(s.equipment, "A").moves;
      const b = session(s.equipment, "B").moves;
      // the knee move always alternates: squat in A, lunge in B
      expect(a[0].pattern, s.name).toBe("squat");
      expect(b[0].pattern, s.name).toBe("lunge");
      expect(a[1].pattern).toBe("horizontal_push");
      expect(a[2].pattern).toBe("horizontal_pull");
    }
    const b = (eq: Equipment[]) => session(eq, "B").moves.map((m) => m.pattern);
    // with a floor or a band there is a beginner vertical push and pull
    expect(b(["floor"])).toEqual(["lunge", "vertical_push", "vertical_pull", "hinge"]);
    expect(b(["floor", "bands"])).toEqual(["lunge", "vertical_push", "vertical_pull", "hinge"]);
    expect(b(["floor", "dumbbells"])).toEqual(["lunge", "vertical_push", "vertical_pull", "hinge"]);
    // no floor, no band: no vertical pull, so the same row
    expect(b(["dumbbells", "noFloor"])).toEqual(["lunge", "vertical_push", "horizontal_pull", "hinge"]);
    expect(b(["noFloor"])).toEqual(["lunge", "horizontal_push", "horizontal_pull", "hinge"]);
    // the hinge variant: a different ladder where there is a beginner one
    for (const s of SETUPS.slice(0, 4)) {
      const ha = byId(session(s.equipment, "A").moves[3].exerciseId);
      const hb = byId(session(s.equipment, "B").moves[3].exerciseId);
      expect(hb.ladder, s.name).not.toBe(ha.ladder);
    }
    expect(session(["floor", "dumbbells"], "A").moves[3].name).toMatch(/Romanian deadlift/);
    expect(session(["floor", "dumbbells"], "B").moves[3].name).toMatch(/hip thrust/);
  });

  it("4-day plans alternate A and B (there is no C)", () => {
    const sched = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 4, awayDates: new Set(), moves: [] });
    expect(Object.values(sched).filter(Boolean)).toEqual(["A", "B", "A", "B"]);
  });

  it("dumbbell users get a dumbbell main move in every pattern the library has one for", () => {
    for (const equipment of [["floor", "dumbbells"], ["floor", "dumbbells", "bands"]] as Equipment[][]) {
      for (const letter of ["A", "B"] as const) {
        for (const m of session(equipment, letter).moves) {
          const hasDb = EXERCISES.some((e) => e.pattern === m.pattern && e.kit === "dumbbell");
          if (hasDb) expect(byId(m.exerciseId).kit, `${letter} ${m.pattern}`).toBe("dumbbell");
        }
      }
    }
  });

  it("band users get a band main move where there is a band ladder (the B hinge is the other ladder)", () => {
    for (const letter of ["A", "B"] as const) {
      for (const m of session(["floor", "bands"], letter).moves) {
        if (letter === "B" && m.pattern === "hinge") continue;
        const hasBand = EXERCISES.some((e) => e.pattern === m.pattern && e.kit === "band");
        if (hasBand) expect(byId(m.exerciseId).kit, `${letter} ${m.pattern}`).toBe("band");
      }
    }
  });

  it("dumbbells and bands together: dumbbells first, a band where there's no dumbbell move", () => {
    const b = session(["floor", "dumbbells", "bands"], "B", 25).moves.map((m) => m.exerciseId);
    expect(b).toEqual(["EX-027", "EX-048", "EX-070", "EX-019", "EX-081"]);
  });

  it("a chair move shows up for floor users only where nothing else fits a beginner", () => {
    for (const equipment of [["floor"], ["floor", "bands"], ["floor", "dumbbells"]] as Equipment[][]) {
      for (const letter of ["A", "B"] as const) {
        for (const minutes of LENGTHS) {
          for (const m of session(equipment, letter, minutes).moves) {
            if (byId(m.exerciseId).kit === "chair") expect(m.exerciseId, `${equipment} ${letter}`).toBe("EX-044");
          }
        }
      }
    }
    // Sit-to-stand is never her first squat when she has a floor.
    expect(session(["floor"], "A").moves[0].exerciseId).toBe("EX-002");
  });

  it("every first pick is a beginner move", () => {
    for (const s of SETUPS)
      for (const letter of ["A", "B"] as const)
        for (const m of session(s.equipment, letter, 25).moves) expect(byId(m.exerciseId).level, `${s.name} ${m.exerciseId}`).toBe("beginner");
  });

  it("progress on a bodyweight ladder still follows the ladder (chair rungs included)", () => {
    const m = session(["floor"], "B", 15, { ladderSteps: { lunge_bw: 4 } }).moves.find((x) => x.pattern === "lunge")!;
    expect(m.exerciseId).toBe("EX-024"); // rear-foot-elevated split squat, a chair rung she has stepped up to
    const core = session(["floor"], "A", 25, { ladderSteps: { core_front: 3 } }).moves[4];
    expect(core.exerciseId).toBe("EX-075"); // plank, her step on the dead bug ladder
  });
});

describe("QA: Hurts swaps stay in the same body area", () => {
  const ctx = (equipment: Equipment[]) => ({ exercises: EXERCISES, equipment, ladderSteps: {}, setAside: [] as string[] });

  it("never offers a move from another body area, for every move in every setup", () => {
    for (const s of SETUPS) {
      for (const letter of ["A", "B"] as const) {
        const moves = session(s.equipment, letter, 25).moves;
        const ids = moves.map((m) => m.exerciseId);
        for (const m of moves) {
          const hurt = byId(m.exerciseId);
          const opts = hurtSwapOptions(hurt, ids, ctx(s.equipment));
          for (const o of opts) {
            expect(patternArea(o.pattern), `${s.name}: ${hurt.id} -> ${o.id}`).toBe(patternArea(hurt.pattern));
            expect(ids).not.toContain(o.id);
            expect(o.id).not.toBe(hurt.id);
          }
        }
      }
    }
  });

  it("same pattern first (its swaps, then the ladder), never a harder rung of the same ladder", () => {
    const opts = hurtSwapOptions(byId("EX-055"), ["EX-055"], ctx(["floor", "dumbbells"]));
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o.pattern).toBe("horizontal_pull");
    const sq = hurtSwapOptions(byId("EX-002"), ["EX-002"], ctx(["floor"]));
    expect(sq[0].id).toBe("EX-001"); // its listed swap: sit-to-stand, an easier rung
    for (const o of sq) if (o.ladder === "squat_bw") expect(o.ladderStep).toBeLessThan(2);
  });

  it("a pull or core move gets a pull or core swap (they used to jump to legs or push)", () => {
    const pull = hurtSwapOptions(byId("EX-051"), ["EX-051"], ctx(["floor"]));
    expect(pull.length).toBeGreaterThan(0);
    for (const o of pull) expect(patternArea(o.pattern)).toBe("pull");
    const core = hurtSwapOptions(byId("EX-073"), ["EX-073"], ctx(["floor"]));
    expect(core.length).toBeGreaterThan(0);
    for (const o of core) expect(patternArea(o.pattern)).toBe("core");
  });
});
