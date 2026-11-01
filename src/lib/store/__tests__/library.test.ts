// The real prep-and-carry library (src/content) through the engine: every rule holds for every allergy.
import { describe, expect, it } from "vitest";
import * as E from "../../engine";
import { ALLERGENS, type Allergen, type MealSlot } from "../../types";
import { getContent } from "../content";
import { storageLine } from "../selectors";

const MON = "2026-11-02";
const C = getContent();
const recipe = new Map(C.recipes.map((r) => [r.id, r]));
const sauce = new Map((C.sauces ?? []).map((s) => [s.id, s]));

function week(allergies: Allergen[], meals: number, fasting = false) {
  return E.buildWeekMeals({
    weekStart: MON,
    awayDates: new Set(),
    prefsFor: () => ({ mealsPerDay: meals, cookOrBuy: "cook", fasting }),
    daily: 1700,
    allergies,
    recipes: C.recipes,
    bought: C.bought,
    sauces: C.sauces,
    sideDelta: 0,
    swaps: [],
  });
}

describe("the prep-and-carry library", () => {
  it("loads 30 mains, 8 breakfasts, 6 snacks and 8 sauces", () => {
    expect(C.recipes.filter((r) => r.mealTypes[0] === "main")).toHaveLength(30);
    expect(C.recipes.filter((r) => r.mealTypes[0] === "breakfast")).toHaveLength(8);
    expect(C.recipes.filter((r) => r.mealTypes[0] === "snack")).toHaveLength(6);
    expect(C.sauces).toHaveLength(8);
  });

  it("for no allergy and each single allergy: ≥2 cold lunches, nothing past its fridge days, no allergen in meal or sauce", () => {
    for (const a of [null, ...ALLERGENS])
      for (const meals of [2, 3, 4]) {
        const allergies = a ? [a] : [];
        const w = week(allergies, meals);
        expect(E.coldLunchCount(w, C.recipes)).toBeGreaterThanOrEqual(2);
        for (const m of w.flatMap((d) => d.meals)) {
          expect(m.recipeId).toBeTruthy();
          const r = recipe.get(m.recipeId!)!;
          expect(E.isSafe(r, allergies)).toBe(true);
          if (m.sauceId) expect(E.isSafe(sauce.get(m.sauceId)!, allergies)).toBe(true);
          if (m.mealType === "main") {
            if (m.fromFreezer) expect(r.freezer).toBe(true);
            else expect(m.ageDays!).toBeLessThanOrEqual(r.fridgeDays);
            expect(m.sauceId).toBeTruthy();
            expect(m.topping).toBeTruthy();
            expect(m.pack).toBeTruthy();
          }
        }
      }
  });

  it("gluten + dairy together still gets 2 cold lunches, and buyers get a safe ready meal", () => {
    const w = week(["gluten", "dairy"], 3);
    expect(E.coldLunchCount(w, C.recipes)).toBeGreaterThanOrEqual(2);
    expect(C.bought.filter((b) => b.kind === "ready" && E.isSafe(b, ["gluten", "dairy"])).length).toBeGreaterThanOrEqual(2);
  });
});

describe("meal card storage line", () => {
  const slot = (p: Partial<MealSlot>): MealSlot => ({
    date: "2026-11-04",
    index: 1,
    label: "Meal 2",
    mealType: "main",
    source: "cook",
    checkLabel: false,
    swapped: false,
    ...p,
  });
  it("says when it was cooked, how long it keeps and if it freezes", () => {
    expect(storageLine(slot({ cookedOn: "2026-11-01", fridgeDays: 3, freezer: true }))).toBe(
      "Cooked Sunday · keeps 3 days in the fridge · freezes",
    );
    expect(storageLine(slot({ cookedOn: "2026-11-01", fridgeDays: 3, freezer: true, fromFreezer: true, carbsFrozen: true }))).toBe(
      "From the freezer: move it to the fridge the night before · keeps 3 days in the fridge · freezes · rice or pasta frozen in portions on cook day",
    );
    expect(storageLine(slot({}))).toBeUndefined();
  });
});
