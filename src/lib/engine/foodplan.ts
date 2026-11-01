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
  fractionText,
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
  /** Her sign-up day. Days before it have no meals; her first cook batch starts here. */
  planStart?: ISODate;
  /** Daily food on a date (days already gone keep the plan they had). Default: `daily`. */
  dailyFor?: (date: ISODate) => number;
  /** Buyer extra sides on a date. Default: `sideDelta`. */
  sideDeltaFor?: (date: ISODate) => number;
}

// ---------- What counts as veg, and which sides go with a main ----------

const NOT_VEG = /berr|banana|apple|mango|lemon|lime|orange|pear|grape|kiwi|peach|pineapple|melon|\bdates?\b|raisin|sultana|fruit|parsley|chive|coriander|basil|mint|dill|thyme|rosemary|herb|ginger|garlic|chill?i/i;

/** A recipe has veg when it lists a vegetable (fruit and herbs don't count). */
export function recipeHasVeg(r: { ingredients: Recipe["ingredients"] }): boolean {
  return r.ingredients.some(
    (g) => (g.area === "fruit-veg" && !NOT_VEG.test(g.name)) || (g.area === "freezer" && /veg|spinach|peas\b|broccoli/i.test(g.name)),
  );
}

/** Sides for a ready meal: fruit, salad or veg. Never a carb side (bread, rice, beans) next to a carb ready meal. */
export function isMainSide(b: BoughtItem): boolean {
  return b.kind === "side" && b.mealTypes.includes("main") && /fruit|salad|veg/i.test(`${b.id} ${b.name}`);
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

/** One batch cook: the day she cooks and the days it feeds (her shopping list covers the same days). */
export interface CookBatch {
  cookOn: ISODate;
  from: ISODate;
  to: ISODate;
}

/**
 * Her first batch, from her sign-up day. Mon–Tue: cook today for up to Wednesday. Wed–Fri: cook today
 * for up to Sunday. Saturday: cook tomorrow (Sunday) for Saturday to Wednesday, Saturday made fresh.
 * Sunday: cook today for Sunday to Wednesday.
 */
export function firstBatch(planStart: ISODate): CookBatch {
  const wd = weekday(planStart);
  const ws = weekStartOf(planStart);
  if (wd <= 1) return { cookOn: planStart, from: planStart, to: addDays(ws, 2) };
  if (wd <= 4) return { cookOn: planStart, from: planStart, to: addDays(ws, 6) };
  if (wd === 5) return { cookOn: addDays(planStart, 1), from: planStart, to: addDays(ws, 9) };
  return { cookOn: planStart, from: planStart, to: addDays(planStart, 3) };
}

/** The batch a date eats from. Normal weeks: Sunday cooks Mon–Wed; Wednesday cooks Thu–Sun (Sunday from the freezer). */
export function batchFor(date: ISODate, planStart?: ISODate): CookBatch {
  if (planStart && date >= planStart) {
    const first = firstBatch(planStart);
    if (date <= first.to) return first;
  }
  const ws = weekStartOf(date);
  return weekday(date) <= 2
    ? { cookOn: addDays(ws, -1), from: ws, to: addDays(ws, 2) }
    : { cookOn: addDays(ws, 2), from: addDays(ws, 3), to: addDays(ws, 6) };
}

/** The next cook batch from today: the one whose cook day is today or later. List and cook day both use it. */
export function nextCookBatch(today: ISODate, planStart?: ISODate): CookBatch {
  const b = batchFor(today, planStart);
  return b.cookOn >= today ? b : batchFor(addDays(b.to, 1), planStart);
}

/**
 * The slots a batch's shopping list and pick-up list cover: every meal on its days from today on
 * (never a day gone), less mains cooked in another batch, plus frozen portions of this batch eaten later.
 */
export function batchDays(days: DayPlan[], batch: CookBatch, today: ISODate): DayPlan[] {
  const start = batch.from > today ? batch.from : today;
  return days
    .filter((d) => !d.away && !d.beforeStart && d.date >= start)
    .map((d) => ({
      ...d,
      meals: d.meals.filter((m) => {
        const inRange = d.date <= batch.to;
        if (m.source === "cook" && m.mealType === "main" && m.cookedOn) {
          if (m.cookedOn === batch.cookOn) return true;
          // Made fresh that day (in range); else it belongs to another batch's list.
          return inRange && m.cookedOn === d.date;
        }
        return inRange;
      }),
    }))
    .filter((d) => d.meals.length > 0);
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
  // When each batch is cooked. Before her sign-up a batch was never cooked; the batch her first day
  // falls in is cooked on that day (a Saturday start cooks on Sunday and makes Saturday fresh).
  const P = i.planStart;
  const blockLast = [addDays(i.weekStart, 2), addDays(i.weekStart, 5)];
  const blockCookOn = (b: 0 | 1): ISODate | null => {
    const cd = cookDate(i.weekStart, b);
    if (!P || cd >= P) return cd;
    if (blockLast[b] < P || weekday(P) === 5) return null;
    return P;
  };
  // Sunday: portions from this week's freezer-friendly batch mains, else a fresh quick main.
  const freezerMains = [
    ...new Map(
      batches.flatMap((b, bi) =>
        blockCookOn(bi as 0 | 1) ? b.all.filter((r) => r.freezer).map((r) => [r.id, { r, block: bi as 0 | 1 }] as const) : [],
      ),
    ).values(),
  ];
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
  const sides = stablePick(rank(i.bought.filter(isMainSide), `${seed}:side`), 3, safe);
  const grabBreakfast = boughtPool("grab", "breakfast", `${seed}:grab:b`);
  const grabSnack = boughtPool("grab", "snack", `${seed}:grab:s`);

  const counters = { hot: [0, 0], lunch: [0, 0], sunday: 0, fresh: 0, breakfast: 0, snack: 0, ready: 0, side: 0, grabB: 0, grabS: 0 };
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
  const sauceFor = (r: Recipe, key: string, advance = true): Sauce | undefined => {
    const options = rank(
      r.sauces.map((id) => sauceById.get(id)).filter((x): x is Sauce => !!x && safe(x)),
      `${seed}:sauce:${key}:${r.id}`,
    ).slice(0, 2);
    if (!options.length) return undefined;
    // Her own swap takes the first sauce and leaves the turns of the plan's meals alone.
    if (!advance) return options[0];
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
    const away = i.awayDates.has(date);
    const workout = i.workouts?.[date] ?? null;
    if (P && date < P) return { date, away, workout, meals: [], beforeStart: true };
    const prefs = i.prefsFor(date);
    const n = effectiveMealsPerDay(prefs.mealsPerDay, prefs.fasting);
    const types = slotMealTypes(n);
    const kcal = mealKcal(i.dailyFor ? i.dailyFor(date) : i.daily, n);
    const sidesPerSlot = buyerSidesPerSlot(types, i.sideDeltaFor ? i.sideDeltaFor(date) : i.sideDelta);
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
        if (type === "main" && index === lunchIndex) base.lunch = true;
        // The plan's own pick is always made first, so a swap in one slot never moves another.
        let r: Recipe | undefined;
        let fromFreezer = false;
        let cookedOn: ISODate | undefined;
        if (!away) {
          if (type === "main" && block !== 2) {
            const on = blockCookOn(block);
            if (on) {
              cookedOn = on;
              const pick = batchMain(block, index === lunchIndex, diffDays(on, date));
              r = pick.r;
              fromFreezer = pick.fromFreezer;
            } else if (freshSunday.length) {
              // No batch cooked for this day yet (a Saturday start): a quick main made fresh.
              r = freshSunday[counters.fresh++ % freshSunday.length];
              cookedOn = date;
            }
          } else if (type === "main") {
            if (freezerMains.length) {
              const f = freezerMains[counters.sunday++ % freezerMains.length];
              r = f.r;
              fromFreezer = true;
              cookedOn = blockCookOn(f.block)!;
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
        const sauceKey = type === "main" ? `b${block}` : type;
        let sauce = r ? sauceFor(r, sauceKey) : undefined;
        const sw = swap ? recipeById.get(swap.itemId) : undefined;
        if (sw && safe(sw) && sw.mealTypes.includes(type)) {
          r = sw;
          base.swapped = true;
          fromFreezer = false;
          cookedOn = type === "main" && block !== 2 ? (blockCookOn(block) ?? date) : date;
          // Her own pick that wouldn't keep this long: from the freezer if it freezes, else made fresh that day.
          if (!withinFridgeDays(sw, diffDays(cookedOn, date))) {
            if (sw.freezer) fromFreezer = true;
            else cookedOn = date;
          }
          sauce = sauceFor(sw, sauceKey, false);
        }
        const hands = handPortions(kcal, type === "main" || (!!r && recipeHasVeg(r)));
        base.hands = hands;
        base.handLine = handLine(hands);
        if (r) {
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
      // I buy most food. The plan's pick first (so a swap never moves another slot), then her swap.
      base.checkLabel = i.allergies.length > 0;
      let planned: string | undefined;
      if (type === "main") planned = ready.length ? ready[counters.ready++ % ready.length].id : undefined;
      else if (type === "breakfast") planned = grabBreakfast.length ? grabBreakfast[counters.grabB++ % grabBreakfast.length].id : undefined;
      else {
        const pool = grabSnack.length ? grabSnack : grabBreakfast;
        planned = pool.length ? pool[counters.grabS++ % pool.length].id : undefined;
      }
      const sw = swap ? boughtById.get(swap.itemId) : undefined;
      const wantKind = type === "main" ? "ready" : "grab";
      if (sw && safe(sw) && (sw.kind === wantKind || (type === "main" && sw.kind === "grab")) && sw.mealTypes.includes(type)) {
        base.boughtId = sw.id;
        base.swapped = true;
      } else base.boughtId = planned;
      base.sideIds = Array.from({ length: sidesPerSlot[index] }, () =>
        sides.length ? sides[counters.side++ % sides.length].id : "",
      ).filter(Boolean);
      if (!base.boughtId) {
        // Nothing safe to buy for this meal: show her size in hands instead.
        base.hands = handPortions(kcal, type === "main");
        base.handLine = handLine(base.hands);
      }
      return base;
    });
    return { date, away, workout, meals };
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
  /** The first amount's number and unit (e.g. 13 and "tins"); see `amount` for the whole line. */
  qty: number;
  unit: string;
  /** What the list shows: "200 g + 3", "13 tins", "1 head", "5½ tbsp". Empty when to taste. */
  amount: string;
  area: ShopArea;
  checkLabel: boolean;
  flagged: boolean;
  /** "to taste" items (salt, pepper, a pinch of spice): no amount shown. */
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

/** A tin is 400 g (or 400 ml). */
export const TIN_SIZE = 400;
/** Lettuce leaves come as heads: about this many leaves to a head. */
export const LEAVES_PER_HEAD = 20;
/** Spices under this many teaspoons in total are "to taste". */
export const TO_TASTE_TSP = 1;

const TIN = /\b(tinned|canned|tin of)\b/i;
const LEAVES = /lettuce.*leaves|leaves.*lettuce/i;

/** Unit families that merge: tsp↔tbsp, g↔kg, ml↔l. Everything else merges only with itself. */
function family(unit: string): { fam: string; factor: number; tin?: boolean } {
  const u = unit.trim().toLowerCase();
  // "tin (400 g)", "tins (400 ml)": the tin's size in grams or ml.
  const tin = /^tins? \((\d+(?:\.\d+)?)\s*(g|ml)\)$/.exec(u);
  if (tin) return { fam: tin[2] === "g" ? "mass" : "volume", factor: Number(tin[1]), tin: true };
  if (u === "tsp") return { fam: "spoon", factor: 1 };
  if (u === "tbsp") return { fam: "spoon", factor: 3 };
  if (u === "g") return { fam: "mass", factor: 1 };
  if (u === "kg") return { fam: "mass", factor: 1000 };
  if (u === "ml") return { fam: "volume", factor: 1 };
  if (u === "l") return { fam: "volume", factor: 1000 };
  return { fam: `unit:${u}`, factor: 1 };
}

function numText(n: number, spoon = false): string {
  if (Number.isInteger(n)) return String(n);
  return spoon ? fractionText(n) : String(Math.round(n * 10) / 10);
}

/** One part of a line, in the unit people shop in. */
function part(name: string, fam: string, base: number, tinned = false): { qty: number; unit: string } {
  if (fam === "mass" || fam === "volume") {
    if (tinned || TIN.test(name)) {
      const tins = Math.max(1, Math.ceil(base / TIN_SIZE - 1e-9));
      return { qty: tins, unit: tins === 1 ? "tin" : "tins" };
    }
    const small = fam === "mass" ? "g" : "ml";
    const big = fam === "mass" ? "kg" : "l";
    return base >= 1000 ? { qty: roundQty(base / 1000, big), unit: big } : { qty: roundQty(base, small), unit: small };
  }
  if (fam === "spoon") return base >= 3 ? { qty: roundQty(base / 3, "tbsp"), unit: "tbsp" } : { qty: roundQty(base, "tsp"), unit: "tsp" };
  const unit = fam.slice("unit:".length);
  if (!unit && LEAVES.test(name)) {
    const heads = Math.max(1, Math.ceil(base / LEAVES_PER_HEAD - 1e-9));
    return { qty: heads, unit: heads === 1 ? "head" : "heads" };
  }
  return { qty: roundQty(base, unit), unit };
}

/**
 * The batch's days (see batchDays; away days left out), sorted by shop area, one line per item.
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
  const acc = new Map<string, { name: string; area: ShopArea; parts: Map<string, number>; anyToTaste: boolean; tinned: boolean }>();
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
          const key = g.name.trim().toLowerCase();
          let cur = acc.get(key);
          if (!cur) acc.set(key, (cur = { name: g.name, area: g.area, parts: new Map(), anyToTaste: false, tinned: false }));
          if (!(g.qty > 0)) {
            cur.anyToTaste = true;
            continue;
          }
          const f = family(g.unit);
          if (f.tin) cur.tinned = true;
          cur.parts.set(f.fam, (cur.parts.get(f.fam) ?? 0) + (g.qty / item.servings) * servings * f.factor);
        }
    }
  }
  const items: ShoppingItem[] = [...acc.entries()].map(([key, x]) => {
    const fams = [...x.parts.entries()];
    // A pinch of a spice (under 1 tsp in all) is "to taste".
    const pinch = x.area === "tins-dry" && fams.length === 1 && fams[0][0] === "spoon" && fams[0][1] < TO_TASTE_TSP;
    const shown = pinch ? [] : fams.map(([fam, base]) => part(x.name, fam, base, x.tinned));
    const amount = shown.map((p) => (p.unit ? `${numText(p.qty, p.unit === "tsp" || p.unit === "tbsp")} ${p.unit}` : numText(p.qty))).join(" + ");
    return {
      key,
      name: x.name,
      qty: shown[0]?.qty ?? 0,
      unit: shown[0]?.unit ?? "",
      amount,
      area: x.area,
      checkLabel: allergies.length > 0,
      flagged: flaggedNames.includes(x.name),
      toTaste: shown.length === 0,
    };
  });
  return SHOP_AREA_ORDER.map((area) => ({
    area,
    title: AREA_NAMES[area],
    items: items.filter((x) => x.area === area).sort((a, b) => a.name.localeCompare(b.name)),
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
    .map((s) => [s.title, ...s.items.map((i) => (i.toTaste ? `- ${i.name}` : `- ${i.name}: ${i.amount}`))].join("\n"))
    .join("\n\n");
}

export function pickupText(items: PickupItem[]): string {
  return items.map((i) => `- ${i.name} · ${i.count} (${i.sizeLine})`).join("\n");
}
