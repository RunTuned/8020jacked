import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import type { Recipe } from "../../types";
import {
  appState,
  cookStepSeconds,
  extrasLines,
  initialState,
  recipeExtras,
  resetRepeatGuard,
  selectAwayUntil,
  selectDayPlan,
  selectDoneToday,
  selectLastMealLog,
  selectLastWalkThisWeek,
  selectMealDetail,
  selectMoveDays,
  selectSchedule,
  selectTodayBanner,
  selectWalksToday,
  setClock,
  setContent,
  useAppStore,
  weightInputToKg,
} from "..";

let t = 0;
const at = (date: string, h = 12) => {
  const [y, m, d] = date.split("-").map(Number);
  t = new Date(y, m - 1, d, h, 0).getTime();
};
const A = () => useAppStore.getState();

function onboard(cook: "cook" | "buy" = "cook") {
  A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 75, noWeigh: false });
  A().saveGoal("lose", true);
  A().saveTime({ minutes: 20, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: cook, allergies: [] });
  A().createPlan();
}

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => t);
  at("2026-11-02"); // Monday
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("Today selectors", () => {
  it("last meal log is the newest one saved today", () => {
    onboard();
    expect(selectLastMealLog(appState())).toBeNull();
    A().logMeal(0, "plan");
    t += 2000;
    A().logMeal(1, "like");
    expect(selectLastMealLog(appState())!.slot).toBe(1);
  });

  it("done today gives the session name and minutes", () => {
    onboard();
    expect(selectDoneToday(appState())).toBeNull();
    A().startWorkout();
    A().finishWorkout("done", "just_right");
    expect(selectDoneToday(appState())).toEqual({ name: "Legs and push", minutes: 20 });
  });

  it("banner priority: allergy > speed brake > payment > check-in", () => {
    onboard();
    expect(selectTodayBanner(appState())).toBeNull();
    expect(selectTodayBanner(appState(), true)).toBe("payment");
    useAppStore.setState({ adjustments: { ...A().adjustments, speedBrakeOn: "2026-11-02" } });
    expect(selectTodayBanner(appState(), true)).toBe("speed_brake");
    A().saveFoodPrefs({ allergies: ["nuts"] });
    expect(selectTodayBanner(appState(), true)).toBe("allergy");
  });

  it("check-in banner shows when a check-in is due", () => {
    onboard();
    at("2026-11-15"); // Sunday, 13 days after the start
    expect(selectTodayBanner(appState())).toBe("check_in");
  });

  it("away until is the last day of the run of away days", () => {
    onboard();
    expect(selectAwayUntil(appState())).toBeNull();
    A().saveAwayDays(["2026-11-02", "2026-11-03", "2026-11-05"], []);
    expect(selectAwayUntil(appState())).toBe("2026-11-03");
  });

  it("move days are free home days from today, never an away day or the same day", () => {
    onboard();
    const sched = selectSchedule(appState());
    const from = Object.keys(sched).find((d) => sched[d])!;
    A().saveAwayDays(["2026-11-03"], []);
    const days = selectMoveDays(appState(), from);
    expect(days).not.toContain(from);
    expect(days).not.toContain("2026-11-03");
    for (const d of days) expect(sched[d]).toBeNull();
    expect(selectMoveDays(appState(), "2026-11-03")).toEqual([]);
  });

  it("walks today", () => {
    onboard();
    A().tickWalk();
    expect(selectWalksToday(appState())).toBe(1);
    expect(selectLastWalkThisWeek(appState())).toBe("2026-11-02");
    A().untickWalk(selectLastWalkThisWeek(appState())!);
    expect(selectLastWalkThisWeek(appState())).toBeNull();
  });
});

describe("weigh-in input", () => {
  it("reads kg and lb, rejects nonsense", () => {
    expect(weightInputToKg("72,4", "kg")).toBe(72.4);
    expect(weightInputToKg("160", "lb")).toBe(72.6);
    expect(weightInputToKg("", "kg")).toBeNull();
    expect(weightInputToKg("abc", "kg")).toBeNull();
    expect(weightInputToKg("5", "kg")).toBeNull();
  });
});

describe("meal detail", () => {
  it("cooks: servings, hand line, ingredients scaled for cooking for, never calories", () => {
    onboard();
    const day = selectDayPlan(appState());
    const main = day.meals.find((m) => m.mealType === "main")!;
    const one = selectMealDetail(appState(), day.date, main.index)!;
    expect(one.servingsLabel).toMatch(/serving/);
    expect(one.handLine).toMatch(/palm/);
    A().setCookingFor(3);
    const three = selectMealDetail(appState(), day.date, main.index)!;
    const base = (x: typeof one) => x.ingredients.find((g) => g.name.endsWith("base"))!.amount!;
    expect(parseFloat(base(three))).toBeGreaterThan(parseFloat(base(one)));
    const shown = [three.servingsLabel, three.handLine, ...three.ingredients.map((g) => g.amount), ...three.extrasLines.map((l) => l.text)];
    expect(shown.join(" ")).not.toMatch(/kcal|calorie/i);
  });

  it("buyers: size lines, no ingredients", () => {
    onboard("buy");
    const day = selectDayPlan(appState());
    const d = selectMealDetail(appState(), day.date, 0)!;
    expect(d.source).toBe("buy");
    expect(d.ingredients).toEqual([]);
    expect(d.sizeLines.length).toBeGreaterThan(0);
  });

  it("unknown slot is null", () => {
    onboard();
    expect(selectMealDetail(appState(), "2026-11-02", 9)).toBeNull();
  });
});

describe("recipe extras", () => {
  const base = CONTENT.recipes[0];
  it("absent fields are skipped", () => {
    const x = recipeExtras(base);
    expect(x).toEqual({ format: null, carry: null, pack: null, fridgeDays: null, sauces: [], topping: null, washUp: null });
    expect(extrasLines(x)).toEqual([]);
  });

  it("present fields give a sauce line, a carry/pack line and a keeps line", () => {
    const r = {
      ...base,
      format: "bowl",
      carry: "cold",
      pack: "lidded box",
      fridgeDays: 3,
      sauces: [{ name: "yoghurt dressing" }, "chilli sauce"],
      topping: "seeds",
      washUp: 1,
    } as unknown as Recipe;
    const lines = extrasLines(recipeExtras(r)).map((l) => l.text);
    expect(lines).toEqual([
      "Sauce: yoghurt dressing, chilli sauce",
      "On top: seeds",
      "Fine to eat cold · Pack: lidded box",
      "Keeps 3 days in the fridge",
      "Washing up: 1 pan",
    ]);
  });

  it("odd values are ignored", () => {
    const r = { ...base, carry: "warm", fridgeDays: -2, sauces: 5 } as unknown as Recipe;
    const x = recipeExtras(r);
    expect(x.carry).toBeNull();
    expect(x.fridgeDays).toBeNull();
    expect(x.sauces).toEqual(["5"]);
  });
});

describe("cook step timer", () => {
  it("reads minutes from the step", () => {
    expect(cookStepSeconds("Bake for 15 minutes, until set.")).toBe(900);
    expect(cookStepSeconds("Simmer 10–12 min.")).toBe(720);
    expect(cookStepSeconds("Chop the onion.")).toBeNull();
  });
});
