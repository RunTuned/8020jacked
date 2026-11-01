// SPEC 3.1 Profile -> daily food. Pure functions; kcal never reach the screen.
import type { FoodTargets, Goal, HandPortions, MealType } from "../types";

export const AVERAGE_HEIGHT_CM = 162; // Height "Not sure"
export const ACTIVITY_FACTOR = 1.4;
export const KCAL_FLOOR = 1500;
export const MAX_CUT_KCAL = 500;
export const CUT_FRACTION = 0.2;
export const FOOD_STEP_KCAL = 150;
export const BMI_LOSE_MIN = 20;
export const BMI_MAINTENANCE_ONLY = 18.5;
export const BMI_PROTEIN_CAP = 30;
export const BMI_PROTEIN_REF = 25;
export const PROTEIN_G_PER_KG = 1.6;
export const PROTEIN_G_PER_KG_LOSE = 2.0;
export const HAND_BASE_KCAL = 300;
export const SERVING_MIN = 0.5;
export const SERVING_MAX = 3;

export function heightOrAverage(heightCm: number | null): number {
  return heightCm && heightCm > 0 ? heightCm : AVERAGE_HEIGHT_CM;
}

/** Mifflin-St Jeor, women: 10*kg + 6.25*cm - 5*age - 161. */
export function bmr(age: number, heightCm: number | null, kg: number): number {
  return 10 * kg + 6.25 * heightOrAverage(heightCm) - 5 * age - 161;
}

export function maintenanceKcal(bmrKcal: number): number {
  return bmrKcal * ACTIVITY_FACTOR;
}

export function bmi(kg: number, heightCm: number | null): number {
  const m = heightOrAverage(heightCm) / 100;
  return kg / (m * m);
}

/** "Lose some weight" is hidden under BMI 20. */
export function loseAllowedByBmi(bmiValue: number): boolean {
  return bmiValue >= BMI_LOSE_MIN;
}

/** Under BMI 18.5: maintenance only. */
export function maintenanceOnly(bmiValue: number): boolean {
  return bmiValue < BMI_MAINTENANCE_ONLY;
}

/** Reaching BMI 20 during "Lose some weight": next check-in switches to Keep steady. */
export function reachedSteadySwitch(bmiValue: number): boolean {
  return bmiValue <= BMI_LOSE_MIN;
}

/** The cut for "Lose some weight": min(500, 20% of maintenance). */
export function baseCut(maintenance: number): number {
  return Math.min(MAX_CUT_KCAL, CUT_FRACTION * maintenance);
}

export interface DailyInput {
  goal: Goal | null;
  maintenance: number;
  /** Sum of check-in food changes (−150 per cut, +150 per speed brake). */
  kcalDelta: number;
  bmi: number;
}

/**
 * Daily food. Lose = maintenance − min(500, 20%) + check-in changes, kept between
 * maintenance − 500 and maintenance. Floor of 1,500 applies after every rule.
 */
export function dailyKcal({ goal, maintenance, kcalDelta, bmi: b }: DailyInput): number {
  let daily = maintenance;
  if (goal === "lose" && !maintenanceOnly(b)) {
    daily = maintenance - baseCut(maintenance) + kcalDelta;
    daily = Math.min(maintenance, Math.max(maintenance - MAX_CUT_KCAL, daily));
  }
  return Math.round(Math.max(KCAL_FLOOR, daily));
}

/** Protein: 1.6 g/kg, or 2.0 g/kg on Lose. Over BMI 30, the weight at BMI 25 is used. */
export function proteinG(kg: number, heightCm: number | null, goal: Goal | null): number {
  const m = heightOrAverage(heightCm) / 100;
  const ref = bmi(kg, heightCm) > BMI_PROTEIN_CAP ? BMI_PROTEIN_REF * m * m : kg;
  const perKg = goal === "lose" ? PROTEIN_G_PER_KG_LOSE : PROTEIN_G_PER_KG;
  return Math.round(ref * perKg);
}

/** Fasting mode: the same daily total in 2 bigger meals. */
export function effectiveMealsPerDay(mealsPerDay: number, fasting: boolean): number {
  return fasting ? 2 : mealsPerDay;
}

export function mealKcal(daily: number, meals: number): number {
  return daily / meals;
}

export interface TargetsInput {
  age: number;
  heightCm: number | null;
  /** Latest real weigh-in, else the setup weight. */
  kg: number;
  goal: Goal | null;
  kcalDelta: number;
  mealsPerDay: number;
  fasting: boolean;
}

export function foodTargets(i: TargetsInput): FoodTargets {
  const b = bmr(i.age, i.heightCm, i.kg);
  const maint = maintenanceKcal(b);
  const bmiValue = bmi(i.kg, i.heightCm);
  const daily = dailyKcal({ goal: i.goal, maintenance: maint, kcalDelta: i.kcalDelta, bmi: bmiValue });
  const n = effectiveMealsPerDay(i.mealsPerDay, i.fasting);
  return {
    bmr: b,
    maintenance: maint,
    daily,
    proteinG: proteinG(i.kg, i.heightCm, i.goal),
    mealsPerDay: n,
    mealKcal: mealKcal(daily, n),
    bmi: bmiValue,
    loseAllowed: loseAllowedByBmi(bmiValue),
    maintenanceOnly: maintenanceOnly(bmiValue),
  };
}

export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

/** Recipe serving multiplier, rounded to 0.25 and kept between ½ and 3. */
export function servingMultiplier(mealKcalValue: number, recipeKcalPerServing: number): number {
  if (recipeKcalPerServing <= 0) return 1;
  const raw = roundTo(mealKcalValue / recipeKcalPerServing, 0.25);
  return Math.min(SERVING_MAX, Math.max(SERVING_MIN, raw));
}

const FRACTIONS: Record<number, string> = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1.5 -> "1½", 0.75 -> "¾", 2 -> "2". */
export function fractionText(x: number): string {
  const whole = Math.floor(x + 1e-9);
  const frac = roundTo(x - whole, 0.25);
  const f = FRACTIONS[frac] ?? "";
  if (whole === 0) return f || "0";
  return `${whole}${f}`;
}

export function servingsLabel(x: number): string {
  return `${fractionText(x)} ${x === 1 || x < 1 ? "serving" : "servings"}`;
}

/** Hand portions: a 300 kcal meal = 1 palm, 1 cupped hand, 1 fist, 1 thumb; rounded to ½. */
export function handPortions(mealKcalValue: number): HandPortions {
  const n = Math.max(0.5, roundTo(mealKcalValue / HAND_BASE_KCAL, 0.5));
  return { palm: n, cuppedHand: n, fist: n, thumb: n };
}

function plural(n: number, one: string, many: string): string {
  return `${fractionText(n)} ${n > 1 ? many : one}`;
}

export function handLine(h: HandPortions): string {
  return [
    `${plural(h.palm, "palm", "palms")} protein`,
    `${plural(h.cuppedHand, "cupped hand", "cupped hands")} carbs`,
    `${plural(h.fist, "fist", "fists")} veg`,
    `${plural(h.thumb, "thumb", "thumbs")} fat`,
  ].join(" · ");
}

/**
 * Meal types per slot. 2 meals (and fasting): two mains. 3: breakfast + 2 mains.
 * 4: breakfast + 2 mains + a 4th meal (snack).
 */
export function slotMealTypes(meals: number): MealType[] {
  if (meals <= 2) return ["main", "main"];
  if (meals === 3) return ["breakfast", "main", "main"];
  return ["breakfast", "main", "main", "snack"];
}

/**
 * Buyers: each main meal is 1 ready meal + 1 side. A food size change adds or removes
 * a side (never "make it smaller"). Returns sides per slot.
 */
export function buyerSidesPerSlot(types: MealType[], sideDelta: number): number[] {
  const sides = types.map((t) => (t === "main" ? 1 : 0));
  const mains = types.map((t, i) => (t === "main" ? i : -1)).filter((i) => i >= 0);
  if (mains.length === 0) return sides;
  let d = sideDelta;
  let k = 0;
  while (d > 0) {
    sides[mains[k % mains.length]] += 1;
    d--;
    k++;
  }
  k = mains.length - 1;
  let guard = 0;
  while (d < 0 && guard < 50) {
    const i = mains[((k % mains.length) + mains.length) % mains.length];
    if (sides[i] > 0) {
      sides[i] -= 1;
      d++;
    }
    k--;
    guard++;
    if (sides.every((s) => s === 0)) break;
  }
  return sides;
}
