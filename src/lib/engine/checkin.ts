// SPEC 3.3 Weekly check-in: at most ONE change a week.
// Priority: safety, then food, then training, then same plan.
import type {
  Adjustments,
  Block,
  CheckIn,
  CheckInAnswer,
  CheckInChange,
  CheckInResult,
  ClothesAnswer,
  ClothesFeel,
  CookOrBuy,
  Effort,
  Goal,
  ISODate,
  SessionMinutes,
  TrainingArea,
  WeighIn,
  Weekday,
} from "../types";
import { addDays, diffDays, weekday } from "./dates";
import { bmi, dailyKcal, FOOD_STEP_KCAL, reachedSteadySwitch } from "./food";
import {
  changeSinceStart,
  inWindow,
  latestWeighIn,
  mean,
  sevenDayAverage,
  speedBrake,
  SPEED_BRAKE_KCAL,
} from "./weighins";
import { AREA_WORDS } from "./workouts";

export const FOOD_CHANGES_PER_BLOCK = 3;
export const WEIGH_INS_FOR_FOOD_CHANGE = 3;
export const STALL_RATE = 0.0025; // 0.25% a week
export const STALL_WEEKS = 3;
export const CLOTHES_SAME_WEEKS = 3;
export const CLOTHES_TIGHTER_WEEKS = 2;
export const SAME_ANSWER_WEEKS = 3;
export const CHECK_IN_BANNER_DAYS = 3;
export const FIRST_CHECK_IN_AFTER_DAYS = 7;
export const AWAY_WEEK_DAYS = 4;
export const TRAINING_UP_WEEKS = 2;
export const MAX_EXTRA_SETS_PER_AREA = 1;
export const TRAINING_AREA_ORDER: TrainingArea[] = ["legs", "push", "pull", "core"];

export const COPY = {
  nothingLogged: "Nothing logged this week. Same plan, fresh start.",
  speedBrake: "You're losing faster than planned, so meals get a little bigger. Workouts stay the same.",
  speedBrakeBuy: "You're losing faster than planned, so add one side a day. Workouts stay the same.",
  speedBrakeAlready: "Your meals are already a little bigger this week. Everything else stays the same.",
  switchSteady: "You've reached a healthy place. Time to switch to Keep steady.",
  foodDown: "Meals get a little smaller. Workouts stay the same.",
  foodDownBuy: "One less side a day. Workouts stay the same.",
  tighter: "Your plan stays the same. Clothes change for lots of reasons, and that's fine.",
  same: "Same plan. It's working, so keep going.",
  blockedByAnswer: (w: string) => `${w}, so your meals stay the same this week. That's fine.`,
  trainingUp: (area: TrainingArea) => `Meals stay the same. ${AREA_WORDS[area]} get one extra set.`,
  trainingEasier: (m: SessionMinutes) => `Workouts get shorter: ${m} minutes. Meals stay the same.`,
  aroundShorter: (m: SessionMinutes) => `We'll plan around it. Workouts get shorter: ${m} minutes.`,
  aroundFasting: "We'll plan around it. Fasting mode is on: the same food in 2 bigger meals.",
  aroundSame: "We'll plan around it. Your workouts are already short, so the plan stays the same.",
};

const ANSWER_WORDS: Record<CheckInAnswer, string> = {
  sore: "You're sore",
  bad_sleep: "Sleep was bad",
  busy: "It was a busy week",
  fasting: "You're fasting",
  nothing: "",
};

export const ANSWER_LABELS: Record<CheckInAnswer, string> = {
  sore: "Sore",
  bad_sleep: "Bad sleep",
  busy: "Busy week",
  fasting: "Fasting",
  nothing: "Nothing",
};

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ---------- When ----------

/** The check-in date for today: the latest check-in weekday on or before today. */
export function checkInDate(today: ISODate, checkInDay: Weekday): ISODate {
  const back = (weekday(today) - checkInDay + 7) % 7;
  return addDays(today, -back);
}

/**
 * Due on check-in day and the 3 days after, once the plan is 7+ days old, if not yet done.
 */
export function checkInDue(today: ISODate, checkInDay: Weekday, planStart: ISODate | null, history: CheckIn[]): ISODate | null {
  if (!planStart) return null;
  const d = checkInDate(today, checkInDay);
  if (diffDays(planStart, d) < FIRST_CHECK_IN_AFTER_DAYS) return null;
  if (diffDays(d, today) > CHECK_IN_BANNER_DAYS) return null;
  if (history.some((c) => c.date === d)) return null;
  return d;
}

// ---------- Inputs ----------

export interface WeekStats {
  workoutsPlanned: number;
  workoutsDone: number;
  mealsPlanned: number;
  mealsLogged: number;
  walks: number;
  awayDays: number;
  anyActivity: boolean;
}

export interface CheckInInput {
  date: ISODate;
  goal: Goal | null;
  cookOrBuy: CookOrBuy;
  heightCm: number | null;
  setupKg: number | null;
  weighIns: WeighIn[];
  clothes?: ClothesFeel;
  clothesHistory: ClothesAnswer[];
  answers: CheckInAnswer[];
  normalNow?: boolean;
  history: CheckIn[];
  week: WeekStats;
  lastWeek: WeekStats | null;
  /** Workout and move ratings from the last 2 weeks. */
  ratings: Effort[];
  adjustments: Adjustments;
  maintenance: number;
  block: Block | null;
  minutes: SessionMinutes;
  fasting: boolean;
}

function prior(history: CheckIn[], date: ISODate): CheckIn[] {
  return history.filter((c) => c.date < date).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** "Same answer 3 weeks running" (not "Nothing") → C8 "Is this your normal now?". */
export function sameAnswerRunning(answers: CheckInAnswer[], history: CheckIn[], date: ISODate): CheckInAnswer | null {
  const prev = prior(history, date).slice(0, SAME_ANSWER_WEEKS - 1);
  if (prev.length < SAME_ANSWER_WEEKS - 1) return null;
  if (diffDays(prev[prev.length - 1].date, date) > 7 * (SAME_ANSWER_WEEKS - 1) + 3) return null;
  for (const a of answers) {
    if (a === "nothing") continue;
    if (prev.every((c) => c.answers.includes(a))) return a;
  }
  return null;
}

export function foodChangesInBlock(history: CheckIn[], block: Block | null): number {
  return history.filter(
    (c) => c.accepted && c.result.change.kind === "food_down" && (!block || c.date >= block.start),
  ).length;
}

function lastFoodChange(history: CheckIn[]): ISODate | null {
  const l = history
    .filter((c) => c.accepted && c.result.change.kind === "food_down")
    .map((c) => c.date)
    .sort();
  return l[l.length - 1] ?? null;
}

/**
 * Average weight hasn't dropped by at least 0.25% a week for 3 weeks running.
 * Each of the 3 weeks (and the week before each) needs 3+ weigh-ins on different days.
 */
export function weightStalled(weighIns: WeighIn[], date: ISODate): boolean {
  const avg = (k: number) => {
    const to = addDays(date, -7 * k);
    const ws = inWindow(weighIns, addDays(to, -6), to);
    return ws.length >= WEIGH_INS_FOR_FOOD_CHANGE ? mean(ws.map((w) => w.kg)) : null;
  };
  for (let k = 0; k < STALL_WEEKS; k++) {
    const now = avg(k);
    const before = avg(k + 1);
    if (now === null || before === null) return false;
    if (before - now >= STALL_RATE * before) return false;
  }
  return true;
}

function clothesBefore(history: ClothesAnswer[], date: ISODate, n: number): ClothesFeel[] {
  return history
    .filter((c) => c.date < date && diffDays(c.date, date) <= 7 * n + 3)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, n)
    .map((c) => c.feel);
}

function stepDown(m: SessionMinutes): SessionMinutes {
  return m === 35 ? 20 : 10;
}

// ---------- The decision ----------

export function evaluateCheckIn(i: CheckInInput): CheckInResult {
  const avgKg = sevenDayAverage(i.weighIns, i.date);
  const weighInsThisWeek = inWindow(i.weighIns, addDays(i.date, -6), i.date).length;
  const facts: CheckInResult["facts"] = {
    workoutsDone: i.week.workoutsDone,
    workoutsPlanned: i.week.workoutsPlanned,
    mealsLogged: i.week.mealsLogged,
    mealsPlanned: i.week.mealsPlanned,
    walks: i.week.walks,
    weighIns: weighInsThisWeek,
    averageKg: avgKg,
    changeSinceStartKg: changeSinceStart(i.weighIns, i.date),
    rule: "",
  };
  const askNormalNow = sameAnswerRunning(i.answers, i.history, i.date);
  const done = (change: CheckInChange, copy: string, rule: string, why: string[], counts = true): CheckInResult => ({
    date: i.date,
    change,
    copy,
    why: [...weekWhy(i, weighInsThisWeek), ...why],
    counts,
    askNormalNow,
    facts: { ...facts, rule },
  });

  // C1b: nothing logged → same plan, week doesn't count.
  if (!i.week.anyActivity) {
    return {
      date: i.date,
      change: { kind: "nothing_logged" },
      copy: COPY.nothingLogged,
      why: [],
      counts: false,
      askNormalNow: null,
      facts: { ...facts, rule: "nothing_logged" },
    };
  }

  const buyer = i.cookOrBuy === "buy";
  const kg = latestWeighIn(i.weighIns, i.date)?.kg ?? i.setupKg;
  const bmiNow = kg ? bmi(avgKg ?? kg, i.heightCm) : null;
  const dailyNow = dailyKcal({ goal: i.goal, maintenance: i.maintenance, kcalDelta: i.adjustments.kcalDelta, bmi: bmiNow ?? 25 });
  const dailyWith = (delta: number) =>
    dailyKcal({ goal: i.goal, maintenance: i.maintenance, kcalDelta: i.adjustments.kcalDelta + delta, bmi: bmiNow ?? 25 });

  // 1. Safety
  if (i.goal === "lose") {
    if (bmiNow !== null && reachedSteadySwitch(bmiNow)) {
      return done({ kind: "switch_to_steady", newGoal: "steady" }, COPY.switchSteady, "bmi_20", [
        "Your average weight has reached a healthy level for your height.",
        "Keep steady keeps what you've built.",
      ]);
    }
    const last = prior(i.history, i.date)[0]?.date ?? addDays(i.date, -7);
    if (i.adjustments.speedBrakeOn && i.adjustments.speedBrakeOn > last && i.adjustments.speedBrakeOn <= i.date) {
      return done({ kind: "speed_brake_already" }, COPY.speedBrakeAlready, "speed_brake", [
        "You were losing faster than planned, so your meals got a little bigger this week.",
      ]);
    }
    const hit = speedBrake(i.weighIns, i.date, i.adjustments.speedBrakeOn);
    if (hit && dailyWith(SPEED_BRAKE_KCAL) > dailyNow) {
      return done(
        { kind: "speed_brake", kcalDelta: SPEED_BRAKE_KCAL, sideDelta: buyer ? 1 : 0 },
        buyer ? COPY.speedBrakeBuy : COPY.speedBrake,
        "speed_brake",
        ["Two weigh-ins showed you're losing faster than planned. Slower is safer and lasts."],
      );
    }
  }

  // C8 answered "Yes, plan around it"
  if (askNormalNow && i.normalNow) {
    if (askNormalNow === "fasting") {
      if (!i.fasting)
        return done({ kind: "plan_around_it", fasting: true }, COPY.aroundFasting, "normal_now", [
          "You said fasting is your normal for now.",
        ]);
    } else if (i.minutes > 10) {
      const m = stepDown(i.minutes);
      return done({ kind: "plan_around_it", minutes: m }, COPY.aroundShorter(m), "normal_now", [
        `You said "${ANSWER_LABELS[askNormalNow]}" is your normal for now.`,
      ]);
    }
    return done({ kind: "same" }, COPY.aroundSame, "normal_now", []);
  }

  // 2. Food (Lose some weight only)
  let sameCopy = COPY.same;
  let sameRule = "same";
  const sameWhy: string[] = [];
  if (i.goal === "lose") {
    const blocking = i.answers.filter((a) => a !== "nothing");
    const cap = foodChangesInBlock(i.history, i.block) >= FOOD_CHANGES_PER_BLOCK;
    const littleLogging = i.week.mealsPlanned > 0 && i.week.mealsLogged < i.week.mealsPlanned / 2;
    const awayWeek = i.week.awayDays >= AWAY_WEEK_DAYS;
    const canCut = dailyWith(-FOOD_STEP_KCAL) < dailyNow;
    const lastCut = lastFoodChange(i.history);
    const settled = !lastCut || diffDays(lastCut, i.date) >= 7 * STALL_WEEKS;
    const cut = (rule: string, why: string): CheckInResult =>
      done(
        { kind: "food_down", kcalDelta: -FOOD_STEP_KCAL, sideDelta: buyer ? -1 : 0 },
        buyer ? COPY.foodDownBuy : COPY.foodDown,
        rule,
        [why, "One small change at a time. Never below a safe amount."],
      );

    let signal: "cut" | "tighter" | "none" = "none";
    let signalRule = "";
    let signalWhy = "";
    if (weighInsThisWeek >= WEIGH_INS_FOR_FOOD_CHANGE) {
      if (weightStalled(i.weighIns, i.date)) {
        signal = "cut";
        signalRule = "weight_stall";
        signalWhy = "Your average weight has stayed about the same for 3 weeks.";
      }
    } else if (i.clothes) {
      const prev = clothesBefore(i.clothesHistory, i.date, CLOTHES_SAME_WEEKS - 1);
      if (i.clothes === "tighter" && prev[0] === "tighter") signal = "tighter";
      else if (
        i.clothes === "same" &&
        prev.length === CLOTHES_SAME_WEEKS - 1 &&
        prev.every((c) => c === "same")
      ) {
        signal = "cut";
        signalRule = "clothes_same";
        signalWhy = "Your clothes have felt the same for 3 weeks.";
      }
    }

    if (signal === "tighter") {
      sameCopy = COPY.tighter;
      sameRule = "clothes_tighter";
      sameWhy.push("Your clothes felt tighter two weeks running, so there are no cuts this week.");
    } else if (signal === "cut") {
      if (blocking.length) {
        sameCopy = COPY.blockedByAnswer(ANSWER_WORDS[blocking[0]]);
        sameRule = "answer_blocks_food";
        sameWhy.push("When life gets in the way, the food plan waits a week.");
      } else if (littleLogging || awayWeek) {
        sameRule = littleLogging ? "little_logging" : "away_week";
        sameWhy.push("There wasn't enough this week to change your meals.");
      } else if (cap) {
        sameRule = "food_cap";
        sameWhy.push("You've had 3 food changes in these 12 weeks, which is the most we make.");
      } else if (!canCut) {
        sameRule = "floor";
        sameWhy.push("Your meals are already at the smallest safe size.");
      } else if (!settled) {
        sameRule = "recent_food_change";
        sameWhy.push("Your last food change needs a few weeks to settle.");
      } else {
        return cut(signalRule, signalWhy);
      }
    } else if (blocking.length) {
      sameCopy = COPY.blockedByAnswer(ANSWER_WORDS[blocking[0]]);
      sameRule = "answer_blocks_food";
    }
  }

  // 3. Training
  const lw = i.lastWeek;
  const allDone = (w: WeekStats | null) => !!w && w.workoutsPlanned > 0 && w.workoutsDone >= w.workoutsPlanned;
  const ratedOk = i.ratings.length > 0 && i.ratings.every((r) => r === "too_easy" || r === "just_right");
  if (allDone(i.week) && allDone(lw) && ratedOk && !i.answers.includes("sore")) {
    const area = TRAINING_AREA_ORDER.find((a) => (i.adjustments.extraSets[a] ?? 0) < MAX_EXTRA_SETS_PER_AREA);
    if (area) {
      return done({ kind: "training_up", area }, COPY.trainingUp(area), "training_up", [
        "You did every workout for 2 weeks and rated them Just right or Too easy.",
      ]);
    }
  }
  if (i.week.workoutsPlanned > 0 && i.week.workoutsDone < i.week.workoutsPlanned / 2 && i.minutes > 10) {
    const m = stepDown(i.minutes);
    return done({ kind: "training_easier", minutes: m }, COPY.trainingEasier(m), "training_easier", [
      "Shorter workouts are easier to fit in. They still count.",
    ]);
  }

  // 4. Same plan
  return done({ kind: "same" }, sameCopy, sameRule, sameWhy);
}

function weekWhy(i: CheckInInput, weighIns: number): string[] {
  const w = i.week;
  const out = [`You did ${w.workoutsDone} of ${w.workoutsPlanned} workouts and logged ${w.mealsLogged} of ${w.mealsPlanned} meals.`];
  if (weighIns > 0) out.push(`You weighed in on ${weighIns} ${weighIns === 1 ? "day" : "days"}.`);
  return out;
}

/** Apply an accepted change to the running adjustments. */
export function applyChange(adj: Adjustments, change: CheckInChange, date: ISODate): Adjustments {
  switch (change.kind) {
    case "speed_brake":
      return {
        ...adj,
        kcalDelta: adj.kcalDelta + (change.kcalDelta ?? 0),
        sideDelta: adj.sideDelta + (change.sideDelta ?? 0),
        speedBrakeOn: date,
      };
    case "food_down":
      return {
        ...adj,
        kcalDelta: adj.kcalDelta + (change.kcalDelta ?? 0),
        sideDelta: adj.sideDelta + (change.sideDelta ?? 0),
      };
    case "training_up":
      return change.area
        ? { ...adj, extraSets: { ...adj.extraSets, [change.area]: (adj.extraSets[change.area] ?? 0) + 1 } }
        : adj;
    default:
      return adj;
  }
}
