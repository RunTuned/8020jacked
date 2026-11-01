// Small invented content so tests never depend on src/content. No real person's data.
import type { Allergen, BoughtItem, Content, Exercise, Recipe } from "../../types";

const ex = (e: Partial<Exercise> & Pick<Exercise, "id" | "pattern" | "ladder" | "ladderStep">): Exercise => ({
  name: e.id,
  primaryMuscle: "quads",
  kit: "none",
  level: "beginner",
  unit: "reps",
  repMin: 8,
  repMax: 12,
  position: "standing",
  cues: ["Move slowly."],
  swaps: [],
  noFloor: true,
  ...e,
});

export const EXERCISES: Exercise[] = [
  ex({ id: "SQ1", name: "Sit-to-stand", pattern: "squat", ladder: "squat_bw", ladderStep: 1, kit: "chair", position: "seated", repMin: 8, repMax: 15, swaps: ["WS1"] }),
  ex({ id: "SQ2", name: "Bodyweight squat", pattern: "squat", ladder: "squat_bw", ladderStep: 2, repMin: 10, repMax: 20 }),
  ex({ id: "SQ3", name: "Pause squat", pattern: "squat", ladder: "squat_bw", ladderStep: 3, level: "intermediate" }),
  ex({ id: "WS1", name: "Wall sit", pattern: "squat", ladder: "wall_sit", ladderStep: 1, kit: "wall", position: "wall", unit: "seconds", repMin: 20, repMax: 45 }),
  ex({ id: "HI1", name: "Glute bridge", pattern: "hinge", ladder: "hinge_bw", ladderStep: 1, position: "floor", noFloor: false, primaryMuscle: "glutes", swaps: ["HS1"] }),
  ex({ id: "HI2", name: "Single-leg bridge", pattern: "hinge", ladder: "hinge_bw", ladderStep: 2, position: "floor", noFloor: false, primaryMuscle: "glutes" }),
  ex({ id: "HS1", name: "Wall hip hinge", pattern: "hinge", ladder: "hinge_standing", ladderStep: 1, primaryMuscle: "hamstrings" }),
  ex({ id: "DB1", name: "Dumbbell RDL", pattern: "hinge", ladder: "db_rdl", ladderStep: 1, kit: "dumbbell", primaryMuscle: "hamstrings" }),
  ex({ id: "LU1", name: "Supported split squat", pattern: "lunge", ladder: "lunge_bw", ladderStep: 1, primaryMuscle: "quads" }),
  ex({ id: "LU2", name: "Split squat", pattern: "lunge", ladder: "lunge_bw", ladderStep: 2, primaryMuscle: "quads" }),
  ex({ id: "PU1", name: "Wall push-up", pattern: "horizontal_push", ladder: "push_up", ladderStep: 1, kit: "wall", position: "wall", primaryMuscle: "chest" }),
  ex({ id: "PU2", name: "High incline push-up", pattern: "horizontal_push", ladder: "push_up", ladderStep: 2, primaryMuscle: "chest" }),
  ex({ id: "PU3", name: "Knee push-up", pattern: "horizontal_push", ladder: "push_up", ladderStep: 3, position: "floor", noFloor: false, primaryMuscle: "chest" }),
  ex({ id: "OP1", name: "Band overhead press", pattern: "vertical_push", ladder: "band_ohp", ladderStep: 1, kit: "band", primaryMuscle: "shoulders" }),
  ex({ id: "RW1", name: "Prone Y-T raise", pattern: "horizontal_pull", ladder: "row_bw", ladderStep: 1, position: "floor", noFloor: false, primaryMuscle: "upper_back" }),
  ex({ id: "RW2", name: "Door-frame row", pattern: "horizontal_pull", ladder: "row_bw", ladderStep: 2, primaryMuscle: "upper_back" }),
  ex({ id: "BR1", name: "Band row", pattern: "horizontal_pull", ladder: "band_row", ladderStep: 1, kit: "band", primaryMuscle: "upper_back" }),
  ex({ id: "LP1", name: "Floor lat pull", pattern: "vertical_pull", ladder: "floor_lat_pull", ladderStep: 1, position: "floor", noFloor: false, primaryMuscle: "lats" }),
  ex({ id: "PB1", name: "Dead hang", pattern: "vertical_pull", ladder: "pull_up", ladderStep: 1, kit: "bar", unit: "seconds", primaryMuscle: "lats" }),
  ex({ id: "CO1", name: "Dead bug", pattern: "core", ladder: "core_front", ladderStep: 1, position: "floor", noFloor: false, primaryMuscle: "abs" }),
  ex({ id: "CO2", name: "Plank", pattern: "core", ladder: "core_front", ladderStep: 2, position: "floor", noFloor: false, unit: "seconds", repMin: 20, repMax: 60, primaryMuscle: "abs" }),
  ex({ id: "CS1", name: "Standing wall plank", pattern: "core", ladder: "core_standing", ladderStep: 1, kit: "wall", position: "wall", unit: "seconds", repMin: 20, repMax: 40, primaryMuscle: "abs" }),
];

const rec = (
  id: string,
  mealTypes: Recipe["mealTypes"],
  kcal: number,
  allergens: Allergen[],
  extra: Partial<Recipe> = {},
): Recipe => ({
  id,
  name: id,
  mealTypes,
  minutes: 25,
  servings: 4,
  kcal,
  protein: 30,
  allergens,
  batch: mealTypes.includes("main"),
  ingredients: [
    { name: `${id} base`, qty: 400, unit: "g", area: "tins-dry" },
    { name: "onion", qty: 2, unit: "", area: "fruit-veg" },
  ],
  method: [`Cook ${id}.`, "Serve."],
  fridgeDays: 3,
  freezer: false,
  carbsFrozen: false,
  sauces: [],
  ...extra,
});

export const RECIPES: Recipe[] = [
  rec("chilli", ["main"], 400, []),
  rec("tuna-pasta", ["main"], 450, ["fish", "gluten"]),
  rec("chicken-rice", ["main"], 500, []),
  rec("lentil-soup", ["main"], 350, []),
  rec("satay", ["main"], 480, ["peanuts", "soy"]),
  rec("nut-curry", ["main"], 450, ["nuts", "dairy"], {
    ingredients: [
      { name: "cashews", qty: 100, unit: "g", area: "tins-dry" },
      { name: "onion", qty: 2, unit: "", area: "fruit-veg" },
    ],
  }),
  rec("egg-fried-rice", ["main"], 420, ["egg", "soy", "sesame"]),
  rec("prawn-stew", ["main"], 380, ["shellfish"]),
  rec("oats", ["breakfast"], 300, ["dairy", "gluten"], { minutes: 5, servings: 1 }),
  rec("eggs-toast", ["breakfast"], 280, ["egg", "gluten"], { minutes: 10, servings: 1 }),
  rec("fruit-bowl", ["breakfast", "snack"], 200, [], { minutes: 5, servings: 1 }),
  rec("hummus", ["snack"], 200, ["sesame"], { servings: 2 }),
  rec("apple-pb", ["snack"], 220, ["peanuts"], { servings: 1 }),
];

const buy = (id: string, kind: BoughtItem["kind"], mealTypes: BoughtItem["mealTypes"], allergens: Allergen[]): BoughtItem => ({
  id,
  name: id,
  kind,
  mealTypes,
  sizeLine: kind === "ready" ? "Regular pack (about 350–400 g), not large" : "1 piece",
  kcal: kind === "ready" ? 450 : 150,
  protein: 20,
  allergens,
});

export const BOUGHT: BoughtItem[] = [
  buy("ready-chicken-rice", "ready", ["main"], ["soy", "gluten"]),
  buy("ready-veg-curry", "ready", ["main"], []),
  buy("ready-fish-pie", "ready", ["main"], ["fish", "dairy"]),
  buy("ready-bean-chilli", "ready", ["main"], []),
  buy("side-fruit", "side", ["main", "snack"], []),
  buy("side-roll", "side", ["main"], ["gluten"]),
  buy("grab-yoghurt-fruit", "grab", ["breakfast", "snack"], ["dairy"]),
  buy("grab-sandwich", "grab", ["breakfast", "snack"], ["gluten", "egg"]),
  buy("grab-banana-oatcake", "grab", ["breakfast"], []),
  buy("grab-nuts", "grab", ["snack"], ["nuts"]),
];

export const CONTENT: Content = { exercises: EXERCISES, recipes: RECIPES, bought: BOUGHT };
