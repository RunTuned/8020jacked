// QA fix round (Food): cook-batch alignment, hands by meal type, buyer sides, swaps, shopping list merging.
// Invented content only.
import { describe, expect, it } from "vitest";
import type { DayPlan, Recipe, Sauce } from "../../types";
import { weekStart } from "../dates";
import { handLine, handPortions } from "../food";
import {
  batchFor,
  buildWeekMeals,
  nextCookBatch,
  recipeHasVeg,
  servedId,
  shoppingList,
  type WeekMealsInput,
} from "../foodplan";
import { BOUGHT, RECIPES } from "./fixtures";

const MON = "2026-11-02";
const input = (p: Partial<WeekMealsInput> & { cook?: "cook" | "buy" } = {}): WeekMealsInput => ({
  weekStart: MON,
  awayDates: new Set(),
  prefsFor: () => ({ mealsPerDay: 3, cookOrBuy: p.cook ?? "cook", fasting: false }),
  daily: 1591,
  allergies: [],
  recipes: RECIPES,
  bought: BOUGHT,
  sideDelta: 0,
  swaps: [],
  ...p,
});

describe("#1 cook batches: the shopping list and cook day cover the same days", () => {
  const LONG_AGO = "2026-09-01";
  it("normal weeks: Sunday cooks Mon–Wed, Wednesday cooks Thu–Sun", () => {
    expect(batchFor("2026-11-03", LONG_AGO)).toEqual({ cookOn: "2026-11-01", from: "2026-11-02", to: "2026-11-04" });
    expect(batchFor("2026-11-06", LONG_AGO)).toEqual({ cookOn: "2026-11-04", from: "2026-11-05", to: "2026-11-08" });
  });

  it("the next batch is the one whose cook day is today or later", () => {
    expect(nextCookBatch("2026-11-02", LONG_AGO).cookOn).toBe("2026-11-04"); // Mon → Wed
    expect(nextCookBatch("2026-11-04", LONG_AGO).cookOn).toBe("2026-11-04"); // Wed → today
    expect(nextCookBatch("2026-11-05", LONG_AGO)).toEqual({ cookOn: "2026-11-08", from: "2026-11-09", to: "2026-11-11" });
    expect(nextCookBatch("2026-11-08", LONG_AGO).cookOn).toBe("2026-11-08"); // Sun → today
  });

  it("sign-up day: the first batch starts today (Sun → today to Wed; Sat → cook Sunday, Sat to Wed)", () => {
    expect(nextCookBatch("2026-11-01", "2026-11-01")).toEqual({ cookOn: "2026-11-01", from: "2026-11-01", to: "2026-11-04" });
    expect(nextCookBatch("2026-10-31", "2026-10-31")).toEqual({ cookOn: "2026-11-01", from: "2026-10-31", to: "2026-11-04" });
    expect(nextCookBatch("2026-11-04", "2026-11-04")).toEqual({ cookOn: "2026-11-04", from: "2026-11-04", to: "2026-11-08" });
    expect(nextCookBatch("2026-11-02", "2026-11-02")).toEqual({ cookOn: "2026-11-02", from: "2026-11-02", to: "2026-11-04" });
    // The day after a Monday start, the next cook is Wednesday.
    expect(nextCookBatch("2026-11-03", "2026-11-02").cookOn).toBe("2026-11-04");
  });

  it("days before she joined have no meals; her first batch is cooked on her first cook day", () => {
    const w = buildWeekMeals(input({ planStart: "2026-11-04" }));
    expect(w[0].beforeStart).toBe(true);
    expect(w[1].meals).toEqual([]);
    for (const d of w.slice(2, 6))
      for (const m of d.meals.filter((x) => x.mealType === "main" && x.recipeId)) expect(m.cookedOn).toBe("2026-11-04");
    // Sunday: a frozen portion of that batch, or made fresh that day (nothing in these recipes freezes).
    for (const m of w[6].meals.filter((x) => x.mealType === "main")) expect(m.cookedOn).toBe("2026-11-08");
    const frozen = buildWeekMeals(input({ planStart: "2026-11-04", recipes: RECIPES.map((r) => ({ ...r, freezer: true })) }));
    for (const m of frozen[6].meals.filter((x) => x.mealType === "main")) {
      expect(m.fromFreezer).toBe(true);
      expect(m.cookedOn).toBe("2026-11-04");
    }
  });

  it("Sunday sign-up: Sunday's main is made that day, not from a freezer that doesn't exist yet", () => {
    const w = buildWeekMeals(input({ planStart: "2026-11-08" }));
    expect(w.slice(0, 6).every((d) => d.beforeStart && d.meals.length === 0)).toBe(true);
    for (const m of w[6].meals.filter((x) => x.mealType === "main")) {
      expect(m.fromFreezer).toBeUndefined();
      expect(m.cookedOn).toBe("2026-11-08");
    }
  });

  it("Saturday sign-up: Saturday is made fresh; Sunday's main is cooked on the Sunday cook day", () => {
    const w = buildWeekMeals(input({ planStart: "2026-11-07" }));
    for (const m of w[5].meals.filter((x) => x.mealType === "main")) expect(m.cookedOn).toBe("2026-11-07");
    for (const m of w[6].meals.filter((x) => x.mealType === "main")) expect(m.cookedOn).toBe("2026-11-08");
    expect(weekStart("2026-11-07")).toBe(MON);
  });
});

describe("#14 hand portions come from the meal's own type", () => {
  it("no fists of veg unless asked; the line leaves them out", () => {
    expect(handPortions(300, false).fist).toBe(0);
    expect(handLine(handPortions(300, false))).toBe("1 palm protein · 1 cupped hand carbs · 1 thumb fat");
    expect(handLine(handPortions(300))).toMatch(/fist veg/);
  });

  it("veg is spotted from the ingredients, not fruit or herbs", () => {
    const r = (names: string[]): Recipe => ({ ...RECIPES[0], ingredients: names.map((name) => ({ name, qty: 1, unit: "", area: "fruit-veg" as const })) });
    expect(recipeHasVeg(r(["blueberries", "banana", "fresh parsley"]))).toBe(false);
    expect(recipeHasVeg(r(["spinach"]))).toBe(true);
    expect(recipeHasVeg(r(["cherry tomatoes"]))).toBe(true);
  });

  it("breakfasts and snacks without veg show no fists; mains always do", () => {
    const fruitOnly = RECIPES.map((x) =>
      x.mealTypes.includes("main") ? x : { ...x, ingredients: [{ name: "banana", qty: 1, unit: "", area: "fruit-veg" as const }] },
    );
    const w = buildWeekMeals(input({ recipes: fruitOnly }));
    for (const d of w)
      for (const m of d.meals) {
        if (m.mealType === "main") expect(m.handLine).toMatch(/fist/);
        else expect(m.handLine).not.toMatch(/fist/);
      }
  });
});

describe("#17 buyer mains: a fruit, salad or veg side, never a carb side", () => {
  it("no bread roll (or rice) next to a ready meal, even with extra sides", () => {
    for (const sideDelta of [0, 2]) {
      const w = buildWeekMeals(input({ cook: "buy", sideDelta }));
      const sides = w.flatMap((d) => d.meals.flatMap((m) => m.sideIds ?? []));
      expect(sides.length).toBeGreaterThan(0);
      expect(sides.every((id) => id === "side-fruit")).toBe(true);
    }
  });
});

describe("#24 a swap replaces only the chosen slot", () => {
  const SAUCES: Sauce[] = ["s1", "s2", "s3"].map((id) => ({
    id,
    name: `Sauce ${id}`,
    minutes: 5,
    servings: 4,
    kcal: 30,
    protein: 1,
    allergens: [],
    fridgeDays: 3,
    freezer: false,
    ingredients: [{ name: `${id} herb`, qty: 1, unit: "handful", area: "fruit-veg" }],
    method: ["Mix."],
  }));
  const recipes = RECIPES.map((r) => (r.mealTypes.includes("main") ? { ...r, sauces: ["s1", "s2", "s3"] } : r));
  const shape = (w: DayPlan[]) => w.map((d) => d.meals.map((m) => `${servedId(m)}|${m.sauceId ?? ""}|${(m.sideIds ?? []).join(",")}`));

  for (const cook of ["cook", "buy"] as const)
    it(`${cook}: every other slot stays the same`, () => {
      const base = buildWeekMeals(input({ cook, recipes, sauces: SAUCES }));
      const day = 1;
      for (const slot of [0, 1, 2]) {
        const m = base[day].meals[slot];
        const pool =
          cook === "cook"
            ? recipes.filter((r) => r.mealTypes.includes(m.mealType))
            : BOUGHT.filter((b) => b.kind === (m.mealType === "main" ? "ready" : "grab") && b.mealTypes.includes(m.mealType));
        const other = pool.find((x) => x.id !== servedId(m))!;
        const swapped = buildWeekMeals(
          input({ cook, recipes, sauces: SAUCES, swaps: [{ creatorId: "8020jacked", date: m.date, slot, itemId: other.id }] }),
        );
        expect(servedId(swapped[day].meals[slot])).toBe(other.id);
        const a = shape(base);
        const b = shape(swapped);
        a[day][slot] = b[day][slot] = "";
        expect(b).toEqual(a);
      }
    });
});

describe("#5 shopping list: one line per item, sensible amounts", () => {
  const day = (recipes: Recipe[]): DayPlan[] => [
    {
      date: MON,
      away: false,
      workout: null,
      meals: recipes.map((r, index) => ({
        date: MON,
        index,
        label: `Meal ${index + 1}`,
        mealType: "main" as const,
        source: "cook" as const,
        recipeId: r.id,
        servings: 1,
        checkLabel: false,
        swapped: false,
      })),
    },
  ];
  const rec = (id: string, ingredients: Recipe["ingredients"]): Recipe => ({ ...RECIPES[0], id, servings: 1, ingredients });
  const items = (rs: Recipe[]) => Object.fromEntries(shoppingList(day(rs), rs, 1, []).flatMap((s) => s.items).map((i) => [i.name, i]));

  it("merges the same item across units, converting where it can", () => {
    const list = items([
      rec("a", [
        { name: "avocado", qty: 200, unit: "g", area: "fruit-veg" },
        { name: "lemon juice", qty: 4.5, unit: "tbsp", area: "fruit-veg" },
        { name: "beef stock", qty: 900, unit: "ml", area: "tins-dry" },
        { name: "rice", qty: 1, unit: "kg", area: "tins-dry" },
      ]),
      rec("b", [
        { name: "Avocado", qty: 3, unit: "", area: "fruit-veg" },
        { name: "lemon juice", qty: 3, unit: "tsp", area: "fruit-veg" },
        { name: "beef stock", qty: 0.3, unit: "l", area: "tins-dry" },
        { name: "rice", qty: 250, unit: "g", area: "tins-dry" },
      ]),
    ]);
    expect(list["avocado"].amount).toBe("200 g + 3");
    expect(list["Avocado"]).toBeUndefined();
    expect(list["lemon juice"].amount).toBe("5½ tbsp");
    expect(list["beef stock"].amount).toBe("1.2 l");
    expect(list["rice"].amount).toBe("1.3 kg");
  });

  it("tins as a number of tins, small spice amounts to taste, lettuce leaves as heads", () => {
    const list = items([
      rec("a", [
        { name: "tinned chopped tomatoes", qty: 4910, unit: "g", area: "tins-dry" },
        { name: "coconut milk (canned)", qty: 200, unit: "ml", area: "tins-dry" },
        { name: "black pepper", qty: 0.5, unit: "tsp", area: "tins-dry" },
        { name: "smoked paprika", qty: 1, unit: "tbsp", area: "tins-dry" },
        { name: "cos lettuce leaves", qty: 19, unit: "", area: "fruit-veg" },
      ]),
    ]);
    expect(list["tinned chopped tomatoes"].amount).toBe("13 tins");
    expect(list["coconut milk (canned)"].amount).toBe("1 tin");
    expect(list["black pepper"].toTaste).toBe(true);
    expect(list["smoked paprika"].amount).toBe("1 tbsp");
    expect(list["cos lettuce leaves"].amount).toBe("1 head");
  });

  it("a recipe's own tin unit merges with grams and counts as tins", () => {
    const list = items([
      rec("a", [
        { name: "tinned chopped tomatoes", qty: 1, unit: "tin (400 g)", area: "tins-dry" },
        { name: "coconut milk", qty: 1, unit: "tin (400 ml)", area: "tins-dry" },
      ]),
      rec("b", [
        { name: "tinned chopped tomatoes", qty: 500, unit: "g", area: "tins-dry" },
        { name: "coconut milk", qty: 0.5, unit: "tin (400 ml)", area: "tins-dry" },
      ]),
    ]);
    expect(list["tinned chopped tomatoes"].amount).toBe("3 tins");
    expect(list["coconut milk"].amount).toBe("2 tins");
  });
});
