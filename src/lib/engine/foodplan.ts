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
  Sauce,
  SessionLetter,
  ShopArea,
} from "../types";
import { addDays, diffDays, weekday, weekDates, weekStart as weekStartOf } from "./dates";
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
  /** Quick sauces (src/content/sauces.json). Optional: no sauces = no sauce lines. */
  sauces?: Sauce[];
}

// ---------- Cook days (prep and carry) ----------

/**
 * Two cook days a week: Sunday cooks for Mon–Wed (block 0), Wednesday cooks for Thu–Sat (block 1).
 * Sunday itself (block 2) eats from the freezer, or a fresh quick meal. Everything stays within 3 fridge days.
 */
export type CookBlock = 0 | 1 | 2;
export function cookBlock(dayIndex: number): CookBlock {
  return dayIndex <= 2 ? 0 : dayIndex <= 5 ? 1 : 2;
}

/** Cook day of each block, in days from Monday: the Sunday before (−1), Wednesday (2), Sunday (6). */
export const COOK_DAY_OFFSET: Record<CookBlock, number> = { 0: -1, 1: 2, 2: 6 };

export function cookDate(weekStartDate: ISODate, block: CookBlock): ISODate {
  return addDays(weekStartDate, COOK_DAY_OFFSET[block]);
}

/**
 * The batch cook a date belongs to, for the cook day screen. Sunday cooks next week's Mon–Wed;
 * Mon–Tue still show that Sunday batch; Wednesday to Saturday show the Wednesday batch.
 */
export function cookSessionFor(date: ISODate): { weekStart: ISODate; block: 0 | 1; cookOn: ISODate } {
  const wd = weekday(date);
  const ws = weekStartOf(date);
  if (wd === 6) return { weekStart: addDays(ws, 7), block: 0, cookOn: date };
  const block = wd <= 1 ? 0 : 1;
  return { weekStart: ws, block, cookOn: cookDate(ws, block) };
}

/** A recipe may be eaten up to fridgeDays after it was cooked. */
export function withinFridgeDays(r: { fridgeDays: number }, ageDays: number): boolean {
  return ageDays <= r.fridgeDays;
}

export function buildWeekMeals(i: WeekMealsInput): DayPlan[] {
  const dates = weekDates(i.weekStart);
  const seed = i.seed ?? i.weekStart;
  const safe = (x: { allergens: Allergen[] }) => isSafe(x, i.allergies);
  const recipeById = new Map(i.recipes.map((r) => [r.id, r]));
  const boughtById = new Map(i.bought.map((b) => [b.id, b]));
  const sauceById = new Map((i.sauces ?? []).map((x) => [x.id, x]));

  // Typical meal size, for choosing recipes that scale well.
  const p0 = i.prefsFor(dates[0]);
  const kcal0 = mealKcal(i.daily, effectiveMealsPerDay(p0.mealsPerDay, p0.fasting));
  const mainsOn = (d: ISODate) => {
    const p = i.prefsFor(d);
    return slotMealTypes(effectiveMealsPerDay(p.mealsPerDay, p.fasting)).filter((t) => t === "main").length;
  };

  // Batch mains for the two cook days. At least one good-cold main per batch goes to lunches.
  const mainPools = ([0, 1] as const).map((b) => recipePool(i.recipes, "main", kcal0, `${seed}:main:${b}`, true));
  const batches = ([0, 1] as const).map((b) => {
    const count = dates.filter((_, idx) => cookBlock(idx) === b).reduce((a, d) => a + mainsOn(d), 0);
    const k = count >= 6 ? 3 : 2;
    const pool = mainPools[b];
    const cold = pool.filter((r) => r.carry === "cold");
    const coldPick = cold.length ? stablePick(cold, 1, safe) : [];
    const hot = coldPick.length ? pool.filter((r) => r.carry !== "cold") : pool;
    const hotPick = stablePick(hot, k - coldPick.length, safe);
    return { cold: coldPick, hot: hotPick.length ? hotPick : coldPick, all: [...coldPick, ...hotPick] };
  });
  // Sunday: portions from this week's freezer-friendly batch mains, else a fresh quick main.
  const freezerMains = [...new Map(batches.flatMap((b, bi) => b.all.filter((r) => r.freezer).map((r) => [r.id, { r, block: bi as 0 | 1 }]))).values()];
  const freshSunday = stablePick(
    recipePool(i.recipes, "main", kcal0, `${seed}:main:2`, false).sort((a, b) => Number(a.minutes > 20) - Number(b.minutes > 20)),
    2,
    safe,
  );

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
  // Allergies can rule out every ready meal: fall back to grab-and-go mains.
  const readyOnly = boughtPool("ready", "main", `${seed}:ready`);
  const ready = readyOnly.length ? readyOnly : boughtPool("grab", "main", `${seed}:grab:m`);
  const sides = boughtPool("side", null, `${seed}:side`);
  const grabBreakfast = boughtPool("grab", "breakfast", `${seed}:grab:b`);
  const grabSnack = boughtPool("grab", "snack", `${seed}:grab:s`);

  const counters = { hot: [0, 0], lunch: [0, 0], sunday: 0, breakfast: 0, snack: 0, ready: 0, side: 0, grabB: 0, grabS: 0 };
  // Extra fresh-enough mains a batch needs when nothing picked keeps long enough (by block and age).
  const extras = new Map<string, Recipe | null>();
  const extraFor = (b: 0 | 1, age: number, used: Recipe[]): Recipe | null => {
    const key = `${b}:${age}`;
    if (!extras.has(key))
      extras.set(key, mainPools[b].find((r) => safe(r) && withinFridgeDays(r, age) && !used.includes(r)) ?? null);
    return extras.get(key)!;
  };

  // Two sauces per main per batch, taking turns across the batch's days.
  const sauceTurns = new Map<string, number>();
  const sauceFor = (r: Recipe, key: string): Sauce | undefined => {
    const options = rank(
      r.sauces.map((id) => sauceById.get(id)).filter((x): x is Sauce => !!x && safe(x)),
      `${seed}:sauce:${key}:${r.id}`,
    ).slice(0, 2);
    if (!options.length) return undefined;
    const t = `${key}:${r.id}`;
    const n = sauceTurns.get(t) ?? 0;
    sauceTurns.set(t, n + 1);
    return options[n % options.length];
  };

  /** A batch main for a slot: lunches alternate cold and hot, and nothing is served past its fridge days. */
  const batchMain = (b: 0 | 1, isLunch: boolean, age: number): { r?: Recipe; fromFreezer: boolean } => {
    const batch = batches[b];
    let wanted: Recipe | undefined;
    if (isLunch && batch.cold.length && counters.lunch[b]++ % 2 === 0) wanted = batch.cold[0];
    else if (batch.hot.length) wanted = batch.hot[counters.hot[b]++ % batch.hot.length];
    const order = [...(wanted ? [wanted] : []), ...batch.hot, ...batch.cold];
    const fresh = order.find((r) => withinFridgeDays(r, age));
    if (fresh) return { r: fresh, fromFreezer: false };
    const frozen = order.find((r) => r.freezer);
    if (frozen) return { r: frozen, fromFreezer: true };
    const extra = extraFor(b, age, batch.all);
    return extra ? { r: extra, fromFreezer: false } : { fromFreezer: false };
  };

  return dates.map((date, dayIdx) => {
    const prefs = i.prefsFor(date);
    const n = effectiveMealsPerDay(prefs.mealsPerDay, prefs.fasting);
    const types = slotMealTypes(n);
    const kcal = mealKcal(i.daily, n);
    const away = i.awayDates.has(date);
    const sidesPerSlot = buyerSidesPerSlot(types, i.sideDelta);
    const block = cookBlock(dayIdx);
    const lunchIndex = types.indexOf("main");

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
        let fromFreezer = false;
        let cookedOn: ISODate | undefined;
        const sw = swap ? recipeById.get(swap.itemId) : undefined;
        if (type === "main" && index === lunchIndex) base.lunch = true;
        if (sw && safe(sw) && sw.mealTypes.includes(type)) {
          r = sw;
          base.swapped = true;
          cookedOn = type === "main" ? cookDate(i.weekStart, block) : date;
          // Her own pick that wouldn't keep this long: from the freezer if it freezes, else made fresh that day.
          if (!withinFridgeDays(sw, diffDays(cookedOn, date))) {
            if (sw.freezer) fromFreezer = true;
            else cookedOn = date;
          }
        } else if (!away) {
          if (type === "main" && block !== 2) {
            cookedOn = cookDate(i.weekStart, block);
            const pick = batchMain(block, index === lunchIndex, diffDays(cookedOn, date));
            r = pick.r;
            fromFreezer = pick.fromFreezer;
          } else if (type === "main") {
            if (freezerMains.length) {
              const f = freezerMains[counters.sunday++ % freezerMains.length];
              r = f.r;
              fromFreezer = true;
              cookedOn = cookDate(i.weekStart, f.block);
            } else if (freshSunday.length) {
              r = freshSunday[counters.sunday++ % freshSunday.length];
              cookedOn = date;
            }
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
          const sauce = sauceFor(r, type === "main" ? `b${block}` : type);
          const m = servingMultiplier(kcal - (sauce?.kcal ?? 0), r.kcal);
          base.recipeId = r.id;
          base.servings = m;
          base.servingsLabel = servingsLabel(m);
          if (sauce) base.sauceId = sauce.id;
          if (r.topping) base.topping = r.topping;
          if (r.carry) base.carry = r.carry;
          if (r.pack) base.pack = r.pack;
          base.fridgeDays = r.fridgeDays;
          base.freezer = r.freezer;
          base.carbsFrozen = r.carbsFrozen;
          if (cookedOn) {
            base.cookedOn = cookedOn;
            base.ageDays = diffDays(cookedOn, date);
          }
          if (fromFreezer) base.fromFreezer = true;
        }
        return base;
      }
      // I buy most food
      base.checkLabel = i.allergies.length > 0;
      const sw = swap ? boughtById.get(swap.itemId) : undefined;
      const wantKind = type === "main" ? "ready" : "grab";
      if (sw && safe(sw) && (sw.kind === wantKind || (type === "main" && sw.kind === "grab")) && sw.mealTypes.includes(type)) {
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
      if (!base.boughtId) {
        // Nothing safe to buy for this meal: show her size in hands instead.
        base.hands = handPortions(kcal);
        base.handLine = handLine(base.hands);
      }
      return base;
    });
    return { date, away, workout: i.workouts?.[date] ?? null, meals };
  });
}

/** Lunches she carries that are good cold, this week. */
export function coldLunchCount(week: DayPlan[], recipes: Recipe[]): number {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return week.flatMap((d) => d.meals).filter((m) => m.lunch && m.recipeId && byId.get(m.recipeId)?.carry === "cold").length;
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
  sauces: Sauce[] = [],
): AllergyChange {
  const ids = (w: DayPlan[]) =>
    new Set(w.flatMap((d) => d.meals.flatMap((m) => [servedId(m), m.sauceId, ...(m.sideIds ?? [])])));
  const beforeIds = ids(before);
  const afterIds = ids(after);
  const removed = [...beforeIds].filter((x): x is string => !!x && !afterIds.has(x));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const boughtById = new Map(bought.map((b) => [b.id, b]));
  const sauceById = new Map(sauces.map((x) => [x.id, x]));
  const cooked = (id: string) => recipeById.get(id) ?? sauceById.get(id);
  const keptIngredients = new Set(
    [...afterIds].flatMap((id) => (id && cooked(id)?.ingredients.map((g) => g.name)) || []),
  );
  const flagged = new Set<string>();
  for (const id of removed) {
    const r = cooked(id);
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
  /** "to taste" items (salt, pepper): no amount shown. */
  toTaste: boolean;
}

export interface ShoppingSection {
  area: ShopArea;
  title: string;
  items: ShoppingItem[];
}

export function roundQty(qty: number, unit: string): number {
  if (!(qty > 0)) return 0;
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
  sauces: Sauce[] = [],
): ShoppingSection[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const sauceById = new Map(sauces.map((x) => [x.id, x]));
  const acc = new Map<string, ShoppingItem>();
  const others = Math.max(0, Math.round(cookingFor) - 1);
  for (const day of week) {
    if (day.away) continue;
    for (const m of day.meals) {
      if (m.source !== "cook" || !m.recipeId) continue;
      const r = byId.get(m.recipeId);
      if (!r) continue;
      // The meal at her serving size, plus one sauce pot per person.
      const sauce = m.sauceId ? sauceById.get(m.sauceId) : undefined;
      const parts: { item: { servings: number; ingredients: Recipe["ingredients"] }; servings: number }[] = [
        { item: r, servings: (m.servings ?? 1) + others },
        ...(sauce ? [{ item: sauce, servings: 1 + others }] : []),
      ];
      for (const { item, servings } of parts)
      for (const g of item.ingredients) {
        const toTaste = !(g.qty > 0);
        const key = toTaste ? `${g.name.toLowerCase()}|to-taste` : `${g.name.toLowerCase()}|${g.unit}`;
        const cur = acc.get(key);
        const add = toTaste ? 0 : (g.qty / item.servings) * servings;
        if (cur) cur.qty += add;
        else
          acc.set(key, {
            key,
            name: g.name,
            qty: add,
            unit: toTaste ? "" : g.unit,
            area: g.area,
            checkLabel: allergies.length > 0,
            flagged: flaggedNames.includes(g.name),
            toTaste,
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
    .map((s) => [s.title, ...s.items.map((i) => (i.toTaste ? `- ${i.name}` : `- ${i.name}: ${i.qty}${i.unit ? " " + i.unit : ""}`))].join("\n"))
    .join("\n\n");
}

export function pickupText(items: PickupItem[]): string {
  return items.map((i) => `- ${i.name} · ${i.count} (${i.sizeLine})`).join("\n");
}
