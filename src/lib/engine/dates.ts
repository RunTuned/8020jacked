// Calendar-day helpers on "YYYY-MM-DD" strings. UTC arithmetic so time zones never shift a day.
import type { ISODate, Weekday } from "../types";

const DAY = 86_400_000;

export function toMs(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromMs(toMs(d) + n * DAY);
}

/** b - a in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toMs(b) - toMs(a)) / DAY);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekday(d: ISODate): Weekday {
  return ((new Date(toMs(d)).getUTCDay() + 6) % 7) as Weekday;
}

/** Monday of the week containing d. */
export function weekStart(d: ISODate): ISODate {
  return addDays(d, -weekday(d));
}

export function weekDates(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Local calendar date of an epoch-ms instant. */
export function localDate(ms: number): ISODate {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inRange(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to;
}
