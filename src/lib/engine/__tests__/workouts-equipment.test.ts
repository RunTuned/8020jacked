// QA fix A / 23: the equipment she has picks the main move of each pattern.
// These tests use the real exercise library on purpose: the bug was in how the engine ranks
// the real ladders (bodyweight ladders are longer, so they always won).
import { describe, expect, it } from "vitest";
import exercisesRaw from "@/content/exercises.json";
import { parseExercises } from "../content";
import type { Equipment, ISODate, SessionLetter } from "../../types";
import { buildSession, hurtSwapOptions, patternArea, weekSchedule, type SessionInput } from "../workouts";

const EXERCISES = parseExercises(exercisesRaw);
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const MON = "2026-11-02";

const session = (equipment: Equipment[], letter: SessionLetter, minutes: 10 | 20 | 35 = 35, p: Partial<SessionInput> = {}) =>
  buildSession({
    exercises: EXERCISES,
    equipment,
    ladderSteps: {},
    setAside: [],
    letter,
    minutes,
    extraSets: { legs: 0, push: 0, pull: 0, core: 0 },
    targets: {},
    easy: false,
    ...p,
  });

/** A full week (3 days) for one setup: date -> move ids. */
function week(equipment: Equipment[], minutes: 10 | 20 | 35 = 35): Record<ISODate, string[]> {
  const sched = weekSchedule({ weekStart: MON, planStart: MON, daysPerWeek: 3, awayDates: new Set(), moves: [] });
  const out: Record<ISODate, string[]> = {};
  for (const [d, l] of Object.entries(sched)) if (l) out[d] = session(equipment, l, minutes).moves.map((m) => m.exerciseId);
  return out;
}

const SETUPS: { name: string; equipment: Equipment[]; A: string[]; B: string[] }[] = [
  {
    name: "no equipment + floor",
    equipment: ["floor"],
    // bodyweight squat, wall push-up, prone Y-T raise, supported split squat,
    // elevated pike push-up (the only beginner vertical push: needs a chair), dead bug, glute bridge
    A: ["EX-002", "EX-031", "EX-051", "EX-021", "EX-044", "EX-073", "EX-010"],
    B: ["EX-010", "EX-051", "EX-031", "EX-021", "EX-069", "EX-073", "EX-002"],
  },
  {
    name: "bands + floor",
    equipment: ["floor", "bands"],
    // band squat, band chest press, band row, supported split squat (no band lunge),
    // band overhead press, Pallof press, band pull-through
    A: ["EX-007", "EX-039", "EX-057", "EX-021", "EX-047", "EX-081", "EX-018"],
    B: ["EX-018", "EX-057", "EX-039", "EX-021", "EX-070", "EX-081", "EX-007"],
  },
  {
    name: "dumbbells + floor",
    equipment: ["floor", "dumbbells"],
    // goblet squat, floor press, dumbbell row, reverse lunge, overhead press, suitcase carry, RDL
    A: ["EX-005", "EX-040", "EX-055", "EX-027", "EX-048", "EX-082", "EX-015"],
    // no dumbbell vertical pull: floor lat pull
    B: ["EX-015", "EX-055", "EX-040", "EX-027", "EX-069", "EX-082", "EX-005"],
  },
  {
    name: "dumbbells + no floor",
    equipment: ["dumbbells", "noFloor"],
    // bench press (seated) instead of the floor press
    A: ["EX-005", "EX-041", "EX-055", "EX-027", "EX-048", "EX-082", "EX-015"],
    // no vertical pull without the floor or a band: the next pattern fills in
    B: ["EX-015", "EX-055", "EX-041", "EX-027", "EX-082", "EX-005", "EX-001"],
  },
  {
    name: "no equipment + no floor",
    equipment: ["noFloor"],
    // sit-to-stand (chair, makes sense with no floor), wall push-up, door-frame row, supported split squat,
    // (no vertical push), wall plank, wall hip hinge, then wall sit fills in
    A: ["EX-001", "EX-031", "EX-090", "EX-021", "EX-093", "EX-091", "EX-088"],
    B: ["EX-091", "EX-090", "EX-031", "EX-021", "EX-093", "EX-001", "EX-088"],
  },
];

describe("QA A: equipment picks the main move (full week per setup)", () => {
  for (const s of SETUPS) {
    it(`${s.name}: workout A and B`, () => {
      const w = week(s.equipment);
      const days = Object.keys(w).sort();
      expect(days).toHaveLength(3);
      // Mon A, Wed B, Fri A
      expect(w[days[0]]).toEqual(s.A);
      expect(w[days[1]]).toEqual(s.B);
      expect(w[days[2]]).toEqual(s.A);
    });
  }

  it("dumbbell users get a dumbbell main move in every pattern the library has one for", () => {
    for (const equipment of [["floor", "dumbbells"], ["floor", "dumbbells", "bands"]] as Equipment[][]) {
      for (const letter of ["A", "B", "C"] as const) {
        const moves = session(equipment, letter).moves;
        for (const pattern of new Set(moves.map((m) => m.pattern))) {
          const first = moves.find((m) => m.pattern === pattern)!;
          const hasDb = EXERCISES.some((e) => e.pattern === pattern && e.kit === "dumbbell");
          if (hasDb) expect(byId(first.exerciseId).kit, `${letter} ${pattern}`).toBe("dumbbell");
        }
      }
    }
  });

  it("band users get a band main move where there is a band ladder", () => {
    for (const letter of ["A", "B", "C"] as const) {
      const moves = session(["floor", "bands"], letter).moves;
      for (const pattern of new Set(moves.map((m) => m.pattern))) {
        const first = moves.find((m) => m.pattern === pattern)!;
        const hasBand = EXERCISES.some((e) => e.pattern === pattern && e.kit === "band");
        if (hasBand) expect(byId(first.exerciseId).kit, `${letter} ${pattern}`).toBe("band");
      }
    }
  });

  it("dumbbells and bands together: dumbbells first, a band where there's no dumbbell move", () => {
    const b = session(["floor", "dumbbells", "bands"], "B").moves.map((m) => m.exerciseId);
    expect(b).toEqual(["EX-015", "EX-055", "EX-040", "EX-027", "EX-070", "EX-082", "EX-005"]);
  });

  it("a chair move shows up for floor users only where nothing else fits a beginner", () => {
    for (const equipment of [["floor"], ["floor", "bands"], ["floor", "dumbbells"]] as Equipment[][]) {
      for (const letter of ["A", "B", "C"] as const) {
        for (const minutes of [10, 20, 35] as const) {
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
      for (const letter of ["A", "B", "C"] as const)
        for (const m of session(s.equipment, letter).moves) expect(byId(m.exerciseId).level, `${s.name} ${m.exerciseId}`).toBe("beginner");
  });

  it("progress on a bodyweight ladder still follows the ladder (chair rungs included)", () => {
    const m = session(["floor"], "A", 35, { ladderSteps: { lunge_bw: 4 } }).moves.find((x) => x.pattern === "lunge")!;
    expect(m.exerciseId).toBe("EX-024"); // rear-foot-elevated split squat, a chair rung she has stepped up to
  });
});

describe("QA: Hurts swaps stay in the same body area", () => {
  const ctx = (equipment: Equipment[]) => ({ exercises: EXERCISES, equipment, ladderSteps: {}, setAside: [] as string[] });

  it("never offers a move from another body area, for every move in every setup", () => {
    for (const s of SETUPS) {
      for (const letter of ["A", "B", "C"] as const) {
        const moves = session(s.equipment, letter).moves;
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
