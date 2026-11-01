// Shared types for 8020jacked v0.1. Every persisted record carries creatorId.
// Dates are local calendar days as "YYYY-MM-DD" strings. Times are epoch ms.

export const CREATOR_ID = "8020jacked" as const;
export type CreatorId = typeof CREATOR_ID;

export type ISODate = string; // "YYYY-MM-DD"

// ---------- Content (from src/content/*.json) ----------

export type Allergen =
  | "nuts"
  | "peanuts"
  | "egg"
  | "shellfish"
  | "fish"
  | "soy"
  | "sesame"
  | "gluten"
  | "dairy";

export const ALLERGENS: readonly Allergen[] = [
  "nuts",
  "peanuts",
  "egg",
  "shellfish",
  "fish",
  "soy",
  "sesame",
  "gluten",
  "dairy",
];

export type ExerciseKit = "none" | "band" | "dumbbell" | "chair" | "wall" | "bar";
export type ExerciseLevel = "beginner" | "intermediate" | "advanced";
export type ExerciseUnit = "reps" | "seconds";
export type ExercisePosition = "standing" | "seated" | "floor" | "wall";

export interface Exercise {
  id: string;
  name: string;
  pattern: string; // squat, hinge, lunge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, core, ...
  primaryMuscle: string;
  kit: ExerciseKit;
  level: ExerciseLevel;
  ladder: string;
  ladderStep: number;
  unit: ExerciseUnit;
  repMin: number;
  repMax: number;
  position: ExercisePosition;
  /** Content may give one string or a list; the parser always returns a list. */
  cues: string[];
  swaps: string[];
  noFloor: boolean;
  perSide?: boolean;
}

export type MealType = "breakfast" | "main" | "snack";
export type ShopArea = "fruit-veg" | "fridge" | "tins-dry" | "freezer";

export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  area: ShopArea;
}

export interface Recipe {
  id: string;
  name: string;
  mealTypes: MealType[];
  minutes: number;
  servings: number;
  kcal: number; // per serving
  protein: number; // g per serving
  allergens: Allergen[];
  batch: boolean;
  ingredients: Ingredient[]; // quantities for `servings` servings
  method: string[];
}

export type BoughtKind = "ready" | "grab" | "side";

export interface BoughtItem {
  id: string;
  name: string;
  kind: BoughtKind;
  mealTypes: MealType[];
  sizeLine: string;
  kcal: number;
  protein: number;
  allergens: Allergen[];
}

export interface Content {
  exercises: Exercise[];
  recipes: Recipe[];
  bought: BoughtItem[];
}

// ---------- Profile and settings ----------

export type Goal = "lose" | "steady" | "stronger";
export type SessionMinutes = 10 | 20 | 35;
export type DaysPerWeek = 2 | 3 | 4;
export type MealsPerDay = 2 | 3 | 4;
export type CookOrBuy = "cook" | "buy";
export type Equipment = "floor" | "noFloor" | "bands" | "dumbbells";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday ... 6 = Sunday

export interface Profile {
  creatorId: CreatorId;
  firstName: string | null;
  age: number | null;
  /** null = "Not sure" (average 162 cm is used). */
  heightCm: number | null;
  /** Setup (rough) weight. NOT a weigh-in: it sizes meals and runs safety checks. */
  setupWeightKg: number | null;
  /** "I'd rather not weigh myself". */
  noWeigh: boolean;
  goal: Goal | null;
  termsAcceptedOn: ISODate | null;
  safetySeenOn: ISODate | null;
}

export interface TrainingPrefs {
  creatorId: CreatorId;
  daysPerWeek: DaysPerWeek;
  minutes: SessionMinutes;
  equipment: Equipment[];
}

export interface FoodPrefs {
  creatorId: CreatorId;
  mealsPerDay: MealsPerDay;
  cookOrBuy: CookOrBuy;
  fasting: boolean;
  /** Allergies apply at once (never served). */
  allergies: Allergen[];
  cookingFor: number;
}

/** Meals a day, cook/buy and fasting changes start tomorrow (S5). */
export interface FoodPrefsChange {
  creatorId: CreatorId;
  from: ISODate;
  mealsPerDay: MealsPerDay;
  cookOrBuy: CookOrBuy;
  fasting: boolean;
}

export type ReminderSlot = "morning" | "lunch" | "evening" | "never";
export type Units = { weight: "kg" | "lb"; height: "cm" | "ftin" };
export type Theme = "light" | "dark" | "system";

export interface Settings {
  creatorId: CreatorId;
  checkInDay: Weekday; // default Sunday (6)
  dayStart: string; // "HH:MM"
  reminder: ReminderSlot;
  quietOnAwayDays: boolean;
  emailReminders: boolean;
  units: Units;
  theme: Theme;
  showWeightNumbers: boolean;
  sharedPhone: boolean;
  bigScreen: boolean;
  stillPictures: boolean;
  photosOn: boolean;
  installShown: boolean;
  ringerTipShown: boolean;
}

export interface Subscription {
  creatorId: CreatorId;
  kind: "test";
  label: "Test version, free";
  trialUsed: boolean;
}

// ---------- Plan (engine output, not persisted) ----------

export type SessionLetter = "A" | "B" | "C";

export interface HandPortions {
  palm: number;
  cuppedHand: number;
  fist: number;
  thumb: number;
}

export interface FoodTargets {
  bmr: number;
  maintenance: number;
  daily: number;
  proteinG: number;
  mealsPerDay: number;
  mealKcal: number;
  bmi: number;
  loseAllowed: boolean;
  maintenanceOnly: boolean;
}

export interface MealSlot {
  date: ISODate;
  index: number; // 0-based; "Meal 1" = index 0
  label: string; // "Meal 1"
  mealType: MealType;
  source: CookOrBuy;
  /** cook */
  recipeId?: string;
  servings?: number; // rounded to 0.25
  servingsLabel?: string; // "1½ servings"
  hands?: HandPortions;
  handLine?: string;
  /** buy */
  boughtId?: string; // ready meal or grab item
  sideIds?: string[];
  checkLabel: boolean;
  swapped: boolean;
}

export interface DayPlan {
  date: ISODate;
  away: boolean;
  workout: SessionLetter | null;
  meals: MealSlot[];
}

export interface PlannedSet {
  setIndex: number;
  target: number; // reps or seconds
}

export interface PlannedMove {
  exerciseId: string;
  name: string;
  pattern: string;
  unit: ExerciseUnit;
  sets: PlannedSet[];
  restSeconds: number;
  cues: string[];
  perSide: boolean;
}

export interface PlannedSession {
  letter: SessionLetter;
  name: string; // "Legs and push"
  minutes: SessionMinutes;
  moves: PlannedMove[];
  totalSets: number;
  easy: boolean;
}

export interface Plan {
  targets: FoodTargets;
  week: DayPlan[];
}

// ---------- Logs (persisted) ----------

export type Effort = "too_easy" | "just_right" | "too_hard";

export interface SetLog {
  creatorId: CreatorId;
  exerciseId: string;
  setIndex: number;
  value: number; // reps or seconds
  unit: ExerciseUnit;
  /** true when saved in big screen mode: the planned number, not a counted one. */
  planned: boolean;
  effort?: Effort;
  at: number;
}

export interface WorkoutSession {
  creatorId: CreatorId;
  id: string;
  date: ISODate;
  letter: SessionLetter;
  minutes: SessionMinutes;
  status: "in_progress" | "done" | "part";
  sets: SetLog[];
  /** Effort per move, asked once per move (W3b). */
  moveEffort: Record<string, Effort>;
  effort?: Effort; // W7
  bigScreen: boolean;
  taster: boolean;
  startedAt: number;
  endedAt?: number;
}

export interface HurtLog {
  creatorId: CreatorId;
  date: ISODate;
  exerciseId: string;
  bodyPart: string;
}

export interface SetAside {
  creatorId: CreatorId;
  exerciseId: string;
  on: ISODate;
}

export interface TodaySwap {
  creatorId: CreatorId;
  date: ISODate;
  fromId: string;
  toId: string;
}

export type MealLogKind = "plan" | "like" | "else";
export type MealSize = "small" | "same" | "big";

export interface MealLog {
  creatorId: CreatorId;
  date: ISODate;
  slot: number;
  kind: MealLogKind;
  where?: "home" | "bought";
  size?: MealSize;
  itemId?: string; // recipe or bought item served at log time
  at: number;
}

export interface MealSwap {
  creatorId: CreatorId;
  date: ISODate;
  slot: number;
  itemId: string;
}

export interface WeighIn {
  creatorId: CreatorId;
  date: ISODate;
  kg: number;
  at: number;
}

export type ClothesFeel = "looser" | "same" | "tighter";

export interface ClothesAnswer {
  creatorId: CreatorId;
  date: ISODate; // check-in date
  feel: ClothesFeel;
}

export type CheckInAnswer = "sore" | "bad_sleep" | "busy" | "fasting" | "nothing";

export type CheckInChangeKind =
  | "nothing_logged"
  | "speed_brake"
  | "speed_brake_already"
  | "switch_to_steady"
  | "food_down"
  | "training_up"
  | "training_easier"
  | "plan_around_it"
  | "same";

export interface CheckInChange {
  kind: CheckInChangeKind;
  /** kcal change for food changes (never shown on screen). */
  kcalDelta?: number;
  /** buyers: sides a day added (+) or removed (-). */
  sideDelta?: number;
  /** training_up: which area gets one extra set. */
  area?: TrainingArea;
  /** training_easier / plan_around_it: new default minutes. */
  minutes?: SessionMinutes;
  /** plan_around_it: fasting mode on. */
  fasting?: boolean;
  newGoal?: Goal;
}

export interface CheckInResult {
  date: ISODate;
  change: CheckInChange;
  copy: string; // C4, 25 words or fewer
  why: string[]; // C5 plain sentences, no numbers shown as calories
  counts: boolean; // false = week doesn't count toward the 12
  askNormalNow: CheckInAnswer | null; // C8 flag
  /** saved-at-the-time facts for C5 */
  facts: {
    workoutsDone: number;
    workoutsPlanned: number;
    mealsLogged: number;
    mealsPlanned: number;
    walks: number;
    weighIns: number;
    averageKg: number | null;
    changeSinceStartKg: number | null;
    rule: string;
  };
}

export interface CheckIn {
  creatorId: CreatorId;
  date: ISODate;
  answers: CheckInAnswer[];
  clothes?: ClothesFeel;
  normalNow?: boolean;
  result: CheckInResult;
  accepted: boolean;
  at: number;
}

export interface CheckInDraft {
  creatorId: CreatorId;
  date: ISODate;
  answers: CheckInAnswer[];
  clothes?: ClothesFeel;
  normalNow?: boolean;
  expires: ISODate;
}

export type TrainingArea = "legs" | "push" | "pull" | "core";

/** Plan adjustments that check-ins accumulate. Reset when a new 12 weeks starts. */
export interface Adjustments {
  creatorId: CreatorId;
  kcalDelta: number;
  sideDelta: number;
  extraSets: Record<TrainingArea, number>;
  speedBrakeOn: ISODate | null;
}

export interface Block {
  creatorId: CreatorId;
  id: string;
  goal: Goal;
  start: ISODate;
  end?: ISODate;
}

export interface ScheduleMove {
  creatorId: CreatorId;
  weekStart: ISODate;
  from: ISODate;
  to: ISODate | null; // null = dropped, no mark
}

export interface WalkTick {
  creatorId: CreatorId;
  date: ISODate;
}

export interface PhotoMeta {
  creatorId: CreatorId;
  id: string;
  date: ISODate;
}

export interface ShoppingTicks {
  creatorId: CreatorId;
  weekStart: ISODate;
  ticked: string[]; // item keys
}

export interface AllergyNotice {
  creatorId: CreatorId;
  date: ISODate;
  allergens: Allergen[];
  flagged: string[]; // ingredient or item names affected
}

export interface CookProgress {
  creatorId: CreatorId;
  weekStart: ISODate;
  cookDay: number; // 0 or 1 (two batch cooks a week)
  step: number;
  done: boolean;
}

export interface EasyWeek {
  creatorId: CreatorId;
  start: ISODate;
  end: ISODate;
}

// ---------- Persisted app state ----------

export interface AppState {
  schemaVersion: number;
  creatorId: CreatorId;
  createdOn: ISODate | null;
  planStart: ISODate | null;
  profile: Profile;
  training: TrainingPrefs;
  food: FoodPrefs;
  foodChanges: FoodPrefsChange[];
  settings: Settings;
  subscription: Subscription;
  adjustments: Adjustments;
  blocks: Block[];
  workouts: WorkoutSession[];
  hurts: HurtLog[];
  setAside: SetAside[];
  todaySwaps: TodaySwap[];
  /** ladder -> current step (starts at the beginner rung). */
  ladderSteps: Record<string, number>;
  /** exerciseId -> next planned reps/seconds. */
  targets: Record<string, number>;
  mealLogs: MealLog[];
  mealSwaps: MealSwap[];
  favourites: string[];
  weighIns: WeighIn[];
  clothes: ClothesAnswer[];
  checkIns: CheckIn[];
  checkInDraft: CheckInDraft | null;
  awayDays: ISODate[];
  awayWeekly: Weekday[];
  scheduleMoves: ScheduleMove[];
  walks: WalkTick[];
  photos: PhotoMeta[];
  shoppingTicks: ShoppingTicks[];
  pickupTicks: ShoppingTicks[];
  allergyNotices: AllergyNotice[];
  cookProgress: CookProgress[];
  easyWeek: EasyWeek | null;
  lastOpened: number | null;
}
