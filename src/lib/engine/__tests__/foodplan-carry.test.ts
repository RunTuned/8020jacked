// Prep-and-carry rules: cook days, fridge days, cold lunches, sauces, shopping and storage facts.
// Invented content only (no real person's data).
import { describe, expect, it } from "vitest";
import { ALLERGENS, type Allergen, type DayPlan, type Recipe, type Sauce } from "../../types";
import { addDays } from "../dates";
import { parseRecipes, parseSauces } from "../content";
import {
  allergyChange,
  buildWeekMeals,
  coldLunchCount,
  cookBlock,
  cookDate,
  cookSessionFor,
  servedId,
  shoppingList,
  type WeekMealsInput,
} from "../foodplan";
import { BOUGHT } from "./fixtures";

const MON = "2026-11-02";
const SUN_BEFORE = "2026-11-01";
const WED = "2026-11-04";

const main = (id: string, carry: "hot" | "cold", allergens: Allergen[], extra: Partial<Recipe> = {}): Recipe => ({
  id,
  name: id,
  mealTypes: ["main"],
  minutes: 40,
  servings: 4,
  kcal: 420,
  protein: 35,
  allergens,
  batch: true,
  ingredients: [
    { name: `${id} base`, qty: 400, unit: "g", area: "fridge" },
    { name: "onion", qty: 2, unit: "", area: "fruit-veg" },
  ],
  method: [`Cook ${id} on one tray.`, "Cool and box."],
  format: carry === "cold" ? "tray" : "pot",
  washUp: 3,
  fridgeDays: 3,
  freezer: true,
  carbsFrozen: false,
  carry,
  pack: carry === "cold" ? "2-part box + sauce pot." : "Microwave-safe box + sauce pot.",
  sauces: ["s-yog", "s-verde", "s-peanut"],
  topping: "Toasted sunflower seeds",
  ...extra,
});

const other = (id: string, type: "breakfast" | "snack", allergens: Allergen[]): Recipe => ({
  ...main(id, "cold", allergens),
  mealTypes: [type],
  minutes: 5,
  servings: 1,
  kcal: 300,
  sauces: [],
});

const sauce = (id: string, allergens: Allergen[], kcal = 40): Sauce => ({
  id,
  name: id,
  minutes: 5,
  servings: 4,
  kcal,
  protein: 1,
  allergens,
  fridgeDays: 3,
  freezer: false,
  ingredients: [{ name: `${id} herb`, qty: 40, unit: "g", area: "fruit-veg" }],
  method: ["Stir together in a jar."],
});

const RECIPES: Recipe[] = [
  main("cold-chicken-salad", "cold", []),
  main("cold-salmon-salad", "cold", ["fish"], { fridgeDays: 2, freezer: false }),
  main("cold-egg-noodles", "cold", ["egg", "gluten", "soy"]),
  main("hot-chicken-stew", "hot", []),
  main("hot-beef-chilli", "hot", ["dairy"]),
  main("hot-fish-curry", "hot", ["fish", "dairy"], { fridgeDays: 2, freezer: false }),
  main("hot-chicken-rice", "hot", ["soy", "gluten"], { carbsFrozen: true }),
  main("hot-lentil-soup", "hot", ["sesame"]),
  main("hot-peanut-chicken", "hot", ["peanuts", "nuts"]),
  other("oats", "breakfast", ["gluten", "dairy"]),
  other("egg-bites", "breakfast", ["egg"]),
  other("fruit", "snack", []),
];
const SAUCES: Sauce[] = [sauce("s-yog", ["dairy"]), sauce("s-verde", []), sauce("s-peanut", ["peanuts", "soy"])];

const input = (p: Partial<WeekMealsInput> & { meals?: number; fasting?: boolean } = {}): WeekMealsInput => ({
  weekStart: MON,
  awayDates: new Set(),
  prefsFor: () => ({ mealsPerDay: p.meals ?? 3, cookOrBuy: "cook", fasting: p.fasting ?? false }),
  daily: 1700,
  allergies: [],
  recipes: RECIPES,
  bought: BOUGHT,
  sideDelta: 0,
  swaps: [],
  sauces: SAUCES,
  ...p,
});
const byId = new Map(RECIPES.map((r) => [r.id, r]));
const mains = (w: DayPlan[]) => w.flatMap((d) => d.meals).filter((m) => m.mealType === "main" && m.recipeId);

describe("cook days: Sunday for Mon–Wed, Wednesday for Thu–Sat", () => {
  it("blocks and cook dates", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(cookBlock)).toEqual([0, 0, 0, 1, 1, 1, 2]);
    expect(cookDate(MON, 0)).toBe(SUN_BEFORE);
    expect(cookDate(MON, 1)).toBe(WED);
  });

  it("Mon–Wed mains were cooked the Sunday before, Thu–Sat on Wednesday; none older than 3 days", () => {
    const w = buildWeekMeals(input());
    for (let d = 0; d < 6; d++)
      for (const m of w[d].meals.filter((x) => x.mealType === "main")) {
        expect(m.cookedOn).toBe(d <= 2 ? SUN_BEFORE : WED);
        expect(m.ageDays).toBeLessThanOrEqual(3);
      }
  });

  it("Sunday's mains come from the freezer (freezer-friendly batch mains) or are made fresh that day", () => {
    const w = buildWeekMeals(input());
    for (const m of w[6].meals.filter((x) => x.mealType === "main")) {
      if (m.fromFreezer) expect(byId.get(m.recipeId!)!.freezer).toBe(true);
      else expect(m.cookedOn).toBe(w[6].date);
    }
    const noFreezer = RECIPES.map((r) => ({ ...r, freezer: false }));
    const fresh = buildWeekMeals(input({ recipes: noFreezer }));
    for (const m of fresh[6].meals.filter((x) => x.mealType === "main")) {
      expect(m.fromFreezer).toBeUndefined();
      expect(m.cookedOn).toBe(fresh[6].date);
    }
  });

  it("the cook day screen's batch: Sunday cooks next week's Mon–Wed, Wednesday cooks Thu–Sat", () => {
    expect(cookSessionFor(SUN_BEFORE)).toEqual({ weekStart: MON, block: 0, cookOn: SUN_BEFORE });
    expect(cookSessionFor(addDays(MON, 1))).toEqual({ weekStart: MON, block: 0, cookOn: SUN_BEFORE });
    expect(cookSessionFor(WED)).toEqual({ weekStart: MON, block: 1, cookOn: WED });
    expect(cookSessionFor(addDays(MON, 5))).toEqual({ weekStart: MON, block: 1, cookOn: WED });
  });
});

describe("never served past its fridge days", () => {
  it("for every allergen, 2–4 meals, fasting on or off", () => {
    for (const a of [null, ...ALLERGENS])
      for (const meals of [2, 3, 4])
        for (const fasting of [false, true]) {
          const w = buildWeekMeals(input({ allergies: a ? [a] : [], meals, fasting }));
          for (const m of mains(w)) {
            const r = byId.get(m.recipeId!)!;
            if (m.fromFreezer) expect(r.freezer).toBe(true);
            else expect(m.ageDays!).toBeLessThanOrEqual(r.fridgeDays);
          }
        }
  });

  it("a batch of 2-day dishes gets a 3-day dish (or a frozen portion) for the third day", () => {
    const short = RECIPES.map((r) => (r.id === "hot-chicken-stew" ? r : { ...r, fridgeDays: 2, freezer: false }));
    const w = buildWeekMeals(input({ recipes: short }));
    for (const d of [w[2], w[5]])
      for (const m of d.meals.filter((x) => x.mealType === "main")) {
        expect(m.ageDays).toBe(3);
        expect(m.recipeId).toBe("hot-chicken-stew");
      }
  });

  it("nothing keeps long enough and nothing freezes: no recipe, her size in hands instead", () => {
    const short = RECIPES.map((r) => ({ ...r, fridgeDays: 2, freezer: false }));
    const w = buildWeekMeals(input({ recipes: short }));
    for (const m of w[2].meals.filter((x) => x.mealType === "main")) {
      expect(m.recipeId).toBeUndefined();
      expect(m.handLine).toMatch(/palm/);
    }
  });
});

describe("at least 2 good-cold lunches a week", () => {
  it("for 2–4 meals a day, fasting on or off, and every single allergy", () => {
    for (const a of [null, ...ALLERGENS])
      for (const meals of [2, 3, 4])
        for (const fasting of [false, true]) {
          const w = buildWeekMeals(input({ allergies: a ? [a] : [], meals, fasting }));
          expect(coldLunchCount(w, RECIPES)).toBeGreaterThanOrEqual(2);
        }
  });

  it("the lunch is the first main of the day", () => {
    for (const d of buildWeekMeals(input({ meals: 4 }))) {
      expect(d.meals[1].lunch).toBe(true);
      expect(d.meals[2].lunch).toBeUndefined();
    }
  });
});

describe("sauces", () => {
  it("2 different sauces take turns across a batch's days", () => {
    const w = buildWeekMeals(input());
    for (const block of [w.slice(0, 3), w.slice(3, 6)]) {
      const byRecipe = new Map<string, Set<string>>();
      const count = new Map<string, number>();
      for (const m of block.flatMap((d) => d.meals).filter((x) => x.mealType === "main")) {
        if (!byRecipe.has(m.recipeId!)) byRecipe.set(m.recipeId!, new Set());
        byRecipe.get(m.recipeId!)!.add(m.sauceId!);
        count.set(m.recipeId!, (count.get(m.recipeId!) ?? 0) + 1);
      }
      for (const [id, set] of byRecipe) if (count.get(id)! >= 2) expect(set.size).toBe(2);
    }
  });

  it("a sauce with her allergen is never served; one safe option is used every time", () => {
    for (const a of ALLERGENS) {
      const w = buildWeekMeals(input({ allergies: [a] }));
      for (const m of mains(w)) {
        const s = SAUCES.find((x) => x.id === m.sauceId);
        if (s) expect(s.allergens).not.toContain(a);
      }
    }
    const w = buildWeekMeals(input({ allergies: ["dairy", "peanuts"] }));
    for (const m of mains(w)) expect(m.sauceId).toBe("s-verde");
  });

  it("the sauce counts toward the meal size (a smaller serving of the main)", () => {
    const heavy = [sauce("s-yog", ["dairy"], 210), sauce("s-verde", [], 210), sauce("s-peanut", ["peanuts"], 210)];
    const none = buildWeekMeals(input({ sauces: [] }));
    const withSauce = buildWeekMeals(input({ sauces: heavy }));
    expect(none[0].meals[1].sauceId).toBeUndefined();
    expect(withSauce[0].meals[1].servings!).toBeLessThan(none[0].meals[1].servings!);
  });

  it("sauces are on the shopping list, one pot per person", () => {
    const w = buildWeekMeals(input());
    const one = shoppingList(w, RECIPES, 1, [], [], SAUCES).flatMap((s) => s.items);
    const two = shoppingList(w, RECIPES, 2, [], [], SAUCES).flatMap((s) => s.items);
    const used = new Set(mains(w).map((m) => m.sauceId!));
    for (const id of used) {
      const pots = mains(w).filter((m) => m.sauceId === id).length;
      const herb1 = one.find((i) => i.name === `${id} herb`)!;
      expect(herb1.qty).toBe(Math.ceil((pots * 10) / 10 - 1e-9) * 10); // 10 g a pot, rounded up to 10 g
      expect(two.find((i) => i.name === `${id} herb`)!.qty).toBeGreaterThan(herb1.qty);
    }
    expect(shoppingList(w, RECIPES, 1, []).flatMap((s) => s.items).some((i) => i.name.endsWith(" herb"))).toBe(false);
  });

  it("a new allergy flags the ingredients of sauces that left the week", () => {
    const before = buildWeekMeals(input());
    const after = buildWeekMeals(input({ allergies: ["dairy"] }));
    const hadYog = before.some((d) => d.meals.some((m) => m.sauceId === "s-yog"));
    const c = allergyChange(before, after, MON, [], RECIPES, BOUGHT, ["dairy"], SAUCES);
    if (hadYog) expect(c.flagged).toContain("s-yog herb");
    expect(after.some((d) => d.meals.some((m) => m.sauceId === "s-yog"))).toBe(false);
  });
});

describe("prep-and-carry facts on every cooked meal", () => {
  it("topping, carry, pack, fridge days, freezer and carbs-frozen come from the recipe", () => {
    for (const m of mains(buildWeekMeals(input()))) {
      const r = byId.get(m.recipeId!)!;
      expect(m).toMatchObject({
        topping: r.topping,
        carry: r.carry,
        pack: r.pack,
        fridgeDays: r.fridgeDays,
        freezer: r.freezer,
        carbsFrozen: r.carbsFrozen,
      });
    }
  });

  it("a swap she picks that won't keep that long is a frozen portion, or made fresh that day", () => {
    const sat = addDays(MON, 5);
    const w = buildWeekMeals(
      input({ swaps: [{ creatorId: "8020jacked", date: sat, slot: 1, itemId: "cold-salmon-salad" }] }),
    );
    const m = w[5].meals[1];
    expect(m).toMatchObject({ recipeId: "cold-salmon-salad", swapped: true, cookedOn: sat, ageDays: 0 });
    expect(servedId(m)).toBe("cold-salmon-salad");
  });
});

describe("content parsing: prep-and-carry fields", () => {
  it("fridge days are kept to 1–3 (missing = 1), sauces parse with their allergens", () => {
    const r = parseRecipes([
      { id: "a", kcal: 300, mealTypes: ["main"], allergens: [], fridgeDays: 5, carry: "cold", format: "tray", sauces: ["x"] },
      { id: "b", kcal: 300, mealTypes: ["main"], allergens: [] },
    ]);
    expect(r[0]).toMatchObject({ fridgeDays: 3, carry: "cold", format: "tray", sauces: ["x"], freezer: false, carbsFrozen: false });
    expect(r[1].fridgeDays).toBe(1);
    expect(r[1].carry).toBeUndefined();
    expect(parseSauces([{ id: "s", kcal: 40, allergens: ["sesame"], fridgeDays: 3 }, { id: "t" }])).toMatchObject([
      { id: "s", allergens: ["sesame"], fridgeDays: 3 },
    ]);
  });
});
