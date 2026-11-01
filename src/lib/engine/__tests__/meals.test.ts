import { describe, expect, it } from "vitest";
import { CREATOR_ID, type DayPlan, type MealLog } from "../../types";
import { appToday, insteadOption, mealsLoggedCount, nextMeal, upsertMealLog } from "../meals";

const D = "2026-11-02";
const day: DayPlan = {
  date: D,
  away: false,
  workout: null,
  meals: [0, 1, 2].map((index) => ({
    date: D,
    index,
    label: `Meal ${index + 1}`,
    mealType: index === 0 ? "breakfast" : "main",
    source: "cook",
    checkLabel: false,
    swapped: false,
  })),
};
const log = (slot: number, at = 0, date = D): MealLog => ({ creatorId: CREATOR_ID, date, slot, kind: "plan", at });

describe("3.6 next meal", () => {
  it("is the first unlogged meal today", () => {
    expect(nextMeal(day, [])?.index).toBe(0);
    expect(nextMeal(day, [log(0)])?.index).toBe(1);
    expect(nextMeal(day, [log(0), log(1), log(2)])).toBeNull();
    expect(nextMeal(day, [log(0, 0, "2026-11-01")])?.index).toBe(0);
  });

  it('"Meal 3 instead" jumps, and the offer is the next unlogged one after', () => {
    const cur = nextMeal(day, [log(0)])!;
    expect(insteadOption(day, [log(0)], cur)?.label).toBe("Meal 3");
    expect(nextMeal(day, [log(0)], 2)?.index).toBe(2);
    // jumping to a logged meal falls back to the first unlogged
    expect(nextMeal(day, [log(0)], 0)?.index).toBe(1);
    expect(insteadOption(day, [log(0), log(2)], nextMeal(day, [log(0), log(2)]))).toBeNull();
  });

  it("one log per meal; a later one replaces the earlier", () => {
    const l = upsertMealLog([log(0, 1)], { ...log(0, 2), kind: "else", size: "big" });
    expect(l).toHaveLength(1);
    expect(l[0].kind).toBe("else");
    expect(mealsLoggedCount(l, [D])).toBe(1);
  });
});

describe("day start time", () => {
  it("the day rolls over 3 hours before her day starts", () => {
    const at = (h: number, m = 0) => new Date(2026, 10, 2, h, m).getTime();
    expect(appToday(at(12), "06:30")).toBe("2026-11-02");
    expect(appToday(at(1), "06:30")).toBe("2026-11-01"); // a 1 am snack is still yesterday
    expect(appToday(at(3, 30), "06:30")).toBe("2026-11-02");
    expect(appToday(at(0, 30), "02:00")).toBe("2026-11-02"); // early starters: never before midnight
  });
});
