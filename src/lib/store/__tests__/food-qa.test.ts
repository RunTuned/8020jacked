// QA fix round (Food): store and selector behaviour. Invented content and profiles only.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

import { CONTENT, RECIPES } from "../../engine/__tests__/fixtures";
import * as E from "../../engine";
import type { Recipe, Sauce } from "../../types";
import {
  appState,
  initialState,
  resetRepeatGuard,
  selectCookDay,
  selectDayPlan,
  selectFoodDays,
  selectMealDetail,
  selectPickupList,
  selectShoppingList,
  selectWeekMeals,
  selectWeekRows,
  setClock,
  setContent,
  useAppStore,
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
  A().saveTime({ minutes: 15, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: cook, allergies: [] });
  A().createPlan();
}

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => t);
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

function listNames() {
  return new Set(selectShoppingList(appState()).sections.flatMap((s) => s.items.map((i) => i.name)));
}

describe("#1 shopping list and cook day cover the same days, from sign-up day", () => {
  for (const [label, day, cookOn, to] of [
    ["Sunday", "2026-11-01", "2026-11-01", "2026-11-04"],
    ["Wednesday", "2026-11-04", "2026-11-04", "2026-11-08"],
  ] as const)
    it(`${label} sign-up: the plan starts today; list and cook day match`, () => {
      at(day);
      onboard();
      const list = selectShoppingList(appState());
      const cook = selectCookDay(appState());
      expect(list.hidden).toBe(false);
      expect(list.cookOn).toBe(cookOn);
      expect(cook.cookOn).toBe(cookOn);
      expect(list.from).toBe(day);
      expect(list.to).toBe(to);
      expect(cook.from).toBe(list.from);
      expect(cook.to).toBe(list.to);
      expect(cook.steps.length).toBeGreaterThan(0);
      // Everything she cooks that day is on the list.
      const names = listNames();
      for (const id of new Set(cook.steps.map((x) => x.recipeId)))
        for (const g of RECIPES.find((r) => r.id === id)!.ingredients) expect(names.has(g.name)).toBe(true);
      // No day before she joined, anywhere.
      expect(selectFoodDays(appState()).every((d) => d.date >= day)).toBe(true);
      expect(selectFoodDays(appState())[0].date).toBe(day);
      expect(selectWeekRows(appState()).every((r) => r.date >= day)).toBe(true);
    });

  it("the list never includes days that have passed; later it moves to the next batch", () => {
    at("2026-11-02");
    onboard();
    at("2026-11-05"); // Thursday
    const list = selectShoppingList(appState());
    expect(list.cookOn).toBe("2026-11-08");
    expect(list.from >= "2026-11-05").toBe(true);
    expect(selectCookDay(appState()).cookOn).toBe("2026-11-08");
  });
});

describe("#4 and #14 meal extras", () => {
  const SAUCE: Sauce = {
    id: "sauce-green",
    name: "Green herb sauce",
    minutes: 5,
    servings: 4,
    kcal: 30,
    protein: 1,
    allergens: [],
    fridgeDays: 3,
    freezer: false,
    ingredients: [{ name: "parsley", qty: 1, unit: "handful", area: "fruit-veg" }],
    method: ["Blend."],
  };
  const recipes: Recipe[] = RECIPES.map((r) =>
    r.mealTypes.includes("main")
      ? { ...r, sauces: ["sauce-green"], format: "tray" as const, washUp: 2 }
      : { ...r, washUp: 1 },
  );

  it("sauces show by name, never by id; washing up only for tray or pot mains", () => {
    setContent({ ...CONTENT, recipes, sauces: [SAUCE] });
    at("2026-11-02");
    onboard();
    const day = selectDayPlan(appState());
    const main = day.meals.find((m) => m.mealType === "main")!;
    const lines = selectMealDetail(appState(), day.date, main.index)!.extrasLines.map((l) => l.text);
    expect(lines.join(" ")).toContain("Green herb sauce");
    expect(lines.join(" ")).not.toContain("sauce-green");
    expect(lines.some((l) => l.startsWith("Washing up"))).toBe(true);
    const breakfast = selectMealDetail(appState(), day.date, 0)!;
    expect(breakfast.extrasLines.some((l) => l.text.startsWith("Washing up"))).toBe(false);
  });
});

describe("#7 cook ↔ buy starts tomorrow, lists included", () => {
  it("switching to buying: today stays cooked, tomorrow is ready meals, the list becomes Pick up", () => {
    at("2026-11-02");
    onboard();
    at("2026-11-03"); // Tuesday: the next shop is Wednesday's, for Thu–Sun
    const msg = A().saveFoodPrefs({ cookOrBuy: "buy" });
    expect(msg).toBe("Saved. From tomorrow your meals are ready-meal versions.");
    expect(selectDayPlan(appState()).meals.every((m) => m.source === "cook")).toBe(true);
    expect(selectDayPlan(appState(), "2026-11-04").meals.every((m) => m.source === "buy")).toBe(true);
    // The next shop (Thu–Sun) is all bought.
    expect(selectShoppingList(appState()).hidden).toBe(true);
    expect(selectPickupList(appState()).hidden).toBe(false);
    expect(selectPickupList(appState()).items.length).toBeGreaterThan(0);
  });

  it("meals a day: a confirmation that names the change", () => {
    at("2026-11-02");
    onboard();
    expect(A().saveFoodPrefs({ mealsPerDay: 4 })).toBe("Saved. From tomorrow you have 4 meals a day.");
  });
});

describe("#11 a plan change never rewrites days gone or meals logged", () => {
  it("speed brake: earlier days and logged servings stay as they were", () => {
    at("2026-11-02");
    onboard();
    A().addWeighIn(76);
    at("2026-11-08", 9);
    A().logMeal(0, "plan");
    const before = JSON.stringify(selectWeekMeals(appState(), "2026-11-02").slice(0, 6));
    const loggedBefore = selectDayPlan(appState()).meals[0].servings;
    expect(appState().mealLogs[0].servings).toBe(loggedBefore);
    expect(A().addWeighIn(74.8).speedBrake).toBe(true);
    expect(JSON.stringify(selectWeekMeals(appState(), "2026-11-02").slice(0, 6))).toBe(before);
    expect(selectDayPlan(appState()).meals[0].servings).toBe(loggedBefore);
    expect(E.weekStart("2026-11-08")).toBe("2026-11-02");
  });
});
