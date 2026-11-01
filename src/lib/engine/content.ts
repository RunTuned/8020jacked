// Parse content JSON (src/content/*.json) defensively. Bad rows are dropped, never served.
import {
  ALLERGENS,
  type Allergen,
  type BoughtItem,
  type Exercise,
  type Ingredient,
  type MealType,
  type Recipe,
  type Sauce,
} from "../types";

type Row = Record<string, unknown>;

const isRow = (x: unknown): x is Row => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);
const num = (x: unknown, d = 0): number => (typeof x === "number" && Number.isFinite(x) ? x : Number(x) || d);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
const oneOf = <T extends string>(x: unknown, opts: readonly T[], d: T): T =>
  opts.includes(x as T) ? (x as T) : d;

const MEAL_TYPES: readonly MealType[] = ["breakfast", "main", "snack"];

/**
 * Allergens: unknown values are kept out, but an item listing an allergen we don't know
 * is still safe-checked by the known ones. A missing allergens field drops the item.
 */
function allergens(x: unknown): Allergen[] | null {
  if (!Array.isArray(x)) return null;
  return x.filter((a): a is Allergen => ALLERGENS.includes(a as Allergen));
}

export function parseExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRow).flatMap((r) => {
    const id = str(r.id);
    if (!id || !str(r.pattern) || !str(r.ladder)) return [];
    return [
      {
        id,
        name: str(r.name, id),
        pattern: str(r.pattern),
        primaryMuscle: str(r.primaryMuscle),
        kit: oneOf(r.kit, ["none", "band", "dumbbell", "chair", "wall", "bar"] as const, "none"),
        level: oneOf(r.level, ["beginner", "intermediate", "advanced"] as const, "beginner"),
        ladder: str(r.ladder),
        ladderStep: num(r.ladderStep, 1),
        unit: oneOf(r.unit, ["reps", "seconds"] as const, "reps"),
        repMin: num(r.repMin, 8),
        repMax: num(r.repMax, 12),
        position: oneOf(r.position, ["standing", "seated", "floor", "wall"] as const, "floor"),
        cues: typeof r.cues === "string" ? (r.cues ? [r.cues] : []) : strs(r.cues),
        swaps: strs(r.swaps),
        noFloor: r.noFloor === true,
        perSide: r.perSide === true,
      },
    ];
  });
}

function ingredients(x: unknown): Ingredient[] {
  if (!Array.isArray(x)) return [];
  return x.filter(isRow).map((g) => ({
    name: str(g.name),
    qty: num(g.qty, 0),
    unit: str(g.unit),
    area: oneOf(g.area, ["fruit-veg", "fridge", "tins-dry", "freezer"] as const, "tins-dry"),
  }));
}

export function parseRecipes(raw: unknown): Recipe[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRow).flatMap((r) => {
    const a = allergens(r.allergens);
    const id = str(r.id);
    const kcal = num(r.kcal);
    if (!id || a === null || kcal <= 0) return [];
    return [
      {
        id,
        name: str(r.name, id),
        mealTypes: strs(r.mealTypes).filter((t): t is MealType => MEAL_TYPES.includes(t as MealType)),
        minutes: num(r.minutes),
        servings: Math.max(1, num(r.servings, 1)),
        kcal,
        protein: num(r.protein),
        allergens: a,
        batch: r.batch === true,
        ingredients: ingredients(r.ingredients),
        method: strs(r.method),
        ...(r.format === "tray" || r.format === "pot" ? { format: r.format } : {}),
        ...(typeof r.washUp === "number" ? { washUp: r.washUp } : {}),
        fridgeDays: fridgeDays(r.fridgeDays),
        freezer: r.freezer === true,
        carbsFrozen: r.carbsFrozen === true,
        ...(r.carry === "hot" || r.carry === "cold" ? { carry: r.carry } : {}),
        ...(str(r.pack) ? { pack: str(r.pack) } : {}),
        sauces: strs(r.sauces),
        ...(str(r.topping) ? { topping: str(r.topping) } : {}),
      },
    ];
  });
}

/** Fridge days: 1 to 3 (the cautious end of USDA 3–4). Missing or bad = 1, never more than 3. */
export const MAX_FRIDGE_DAYS = 3;
function fridgeDays(x: unknown): number {
  const n = Math.floor(num(x, 1));
  return Math.min(MAX_FRIDGE_DAYS, Math.max(1, n));
}

export function parseSauces(raw: unknown): Sauce[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRow).flatMap((r) => {
    const a = allergens(r.allergens);
    const id = str(r.id);
    if (!id || a === null) return [];
    return [
      {
        id,
        name: str(r.name, id),
        minutes: num(r.minutes),
        servings: Math.max(1, num(r.servings, 1)),
        kcal: Math.max(0, num(r.kcal)),
        protein: Math.max(0, num(r.protein)),
        allergens: a,
        fridgeDays: fridgeDays(r.fridgeDays),
        freezer: r.freezer === true,
        ingredients: ingredients(r.ingredients),
        method: strs(r.method),
      },
    ];
  });
}

export function parseBought(raw: unknown): BoughtItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRow).flatMap((r) => {
    const a = allergens(r.allergens);
    const id = str(r.id);
    if (!id || a === null) return [];
    return [
      {
        id,
        name: str(r.name, id),
        kind: oneOf(r.kind, ["ready", "grab", "side"] as const, "grab"),
        mealTypes: strs(r.mealTypes).filter((t): t is MealType => MEAL_TYPES.includes(t as MealType)),
        sizeLine: str(r.sizeLine),
        kcal: num(r.kcal),
        protein: num(r.protein),
        allergens: a,
      },
    ];
  });
}
