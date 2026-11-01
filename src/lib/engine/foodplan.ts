// SPEC 3.5 Food content: week of meals, swaps, allergies, shopping and pick-up lists.
import type {
  Allergen,
  BoughtItem,
  CookOrBuy,
  DayPlan,
  ISODate,
  MealLog,
  MealSlot,
  MealSwap,
  MealType,
  Recipe,
  SessionLetter,
  ShopArea,
} from "../types";
import { weekDates } from "./dates";
import {
  buyerSidesPerSlot,
  effectiveMealsPerDay,
  handLine,
  handPortions,
  mealKcal,
  servingMultiplier,
  servingsLabel,
  slotMealTypes,
  SERVING_MAX,
  SERVING_MIN,
} from "./food";

export const ALLERGY_WARNING = (names: string) => `Already cooked or bought something with ${names}? Don't eat it.`;
export const CHECK_LABEL = "Check the label";

const ALLERGEN_WORDS: Record<Allergen, string> = {
  nuts: "nuts",
  peanuts: "peanuts",
  egg: "egg",
  shellfish: "shellfish",
  fish: "fish",
  soy: "soy",
  sesame: "sesame",
  gluten: "gluten",
  dairy: "dairy",
};

export function allergenWords(a: Allergen[]): string {
  const w = a.map((x) => ALLERGEN_WORDS[x]);
  if (w.length <= 1) return w[0] ?? "";
  return `${w.slice(0, -1).join(", ")} or ${w[w.length - 1]}`;
}

export function isSafe(item: { allergens: Allergen[] }, allergies: Allergen[]): boolean {
  return !item.allergens.some((a) => allergies.includes(a));
}

/** FNV-1a, for stable ranking. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function rank<T extends { id: string }>(items: T[], key: string): T[] {
  return [...items].sort((a, b) => hash(`${key}:${a.id}`) - hash(`${key}:${b.id}`) || a.id.localeCompare(b.id));
}

/**
 * Pick k items keeping positions stable: each position takes its ranked item if safe,
 * else the next safe item from beyond the first k. So a new allergy only changes the
 * meals that had it.
 */
export function stablePick<T extends { id: string }>(ranked: T[], k: number, ok: (t: T) => boolean): T[] {
  const out: T[] = [];
  const used = new Set<string>();
  const pool = ranked.slice(k);
  for (let p = 0; p < Math.min(k, ranked.length); p++) {
    const base = ranked[p];
    if (ok(base)) {
      out.push(base);
      used.add(base.id);
      continue;
    }
    const sub = pool.find((x) => ok(x) && !used.has(x.id));
    if (sub) {
      out.push(sub);
      used.add(sub.id);
    }
  }
  return out;
}

function fits(r: Recipe, kcal: number): boolean {
  const raw = kcal / r.kcal;
  return raw >= SERVING_MIN && raw <= SERVING_MAX;
}

/** Recipes for a meal type, ranked; ones that fit the meal size first. */
function recipePool(recipes: Recipe[], type: MealType, kcal: number, key: string, batchFirst: boolean): Recipe[] {
  const all = recipes.filter((r) => r.mealTypes.includes(type));
  const ranked = rank(all, key);
  const score = (r: Recipe) => (fits(r, kcal) ? 0 : 2) + (batchFirst && !r.batch ? 1 : 0);
  return ranked.sort((a, b) => score(a) - score(b));
}

export interface DayFoodPrefs {
  mealsPerDay: number;
  cookOrBuy: CookOrBuy;
  fasting: boolean;
}

export interface WeekMealsInput {
  weekStart: ISODate;
  awayDates: Set<ISODate>;
  /** Food prefs in effect on a date (meals a day / cook-buy changes start tomorrow). */
  prefsFor: (date: ISODate) => DayFoodPrefs;
  daily: number;
  allergies: Allergen[];
  recipes: Recipe[];
  bought: BoughtItem[];
  sideDelta: number;
  swaps: MealSwap[];
  workouts?: Record<ISODate, SessionLetter | null>;
  seed?: string;
}

/** Two batch cooks a week: Mon–Thu and Fri–Sun. */
export function cookBlock(dayIndex: number): 0 | 1 {
  return dayIndex < 4 ? 0 : 1;
}

export function buildWeekMeals(i: WeekMealsInput): DayPlan[] {
  const dates = weekDates(i.weekStart);
  const seed = i.seed ?? i.weekStart;
  const safe = (x: { allergens: Allergen[] }) => isSafe(x, i.allergies);
  const recipeById = new Map(i.recipes.map((r) => [r.id, r]));
  const boughtById = new Map(i.bought.map((b) => [b.id, b]));

  // Typical meal size, for choosing recipes that scale well.
  const p0 = i.prefsFor(dates[0]);
  const kcal0 = mealKcal(i.daily, effectiveMealsPerDay(p0.mealsPerDay, p0.fasting));

  const mainsByBlock = [0, 1].map((b) => {
    const days = dates.filter((_, idx) => cookBlock(idx) === b);
    const count = days.reduce((a, d) => {
      const p = i.prefsFor(d);
      return a + slotMealTypes(effectiveMealsPerDay(p.mealsPerDay, p.fasting)).filter((t) => t === "main").length;
    }, 0);
    const k = count >= 6 ? 3 : 2;
    return stablePick(recipePool(i.recipes, "main", kcal0, `${seed}:main:${b}`, true), k, safe);
  });
  const pickTwo = (type: MealType) =>
    stablePick(
      recipePool(i.recipes, type, kcal0, `${seed}:${type}`, false).sort(
        (a, b) => Number(a.minutes > 10) - Number(b.minutes > 10),
      ),
      2,
      safe,
    );
  const breakfasts = pickTwo("breakfast");
  const snacks = pickTwo("snack");
  const boughtPool = (kind: "ready" | "grab" | "side", type: MealType | null, key: string) =>
    stablePick(
      rank(
        i.bought.filter((b) => b.kind === kind && (type === null || b.mealTypes.includes(type))),
        key,
      ),
      3,
      safe,
    );
  const ready = boughtPool("ready", "main", `${seed}:ready`);
  const sides = boughtPool("side", null, `${seed}:side`);
  const grabBreakfast = boughtPool("grab", "breakfast", `${seed}:grab:b`);
  const grabSnack = boughtPool("grab", "snack", `${seed}:grab:s`);

  const counters = { main: [0, 0], breakfast: 0, snack: 0, ready: 0, side: 0, grabB: 0, grabS: 0 };

  return dates.map((date, dayIdx) => {
    const prefs = i.prefsFor(date);
    const n = effectiveMealsPerDay(prefs.mealsPerDay, prefs.fasting);
    const types = slotMealTypes(n);
    const kcal = mealKcal(i.daily, n);
    const away = i.awayDates.has(date);
    const sidesPerSlot = buyerSidesPerSlot(types, i.sideDelta);
    const block = cookBlock(dayIdx);

    const meals: MealSlot[] = types.map((type, index) => {
      const swap = i.swaps.find((s) => s.date === date && s.slot === index);
      const base: MealSlot = {
        date,
        index,
        label: `Meal ${index + 1}`,
        mealType: type,
        source: prefs.cookOrBuy,
        checkLabel: false,
        swapped: false,
      };
      if (prefs.cookOrBuy === "cook") {
        let r: Recipe | undefined;
        const sw = swap ? recipeById.get(swap.itemId) : undefined;
        if (sw && safe(sw) && sw.mealTypes.includes(type)) {
          r = sw;
          base.swapped = true;
        } else if (!away) {
          if (type === "main") {
            const list = mainsByBlock[block];
            r = list.length ? list[counters.main[block]++ % list.length] : undefined;
          } else if (type === "breakfast") {
            r = breakfasts.length ? breakfasts[counters.breakfast++ % breakfasts.length] : undefined;
          } else {
            r = snacks.length ? snacks[counters.snack++ % snacks.length] : undefined;
          }
        }
        const hands = handPortions(kcal);
        base.hands = hands;
        base.handLine = handLine(hands);
        if (r) {
          const m = servingMultiplier(kcal, r.kcal);
          base.recipeId = r.id;
          base.servings = m;
          base.servingsLabel = servingsLabel(m);
        }
        return base;
      }
      // I buy most food
      base.checkLabel = i.allergies.length > 0;
      const sw = swap ? boughtById.get(swap.itemId) : undefined;
      const wantKind = type === "main" ? "ready" : "grab";
      if (sw && safe(sw) && sw.kind === wantKind && sw.mealTypes.includes(type)) {
        base.boughtId = sw.id;
        base.swapped = true;
      } else if (type === "main") {
        base.boughtId = ready.length ? ready[counters.ready++ % ready.length].id : undefined;
      } else if (type === "breakfast") {
        base.boughtId = grabBreakfast.length ? grabBreakfast[counters.grabB++ % grabBreakfast.length].id : undefined;
      } else {
        const pool = grabSnack.length ? grabSnack : grabBreakfast;
        base.boughtId = pool.length ? pool[counters.grabS++ % pool.length].id : undefined;
      }
      base.sideIds = Array.from({ length: sidesPerSlot[index] }, () =>
        sides.length ? sides[counters.side++ % sides.length].id : "",
      ).filter(Boolean);
      return base;
    });
    return { date, away, workout: i.workouts?.[date] ?? null, meals };
  });
}

/** Item id currently served in a slot. */
export function servedId(slot: MealSlot): string | undefined {
  return slot.recipeId ?? slot.boughtId;
}

// ---------- Swaps (F3) ----------

export interface SwapOption {
  id: string;
  name: string;
  favourite: boolean;
  sizeLine?: string;
}

/** Same meal type, never an allergen, favourites first. Buyers: mains swap for ready meals, others for grab-and-go. */
export function swapOptions(
  slot: MealSlot,
  recipes: Recipe[],
  bought: BoughtItem[],
  allergies: Allergen[],
  favourites: string[],
  max = 3,
): SwapOption[] {
  const current = servedId(slot);
  const key = `${slot.date}:${slot.index}`;
  const fav = (id: string) => favourites.includes(id);
  const order = <T extends { id: string }>(xs: T[]) =>
    rank(xs, key).sort((a, b) => Number(fav(b.id)) - Number(fav(a.id)));
  if (slot.source === "cook") {
    return order(recipes.filter((r) => r.mealTypes.includes(slot.mealType) && isSafe(r, allergies) && r.id !== current))
      .slice(0, max)
      .map((r) => ({ id: r.id, name: r.name, favourite: fav(r.id) }));
  }
  const kind = slot.mealType === "main" ? "ready" : "grab";
  return order(
    bought.filter(
      (b) => b.kind === kind && b.mealTypes.includes(slot.mealType) && isSafe(b, allergies) && b.id !== current,
    ),
  )
    .slice(0, max)
    .map((b) => ({ id: b.id, name: b.name, favourite: fav(b.id), sizeLine: b.sizeLine }));
}

// ---------- New allergy ----------

export interface AllergyChange {
  /** Today's unlogged slots whose meal was replaced. */
  replacedToday: number[];
  /** Shopping or pick-up items to flag (from meals that were removed). */
  flagged: string[];
  message: string;
}

/**
 * Compare the week before and after a new allergy. Today's unlogged meals are replaced at
 * once (the plan already never serves an allergen); flagged items are the ingredients or
 * bought items of meals that left the week.
 */
export function allergyChange(
  before: DayPlan[],
  after: DayPlan[],
  today: ISODate,
  logs: MealLog[],
  recipes: Recipe[],
  bought: BoughtItem[],
  newAllergens: Allergen[],
): AllergyChange {
  const ids = (w: DayPlan[]) => new Set(w.flatMap((d) => d.meals.flatMap((m) => [servedId(m), ...(m.sideIds ?? [])])));
  const beforeIds = ids(before);
  const afterIds = ids(after);
  const removed = [...beforeIds].filter((x): x is string => !!x && !afterIds.has(x));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const boughtById = new Map(bought.map((b) => [b.id, b]));
  const keptIngredients = new Set(
    [...afterIds].flatMap((id) => (id && recipeById.get(id)?.ingredients.map((g) => g.name)) || []),
  );
  const flagged = new Set<string>();
  for (const id of removed) {
    const r = recipeById.get(id);
    if (r) r.ingredients.filter((g) => !keptIngredients.has(g.name)).forEach((g) => flagged.add(g.name));
    const b = boughtById.get(id);
    if (b) flagged.add(b.name);
  }
  const bDay = before.find((d) => d.date === today);
  const aDay = after.find((d) => d.date === today);
  const logged = new Set(logs.filter((l) => l.date === today).map((l) => l.slot));
  const replacedToday =
    bDay && aDay
      ? aDay.meals
          .filter((m) => !logged.has(m.index))
          .filter((m) => {
            const b = bDay.meals.find((x) => x.index === m.index);
            return !!b && servedId(b) !== servedId(m);
          })
          .map((m) => m.index)
      : [];
  return { replacedToday, flagged: [...flagged].sort(), message: ALLERGY_WARNING(allergenWords(newAllergens)) };
}

// ---------- Shopping list (F4) ----------

export const SHOP_AREA_ORDER: ShopArea[] = ["fruit-veg", "fridge", "tins-dry", "freezer"];
export const AREA_NAMES: Record<ShopArea, string> = {
  "fruit-veg": "Fruit and veg",
  fridge: "Fridge",
  "tins-dry": "Tins and dry",
  freezer: "Freezer",
};

export interface ShoppingItem {
  key: string;
  name: string;
  qty: number;
  unit: string;
  area: ShopArea;
  checkLabel: boolean;
  flagged: boolean;
}

export interface ShoppingSection {
  area: ShopArea;
  title: string;
  items: ShoppingItem[];
}

export function roundQty(qty: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "g" || u === "ml") return Math.ceil(qty / 10 - 1e-9) * 10;
  if (u === "tsp" || u === "tbsp" || u === "cup" || u === "cups") return Math.ceil(qty * 2 - 1e-9) / 2;
  if (u === "kg" || u === "l") return Math.ceil(qty * 10 - 1e-9) / 10;
  return Math.ceil(qty - 1e-9);
}

/**
 * The week's home days only (away days left out), sorted by shop area.
 * "Cooking for N": her portion (the serving multiplier) plus one serving for each other person.
 */
export function shoppingList(
  week: DayPlan[],
  recipes: Recipe[],
  cookingFor: number,
  allergies: Allergen[],
  flaggedNames: string[] = [],
): ShoppingSection[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const acc = new Map<string, ShoppingItem>();
  const others = Math.max(0, Math.round(cookingFor) - 1);
  for (const day of week) {
    if (day.away) continue;
    for (const m of day.meals) {
      if (m.source !== "cook" || !m.recipeId) continue;
      const r = byId.get(m.recipeId);
      if (!r) continue;
      const servings = (m.servings ?? 1) + others;
      for (const g of r.ingredients) {
        const key = `${g.name.toLowerCase()}|${g.unit}`;
        const cur = acc.get(key);
        const add = (g.qty / r.servings) * servings;
        if (cur) cur.qty += add;
        else
          acc.set(key, {
            key,
            name: g.name,
            qty: add,
            unit: g.unit,
            area: g.area,
            checkLabel: allergies.length > 0,
            flagged: flaggedNames.includes(g.name),
          });
      }
    }
  }
  return SHOP_AREA_ORDER.map((area) => ({
    area,
    title: AREA_NAMES[area],
    items: [...acc.values()]
      .filter((x) => x.area === area)
      .map((x) => ({ ...x, qty: roundQty(x.qty, x.unit) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((s) => s.items.length > 0);
}

// ---------- Pick up this week (F8) ----------

export interface PickupItem {
  key: string;
  id: string;
  name: string;
  kind: "ready" | "grab" | "side";
  count: number;
  sizeLine: string;
  checkLabel: boolean;
  flagged: boolean;
}

export function pickupList(
  week: DayPlan[],
  bought: BoughtItem[],
  allergies: Allergen[],
  flaggedNames: string[] = [],
): PickupItem[] {
  const byId = new Map(bought.map((b) => [b.id, b]));
  const counts = new Map<string, number>();
  for (const day of week) {
    if (day.away) continue;
    for (const m of day.meals) {
      if (m.source !== "buy") continue;
      for (const id of [m.boughtId, ...(m.sideIds ?? [])]) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const kindOrder = { ready: 0, grab: 1, side: 2 };
  return [...counts.entries()]
    .map(([id, count]) => {
      const b = byId.get(id)!;
      return {
        key: id,
        id,
        name: b.name,
        kind: b.kind,
        count,
        sizeLine: b.sizeLine,
        checkLabel: allergies.length > 0,
        flagged: flaggedNames.includes(b.name),
      };
    })
    .filter((x) => x.name)
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.name.localeCompare(b.name));
}

/** Plain text for Share list (Web Share API or copy). */
export function shoppingText(sections: ShoppingSection[]): string {
  return sections
    .map((s) => [s.title, ...s.items.map((i) => `- ${i.name}: ${i.qty}${i.unit ? " " + i.unit : ""}`)].join("\n"))
    .join("\n\n");
}

export function pickupText(items: PickupItem[]): string {
  return items.map((i) => `- ${i.name} · ${i.count} (${i.sizeLine})`).join("\n");
}
