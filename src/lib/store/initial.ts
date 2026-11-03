import { DEFAULT_MINUTES, toSessionMinutes } from "../engine/workouts";
import { CREATOR_ID, type AppState, type CheckIn, type SessionLetter, type SessionMinutes, type WorkoutSession } from "../types";

/** v2 (minimum dose): lengths 10/20/35 became 8/15/25, session C and the per-area extra sets went. */
export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = "8020jacked:v1";

export function initialState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    creatorId: CREATOR_ID,
    createdOn: null,
    planStart: null,
    profile: {
      creatorId: CREATOR_ID,
      firstName: null,
      age: null,
      heightCm: null,
      setupWeightKg: null,
      noWeigh: false,
      goal: null,
      termsAcceptedOn: null,
      safetySeenOn: null,
    },
    training: { creatorId: CREATOR_ID, daysPerWeek: 3, minutes: DEFAULT_MINUTES, equipment: ["floor"] },
    food: {
      creatorId: CREATOR_ID,
      mealsPerDay: 3,
      cookOrBuy: "cook",
      fasting: false,
      allergies: [],
      cookingFor: 1,
    },
    foodChanges: [],
    settings: {
      creatorId: CREATOR_ID,
      checkInDay: 6,
      dayStart: "07:00",
      reminder: "morning",
      quietOnAwayDays: true,
      emailReminders: false,
      units: { weight: "kg", height: "cm" },
      theme: "system",
      showWeightNumbers: true,
      sharedPhone: false,
      bigScreen: false,
      stillPictures: false,
      photosOn: false,
      installShown: false,
      ringerTipShown: false,
    },
    subscription: { creatorId: CREATOR_ID, kind: "test", label: "Test version, free", trialUsed: false },
    adjustments: {
      creatorId: CREATOR_ID,
      kcalDelta: 0,
      sideDelta: 0,
      speedBrakeOn: null,
    },
    blocks: [],
    workouts: [],
    hurts: [],
    setAside: [],
    todaySwaps: [],
    ladderSteps: {},
    targets: {},
    mealLogs: [],
    mealSwaps: [],
    favourites: [],
    weighIns: [],
    clothes: [],
    checkIns: [],
    checkInDraft: null,
    awayDays: [],
    awayWeekly: [],
    scheduleMoves: [],
    walks: [],
    photos: [],
    shoppingTicks: [],
    pickupTicks: [],
    allergyNotices: [],
    cookProgress: [],
    easyWeek: null,
    lastOpened: null,
    setupStep: null,
  };
}

/** Old lengths to new (10 → 8, 20 → 15, 35 → 25); anything unknown becomes Standard. */
function minutesOf(v: unknown, fallback: SessionMinutes = DEFAULT_MINUTES): SessionMinutes {
  return toSessionMinutes(v) ?? fallback;
}

/** Session C (old 4-day plans) is now Full body B. */
function letterOf(v: unknown): SessionLetter {
  return v === "A" ? "A" : "B";
}

/**
 * Migrate persisted state from an older schema version; unknown or missing fields are
 * filled from the initial state so old files never crash the app.
 * v1 → v2: minutes 10/20/35 → 8/15/25 (profile, workouts, check-ins), letter C → B,
 * the per-area extra sets dropped (the step-up is now a longer session).
 * The mapping is idempotent, so running it on v2 data changes nothing.
 */
export function migrate(persisted: unknown, version: number): AppState {
  const base = initialState();
  if (typeof persisted !== "object" || persisted === null) return base;
  const p = persisted as Partial<AppState>;
  void version;
  const workouts = Array.isArray(p.workouts)
    ? p.workouts.map((w: WorkoutSession) => ({ ...w, letter: letterOf(w.letter), minutes: minutesOf(w.minutes) }))
    : base.workouts;
  const checkIns = Array.isArray(p.checkIns)
    ? p.checkIns.map((c: CheckIn) =>
        c?.result?.change?.minutes !== undefined
          ? { ...c, result: { ...c.result, change: { ...c.result.change, minutes: minutesOf(c.result.change.minutes) } } }
          : c,
      )
    : base.checkIns;
  const adjustments = { ...base.adjustments, ...(p.adjustments ?? {}) } as AppState["adjustments"] & { extraSets?: unknown };
  delete adjustments.extraSets;
  return {
    ...base,
    ...p,
    schemaVersion: SCHEMA_VERSION,
    creatorId: base.creatorId,
    profile: { ...base.profile, ...(p.profile ?? {}) },
    training: { ...base.training, ...(p.training ?? {}), minutes: minutesOf(p.training?.minutes) },
    workouts,
    checkIns,
    food: { ...base.food, ...(p.food ?? {}) },
    settings: { ...base.settings, ...(p.settings ?? {}), units: { ...base.settings.units, ...(p.settings?.units ?? {}) } },
    subscription: { ...base.subscription, ...(p.subscription ?? {}) },
    adjustments,
  };
}

export const STATE_KEYS = Object.keys(initialState()) as (keyof AppState)[];

export function pickState<T extends Partial<AppState>>(s: T): AppState {
  const out = {} as Record<string, unknown>;
  for (const k of STATE_KEYS) out[k] = (s as Record<string, unknown>)[k];
  return out as unknown as AppState;
}
