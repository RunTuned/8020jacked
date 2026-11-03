import { describe, expect, it } from "vitest";
import { CREATOR_ID, type Block, type MealLog, type WorkoutSession } from "../../types";
import { addDays } from "../dates";
import { activeWeeks, blockProgress, blockSummary, currentBlock, goalOptions, loseOffered, startBlock, type ActivityLogs } from "../phase";
import { EXERCISES } from "./fixtures";

const MON = "2026-11-02";
const block: Block = { creatorId: CREATOR_ID, id: "b1", goal: "lose", start: MON };
const meal = (date: string): MealLog => ({ creatorId: CREATOR_ID, date, slot: 0, kind: "plan", at: 0 });
const logsFor = (weeks: number[]): ActivityLogs => ({
  mealLogs: weeks.map((k) => meal(addDays(MON, 7 * k + 1))),
  workouts: [],
  weighIns: [],
  walks: [],
});

describe("12-week block counter", () => {
  it("weeks with no activity don't count", () => {
    // active in weeks 0, 1, 3 (week 2 empty); today in week 4
    const today = addDays(MON, 7 * 4 + 2);
    expect(activeWeeks(block, today, logsFor([0, 1, 3]), false)).toBe(3);
    expect(blockProgress(block, today, logsFor([0, 1, 3])).weekNumber).toBe(4);
  });

  it("done after 12 active weeks, even with gaps", () => {
    const weeks = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]; // week 5 off
    const today = addDays(MON, 7 * 12 + 6);
    const p = blockProgress(block, today, logsFor(weeks));
    expect(p.activeWeeks).toBe(12);
    expect(p.done).toBe(true);
    expect(blockProgress(block, addDays(MON, 7 * 11 + 6), logsFor(weeks)).done).toBe(false);
  });

  it("a taster or an unfinished workout isn't activity", () => {
    const w: WorkoutSession = { creatorId: CREATOR_ID, id: "t", date: MON, letter: "A", minutes: 8, status: "done", sets: [], moveEffort: {}, bigScreen: false, taster: true, startedAt: 0 };
    expect(activeWeeks(block, addDays(MON, 8), { mealLogs: [], workouts: [w], weighIns: [], walks: [] }, false)).toBe(0);
  });

  it("a goal change ends the block and starts a new 12 weeks", () => {
    const b = startBlock([block], "steady", "2026-12-01", "b2");
    expect(b).toHaveLength(2);
    expect(b[0].end).toBe("2026-11-30");
    expect(currentBlock(b)).toMatchObject({ id: "b2", goal: "steady", start: "2026-12-01" });
  });

  it('"Lose some weight" offered only with BMI room and fewer than 2 Lose blocks this year', () => {
    expect(loseOffered(false, [], MON, null)).toBe(false);
    expect(loseOffered(true, [], MON, null)).toBe(true);
    const two = [block, { ...block, id: "b0", start: "2026-06-01", end: "2026-08-23" }];
    expect(loseOffered(true, two, "2026-12-01", "steady")).toBe(false);
    expect(loseOffered(true, two, "2027-11-03", "steady")).toBe(true);
    expect(goalOptions(false)).not.toContain("lose");
  });
});

describe("C6 summary", () => {
  it("counts workouts, good weeks, strength ups and new skills", () => {
    const w = (date: string, values: [string, number][]): WorkoutSession => ({
      creatorId: CREATOR_ID, id: date, date, letter: "A", minutes: 15, status: "done", moveEffort: {}, bigScreen: false, taster: false, startedAt: 0,
      sets: values.map(([exerciseId, value], setIndex) => ({ creatorId: CREATOR_ID, exerciseId, setIndex, value, unit: "reps", planned: false, at: 0 })),
    });
    const logs: ActivityLogs = {
      mealLogs: [],
      workouts: [w(MON, [["SQ1", 8]]), w("2026-11-04", [["SQ1", 10]]), w("2026-11-09", [["SQ1", 12], ["SQ2", 10]])],
      weighIns: [
        { creatorId: CREATOR_ID, date: MON, kg: 80, at: 0 },
        { creatorId: CREATOR_ID, date: "2026-11-09", kg: 79, at: 0 },
      ],
      walks: [],
    };
    const s = blockSummary(block, "2026-11-10", logs, EXERCISES, 2);
    expect(s.workoutsDone).toBe(3);
    expect(s.goodWeeks).toBe(1); // 2 in week 1, 1 in week 2
    expect(s.strengthUps).toEqual([{ exerciseId: "SQ1", name: "Sit-to-stand", from: 8, to: 12 }]);
    expect(s.newSkills).toEqual(["Bodyweight squat"]);
    expect(s.averageChangeKg).toBeCloseTo(-1, 6);
  });
});
