import { describe, expect, it } from "vitest";
import { ALLERGENS, CREATOR_ID, type Allergen, type CookOrBuy, type DayPlan, type MealLog } from "../../types";
import { addDays } from "../dates";
import {
  allergyChange,
  buildWeekMeals,
  pickupList,
  servedId,
  shoppingList,
  swapOptions,
  type WeekMealsInput,
} from "../foodplan";
import { BOUGHT, RECIPES } from "./fixtures";

const MON = "2026-11-02";
const input = (p: Partial<WeekMealsInput> & { meals?: number; cook?: CookOrBuy; fasting?: boolean } = {}): WeekMealsInput => ({
  weekStart: MON,
  awayDates: new Set(),
  prefsFor: () => ({ mealsPerDay: p.meals ?? 3, cookOrBuy: p.cook ?? "cook", fasting: p.fasting ?? false }),
  daily: 1591,
  allergies: [],
  recipes: RECIPES,
  bought: BOUGHT,
  sideDelta: 0,
  swaps: [],
  ...p,
});
const allItems = new Map<string, { allergens: Allergen[] }>([...RECIPES, ...BOUGHT].map((x) => [x.id, x]));
function servedAllergens(week: DayPlan[]): Allergen[] {
  return week.flatMap((d) =>
    d.meals.flatMap((m) => [servedId(m), ...(m.sideIds ?? [])].flatMap((id) => (id ? allItems.get(id)!.allergens : []))),
  );
}

describe("3.5 week plan", () => {
  it("N meals a day; fasting = 2", () => {
    for (const n of [2, 3, 4]) for (const d of buildWeekMeals(input({ meals: n }))) expect(d.meals).toHaveLength(n);
    for (const d of buildWeekMeals(input({ meals: 4, fasting: true }))) expect(d.meals).toHaveLength(2);
  });

  it("cooks: mains batch-cooked twice a week, 2–3 recipes per cook", () => {
    const w = buildWeekMeals(input());
    const mains = (days: DayPlan[]) => new Set(days.flatMap((d) => d.meals.filter((m) => m.mealType === "main").map((m) => m.recipeId)));
    const a = mains(w.slice(0, 4));
    const b = mains(w.slice(4));
    expect(a.size).toBeGreaterThanOrEqual(2);
    expect(a.size).toBeLessThanOrEqual(3);
    expect(b.size).toBeGreaterThanOrEqual(2);
    expect(b.size).toBeLessThanOrEqual(3);
  });

  it("cooks: each meal has a serving multiplier (0.25 steps) and a hand-portion line", () => {
    for (const d of buildWeekMeals(input()))
      for (const m of d.meals) {
        expect(m.recipeId).toBeTruthy();
        expect((m.servings! * 4) % 1).toBe(0);
        expect(m.handLine).toMatch(/palm/);
      }
  });

  it("buyers: mains are 1 ready meal + 1 side, breakfast and 4th meal grab-and-go", () => {
    const w = buildWeekMeals(input({ cook: "buy", meals: 4 }));
    for (const d of w) {
      const [b, m1, m2, snack] = d.meals;
      expect(BOUGHT.find((x) => x.id === b.boughtId)!.kind).toBe("grab");
      expect(BOUGHT.find((x) => x.id === snack.boughtId)!.kind).toBe("grab");
      for (const m of [m1, m2]) {
        expect(BOUGHT.find((x) => x.id === m.boughtId)!.kind).toBe("ready");
        expect(m.sideIds).toHaveLength(1);
      }
      expect(b.sideIds).toHaveLength(0);
    }
  });

  it("buyers: a size change adds or removes a side", () => {
    const more = buildWeekMeals(input({ cook: "buy", sideDelta: 1 }));
    expect(more[0].meals.reduce((a, m) => a + (m.sideIds?.length ?? 0), 0)).toBe(3);
    const less = buildWeekMeals(input({ cook: "buy", sideDelta: -1 }));
    expect(less[0].meals.reduce((a, m) => a + (m.sideIds?.length ?? 0), 0)).toBe(1);
  });

  it("bought items say Check the label when she has allergies", () => {
    expect(buildWeekMeals(input({ cook: "buy" }))[0].meals.every((m) => !m.checkLabel)).toBe(true);
    expect(buildWeekMeals(input({ cook: "buy", allergies: ["egg"] }))[0].meals.every((m) => m.checkLabel)).toBe(true);
  });

  it("away days are marked; cooks get simple meals (no recipe)", () => {
    const w = buildWeekMeals(input({ awayDates: new Set([MON]) }));
    expect(w[0].away).toBe(true);
    expect(w[0].meals.every((m) => !m.recipeId && !!m.handLine)).toBe(true);
  });
});

describe("3.5 allergies: an allergen is never served", () => {
  it("for every single allergen, cook and buy, 2–4 meals, fasting on or off", () => {
    for (const a of ALLERGENS)
      for (const cook of ["cook", "buy"] as const)
        for (const meals of [2, 3, 4])
          for (const fasting of [false, true]) {
            const w = buildWeekMeals(input({ allergies: [a], cook, meals, fasting }));
            expect(servedAllergens(w)).not.toContain(a);
          }
  });

  it("with many allergies at once", () => {
    const many: Allergen[] = ["nuts", "peanuts", "egg", "fish", "gluten", "dairy", "soy", "sesame"];
    for (const cook of ["cook", "buy"] as const) {
      const w = buildWeekMeals(input({ allergies: many, cook, meals: 4 }));
      for (const a of many) expect(servedAllergens(w)).not.toContain(a);
    }
  });

  it("a swap to a meal with an allergen is ignored", () => {
    const w = buildWeekMeals(
      input({ allergies: ["fish"], swaps: [{ creatorId: CREATOR_ID, date: MON, slot: 1, itemId: "tuna-pasta" }] }),
    );
    expect(w[0].meals[1].recipeId).not.toBe("tuna-pasta");
  });

  it("swap options never show allergens", () => {
    const w = buildWeekMeals(input({ allergies: ["peanuts"] }));
    const opts = swapOptions(w[0].meals[1], RECIPES, BOUGHT, ["peanuts"], [], 99);
    expect(opts.map((o) => o.id)).not.toContain("satay");
  });
});

describe("3.5 swaps (F3)", () => {
  it("same meal type, favourites first", () => {
    const w = buildWeekMeals(input());
    const slot = w[0].meals[1]; // a main
    const opts = swapOptions(slot, RECIPES, BOUGHT, [], ["lentil-soup"], 3);
    expect(opts.length).toBeLessThanOrEqual(3);
    for (const o of opts) expect(RECIPES.find((r) => r.id === o.id)!.mealTypes).toContain("main");
    if (slot.recipeId !== "lentil-soup") expect(opts[0]).toMatchObject({ id: "lentil-soup", favourite: true });
  });

  it("buyers: mains swap for ready meals, breakfast for grab-and-go, with size lines", () => {
    const w = buildWeekMeals(input({ cook: "buy" }));
    for (const o of swapOptions(w[0].meals[1], RECIPES, BOUGHT, [], [], 99)) {
      expect(BOUGHT.find((b) => b.id === o.id)!.kind).toBe("ready");
      expect(o.sizeLine).toBeTruthy();
    }
    for (const o of swapOptions(w[0].meals[0], RECIPES, BOUGHT, [], [], 99))
      expect(BOUGHT.find((b) => b.id === o.id)!.kind).toBe("grab");
  });

  it("a chosen swap is served", () => {
    const w = buildWeekMeals(input({ swaps: [{ creatorId: CREATOR_ID, date: MON, slot: 1, itemId: "prawn-stew" }] }));
    expect(w[0].meals[1]).toMatchObject({ recipeId: "prawn-stew", swapped: true });
  });
});

describe("3.5 new allergy", () => {
  it("replaces today's unlogged meals, flags the removed ingredients, and says so", () => {
    // Today both meals are the nut curry (by swap); then she adds a nut allergy.
    const swaps = [0, 1].map((slot) => ({ creatorId: CREATOR_ID, date: MON, slot, itemId: "nut-curry" }));
    const base = buildWeekMeals(input({ meals: 2, swaps }));
    const after = buildWeekMeals(input({ meals: 2, allergies: ["nuts"], swaps }));
    const logged: MealLog[] = [{ creatorId: CREATOR_ID, date: MON, slot: 0, kind: "plan", itemId: "nut-curry", at: 0 }];
    const c = allergyChange(base, after, MON, logged, RECIPES, BOUGHT, ["nuts"]);
    expect(c.replacedToday).toEqual([1]); // meal 1 was already logged
    expect(c.flagged).toContain("cashews");
    expect(c.flagged).not.toContain("onion"); // still used by other meals
    expect(c.message).toBe("Already cooked or bought something with nuts? Don't eat it.");
    expect(servedAllergens(after)).not.toContain("nuts");
  });

  it("only the meals that had the allergen change", () => {
    const before = buildWeekMeals(input({ meals: 4 }));
    const after = buildWeekMeals(input({ meals: 4, allergies: ["egg"] }));
    for (let d = 0; d < 7; d++)
      for (let s = 0; s < 4; s++) {
        const b = before[d].meals[s];
        const a = after[d].meals[s];
        const hadEgg = allItems.get(servedId(b)!)!.allergens.includes("egg");
        if (!hadEgg) expect(servedId(a)).toBe(servedId(b));
      }
  });

  it("bought items: removed items are flagged by name", () => {
    const before = buildWeekMeals(input({ cook: "buy" }));
    const after = buildWeekMeals(input({ cook: "buy", allergies: ["gluten"] }));
    const c = allergyChange(before, after, MON, [], RECIPES, BOUGHT, ["gluten"]);
    const hadGluten = before.some((d) => d.meals.some((m) => [m.boughtId, ...(m.sideIds ?? [])].some((id) => id && allItems.get(id)!.allergens.includes("gluten"))));
    if (hadGluten) expect(c.flagged.length).toBeGreaterThan(0);
    expect(servedAllergens(after)).not.toContain("gluten");
  });
});

describe("3.5 shopping list (F4)", () => {
  it("home days only, by shop area, scaled by Cooking for N", () => {
    const week = buildWeekMeals(input());
    const one = shoppingList(week, RECIPES, 1, []);
    const two = shoppingList(week, RECIPES, 2, []);
    expect(one.map((s) => s.area)).toEqual(["fruit-veg", "tins-dry"]);
    // onion: 2 per 4 servings = 0.5 per serving. For 2, each cooked meal adds 1 serving → +0.5 onion per meal.
    const cooked = week.flatMap((d) => d.meals).filter((m) => m.recipeId);
    const herServings = cooked.reduce((a, m) => a + m.servings! / RECIPES.find((r) => r.id === m.recipeId)!.servings * 2, 0);
    const onion1 = one[0].items.find((i) => i.name === "onion")!;
    const onion2 = two[0].items.find((i) => i.name === "onion")!;
    expect(onion1.qty).toBe(Math.ceil(herServings - 1e-9));
    const extra = cooked.reduce((a, m) => a + 2 / RECIPES.find((r) => r.id === m.recipeId)!.servings, 0);
    expect(onion2.qty).toBe(Math.ceil(herServings + extra - 1e-9));
    expect(onion2.qty).toBeGreaterThan(onion1.qty);
  });

  it("away days are left out", () => {
    const all = shoppingList(buildWeekMeals(input()), RECIPES, 1, []);
    const away = new Set(Array.from({ length: 7 }, (_, i) => addDays(MON, i)));
    expect(shoppingList(buildWeekMeals(input({ awayDates: away })), RECIPES, 1, [])).toEqual([]);
    expect(all.length).toBeGreaterThan(0);
  });

  it("grams round up to 10; with allergies every item says Check the label; flagged items marked", () => {
    const list = shoppingList(buildWeekMeals(input({ allergies: ["fish"] })), RECIPES, 1, ["onion"], ["onion"]);
    for (const s of list)
      for (const i of s.items) {
        expect(i.checkLabel).toBe(true);
        if (i.unit === "g") expect(i.qty % 10).toBe(0);
      }
    expect(list[0].items.find((i) => i.name === "onion")!.flagged).toBe(true);
  });
});

describe("3.5 pick up this week (F8)", () => {
  it("counts ready meals, grab items and sides on home days, with size lines", () => {
    const week = buildWeekMeals(input({ cook: "buy" }));
    const items = pickupList(week, BOUGHT, []);
    const total = items.reduce((a, i) => a + i.count, 0);
    // 7 days × (1 grab + 2 ready + 2 sides) = 35
    expect(total).toBe(35);
    for (const i of items) expect(i.sizeLine).toBeTruthy();
    expect(items[0].kind).toBe("ready");
    const away = buildWeekMeals(input({ cook: "buy", awayDates: new Set([MON]) }));
    expect(pickupList(away, BOUGHT, []).reduce((a, i) => a + i.count, 0)).toBe(30);
  });
});
