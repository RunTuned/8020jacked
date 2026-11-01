// SPEC 3.6 Logging: next meal, "Meal 3 instead", day start time.
import type { DayPlan, ISODate, MealLog, MealSlot } from "../types";
import { addDays, localDate } from "./dates";

export const UNDO_MS = 5000;
export const REPEAT_TAP_MS = 1000;
/** The app's day starts this many hours before her day start, so late meals count for the right day. */
export const DAY_ROLLOVER_HOURS_BEFORE_START = 3;

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 7) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * The app's "today". Day start 6:30 means the day rolls over at 3:30: a meal logged at
 * 1 am still belongs to yesterday.
 */
export function appToday(nowMs: number, dayStart: string): ISODate {
  const d = new Date(nowMs);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const rollover = Math.max(0, parseTime(dayStart) - DAY_ROLLOVER_HOURS_BEFORE_START * 60);
  const today = localDate(nowMs);
  return minutes < rollover ? addDays(today, -1) : today;
}

export function loggedSlots(logs: MealLog[], date: ISODate): Set<number> {
  return new Set(logs.filter((l) => l.date === date).map((l) => l.slot));
}

/** Next meal = the first unlogged meal today. `jumpTo` = "Meal 3 instead". */
export function nextMeal(day: DayPlan, logs: MealLog[], jumpTo?: number): MealSlot | null {
  const logged = loggedSlots(logs, day.date);
  if (jumpTo !== undefined) {
    const j = day.meals.find((m) => m.index === jumpTo && !logged.has(m.index));
    if (j) return j;
  }
  return day.meals.find((m) => !logged.has(m.index)) ?? null;
}

/** The "Meal N instead" offer: the next unlogged meal after the current one. */
export function insteadOption(day: DayPlan, logs: MealLog[], current: MealSlot | null): MealSlot | null {
  if (!current) return null;
  const logged = loggedSlots(logs, day.date);
  return day.meals.find((m) => m.index > current.index && !logged.has(m.index)) ?? null;
}

export function mealsLoggedCount(logs: MealLog[], dates: ISODate[]): number {
  const set = new Set(dates);
  return new Set(logs.filter((l) => set.has(l.date)).map((l) => `${l.date}:${l.slot}`)).size;
}

/** One log per meal; a later one replaces the earlier one. */
export function upsertMealLog(logs: MealLog[], log: MealLog): MealLog[] {
  return [...logs.filter((l) => !(l.date === log.date && l.slot === log.slot)), log];
}
