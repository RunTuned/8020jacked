import { describe, expect, it } from "vitest";
import {
  CREATOR_ID,
  type Adjustments,
  type CheckIn,
  type CheckInChangeKind,
  type ClothesAnswer,
  type WeighIn,
} from "../../types";
import {
  applyChange,
  checkInDate,
  checkInDue,
  COPY,
  evaluateCheckIn,
  foodChangesInBlock,
  sameAnswerRunning,
  weightStalled,
  wordCount,
  type CheckInInput,
  type WeekStats,
} from "../checkin";
import { addDays } from "../dates";

const D = "2026-11-29"; // a Sunday
const w = (date: string, kg: number): WeighIn => ({ creatorId: CREATOR_ID, date, kg, at: 0 });
const adj = (p: Partial<Adjustments> = {}): Adjustments => ({
  creatorId: CREATOR_ID,
  kcalDelta: 0,
  sideDelta: 0,
  extraSets: { legs: 0, push: 0, pull: 0, core: 0 },
  speedBrakeOn: null,
  ...p,
});
const week = (p: Partial<WeekStats> = {}): WeekStats => ({
  workoutsPlanned: 3,
  workoutsDone: 2,
  mealsPlanned: 21,
  mealsLogged: 15,
  walks: 2,
  awayDays: 0,
  anyActivity: true,
  ...p,
});
const ci = (date: string, kind: CheckInChangeKind, accepted = true, answers: CheckIn["answers"] = []): CheckIn => ({
  creatorId: CREATOR_ID,
  date,
  answers,
  accepted,
  at: 0,
  result: {
    date,
    change: { kind },
    copy: "",
    why: [],
    counts: true,
    askNormalNow: null,
    facts: {
      workoutsDone: 0,
      workoutsPlanned: 0,
      mealsLogged: 0,
      mealsPlanned: 0,
      walks: 0,
      weighIns: 0,
      averageKg: null,
      changeSinceStartKg: null,
      rule: "",
    },
  },
});
const clothes = (date: string, feel: ClothesAnswer["feel"]): ClothesAnswer => ({ creatorId: CREATOR_ID, date, feel });

/** 3 weigh-ins in each of the 4 weeks to D, all at `kgs[k]` (k = weeks back). */
function weighWeeks(kgs: number[]): WeighIn[] {
  return kgs.flatMap((kg, k) => [0, 2, 4].map((o) => w(addDays(D, -7 * k - o), kg)));
}

/** 3 weigh-ins a week for 4 weeks, losing `perWeek` kg a week smoothly (no day-to-day jumps). */
function weighLinear(start: number, perWeek: number): WeighIn[] {
  return [0, 1, 2, 3].flatMap((k) =>
    [0, 2, 4].map((o) => {
      const daysBack = 7 * k + o;
      return w(addDays(D, -daysBack), start - (perWeek * (27 - daysBack)) / 7);
    }),
  );
}

// Woman 40, 165 cm, 75 kg: maintenance 1988.35 (see food.test.ts).
const base = (p: Partial<CheckInInput> = {}): CheckInInput => ({
  date: D,
  goal: "lose",
  cookOrBuy: "cook",
  heightCm: 165,
  setupKg: 75,
  weighIns: [],
  clothesHistory: [],
  answers: ["nothing"],
  history: [],
  week: week(),
  lastWeek: week(),
  ratings: ["just_right"],
  adjustments: adj(),
  maintenance: 1988.35,
  block: { creatorId: CREATOR_ID, id: "b1", goal: "lose", start: "2026-11-02" },
  minutes: 20,
  fasting: false,
  ...p,
});

describe("3.3 when the check-in comes", () => {
  it("Sunday by default; the latest check-in day on or before today", () => {
    expect(checkInDate("2026-11-29", 6)).toBe("2026-11-29");
    expect(checkInDate("2026-12-01", 6)).toBe("2026-11-29");
  });

  it("first check-in at least 7 days after the plan starts", () => {
    // plan starts Mon 2 Nov; Sun 8 Nov is only 6 days in → no; Sun 15 Nov → yes
    expect(checkInDue("2026-11-08", 6, "2026-11-02", [])).toBeNull();
    expect(checkInDue("2026-11-15", 6, "2026-11-02", [])).toBe("2026-11-15");
  });

  it("the banner stays up for 3 days, and goes once done", () => {
    expect(checkInDue("2026-11-18", 6, "2026-11-02", [])).toBe("2026-11-15");
    expect(checkInDue("2026-11-19", 6, "2026-11-02", [])).toBeNull();
    expect(checkInDue("2026-11-16", 6, "2026-11-02", [ci("2026-11-15", "same")])).toBeNull();
  });
});

describe("C1b: nothing logged", () => {
  it("same plan, fresh start; the week doesn't count", () => {
    const r = evaluateCheckIn(base({ week: week({ anyActivity: false, workoutsDone: 0, mealsLogged: 0 }) }));
    expect(r.change.kind).toBe("nothing_logged");
    expect(r.copy).toBe("Nothing logged this week. Same plan, fresh start.");
    expect(r.counts).toBe(false);
  });
});

describe("priority 1: safety", () => {
  it("speed brake → +150, ahead of any food or training change", () => {
    const r = evaluateCheckIn(
      base({
        weighIns: [w("2026-11-23", 76), w("2026-11-25", 75.6), w("2026-11-29", 74.8)], // 1.2 kg in 6 days
        week: week({ workoutsDone: 3 }),
        lastWeek: week({ workoutsDone: 3 }),
      }),
    );
    expect(r.change).toEqual({ kind: "speed_brake", kcalDelta: 150, sideDelta: 0 });
  });

  it("buyers get one more side instead", () => {
    const r = evaluateCheckIn(base({ cookOrBuy: "buy", weighIns: [w("2026-11-23", 76), w("2026-11-29", 74.8)] }));
    expect(r.change.sideDelta).toBe(1);
    expect(r.copy).toMatch(/add one side/);
  });

  it("a brake already fired this week is the week's one change", () => {
    const r = evaluateCheckIn(base({ adjustments: adj({ speedBrakeOn: "2026-11-26" }), history: [ci("2026-11-22", "same")] }));
    expect(r.change.kind).toBe("speed_brake_already");
  });

  it("speed brake doesn't run on Keep steady", () => {
    const r = evaluateCheckIn(base({ goal: "steady", weighIns: [w("2026-11-23", 76), w("2026-11-29", 74.8)] }));
    expect(r.change.kind).not.toBe("speed_brake");
  });

  it("average weight reaching BMI 20 on Lose → Switch to Keep steady", () => {
    // 165 cm: BMI 20 = 54.45 kg
    const r = evaluateCheckIn(base({ weighIns: [w("2026-11-27", 54.4), w("2026-11-29", 54.4)], setupKg: 60 }));
    expect(r.change).toEqual({ kind: "switch_to_steady", newGoal: "steady" });
  });
});

describe("priority 2: food (Lose some weight only)", () => {
  it("weight stall: 3+ weigh-ins and the average hasn't dropped 0.25% a week for 3 weeks → −150", () => {
    expect(weightStalled(weighWeeks([75, 75, 75, 75]), D)).toBe(true);
    const r = evaluateCheckIn(base({ weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.change).toEqual({ kind: "food_down", kcalDelta: -150, sideDelta: 0 });
    expect(r.copy).toBe(COPY.foodDown);
  });

  it("a steady 0.25%+ drop each week → no food change", () => {
    // 0.5 kg a week ≥ 0.25% of 75 (0.19 kg), and under the 1% speed brake (0.75 kg)
    expect(weightStalled(weighLinear(75, 0.5), D)).toBe(false);
    expect(evaluateCheckIn(base({ weighIns: weighLinear(75, 0.5) })).change.kind).toBe("same");
    // 0.1 kg a week is under 0.25% → stalled
    expect(weightStalled(weighLinear(75, 0.1), D)).toBe(true);
  });

  it("one week with under 3 weigh-ins breaks the run", () => {
    const l = weighWeeks([75, 75, 75, 75]).filter((x) => !(x.date >= "2026-11-09" && x.date <= "2026-11-14"));
    expect(weightStalled(l, D)).toBe(false);
  });

  it("no weigh-ins: clothes Same 3 weeks running → −150", () => {
    const r = evaluateCheckIn(
      base({ clothes: "same", clothesHistory: [clothes("2026-11-15", "same"), clothes("2026-11-22", "same")] }),
    );
    expect(r.change.kind).toBe("food_down");
    expect(r.facts.rule).toBe("clothes_same");
  });

  it("clothes Same only 2 weeks → no change", () => {
    expect(evaluateCheckIn(base({ clothes: "same", clothesHistory: [clothes("2026-11-22", "same")] })).change.kind).toBe("same");
  });

  it("clothes Looser → no change", () => {
    const r = evaluateCheckIn(
      base({ clothes: "looser", clothesHistory: [clothes("2026-11-15", "same"), clothes("2026-11-22", "same")] }),
    );
    expect(r.change.kind).toBe("same");
  });

  it("clothes Tighter 2 weeks running → no cuts, kind words", () => {
    const r = evaluateCheckIn(base({ clothes: "tighter", clothesHistory: [clothes("2026-11-22", "tighter")] }));
    expect(r.change.kind).toBe("same");
    expect(r.copy).toBe(COPY.tighter);
    expect(r.copy.startsWith("Your plan stays the same.")).toBe(true);
  });

  it("under 3 weigh-ins this week: the clothes rules apply", () => {
    const r = evaluateCheckIn(
      base({
        weighIns: [w("2026-11-27", 75), w("2026-11-29", 75)],
        clothes: "same",
        clothesHistory: [clothes("2026-11-15", "same"), clothes("2026-11-22", "same")],
      }),
    );
    expect(r.change.kind).toBe("food_down");
  });

  it("at most 3 food changes per 12 weeks (declined ones don't count)", () => {
    const history = [ci("2026-11-08", "food_down"), ci("2026-11-15", "food_down"), ci("2026-11-22", "food_down", false)];
    expect(foodChangesInBlock(history, base().block)).toBe(2);
    const capped = [ci("2026-10-04", "food_down"), ci("2026-10-11", "food_down"), ci("2026-11-01", "food_down")];
    const block = { creatorId: CREATOR_ID, id: "b0", goal: "lose" as const, start: "2026-09-28" };
    const r = evaluateCheckIn(base({ block, history: capped, weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.change.kind).toBe("same");
    expect(r.facts.rule).toBe("food_cap");
  });

  it("food changes from an earlier 12 weeks don't count", () => {
    const old = [ci("2026-08-02", "food_down"), ci("2026-08-09", "food_down"), ci("2026-08-16", "food_down")];
    expect(evaluateCheckIn(base({ history: old, weighIns: weighWeeks([75, 75, 75, 75]) })).change.kind).toBe("food_down");
  });

  it("never below the floor", () => {
    // 1988.35 - 397.67 - 150 = 1440.68 → already held at 1500; another cut changes nothing
    const r = evaluateCheckIn(base({ adjustments: adj({ kcalDelta: -150 }), weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.change.kind).toBe("same");
    expect(r.facts.rule).toBe("floor");
  });

  it("the last food change needs 3 weeks to settle", () => {
    const r = evaluateCheckIn(base({ history: [ci("2026-11-15", "food_down")], weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.facts.rule).toBe("recent_food_change");
  });

  it("Sore, bad sleep, busy or fasting: no food change, said plainly", () => {
    for (const a of ["sore", "bad_sleep", "busy", "fasting"] as const) {
      const r = evaluateCheckIn(base({ answers: [a], weighIns: weighWeeks([75, 75, 75, 75]) }));
      expect(r.change.kind).not.toBe("food_down");
    }
    const busy = evaluateCheckIn(base({ answers: ["busy"], weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(busy.copy).toBe("It was a busy week, so your meals stay the same this week. That's fine.");
  });

  it("little logging or an away week = no food change", () => {
    const low = evaluateCheckIn(base({ week: week({ mealsLogged: 5 }), weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(low.facts.rule).toBe("little_logging");
    const away = evaluateCheckIn(base({ week: week({ awayDays: 4 }), weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(away.facts.rule).toBe("away_week");
  });

  it("buyers: a food change removes a side, never 'make it smaller'", () => {
    const r = evaluateCheckIn(base({ cookOrBuy: "buy", weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.change.sideDelta).toBe(-1);
    expect(r.copy).toBe(COPY.foodDownBuy);
    expect(r.copy).not.toMatch(/smaller/);
  });

  it("Keep steady and Get stronger never get a food change", () => {
    for (const goal of ["steady", "stronger"] as const) {
      expect(evaluateCheckIn(base({ goal, weighIns: weighWeeks([75, 75, 75, 75]) })).change.kind).not.toBe("food_down");
    }
  });
});

describe("priority 3: training", () => {
  const allDone = { week: week({ workoutsDone: 3 }), lastWeek: week({ workoutsDone: 3 }) };

  it("all workouts done 2 weeks and rated Just right / Too easy → one step up", () => {
    const r = evaluateCheckIn(base({ ...allDone, ratings: ["just_right", "too_easy"] }));
    expect(r.change).toEqual({ kind: "training_up", area: "legs" });
    expect(r.copy).toBe("Meals stay the same. Legs get one extra set.");
  });

  it("the next step up goes to the next area", () => {
    const r = evaluateCheckIn(base({ ...allDone, adjustments: adj({ extraSets: { legs: 1, push: 0, pull: 0, core: 0 } }) }));
    expect(r.change.area).toBe("push");
  });

  it("any Too hard → no step up", () => {
    expect(evaluateCheckIn(base({ ...allDone, ratings: ["just_right", "too_hard"] })).change.kind).toBe("same");
  });

  it("only 1 of the 2 weeks complete → no step up", () => {
    expect(evaluateCheckIn(base({ week: week({ workoutsDone: 3 }) })).change.kind).toBe("same");
  });

  it("under half done → easier (a shorter default), never harder", () => {
    const r = evaluateCheckIn(base({ goal: "steady", week: week({ workoutsDone: 1 }) }));
    expect(r.change).toEqual({ kind: "training_easier", minutes: 10 });
    const r35 = evaluateCheckIn(base({ goal: "steady", minutes: 35, week: week({ workoutsDone: 1 }) }));
    expect(r35.change.minutes).toBe(20);
    // already at 10 minutes → same plan
    expect(evaluateCheckIn(base({ goal: "steady", minutes: 10, week: week({ workoutsDone: 0 }) })).change.kind).toBe("same");
  });

  it("food beats training in the priority order", () => {
    const r = evaluateCheckIn(base({ ...allDone, weighIns: weighWeeks([75, 75, 75, 75]) }));
    expect(r.change.kind).toBe("food_down");
  });
});

describe("C8: same answer 3 weeks running", () => {
  const history = [ci("2026-11-15", "same", true, ["busy"]), ci("2026-11-22", "same", true, ["busy", "sore"])];

  it("asks 'Is this your normal now?'", () => {
    expect(sameAnswerRunning(["busy"], history, D)).toBe("busy");
    expect(sameAnswerRunning(["sore"], history, D)).toBeNull();
    expect(sameAnswerRunning(["nothing"], [ci("2026-11-15", "same", true, ["nothing"]), ci("2026-11-22", "same", true, ["nothing"])], D)).toBeNull();
    expect(evaluateCheckIn(base({ answers: ["busy"], history })).askNormalNow).toBe("busy");
  });

  it("Yes, plan around it → shorter workouts", () => {
    const r = evaluateCheckIn(base({ goal: "steady", answers: ["busy"], history, normalNow: true }));
    expect(r.change).toEqual({ kind: "plan_around_it", minutes: 10 });
  });

  it("No, it will pass → the usual rules", () => {
    const r = evaluateCheckIn(base({ goal: "steady", answers: ["busy"], history, normalNow: false }));
    expect(r.change.kind).toBe("same");
  });

  it("fasting as the normal → fasting mode", () => {
    const fh = [ci("2026-11-15", "same", true, ["fasting"]), ci("2026-11-22", "same", true, ["fasting"])];
    expect(evaluateCheckIn(base({ answers: ["fasting"], history: fh, normalNow: true })).change).toEqual({
      kind: "plan_around_it",
      fasting: true,
    });
  });
});

describe("copy rules", () => {
  it("every result is 25 words or fewer, with no calories or numbers of kcal", () => {
    const inputs: Partial<CheckInInput>[] = [
      {},
      { week: week({ anyActivity: false }) },
      { weighIns: [w("2026-11-23", 76), w("2026-11-29", 74.8)] },
      { weighIns: [w("2026-11-27", 54.4)] },
      { weighIns: weighWeeks([75, 75, 75, 75]) },
      { cookOrBuy: "buy", weighIns: weighWeeks([75, 75, 75, 75]) },
      { clothes: "tighter", clothesHistory: [clothes("2026-11-22", "tighter")] },
      { answers: ["bad_sleep"] },
      { week: week({ workoutsDone: 3 }), lastWeek: week({ workoutsDone: 3 }) },
      { goal: "steady", week: week({ workoutsDone: 0 }) },
    ];
    for (const p of inputs) {
      const r = evaluateCheckIn(base(p));
      expect(wordCount(r.copy)).toBeLessThanOrEqual(25);
      expect(r.copy).not.toMatch(/calorie|kcal|deficit|streak|missed/i);
      for (const why of r.why) expect(why).not.toMatch(/calorie|kcal|deficit/i);
    }
  });
});

describe("applyChange", () => {
  it("adds food and training changes to the running adjustments", () => {
    let a = applyChange(adj(), { kind: "food_down", kcalDelta: -150, sideDelta: -1 }, D);
    expect(a.kcalDelta).toBe(-150);
    expect(a.sideDelta).toBe(-1);
    a = applyChange(a, { kind: "speed_brake", kcalDelta: 150, sideDelta: 1 }, D);
    expect(a.kcalDelta).toBe(0);
    expect(a.speedBrakeOn).toBe(D);
    a = applyChange(a, { kind: "training_up", area: "legs" }, D);
    expect(a.extraSets.legs).toBe(1);
    expect(applyChange(a, { kind: "same" }, D)).toBe(a);
  });
});
