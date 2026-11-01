// Small selectors for the Today and Food screens (builder 2). Pure functions of state + content.
// Screens never calculate: every number they show comes from here or from ./selectors.
import recipesRaw from "@/content/recipes.json";
import * as E from "../engine";
import type { AppState, ISODate, MealLog, Recipe } from "../types";
import { awaySet, isAway, mealView, selectDayPlan, selectSchedule, selectToday, selectWeight, selectCheckIn, selectAllergyNotice } from "./selectors";

// ---------- meal logging ----------

/** The most recent meal log (by time saved) for a day. Today keeps that card up during its Undo. */
export function selectLastMealLog(s: AppState, date: ISODate = selectToday(s)): MealLog | null {
  let best: MealLog | null = null;
  for (const l of s.mealLogs) if (l.date === date && (!best || l.at >= best.at)) best = l;
  return best;
}

// ---------- Today ----------

/** T5: today's finished workout, if any. */
export function selectDoneToday(s: AppState): { name: string; minutes: number } | null {
  const w = E.doneOn(s.workouts, selectToday(s));
  return w ? { name: E.SESSION_NAMES[w.letter], minutes: w.minutes } : null;
}

export type TodayBanner = "allergy" | "speed_brake" | "payment" | "check_in";

/**
 * T1: at most one banner. Wireframe priority: safety warning (new allergy) > meals a little bigger
 * (speed brake) > payment didn't go through (T1b) > check-in due.
 */
export function selectTodayBanner(s: AppState, paymentFailed = false): TodayBanner | null {
  if (selectAllergyNotice(s)) return "allergy";
  if (selectWeight(s).speedBrakeBanner) return "speed_brake";
  if (paymentFailed) return "payment";
  if (selectCheckIn(s).due) return "check_in";
  return null;
}

/** F1 and T7: when today is an away day, the last day of this run of away days. */
export function selectAwayUntil(s: AppState): ISODate | null {
  const today = selectToday(s);
  if (!isAway(s, today)) return null;
  let d = today;
  // A weekly repeat could run for ever; stop after 8 weeks.
  for (let i = 0; i < 56 && isAway(s, E.addDays(d, 1)); i++) d = E.addDays(d, 1);
  return d;
}

/** T2 "Move to another day": the days this week a planned workout can move to. */
export function selectMoveDays(s: AppState, from: ISODate): ISODate[] {
  const ws = E.weekStart(from);
  const sched = selectSchedule(s, ws);
  if (!sched[from]) return [];
  const away = awaySet(s, ws);
  const today = selectToday(s);
  return E.weekDates(ws).filter((d) => d !== from && d >= today && !sched[d] && !away.has(d) && !E.doneOn(s.workouts, d));
}

/** Walks ticked today (T2 shows them as ticks 1 · 2 · 3 for the week). */
export function selectWalksToday(s: AppState): number {
  const today = selectToday(s);
  return s.walks.filter((w) => w.date === today).length;
}

// ---------- weigh-in (T3) ----------

export const KG_PER_LB = 0.45359237;

/** The number she typed, in kg, rounded to 0.1. Null when it isn't a sensible weight. */
export function weightInputToKg(text: string, unit: "kg" | "lb"): number | null {
  const v = Number(String(text).replace(",", ".").trim());
  if (!Number.isFinite(v) || v <= 0) return null;
  const kg = unit === "lb" ? v * KG_PER_LB : v;
  if (kg < 30 || kg > 300) return null;
  return Math.round(kg * 10) / 10;
}

// ---------- meal detail (F2 / F2b) ----------

export interface RecipeExtras {
  format: string | null;
  carry: "hot" | "cold" | null;
  pack: string | null;
  fridgeDays: number | null;
  sauces: string[];
  topping: string | null;
  washUp: string | null;
}

const rawById = new Map<string, Record<string, unknown>>(
  (Array.isArray(recipesRaw) ? (recipesRaw as unknown[]) : [])
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && typeof (r as { id?: unknown }).id === "string")
    .map((r) => [r.id as string, r]),
);

function text(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string") return text((v as { name: string }).name);
  return null;
}

function texts(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(text).filter((x): x is string => !!x);
  const t = text(v);
  return t ? [t] : [];
}

/**
 * Optional recipe fields from the food library (format, carry, pack, fridgeDays, sauces, topping,
 * washUp). Read from the parsed recipe when the parser keeps them, else from the content file.
 * Anything missing or odd comes back empty, so the meal view skips it.
 */
export function recipeExtras(recipe: Recipe | undefined): RecipeExtras {
  const empty: RecipeExtras = { format: null, carry: null, pack: null, fridgeDays: null, sauces: [], topping: null, washUp: null };
  if (!recipe) return empty;
  const parsed = recipe as unknown as Record<string, unknown>;
  const raw = rawById.get(recipe.id) ?? {};
  const get = (k: string) => (parsed[k] !== undefined ? parsed[k] : raw[k]);
  const carry = text(get("carry"))?.toLowerCase();
  const days = Number(get("fridgeDays"));
  const wash = get("washUp");
  return {
    format: text(get("format")),
    carry: carry === "hot" || carry === "cold" ? carry : null,
    pack: text(get("pack")),
    fridgeDays: Number.isFinite(days) && days > 0 ? Math.floor(days) : null,
    sauces: texts(get("sauces")),
    topping: texts(get("topping")).join(", ") || null,
    washUp: typeof wash === "number" ? (wash > 0 ? `${wash} ${wash === 1 ? "pan" : "pans"}` : null) : text(wash),
  };
}

/** Plain lines for the extras, in the order the meal view shows them. Empty fields are skipped. */
export function extrasLines(x: RecipeExtras): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  if (x.sauces.length) out.push({ key: "sauce", text: `Sauce: ${x.sauces.join(", ")}` });
  if (x.topping) out.push({ key: "topping", text: `On top: ${x.topping}` });
  const carry = x.carry === "hot" ? "Best eaten hot" : x.carry === "cold" ? "Fine to eat cold" : null;
  const carryLine = [carry, x.pack ? `Pack: ${x.pack}` : null].filter(Boolean).join(" · ");
  if (carryLine) out.push({ key: "carry", text: carryLine });
  if (x.fridgeDays) out.push({ key: "keeps", text: `Keeps ${x.fridgeDays} ${x.fridgeDays === 1 ? "day" : "days"} in the fridge` });
  if (x.washUp) out.push({ key: "wash", text: `Washing up: ${x.washUp}` });
  return out;
}

export interface MealIngredientLine {
  name: string;
  amount: string | null; // "120 g", "1½ tbsp", "2"; null = to taste
}

function amountText(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? String(qty) : E.fractionText(qty);
  return unit ? `${n} ${unit}` : n;
}

/**
 * F2 / F2b: everything the meal screen shows. Cooks: servings, hand portions, ingredients scaled for
 * "Cooking for N" (her serving + 1 for each other person, rounded as the shopping list) and the method.
 * Buyers: the item, sides and size lines. Never calories.
 */
export function selectMealDetail(s: AppState, date: ISODate, slot: number) {
  const day = selectDayPlan(s, date);
  const m = day?.meals.find((x) => x.index === slot);
  if (!m) return null;
  const view = mealView(s, m);
  const recipe = view.recipe;
  const cookingFor = s.food.cookingFor;
  const servings = (m.servings ?? 1) + Math.max(0, cookingFor - 1);
  const ingredients: MealIngredientLine[] = recipe
    ? recipe.ingredients.map((g) => {
        if (!(g.qty > 0)) return { name: g.name, amount: null };
        const qty = E.roundQty((g.qty / recipe.servings) * servings, g.unit);
        return { name: g.name, amount: amountText(qty, g.unit) };
      })
    : [];
  const extras = recipeExtras(recipe);
  return {
    date,
    slot,
    label: m.label,
    source: m.source,
    away: day.away,
    view,
    servingsLabel: m.servingsLabel ?? null,
    handLine: m.handLine ?? null,
    cookingFor,
    ingredients,
    method: recipe?.method ?? [],
    minutes: recipe?.minutes ?? null,
    extras,
    extrasLines: extrasLines(extras),
    sizeLines: m.source === "buy" ? [view.bought?.sizeLine, ...view.sides.map((x) => x.sizeLine)].filter((x): x is string => !!x) : [],
    checkLabel: view.checkLabel,
    logged: view.logged,
  };
}

// ---------- cook day (F5) ----------

/** A step's timer, from the minutes it names ("Bake for 15 minutes", "simmer 10–12 min"). Null = no timer. */
export function cookStepSeconds(step: string): number | null {
  const m = /(\d+)(?:\s*(?:–|-|to)\s*(\d+))?\s*(?:minutes?|mins?)\b/i.exec(step);
  if (!m) return null;
  const mins = Number(m[2] ?? m[1]);
  return mins > 0 && mins <= 240 ? mins * 60 : null;
}

/** T2: the day of the latest walk ticked this week (unticking takes that one off). */
export function selectLastWalkThisWeek(s: AppState): ISODate | null {
  const ws = E.weekStart(selectToday(s));
  const end = E.addDays(ws, 6);
  const dates = s.walks.map((w) => w.date).filter((d) => d >= ws && d <= end);
  return dates.length ? dates[dates.length - 1] : null;
}
