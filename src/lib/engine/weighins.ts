// SPEC 3.2 Weigh-ins and the speed brake (3.3 priority 1).
import { CREATOR_ID, type ISODate, type WeighIn } from "../types";
import { addDays, diffDays } from "./dates";

export const SPEED_BRAKE_WINDOW_DAYS = 14;
export const SPEED_BRAKE_RATE = 0.01; // 1% of body weight a week
export const SPEED_BRAKE_MIN_LOSS_KG = 0.5; // C5: under 0.5 kg ignored
export const SPEED_BRAKE_KCAL = 150;

/** Only one weigh-in a day counts: a later one replaces the earlier one. Sorted by date. */
export function addWeighIn(list: WeighIn[], date: ISODate, kg: number, at: number): WeighIn[] {
  const rest = list.filter((w) => w.date !== date);
  return [...rest, { creatorId: CREATOR_ID, date, kg, at }].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/** One per day, the latest saved wins (defensive against bad imports). */
export function dedupe(list: WeighIn[]): WeighIn[] {
  const byDay = new Map<string, WeighIn>();
  for (const w of list) {
    const cur = byDay.get(w.date);
    if (!cur || w.at >= cur.at) byDay.set(w.date, w);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function inWindow(list: WeighIn[], from: ISODate, to: ISODate): WeighIn[] {
  return dedupe(list).filter((w) => w.date >= from && w.date <= to);
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Average weight = mean of the weigh-ins over the last 7 days (today and the 6 before). */
export function sevenDayAverage(list: WeighIn[], today: ISODate): number | null {
  return mean(inWindow(list, addDays(today, -6), today).map((w) => w.kg));
}

export function firstWeighIn(list: WeighIn[]): WeighIn | null {
  return dedupe(list)[0] ?? null;
}

export function latestWeighIn(list: WeighIn[], today?: ISODate): WeighIn | null {
  const l = dedupe(list).filter((w) => !today || w.date <= today);
  return l[l.length - 1] ?? null;
}

/**
 * Change since start runs from the first real weigh-in (the setup weight isn't one).
 * Uses the 7-day average now, or the latest weigh-in if none in the last 7 days.
 */
export function changeSinceStart(list: WeighIn[], today: ISODate): number | null {
  const first = firstWeighIn(list);
  if (!first) return null;
  const now = sevenDayAverage(list, today) ?? latestWeighIn(list, today)?.kg ?? null;
  return now === null ? null : now - first.kg;
}

/** Weight used for meal size and safety: latest real weigh-in, else the setup weight. */
export function currentWeight(list: WeighIn[], setupKg: number | null, today: ISODate): number | null {
  return latestWeighIn(list, today)?.kg ?? setupKg;
}

export interface SpeedBrakeHit {
  from: WeighIn;
  to: WeighIn;
  weeklyLossKg: number;
}

/**
 * Speed brake: any 2 real weigh-ins on different days within 14 days showing a loss
 * faster than 1% of body weight a week. Losses under 0.5 kg are ignored.
 * `since`: only pairs whose later weigh-in is after this date (the last brake).
 */
export function speedBrake(list: WeighIn[], today: ISODate, since: ISODate | null = null): SpeedBrakeHit | null {
  const l = inWindow(list, addDays(today, -SPEED_BRAKE_WINDOW_DAYS), today);
  let best: SpeedBrakeHit | null = null;
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      const a = l[i];
      const b = l[j];
      if (since && b.date <= since) continue;
      const days = diffDays(a.date, b.date);
      if (days < 1 || days > SPEED_BRAKE_WINDOW_DAYS) continue;
      const loss = a.kg - b.kg;
      if (loss < SPEED_BRAKE_MIN_LOSS_KG) continue;
      const weekly = loss / (days / 7);
      if (weekly > SPEED_BRAKE_RATE * a.kg && (!best || weekly > best.weeklyLossKg)) {
        best = { from: a, to: b, weeklyLossKg: weekly };
      }
    }
  }
  return best;
}

export const SPEED_BRAKE_BANNER =
  "You're losing faster than planned, so your meals are a little bigger this week.";

/** The T1 banner shows for 7 days after the brake. */
export function speedBrakeBannerOn(brakeOn: ISODate | null, today: ISODate): boolean {
  return !!brakeOn && diffDays(brakeOn, today) >= 0 && diffDays(brakeOn, today) < 7;
}

/** Distinct days with a weigh-in in a window. */
export function weighInDays(list: WeighIn[], from: ISODate, to: ISODate): number {
  return inWindow(list, from, to).length;
}
