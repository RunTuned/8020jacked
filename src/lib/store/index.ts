// The one store. Persisted to localStorage (key 8020jacked:v1). Screens call actions and read selectors.
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as E from "../engine";
import {
  CREATOR_ID,
  type Allergen,
  type AppState,
  type CheckInAnswer,
  type CheckInResult,
  type ClothesFeel,
  type CookOrBuy,
  type DaysPerWeek,
  type Effort,
  type Equipment,
  type Goal,
  type ISODate,
  type MealLogKind,
  type MealSize,
  type MealsPerDay,
  type ReminderSlot,
  type SessionLetter,
  type SessionMinutes,
  type SetupStep,
  type Theme,
  type Units,
  type Weekday,
} from "../types";
import { getContent } from "./content";
import { now, uid } from "./clock";
import { initialState, migrate, pickState, SCHEMA_VERSION, STORAGE_KEY } from "./initial";
import { exportJSON, parseImport, type ImportResult } from "./io";
import { deletePhotoBlob, deletePhotoBlobs, getPhotoBlob, savePhotoBlob } from "./photos";
import * as S from "./selectors";
import { safeStorage } from "./storage";

export * from "./selectors";
export * from "./progress";
export * from "./screens";
export * from "./train";
export { exportFileName } from "./io";
export * from "./units";
export { setContent, getContent } from "./content";
export { setClock, resetClock } from "./clock";
export { SCHEMA_VERSION, STORAGE_KEY, initialState, migrate } from "./initial";

// ---------- UI-only state (not persisted) ----------

export interface UndoEntry {
  id: string;
  kind: "meal" | "set" | "not_today" | "hurt";
  label: string; // "Saved. Undo" / "Moved. Undo"
  expiresAt: number;
  snapshot: Partial<AppState>;
}

export interface PendingGoal {
  goal: Goal;
  previousGoal: Goal | null;
  freshKg?: number;
  startsNew: boolean;
}

export interface UiState {
  undo: UndoEntry | null;
  pendingGoal: PendingGoal | null;
  lastCheckIn: CheckInResult | null;
}

export interface Actions {
  // Onboarding (A2–A13)
  saveAbout(a: { age: number; heightCm: number | null; setupWeightKg: number; noWeigh: boolean }): void;
  clearSetup(): void;
  saveGoal(goal: Goal, termsAccepted?: boolean): void;
  markSafetySeen(): void;
  saveTime(t: { minutes: SessionMinutes; daysPerWeek: DaysPerWeek }): void;
  saveEquipment(eq: Equipment[]): void;
  saveFoodSetup(f: { mealsPerDay: MealsPerDay; cookOrBuy: CookOrBuy; allergies: Allergen[] }): void;
  createPlan(): void;
  saveFirstName(name: string): void;
  saveSharedPhone(shared: boolean): void;
  saveReminders(r: { dayStart: string; reminder: ReminderSlot }): void;
  markInstallShown(): void;
  markOpened(): void;
  /** Setup resume point, saved after every setup screen (null = finished). */
  saveSetupStep(step: SetupStep | null): void;

  // Today
  logMeal(slot: number, kind: MealLogKind, extra?: { where?: "home" | "bought"; size?: MealSize; date?: ISODate }): boolean;
  notToday(): { movedTo: ISODate | null } | null;
  moveWorkout(from: ISODate, to: ISODate): boolean;
  tickWalk(date?: ISODate): boolean;
  untickWalk(date?: ISODate): void;
  saveAwayDays(dates: ISODate[], weekly: Weekday[]): void;
  startEasyWeek(): void;

  // Train
  setBigScreen(on: boolean): void;
  startWorkout(opts?: { taster?: boolean; letter?: SessionLetter; minutes?: SessionMinutes }): string | null;
  logSet(exerciseId: string, setIndex: number, value: number): boolean;
  rateMove(exerciseId: string, effort: Effort): void;
  tapHurts(exerciseId: string): { setAside: boolean };
  /** W5 Cancel: takes back the hurt just tapped on this move today (and its set-aside). */
  cancelHurt(exerciseId: string): void;
  swapToday(fromId: string, toId: string): void;
  finishWorkout(status: "done" | "part", effort?: Effort): void;
  discardWorkout(): void;
  fixSet(workoutId: string, exerciseId: string, setIndex: number, value: number): void;
  bringBack(exerciseId: string): void;
  markRingerTipShown(): void;

  // Food
  swapMeal(date: ISODate, slot: number, itemId: string): void;
  toggleFavourite(id: string): void;
  setCookingFor(n: number): void;
  tickShopping(key: string): void;
  tickPickup(key: string): void;
  saveCookStep(step: number): void;
  cookDayDone(): void;

  // Weigh-ins
  addWeighIn(kg: number, date?: ISODate): { speedBrake: boolean };
  editWeighIn(date: ISODate, kg: number): void;
  deleteWeighIn(date: ISODate): void;

  // Check-in (C1–C8)
  saveCheckInDraft(d: { answers?: CheckInAnswer[]; clothes?: ClothesFeel; normalNow?: boolean }): void;
  submitCheckIn(accepted: boolean): CheckInResult | null;

  // Goal and plan (S2, C7, A9)
  proposeGoal(goal: Goal, freshKg?: number): void;
  confirmGoal(): void;
  cancelGoal(): void;
  saveTraining(t: { daysPerWeek?: DaysPerWeek; minutes?: SessionMinutes }): void;

  // You (S3–S9)
  saveBodyStats(b: { age?: number; heightCm?: number | null; setupWeightKg?: number; noWeigh?: boolean }): void;
  saveUnits(u: Units): void;
  saveFoodPrefs(f: { mealsPerDay?: MealsPerDay; cookOrBuy?: CookOrBuy; fasting?: boolean; allergies?: Allergen[] }): void;
  saveReminderSettings(r: {
    dayStart?: string;
    reminder?: ReminderSlot;
    checkInDay?: Weekday;
    quietOnAwayDays?: boolean;
    emailReminders?: boolean;
  }): void;
  saveDisplay(d: { theme?: Theme; showWeightNumbers?: boolean; bigScreen?: boolean; stillPictures?: boolean; sharedPhone?: boolean }): void;
  setPhotosOn(on: boolean): Promise<void>;
  addPhoto(blob: Blob, date?: ISODate): Promise<string>;
  deletePhoto(id: string): Promise<void>;
  getPhoto(id: string): Promise<Blob | undefined>;
  exportData(): string;
  importData(text: string): ImportResult;
  deleteEverything(): Promise<void>;

  // Undo (5 s)
  undo(): boolean;
  clearUndo(): void;
}

export type Store = AppState & { ui: UiState } & Actions;

// ---------- helpers ----------

const lastTaps = new Map<string, number>();
/** Repeat taps of the same action within 1 s are ignored. */
export function isRepeat(key: string): boolean {
  const t = now();
  const prev = lastTaps.get(key);
  if (prev !== undefined && t - prev < E.REPEAT_TAP_MS) return true;
  lastTaps.set(key, t);
  return false;
}
export function resetRepeatGuard(): void {
  lastTaps.clear();
}

const today = (s: AppState) => S.selectToday(s);

export const useAppStore = create<Store>()(
  persist(
    (set, get) => {
      const st = (): AppState => pickState(get());
      const patch = (p: Partial<AppState>) => set(p as Partial<Store>);
      const withUndo = (kind: UndoEntry["kind"], label: string, keys: (keyof AppState)[], p: Partial<AppState>) => {
        const s = get();
        const snapshot: Partial<AppState> = {};
        for (const k of keys) (snapshot as Record<string, unknown>)[k] = s[k];
        set({
          ...(p as Partial<Store>),
          ui: { ...s.ui, undo: { id: uid(), kind, label, expiresAt: now() + E.UNDO_MS, snapshot } },
        });
      };

      /** Speed brake runs on every weigh-in, outside check-ins too. */
      const runSpeedBrake = (s: AppState, date: ISODate): Partial<AppState> | null => {
        if (s.profile.goal !== "lose" || s.profile.noWeigh) return null;
        const hit = E.speedBrake(s.weighIns, date, s.adjustments.speedBrakeOn);
        if (!hit) return null;
        const t = S.selectTargets(s, date);
        if (!t) return null;
        const raised = E.dailyKcal({
          goal: s.profile.goal,
          maintenance: t.maintenance,
          kcalDelta: s.adjustments.kcalDelta + E.SPEED_BRAKE_KCAL,
          bmi: t.bmi,
        });
        if (raised <= t.daily) return null;
        const buyer = S.prefsFor(s, date).cookOrBuy === "buy";
        return {
          adjustments: E.applyChange(
            s.adjustments,
            { kind: "speed_brake", kcalDelta: E.SPEED_BRAKE_KCAL, sideDelta: buyer ? 1 : 0 },
            date,
          ),
        };
      };

      const foodChangeFrom = (s: AppState, from: ISODate, f: Partial<Pick<AppState["food"], "mealsPerDay" | "cookOrBuy" | "fasting">>) => {
        const cur = S.prefsFor(s, from);
        const next = {
          creatorId: CREATOR_ID,
          from,
          mealsPerDay: (f.mealsPerDay ?? cur.mealsPerDay) as MealsPerDay,
          cookOrBuy: f.cookOrBuy ?? cur.cookOrBuy,
          fasting: f.fasting ?? cur.fasting,
        };
        return [...s.foodChanges.filter((c) => c.from !== from), next].sort((a, b) => (a.from < b.from ? -1 : 1));
      };

      const doStartBlock = (s: AppState, goal: Goal, date: ISODate): Partial<AppState> => ({
        blocks: E.startBlock(s.blocks, goal, date, uid()),
        adjustments: { ...initialState().adjustments },
      });

      return {
        ...initialState(),
        ui: { undo: null, pendingGoal: null, lastCheckIn: null },

        // ----- Onboarding -----
        saveAbout: (a) =>
          patch({
            createdOn: get().createdOn ?? today(st()),
            profile: { ...get().profile, age: a.age, heightCm: a.heightCm, setupWeightKg: a.setupWeightKg, noWeigh: a.noWeigh },
          }),
        clearSetup: () => set({ ...initialState(), subscription: get().subscription } as Partial<Store>),
        saveGoal: (goal, termsAccepted) =>
          patch({
            profile: {
              ...get().profile,
              goal,
              termsAcceptedOn: termsAccepted ? today(st()) : get().profile.termsAcceptedOn,
            },
          }),
        markSafetySeen: () => patch({ profile: { ...get().profile, safetySeenOn: today(st()) } }),
        saveTime: (t) => patch({ training: { ...get().training, minutes: t.minutes, daysPerWeek: t.daysPerWeek } }),
        saveEquipment: (eq) => patch({ training: { ...get().training, equipment: [...eq] } }),
        saveFoodSetup: (f) => {
          const s = st();
          patch({
            food: { ...s.food, mealsPerDay: f.mealsPerDay, cookOrBuy: f.cookOrBuy, allergies: [...f.allergies] },
            foodChanges: s.planStart
              ? foodChangeFrom(s, E.addDays(today(s), 1), f)
              : [{ creatorId: CREATOR_ID, from: "0000-01-01", mealsPerDay: f.mealsPerDay, cookOrBuy: f.cookOrBuy, fasting: s.food.fasting }],
          });
        },
        createPlan: () => {
          const s = st();
          if (s.planStart) return;
          const d = today(s);
          patch({
            planStart: d,
            createdOn: s.createdOn ?? d,
            ...doStartBlock(s, s.profile.goal ?? "steady", d),
            foodChanges: s.foodChanges.length
              ? s.foodChanges
              : [{ creatorId: CREATOR_ID, from: "0000-01-01", mealsPerDay: s.food.mealsPerDay, cookOrBuy: s.food.cookOrBuy, fasting: s.food.fasting }],
            lastOpened: now(),
          });
        },
        saveFirstName: (name) => patch({ profile: { ...get().profile, firstName: name.trim() || null } }),
        saveSharedPhone: (shared) => patch({ settings: { ...get().settings, sharedPhone: shared } }),
        saveReminders: (r) => patch({ settings: { ...get().settings, dayStart: r.dayStart, reminder: r.reminder } }),
        markInstallShown: () => patch({ settings: { ...get().settings, installShown: true } }),
        markOpened: () => patch({ lastOpened: now() }),
        saveSetupStep: (step) => patch({ setupStep: step }),

        // ----- Today -----
        logMeal: (slot, kind, extra) => {
          const s = st();
          const date = extra?.date ?? today(s);
          if (isRepeat(`meal:${date}:${slot}:${kind}`)) return false;
          const m = S.selectDayPlan(s, date).meals.find((x) => x.index === slot);
          const log = {
            creatorId: CREATOR_ID,
            date,
            slot,
            kind,
            where: extra?.where,
            size: extra?.size,
            itemId: m ? E.servedId(m) : undefined,
            at: now(),
          };
          withUndo("meal", "Saved. Undo", ["mealLogs"], { mealLogs: E.upsertMealLog(s.mealLogs, log) });
          return true;
        },
        notToday: () => {
          const s = st();
          const d = today(s);
          if (isRepeat(`not_today:${d}`)) return null;
          const ws = E.weekStart(d);
          const move = E.notToday(S.selectSchedule(s, ws), d, S.awaySet(s, ws), s.workouts);
          if (!move) return null;
          withUndo("not_today", "Moved. Undo", ["scheduleMoves"], { scheduleMoves: [...s.scheduleMoves, move] });
          return { movedTo: move.to };
        },
        moveWorkout: (from, to) => {
          const s = st();
          const ws = E.weekStart(from);
          const sched = S.selectSchedule(s, ws);
          if (!sched[from] || sched[to] || E.weekStart(to) !== ws || S.awaySet(s, ws).has(to) || E.doneOn(s.workouts, to)) return false;
          patch({ scheduleMoves: [...s.scheduleMoves, { creatorId: CREATOR_ID, weekStart: ws, from, to }] });
          return true;
        },
        tickWalk: (date) => {
          const s = st();
          const d = date ?? today(s);
          if (isRepeat(`walk:${d}`)) return false;
          if (S.isAway(s, d)) return false;
          const ws = E.weekStart(d);
          const inWeek = s.walks.filter((w) => w.date >= ws && w.date <= E.addDays(ws, 6)).length;
          if (inWeek >= S.WALKS_A_WEEK) return false;
          patch({ walks: [...s.walks, { creatorId: CREATOR_ID, date: d }] });
          return true;
        },
        untickWalk: (date) => {
          const s = st();
          const d = date ?? today(s);
          const i = s.walks.map((w) => w.date).lastIndexOf(d);
          if (i >= 0) patch({ walks: s.walks.filter((_, k) => k !== i) });
        },
        saveAwayDays: (dates, weekly) => patch({ awayDays: [...new Set(dates)].sort(), awayWeekly: [...new Set(weekly)] }),
        startEasyWeek: () => {
          const d = today(st());
          patch({ easyWeek: { creatorId: CREATOR_ID, start: d, end: E.addDays(d, 6) }, lastOpened: now() });
        },

        // ----- Train -----
        setBigScreen: (on) => patch({ settings: { ...get().settings, bigScreen: on } }),
        startWorkout: (opts) => {
          const s = st();
          const d = today(s);
          const open = S.selectWorkoutInProgress(s);
          if (open) return open.id;
          if (!opts?.taster && !E.canStartWorkout(s.workouts, d)) return null;
          const session = S.selectSession(s, opts);
          const w = {
            creatorId: CREATOR_ID,
            id: uid(),
            date: d,
            letter: session.letter,
            minutes: session.minutes,
            status: "in_progress" as const,
            sets: [],
            moveEffort: {},
            bigScreen: s.settings.bigScreen,
            taster: !!opts?.taster,
            startedAt: now(),
          };
          patch({ workouts: [...s.workouts, w] });
          return w.id;
        },
        logSet: (exerciseId, setIndex, value) => {
          const s = st();
          const w = S.selectWorkoutInProgress(s);
          if (!w) return false;
          if (isRepeat(`set:${w.id}:${exerciseId}:${setIndex}`)) return false;
          const ex = getContent().exercises.find((e) => e.id === exerciseId);
          const log = {
            creatorId: CREATOR_ID,
            exerciseId,
            setIndex,
            value: Math.max(0, Math.round(value)),
            unit: ex?.unit ?? ("reps" as const),
            planned: s.settings.bigScreen,
            at: now(),
          };
          const sets = [...w.sets.filter((x) => !(x.exerciseId === exerciseId && x.setIndex === setIndex)), log];
          withUndo("set", "Saved. Undo", ["workouts"], {
            workouts: s.workouts.map((x) => (x.id === w.id ? { ...x, sets, bigScreen: x.bigScreen || s.settings.bigScreen } : x)),
          });
          return true;
        },
        rateMove: (exerciseId, effort) => {
          const s = st();
          const w = S.selectWorkoutInProgress(s);
          if (!w) return;
          patch({
            workouts: s.workouts.map((x) =>
              x.id === w.id
                ? {
                    ...x,
                    moveEffort: { ...x.moveEffort, [exerciseId]: effort },
                    sets: x.sets.map((set) => (set.exerciseId === exerciseId ? { ...set, effort } : set)),
                  }
                : x,
            ),
          });
        },
        tapHurts: (exerciseId) => {
          const s = st();
          const d = today(s);
          const ex = getContent().exercises.find((e) => e.id === exerciseId);
          const hurts = [...s.hurts, { creatorId: CREATOR_ID, date: d, exerciseId, bodyPart: ex?.primaryMuscle ?? "" }];
          const aside = E.shouldSetAside(hurts, exerciseId, s.setAside);
          withUndo("hurt", "Hurts saved. Undo", ["hurts", "setAside"], {
            hurts,
            setAside: aside ? [...s.setAside, { creatorId: CREATOR_ID, exerciseId, on: d }] : s.setAside,
          });
          return { setAside: aside };
        },
        cancelHurt: (exerciseId) => {
          const s = st();
          const d = today(s);
          let i = -1;
          s.hurts.forEach((h, k) => {
            if (h.date === d && h.exerciseId === exerciseId) i = k;
          });
          if (i < 0) return;
          const hurts = s.hurts.filter((_, k) => k !== i);
          const keepAside = E.hurtCount(hurts, exerciseId) >= E.HURTS_TO_SET_ASIDE;
          set({
            hurts,
            setAside: keepAside ? s.setAside : s.setAside.filter((x) => !(x.exerciseId === exerciseId && x.on === d)),
            ui: { ...get().ui, undo: get().ui.undo?.kind === "hurt" ? null : get().ui.undo },
          } as Partial<Store>);
        },
        swapToday: (fromId, toId) => {
          const s = st();
          const d = today(s);
          patch({
            todaySwaps: [
              ...s.todaySwaps.filter((x) => !(x.date === d && x.fromId === fromId)),
              { creatorId: CREATOR_ID, date: d, fromId, toId },
            ],
          });
        },
        finishWorkout: (status, effort) => {
          const s = st();
          const w = S.selectWorkoutInProgress(s);
          if (!w) return;
          const finished = { ...w, status, effort, endedAt: now() };
          const targets = { ...s.targets };
          const ladderSteps = { ...s.ladderSteps };
          if (!w.taster) {
            const all = getContent().exercises;
            for (const exId of new Set(w.sets.map((x) => x.exerciseId))) {
              const ex = all.find((e) => e.id === exId);
              if (!ex) continue;
              const r = E.progress({
                exercise: ex,
                ladderMoves: all.filter((e) => e.ladder === ex.ladder && E.isAllowed(e, s.training.equipment)),
                sets: w.sets.filter((x) => x.exerciseId === exId),
                effort: w.moveEffort[exId] ?? effort,
                target: s.targets[exId] ?? ex.repMin,
                status,
                easy: S.isEasy(s, w.date),
              });
              targets[r.nextExerciseId] = r.target;
              if (r.stepUp) ladderSteps[ex.ladder] = r.nextStep;
            }
          }
          patch({
            workouts: s.workouts.map((x) => (x.id === w.id ? finished : x)),
            targets,
            ladderSteps,
            settings: { ...s.settings, ringerTipShown: true },
          });
        },
        discardWorkout: () => {
          const s = st();
          patch({ workouts: s.workouts.filter((x) => x.status !== "in_progress") });
        },
        fixSet: (workoutId, exerciseId, setIndex, value) => {
          const s = st();
          patch({
            workouts: s.workouts.map((w) =>
              w.id === workoutId
                ? {
                    ...w,
                    sets: w.sets.map((x) =>
                      x.exerciseId === exerciseId && x.setIndex === setIndex
                        ? { ...x, value: Math.max(0, Math.round(value)), planned: false }
                        : x,
                    ),
                  }
                : w,
            ),
          });
        },
        bringBack: (exerciseId) => {
          const s = st();
          patch({
            setAside: s.setAside.filter((x) => x.exerciseId !== exerciseId),
            hurts: s.hurts.filter((h) => h.exerciseId !== exerciseId),
          });
        },
        markRingerTipShown: () => patch({ settings: { ...get().settings, ringerTipShown: true } }),

        // ----- Food -----
        swapMeal: (date, slot, itemId) => {
          const s = st();
          patch({
            mealSwaps: [
              ...s.mealSwaps.filter((x) => !(x.date === date && x.slot === slot)),
              { creatorId: CREATOR_ID, date, slot, itemId },
            ],
          });
        },
        toggleFavourite: (id) => {
          const f = get().favourites;
          patch({ favourites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
        },
        setCookingFor: (n) => patch({ food: { ...get().food, cookingFor: Math.max(1, Math.min(8, Math.round(n))) } }),
        tickShopping: (key) => {
          const s = st();
          const ws = E.weekStart(today(s));
          const cur = s.shoppingTicks.find((t) => t.weekStart === ws)?.ticked ?? [];
          const ticked = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
          patch({ shoppingTicks: [...s.shoppingTicks.filter((t) => t.weekStart !== ws), { creatorId: CREATOR_ID, weekStart: ws, ticked }] });
        },
        tickPickup: (key) => {
          const s = st();
          const ws = E.weekStart(today(s));
          const cur = s.pickupTicks.find((t) => t.weekStart === ws)?.ticked ?? [];
          const ticked = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
          patch({ pickupTicks: [...s.pickupTicks.filter((t) => t.weekStart !== ws), { creatorId: CREATOR_ID, weekStart: ws, ticked }] });
        },
        saveCookStep: (step) => {
          const s = st();
          const { weekStart: ws, block: cookDay } = E.cookSessionFor(today(s));
          patch({
            cookProgress: [
              ...s.cookProgress.filter((p) => !(p.weekStart === ws && p.cookDay === cookDay)),
              { creatorId: CREATOR_ID, weekStart: ws, cookDay, step, done: false },
            ],
          });
        },
        cookDayDone: () => {
          const s = st();
          const { weekStart: ws, block: cookDay } = E.cookSessionFor(today(s));
          const cur = s.cookProgress.find((p) => p.weekStart === ws && p.cookDay === cookDay);
          patch({
            cookProgress: [
              ...s.cookProgress.filter((p) => !(p.weekStart === ws && p.cookDay === cookDay)),
              { creatorId: CREATOR_ID, weekStart: ws, cookDay, step: cur?.step ?? 0, done: true },
            ],
          });
        },

        // ----- Weigh-ins -----
        addWeighIn: (kg, date) => {
          const s = st();
          const d = date ?? today(s);
          const next = { ...s, weighIns: E.addWeighIn(s.weighIns, d, kg, now()) };
          const brake = runSpeedBrake(next, d);
          patch({ weighIns: next.weighIns, ...(brake ?? {}) });
          return { speedBrake: !!brake };
        },
        editWeighIn: (date, kg) => {
          const s = st();
          patch({ weighIns: E.addWeighIn(s.weighIns, date, kg, now()) });
        },
        deleteWeighIn: (date) => patch({ weighIns: get().weighIns.filter((w) => w.date !== date) }),

        // ----- Check-in -----
        saveCheckInDraft: (d) => {
          const s = st();
          const due = E.checkInDue(today(s), s.settings.checkInDay, s.planStart, s.checkIns);
          if (!due) return;
          const cur = s.checkInDraft?.date === due ? s.checkInDraft : null;
          patch({
            checkInDraft: {
              creatorId: CREATOR_ID,
              date: due,
              answers: d.answers ?? cur?.answers ?? [],
              clothes: d.clothes ?? cur?.clothes,
              normalNow: d.normalNow ?? cur?.normalNow,
              expires: E.addDays(due, 7),
            },
          });
        },
        submitCheckIn: (accepted) => {
          const s = st();
          const view = S.selectCheckIn(s);
          if (!view.due || !("result" in view) || !view.result) return null;
          const result = view.result;
          const draft = view.draft;
          const date = view.due;
          const record = {
            creatorId: CREATOR_ID,
            date,
            answers: draft?.answers ?? [],
            clothes: draft?.clothes,
            normalNow: draft?.normalNow,
            result,
            accepted,
            at: now(),
          };
          const p: Partial<AppState> = {
            checkIns: [...s.checkIns, record],
            checkInDraft: null,
            clothes: draft?.clothes
              ? [...s.clothes.filter((c) => c.date !== date), { creatorId: CREATOR_ID, date, feel: draft.clothes }]
              : s.clothes,
          };
          let pendingGoal: PendingGoal | null = null;
          if (accepted) {
            const c = result.change;
            p.adjustments = E.applyChange(s.adjustments, c, date);
            if (c.minutes) p.training = { ...s.training, minutes: c.minutes };
            if (c.fasting) {
              p.food = { ...s.food, fasting: true };
              p.foodChanges = foodChangeFrom(s, E.addDays(today(s), 1), { fasting: true });
            }
            if (c.newGoal) pendingGoal = { goal: c.newGoal, previousGoal: s.profile.goal, startsNew: true };
          }
          set({ ...(p as Partial<Store>), ui: { ...get().ui, pendingGoal: pendingGoal ?? get().ui.pendingGoal, lastCheckIn: result } });
          return result;
        },

        // ----- Goal and plan -----
        proposeGoal: (goal, freshKg) =>
          set({ ui: { ...get().ui, pendingGoal: { goal, previousGoal: get().profile.goal, freshKg, startsNew: goal !== get().profile.goal } } }),
        confirmGoal: () => {
          const s = st();
          const pg = get().ui.pendingGoal;
          if (!pg) return;
          const d = today(s);
          const profile = { ...s.profile, goal: pg.goal, setupWeightKg: pg.freshKg ?? s.profile.setupWeightKg };
          set({
            profile,
            ...(pg.startsNew ? doStartBlock(s, pg.goal, d) : {}),
            ui: { ...get().ui, pendingGoal: null },
          } as Partial<Store>);
        },
        cancelGoal: () => set({ ui: { ...get().ui, pendingGoal: null } }),
        saveTraining: (t) => patch({ training: { ...get().training, ...t } }),

        // ----- You -----
        saveBodyStats: (b) => {
          const p = get().profile;
          patch({
            profile: {
              ...p,
              age: b.age ?? p.age,
              heightCm: b.heightCm === undefined ? p.heightCm : b.heightCm,
              setupWeightKg: b.setupWeightKg ?? p.setupWeightKg,
              noWeigh: b.noWeigh ?? p.noWeigh,
            },
          });
        },
        saveUnits: (u) => patch({ settings: { ...get().settings, units: { ...u } } }),
        saveFoodPrefs: (f) => {
          const s = st();
          const d = today(s);
          const p: Partial<AppState> = {};
          const routine = f.mealsPerDay !== undefined || f.cookOrBuy !== undefined || f.fasting !== undefined;
          if (routine) {
            // Other changes start tomorrow; the list rebuilds next week.
            p.foodChanges = foodChangeFrom(s, E.addDays(d, 1), f);
          }
          const newAllergens = (f.allergies ?? []).filter((a) => !s.food.allergies.includes(a));
          p.food = {
            ...s.food,
            mealsPerDay: f.mealsPerDay ?? s.food.mealsPerDay,
            cookOrBuy: f.cookOrBuy ?? s.food.cookOrBuy,
            fasting: f.fasting ?? s.food.fasting,
            allergies: f.allergies ? [...f.allergies] : s.food.allergies,
          };
          if (newAllergens.length) {
            const ws = E.weekStart(d);
            const before = S.selectWeekMeals(s, ws);
            const nextState = { ...s, ...p } as AppState;
            const after = S.selectWeekMeals(nextState, ws);
            const c = E.allergyChange(before, after, d, s.mealLogs, getContent().recipes, getContent().bought, newAllergens, getContent().sauces ?? []);
            p.allergyNotices = [...s.allergyNotices, { creatorId: CREATOR_ID, date: d, allergens: newAllergens, flagged: c.flagged }];
            // Swaps that now hold an allergen are dropped (they'd be ignored anyway).
            const { recipes, bought } = getContent();
            const items = new Map<string, { allergens: Allergen[] }>([...recipes, ...bought].map((x) => [x.id, x]));
            p.mealSwaps = s.mealSwaps.filter((m) => {
              const it = items.get(m.itemId);
              return !it || E.isSafe(it, p.food!.allergies);
            });
          }
          patch(p);
        },
        saveReminderSettings: (r) => patch({ settings: { ...get().settings, ...r } }),
        saveDisplay: (d) => patch({ settings: { ...get().settings, ...d } }),
        setPhotosOn: async (on) => {
          if (!on) {
            const ids = get().photos.map((p) => p.id);
            await deletePhotoBlobs(ids);
            patch({ photos: [], settings: { ...get().settings, photosOn: false } });
          } else patch({ settings: { ...get().settings, photosOn: true } });
        },
        addPhoto: async (blob, date) => {
          const id = uid();
          await savePhotoBlob(id, blob);
          const d = date ?? today(st());
          patch({ photos: [...get().photos, { creatorId: CREATOR_ID, id, date: d }] });
          return id;
        },
        deletePhoto: async (id) => {
          await deletePhotoBlob(id);
          patch({ photos: get().photos.filter((p) => p.id !== id) });
        },
        getPhoto: (id) => getPhotoBlob(id),
        exportData: () => exportJSON(st(), now()),
        importData: (text) => {
          const r = parseImport(text);
          if (r.ok) set({ ...(r.state as Partial<Store>), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
          return r;
        },
        deleteEverything: async () => {
          await deletePhotoBlobs(get().photos.map((p) => p.id));
          const fresh = initialState();
          set({
            ...(fresh as Partial<Store>),
            subscription: { ...fresh.subscription, trialUsed: true },
            ui: { undo: null, pendingGoal: null, lastCheckIn: null },
          });
        },

        // ----- Undo -----
        undo: () => {
          const u = get().ui.undo;
          if (!u || now() > u.expiresAt) {
            set({ ui: { ...get().ui, undo: null } });
            return false;
          }
          set({ ...(u.snapshot as Partial<Store>), ui: { ...get().ui, undo: null } });
          return true;
        },
        clearUndo: () => set({ ui: { ...get().ui, undo: null } }),
      };
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => pickState(s),
      migrate: (persisted, version) => migrate(persisted, version) as unknown as Store,
      merge: (persisted, current) => ({ ...current, ...migrate(persisted, SCHEMA_VERSION) }),
    },
  ),
);

/** Read the persisted part of the store (for selectors outside React). */
export function appState(): AppState {
  return pickState(useAppStore.getState());
}

/** Undo still showing? (UI shows "Saved. Undo" until it expires.) */
export function undoVisible(u: UndoEntry | null): boolean {
  return !!u && now() <= u.expiresAt;
}
