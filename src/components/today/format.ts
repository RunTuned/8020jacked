// Date words for headings. Formatting only: the dates themselves come from the store.
import type { ISODate } from "@/lib/types";

function parse(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** "Thursday 29 October" */
export function longDate(d: ISODate): string {
  const x = parse(d);
  return `${x.toLocaleDateString("en-GB", { weekday: "long" })} ${x.getDate()} ${x.toLocaleDateString("en-GB", { month: "long" })}`;
}

/** "Thursday" */
export function dayName(d: ISODate): string {
  return parse(d).toLocaleDateString("en-GB", { weekday: "long" });
}

/** "Sun 9 Nov" */
export function shortDate(d: ISODate): string {
  const x = parse(d);
  return `${x.toLocaleDateString("en-GB", { weekday: "short" })} ${x.getDate()} ${x.toLocaleDateString("en-GB", { month: "short" })}`;
}

/** "Mon" */
export function shortDay(d: ISODate): string {
  return parse(d).toLocaleDateString("en-GB", { weekday: "short" });
}

/** "November 2026" */
export function monthTitle(d: ISODate): string {
  return parse(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Day of the month, "9" */
export function dayOfMonth(d: ISODate): string {
  return String(parse(d).getDate());
}

/** "Thu 5 Nov to Sun 8 Nov", or one day. */
export function rangeText(from: ISODate, to: ISODate): string {
  return from === to ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
}
