import { CREATOR_ID, type AppState } from "../types";

export const SCHEMA_VERSION = 1;
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
    training: { creatorId: CREATOR_ID, daysPerWeek: 3, minutes: 20, equipment: ["floor"] },
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
      extraSets: { legs: 0, push: 0, pull: 0, core: 0 },
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

/**
 * Migrate persisted state from an older schema version. v1 is the first; unknown or
 * missing fields are filled from the initial state so old files never crash the app.
 */
export function migrate(persisted: unknown, version: number): AppState {
  const base = initialState();
  if (typeof persisted !== "object" || persisted === null) return base;
  const p = persisted as Partial<AppState>;
  // Future: if (version < 2) { ...transform... }
  void version;
  return {
    ...base,
    ...p,
    schemaVersion: SCHEMA_VERSION,
    creatorId: base.creatorId,
    profile: { ...base.profile, ...(p.profile ?? {}) },
    training: { ...base.training, ...(p.training ?? {}) },
    food: { ...base.food, ...(p.food ?? {}) },
    settings: { ...base.settings, ...(p.settings ?? {}), units: { ...base.settings.units, ...(p.settings?.units ?? {}) } },
    subscription: { ...base.subscription, ...(p.subscription ?? {}) },
    adjustments: {
      ...base.adjustments,
      ...(p.adjustments ?? {}),
      extraSets: { ...base.adjustments.extraSets, ...(p.adjustments?.extraSets ?? {}) },
    },
  };
}

export const STATE_KEYS = Object.keys(initialState()) as (keyof AppState)[];

export function pickState<T extends Partial<AppState>>(s: T): AppState {
  const out = {} as Record<string, unknown>;
  for (const k of STATE_KEYS) out[k] = (s as Record<string, unknown>)[k];
  return out as unknown as AppState;
}
