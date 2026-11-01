// Selectors: every number a screen shows comes from here, through the engine.
// Pure functions of (state, content, now). Memoised per state object + day so React gets stable results.
import * as E from "../engine";
import type { CheckInInput, DayFoodPrefs, WeekStats } from "../engine";
import type {
  AppState,
  CheckInAnswer,
  Content,
  DayPlan,
  Effort,
  Exercise,
  FoodTargets,
  ISODate,
  MealSlot,
  PlannedSession,
  SessionLetter,
  SessionMinutes,
} from "../types";
import { getContent } from "./content";
import { now } from "./clock";

// ---------- memo ----------

/** Cache results per state object, day and arguments (state objects are replaced on every change). */
function memo<A extends unknown[], R>(fn: (s: AppState, ...a: A) => R): (s: AppState, ...a: A) => R {
  let lastS: AppState | null = null;
  let lastContent: Content | null = null;
  let cache = new Map<string, R>();
  return (s: AppState, ...a: A) => {
    const c = getContent();
    if (s !== lastS || c !== lastContent) {
      lastS = s;
      lastContent = c;
      cache = new Map();
    }
    const key = `${selectToday(s)}|${JSON.stringify(a)}`;
    if (cache.has(key)) return cache.get(key)!;
    const r = fn(s, ...a);
    cache.set(key, r);
    return r;
  };
}

const C = (): Content => getContent();

// ---------- basics ----------

export function selectToday(s: AppState): ISODate {
  return E.appToday(now(), s.settings.dayStart);
}

export function awaySet(s: AppState, weekStartDate: ISODate): Set<ISODate> {
  const out = new Set(s.awayDays);
  for (const d of E.weekDates(weekStartDate)) if (s.awayWeekly.includes(E.weekday(d))) out.add(d);
  return out;
}

export function isAway(s: AppState, date: ISODate): boolean {
  return awaySet(s, E.weekStart(date)).has(date);
}

export function prefsFor(s: AppState, date: ISODate): DayFoodPrefs {
  const changes = [...s.foodChanges].sort((a, b) => (a.from < b.from ? -1 : 1));
  const c = [...changes].reverse().find((x) => x.from <= date) ?? changes[0];
  return c
    ? { mealsPerDay: c.mealsPerDay, cookOrBuy: c.cookOrBuy, fasting: c.fasting }
    : { mealsPerDay: s.food.mealsPerDay, cookOrBuy: s.food.cookOrBuy, fasting: s.food.fasting };
}

export function currentKg(s: AppState, date: ISODate = selectToday(s)): number | null {
  return E.currentWeight(s.weighIns, s.profile.setupWeightKg, date);
}

export function isEasy(s: AppState, date: ISODate): boolean {
  return !!s.easyWeek && date >= s.easyWeek.start && date <= s.easyWeek.end;
}

// ---------- food targets ----------

export const selectTargets = memo((s: AppState, date?: ISODate): FoodTargets | null => {
  const d = date ?? selectToday(s);
  const kg = currentKg(s, d);
  if (!kg || !s.profile.age) return null;
  const p = prefsFor(s, d);
  return E.foodTargets({
    age: s.profile.age,
    heightCm: s.profile.heightCm,
    kg,
    goal: s.profile.goal,
    kcalDelta: s.adjustments.kcalDelta,
    mealsPerDay: p.mealsPerDay,
    fasting: p.fasting,
  });
});

/** A3, S2, C7: which goals to show. "Lose some weight" is quietly hidden when it doesn't fit. */
export function selectGoalOptions(s: AppState) {
  const kg = currentKg(s);
  const bmiOk = kg ? E.loseAllowedByBmi(E.bmi(kg, s.profile.heightCm)) : true;
  return E.goalOptions(E.loseOffered(bmiOk, s.blocks, selectToday(s), s.profile.goal));
}

/** Picking "Lose some weight" with no weigh-ins asks a fresh rough weight first (C7, S2). */
export function selectNeedsFreshWeight(s: AppState): boolean {
  return s.weighIns.length === 0 && s.profile.goal !== "lose";
}

// ---------- schedule ----------

export const selectSchedule = memo((s: AppState, weekStartDate?: ISODate) => {
  const ws = weekStartDate ?? E.weekStart(selectToday(s));
  if (!s.planStart) return Object.fromEntries(E.weekDates(ws).map((d) => [d, null])) as Record<ISODate, SessionLetter | null>;
  return E.weekSchedule({
    weekStart: ws,
    planStart: s.planStart,
    daysPerWeek: s.training.daysPerWeek,
    awayDates: awaySet(s, ws),
    moves: s.scheduleMoves,
  });
});

export const selectWeekCount = memo((s: AppState, weekStartDate?: ISODate) => {
  const ws = weekStartDate ?? E.weekStart(selectToday(s));
  return E.weekCount(selectSchedule(s, ws), s.workouts, awaySet(s, ws));
});

export const WALKS_A_WEEK = 3;

/** T2: one row per day, Mon to Sun. */
export const selectWeekRows = memo((s: AppState) => {
  const today = selectToday(s);
  const ws = E.weekStart(today);
  const sched = selectSchedule(s, ws);
  const away = awaySet(s, ws);
  const week = selectWeekMeals(s, ws);
  return E.weekDates(ws).map((d) => {
    const done = E.doneOn(s.workouts, d);
    const planned = sched[d];
    const day = week.find((x) => x.date === d)!;
    return {
      date: d,
      weekday: E.weekday(d),
      workout: away.has(d)
        ? ("away" as const)
        : done
          ? ("done" as const)
          : planned
            ? ("planned" as const)
            : ("rest" as const),
      letter: planned ?? done?.letter ?? null,
      name: planned ? E.SESSION_NAMES[planned] : done ? E.SESSION_NAMES[done.letter] : null,
      mealsLogged: E.loggedSlots(s.mealLogs, d).size,
      mealsPlanned: day.meals.length,
      isToday: d === today,
    };
  });
});

export const selectWalks = memo((s: AppState) => {
  const ws = E.weekStart(selectToday(s));
  const ticked = s.walks.filter((w) => w.date >= ws && w.date <= E.addDays(ws, 6) && !isAway(s, w.date)).length;
  return { ticked, target: WALKS_A_WEEK, left: Math.max(0, WALKS_A_WEEK - ticked) };
});

// ---------- workouts ----------

export function pickContext(s: AppState) {
  return {
    exercises: C().exercises,
    equipment: s.training.equipment,
    ladderSteps: s.ladderSteps,
    setAside: s.setAside.map((x) => x.exerciseId),
  };
}

export function sessionFor(s: AppState, letter: SessionLetter, date: ISODate, minutes = s.training.minutes): PlannedSession {
  const swaps = Object.fromEntries(s.todaySwaps.filter((x) => x.date === date).map((x) => [x.fromId, x.toId]));
  return E.buildSession({
    ...pickContext(s),
    letter,
    minutes,
    extraSets: s.adjustments.extraSets,
    targets: s.targets,
    easy: isEasy(s, date),
    swaps,
  });
}

/** Today's (or the next) workout. Taster: session A, 10 minutes. */
/** `minutes` picks a shorter (or longer) version of today's workout, e.g. T1's "10 min". */
export const selectSession = memo((s: AppState, opts?: { taster?: boolean; letter?: SessionLetter; minutes?: SessionMinutes }) => {
  const today = selectToday(s);
  if (opts?.taster) return sessionFor(s, "A", today, 10);
  const letter = opts?.letter ?? selectSchedule(s)[today] ?? selectNextWorkout(s)?.letter ?? "A";
  return sessionFor(s, letter, today, opts?.minutes);
});

export const selectNextWorkout = memo((s: AppState) => {
  const today = selectToday(s);
  return E.nextWorkout(selectSchedule(s), today, s.workouts);
});

export function selectWorkoutInProgress(s: AppState) {
  return s.workouts.find((w) => w.status === "in_progress") ?? null;
}

/** T1 / W1 top card. */
export const selectTodayWorkout = memo((s: AppState) => {
  const today = selectToday(s);
  const away = isAway(s, today);
  const done = E.doneOn(s.workouts, today);
  const letter = selectSchedule(s)[today];
  return {
    away,
    doneToday: !!done,
    doneName: done ? E.SESSION_NAMES[done.letter] : null,
    planned: !away && !done && !!letter,
    letter: letter ?? null,
    name: letter ? E.SESSION_NAMES[letter] : null,
    minutes: s.training.minutes,
    canStart: E.canStartWorkout(s.workouts, today),
    bigScreen: s.settings.bigScreen,
    next: selectNextWorkout(s),
  };
});

/** W11: Moves I've set aside. */
export const selectSetAside = memo((s: AppState) => {
  const byId = new Map(C().exercises.map((e) => [e.id, e]));
  return s.setAside
    .map((x) => ({ exerciseId: x.exerciseId, name: byId.get(x.exerciseId)?.name ?? x.exerciseId, on: x.on }))
    .sort((a, b) => (a.on < b.on ? 1 : -1));
});

/** W5: two moves for a different body part, never one already in today's workout. */
export function selectHurtOptions(s: AppState, exerciseId: string): Exercise[] {
  const ex = C().exercises.find((e) => e.id === exerciseId);
  if (!ex) return [];
  const today = selectToday(s);
  const session = selectSession(s);
  const todayIds = session.moves.map((m) => m.exerciseId);
  const hurtParts = s.hurts.filter((h) => h.date === today).map((h) => h.bodyPart);
  return E.hurtSwapOptions(ex, todayIds, pickContext(s), hurtParts);
}

/** W6: starter / no-floor / harder versions on the same ladder. */
export function selectMoveVersions(s: AppState, exerciseId: string) {
  const all = C().exercises;
  const ex = all.find((e) => e.id === exerciseId);
  if (!ex) return null;
  const ladder = all.filter((e) => e.ladder === ex.ladder).sort((a, b) => a.ladderStep - b.ladderStep);
  const usable = ladder.filter((e) => E.isAllowed(e, s.training.equipment));
  return {
    exercise: ex,
    starter: usable[0] && usable[0].id !== ex.id ? usable[0] : null,
    noFloor:
      ex.position === "floor"
        ? (all.find((e) => e.pattern === ex.pattern && e.position !== "floor" && E.isAllowed(e, s.training.equipment)) ?? null)
        : null,
    harder: usable.find((e) => e.ladderStep > ex.ladderStep) ?? null,
  };
}

/** W8 skills: push-up, squat, pull-up, core with her level. */
export const selectSkills = memo((s: AppState) => {
  const all = C().exercises;
  const skills: { key: string; title: string; ladder: string }[] = [
    { key: "push", title: "Push-up", ladder: "push_up" },
    { key: "squat", title: "Squat", ladder: "squat_bw" },
    { key: "pull", title: "Pull-up", ladder: "pull_up" },
    { key: "core", title: "Core", ladder: "core_front" },
  ];
  return skills.map((k) => {
    const steps = all.filter((e) => e.ladder === k.ladder).sort((a, b) => a.ladderStep - b.ladderStep);
    const current = steps.length ? E.exerciseOnLadder(steps, s.ladderSteps[k.ladder]) : null;
    return {
      ...k,
      level: current ? steps.indexOf(current) + 1 : 0,
      levels: steps.length,
      current: current?.name ?? null,
      currentId: current?.id ?? null,
      next: current ? (steps.find((e) => e.ladderStep > current.ladderStep)?.name ?? null) : null,
    };
  });
});

/** W9: past workouts, newest first. */
export const selectPastWorkouts = memo((s: AppState) =>
  s.workouts
    .filter((w) => w.status === "done" || w.status === "part")
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((w) => ({
      id: w.id,
      date: w.date,
      name: E.SESSION_NAMES[w.letter],
      minutes: w.minutes,
      sets: w.sets.length,
      part: w.status === "part",
      effort: w.effort ?? null,
    })),
);

/** W10: one past workout — each move: sets × reps, effort. */
export function selectPastWorkout(s: AppState, id: string) {
  const w = s.workouts.find((x) => x.id === id);
  if (!w) return null;
  const byId = new Map(C().exercises.map((e) => [e.id, e]));
  const ids = [...new Set(w.sets.map((x) => x.exerciseId))];
  return {
    ...w,
    name: E.SESSION_NAMES[w.letter],
    moves: ids.map((id) => ({
      exerciseId: id,
      name: byId.get(id)?.name ?? id,
      unit: byId.get(id)?.unit ?? "reps",
      values: w.sets.filter((x) => x.exerciseId === id).map((x) => x.value),
      effort: w.moveEffort[id] ?? null,
    })),
  };
}

// ---------- food plan ----------

function mealsInput(s: AppState, ws: ISODate, prefs: (d: ISODate) => DayFoodPrefs) {
  const targets = selectTargets(s);
  return {
    weekStart: ws,
    awayDates: awaySet(s, ws),
    prefsFor: prefs,
    daily: targets?.daily ?? E.KCAL_FLOOR,
    allergies: s.food.allergies,
    recipes: C().recipes,
    bought: C().bought,
    sideDelta: s.adjustments.sideDelta,
    swaps: s.mealSwaps,
    workouts: selectSchedule(s, ws),
  };
}

/** The week's meals (F1), with prefs as they apply each day. */
export const selectWeekMeals = memo((s: AppState, weekStartDate?: ISODate): DayPlan[] => {
  const ws = weekStartDate ?? E.weekStart(selectToday(s));
  return E.buildWeekMeals(mealsInput(s, ws, (d) => prefsFor(s, d)));
});

export const selectDayPlan = memo((s: AppState, date?: ISODate): DayPlan => {
  const d = date ?? selectToday(s);
  return selectWeekMeals(s, E.weekStart(d)).find((x) => x.date === d)!;
});

export interface MealView {
  slot: MealSlot;
  title: string;
  logged: boolean;
  recipe?: Content["recipes"][number];
  bought?: Content["bought"][number];
  sides: Content["bought"];
  lines: string[]; // plain lines for the card (size lines, hand portions)
  checkLabel: boolean;
}

export function mealView(s: AppState, slot: MealSlot): MealView {
  const { recipes, bought } = C();
  const recipe = slot.recipeId ? recipes.find((r) => r.id === slot.recipeId) : undefined;
  const b = slot.boughtId ? bought.find((x) => x.id === slot.boughtId) : undefined;
  const sides = (slot.sideIds ?? []).map((id) => bought.find((x) => x.id === id)).filter((x) => !!x);
  const sideNames = sides.map((x) => x.name.toLowerCase());
  const title = recipe
    ? recipe.name
    : b
      ? sideNames.length
        ? `${b.name} + ${sideNames.join(" + ")}`
        : b.name
      : "Your own meal";
  const lines: string[] = [];
  if (slot.source === "cook") {
    if (slot.servingsLabel) lines.push(slot.servingsLabel);
    if (slot.handLine) lines.push(slot.handLine);
  } else {
    if (b) lines.push(b.sizeLine);
    for (const x of sides) lines.push(x.sizeLine);
  }
  if (slot.checkLabel) lines.push(E.CHECK_LABEL);
  return {
    slot,
    title,
    logged: E.loggedSlots(s.mealLogs, slot.date).has(slot.index),
    recipe,
    bought: b,
    sides,
    lines,
    checkLabel: slot.checkLabel,
  };
}

/** T1 meal card: the first unlogged meal today, with a "Meal N instead" jump. */
export const selectNextMeal = memo((s: AppState, jumpTo?: number) => {
  const day = selectDayPlan(s);
  const next = E.nextMeal(day, s.mealLogs, jumpTo);
  const instead = E.insteadOption(day, s.mealLogs, next);
  return {
    meal: next ? mealView(s, next) : null,
    instead: instead ? { index: instead.index, label: instead.label } : null,
    allLogged: !next,
  };
});

export function selectMeal(s: AppState, date: ISODate, slot: number): MealView | null {
  const m = selectDayPlan(s, date).meals.find((x) => x.index === slot);
  return m ? mealView(s, m) : null;
}

/** F3: same meal type, never an allergen, favourites first. */
export function selectSwapOptions(s: AppState, date: ISODate, slot: number) {
  const m = selectDayPlan(s, date).meals.find((x) => x.index === slot);
  if (!m) return [];
  return E.swapOptions(m, C().recipes, C().bought, s.food.allergies, s.favourites);
}

function weekFlags(s: AppState, ws: ISODate): string[] {
  return s.allergyNotices.filter((n) => n.date >= ws && n.date <= E.addDays(ws, 6)).flatMap((n) => n.flagged);
}

/** Shopping list and pick-up list use the prefs in effect at the start of the week. */
function listWeek(s: AppState, ws: ISODate): DayPlan[] {
  const p = prefsFor(s, ws);
  return E.buildWeekMeals(mealsInput(s, ws, () => p));
}

/** F4: this week's home days, by shop area, scaled by "Cooking for N". Hidden for buyers. */
export const selectShoppingList = memo((s: AppState) => {
  const ws = E.weekStart(selectToday(s));
  const sections = E.shoppingList(listWeek(s, ws), C().recipes, s.food.cookingFor, s.food.allergies, weekFlags(s, ws));
  const ticked = new Set(s.shoppingTicks.find((t) => t.weekStart === ws)?.ticked ?? []);
  return {
    weekStart: ws,
    hidden: prefsFor(s, ws).cookOrBuy === "buy",
    cookingFor: s.food.cookingFor,
    sections: sections.map((sec) => ({ ...sec, items: sec.items.map((i) => ({ ...i, ticked: ticked.has(i.key) })) })),
    shareText: E.shoppingText(sections),
  };
});

/** F8: Pick up this week (buyers). */
export const selectPickupList = memo((s: AppState) => {
  const ws = E.weekStart(selectToday(s));
  const items = E.pickupList(listWeek(s, ws), C().bought, s.food.allergies, weekFlags(s, ws));
  const ticked = new Set(s.pickupTicks.find((t) => t.weekStart === ws)?.ticked ?? []);
  return {
    weekStart: ws,
    items: items.map((i) => ({ ...i, ticked: ticked.has(i.key) })),
    shareText: E.pickupText(items),
  };
});

/** F5: cook day steps, for this week's batch recipes. */
export const selectCookDay = memo((s: AppState) => {
  const today = selectToday(s);
  const ws = E.weekStart(today);
  const block = E.cookBlock(E.weekday(today));
  const week = listWeek(s, ws);
  const ids = [
    ...new Set(
      week
        .filter((_, i) => E.cookBlock(i) === block && !week[i].away)
        .flatMap((d) => d.meals.filter((m) => m.mealType === "main" && m.recipeId).map((m) => m.recipeId!)),
    ),
  ];
  const recipes = ids.map((id) => C().recipes.find((r) => r.id === id)!).filter(Boolean);
  const steps = recipes.flatMap((r) => r.method.map((text, i) => ({ recipeId: r.id, recipe: r.name, index: i, text })));
  const prog = s.cookProgress.find((p) => p.weekStart === ws && p.cookDay === block);
  return { weekStart: ws, cookDay: block, cookingFor: s.food.cookingFor, steps, step: prog?.step ?? 0, done: prog?.done ?? false };
});

/** The new-allergy line for today, if any. */
export function selectAllergyNotice(s: AppState) {
  const today = selectToday(s);
  const n = [...s.allergyNotices].reverse().find((x) => x.date === today);
  return n ? { message: E.ALLERGY_WARNING(E.allergenWords(n.allergens)), flagged: n.flagged } : null;
}

// ---------- weigh-ins and progress ----------

export const selectWeight = memo((s: AppState) => {
  const today = selectToday(s);
  const list = E.dedupe(s.weighIns);
  return {
    hidden: s.profile.noWeigh,
    showNumbers: s.settings.showWeightNumbers && !s.settings.sharedPhone,
    count: list.length,
    average: E.sevenDayAverage(list, today),
    changeSinceStart: E.changeSinceStart(list, today),
    list: [...list].reverse(),
    weighedToday: list.some((w) => w.date === today),
    speedBrakeBanner: E.speedBrakeBannerOn(s.adjustments.speedBrakeOn, today),
  };
});

/** P1: which view opens first. */
export function selectProgressStart(s: AppState): "weight" | "wins" {
  return !s.profile.noWeigh && s.weighIns.length > 0 ? "weight" : "wins";
}

/** P5 wins: from workouts, skills and check-in answers. Never weight. */
export const selectWins = memo((s: AppState) => {
  const today = selectToday(s);
  const done = s.workouts.filter((w) => !w.taster && (w.status === "done" || w.status === "part"));
  let goodWeeks = 0;
  for (let k = 0; k < 8; k++) {
    const ws = E.addDays(E.weekStart(today), -7 * k);
    const n = done.filter((w) => w.date >= ws && w.date <= E.addDays(ws, 6)).length;
    if (n >= s.training.daysPerWeek) goodWeeks++;
  }
  const looser = s.clothes.filter((c) => c.feel === "looser").length;
  const block = E.currentBlock(s.blocks);
  const summary = block
    ? E.blockSummary(block, today, logs(s), C().exercises, s.training.daysPerWeek)
    : null;
  return {
    workoutsDone: done.length,
    goodWeeksOfLast8: goodWeeks,
    clothesLooser: looser,
    strengthUps: summary?.strengthUps ?? [],
    skills: selectSkills(s),
  };
});

/** P4: every week, the one change and whether she took it. */
export const selectCheckInHistory = memo((s: AppState) =>
  [...s.checkIns]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((c) => ({ date: c.date, copy: c.result.copy, accepted: c.accepted, kind: c.result.change.kind, why: c.result.why })),
);

// ---------- check-in ----------

export function logs(s: AppState) {
  return { mealLogs: s.mealLogs, workouts: s.workouts, weighIns: s.weighIns, walks: s.walks };
}

function weekStats(s: AppState, from: ISODate): WeekStats {
  const dates = Array.from({ length: 7 }, (_, i) => E.addDays(from, i));
  let planned = 0;
  let mealsPlanned = 0;
  let away = 0;
  for (const d of dates) {
    const ws = E.weekStart(d);
    const a = awaySet(s, ws);
    if (a.has(d)) {
      away++;
      continue;
    }
    if (s.planStart && d >= s.planStart) {
      if (selectSchedule(s, ws)[d]) planned++;
      const p = prefsFor(s, d);
      mealsPlanned += E.effectiveMealsPerDay(p.mealsPerDay, p.fasting);
    }
  }
  const done = dates.filter((d) => E.doneOn(s.workouts, d)).length;
  return {
    workoutsPlanned: planned,
    workoutsDone: done,
    mealsPlanned,
    mealsLogged: E.mealsLoggedCount(s.mealLogs, dates),
    walks: s.walks.filter((w) => dates.includes(w.date)).length,
    awayDays: away,
    anyActivity: E.hasActivity(logs(s), from),
  };
}

export function checkInInput(
  s: AppState,
  date: ISODate,
  answers: CheckInAnswer[],
  clothes?: CheckInInput["clothes"],
  normalNow?: boolean,
): CheckInInput {
  const from = E.addDays(date, -6);
  const ratings: Effort[] = s.workouts
    .filter((w) => w.date >= E.addDays(date, -13) && w.date <= date && !w.taster && w.status === "done")
    .flatMap((w) => [...(w.effort ? [w.effort] : []), ...Object.values(w.moveEffort)]);
  const kg = currentKg(s, date) ?? 70;
  const maintenance = E.maintenanceKcal(E.bmr(s.profile.age ?? 40, s.profile.heightCm, kg));
  const p = prefsFor(s, date);
  return {
    date,
    goal: s.profile.goal,
    cookOrBuy: p.cookOrBuy,
    heightCm: s.profile.heightCm,
    setupKg: s.profile.setupWeightKg,
    weighIns: s.profile.noWeigh ? [] : s.weighIns,
    clothes,
    clothesHistory: s.clothes,
    answers,
    normalNow,
    history: s.checkIns,
    week: weekStats(s, from),
    lastWeek: weekStats(s, E.addDays(from, -7)),
    ratings,
    adjustments: s.adjustments,
    maintenance,
    block: E.currentBlock(s.blocks),
    minutes: s.training.minutes,
    fasting: p.fasting,
  };
}

/** T1 banner, C1 week, C2 vs C2b, and a live C4 result from the draft. */
export const selectCheckIn = memo((s: AppState) => {
  const today = selectToday(s);
  const due = E.checkInDue(today, s.settings.checkInDay, s.planStart, s.checkIns);
  if (!due) return { due: null };
  const draft = s.checkInDraft?.date === due ? s.checkInDraft : null;
  const input = checkInInput(s, due, draft?.answers ?? [], draft?.clothes, draft?.normalNow);
  const weighIns = E.inWindow(s.weighIns, E.addDays(due, -6), due).length;
  const result = E.evaluateCheckIn(input);
  return {
    due,
    draft,
    week: input.week,
    nothingLogged: !input.week.anyActivity,
    weighs: !s.profile.noWeigh,
    weighInsThisWeek: weighIns,
    askClothes: s.profile.noWeigh || weighIns < E.WEIGH_INS_FOR_FOOD_CHANGE,
    askNormalNow: result.askNormalNow,
    result,
  };
});

// ---------- 12 weeks ----------

export const selectBlock = memo((s: AppState) => {
  const b = E.currentBlock(s.blocks);
  if (!b) return null;
  const today = selectToday(s);
  return { ...E.blockProgress(b, today, logs(s)), goal: b.goal, start: b.start };
});

/** C6 summary data. */
export const selectBlockSummary = memo((s: AppState) => {
  const b = E.currentBlock(s.blocks);
  return b ? E.blockSummary(b, selectToday(s), logs(s), C().exercises, s.training.daysPerWeek) : null;
});

/** T4: after 5+ days away. */
export const WELCOME_BACK_DAYS = 5;
export function selectWelcomeBackDue(s: AppState): boolean {
  if (!s.lastOpened || !s.planStart) return false;
  return E.diffDays(E.localDate(s.lastOpened), selectToday(s)) >= WELCOME_BACK_DAYS;
}

// ---------- banners ----------

/** T1: the one banner. Speed brake is the top note; else check-in. */
export function selectBanner(s: AppState): "speed_brake" | "check_in" | null {
  if (selectWeight(s).speedBrakeBanner) return "speed_brake";
  if (selectCheckIn(s).due) return "check_in";
  return null;
}

export function selectSetupDone(s: AppState): boolean {
  return !!s.planStart;
}
