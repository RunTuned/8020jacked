// Progress (P1–P5) and check-in (C1–C8) view selectors. Screens show these strings and shapes as they are:
// every number, unit, word choice and chart coordinate is worked out here, never in a screen.
import * as E from "../engine";
import type { AppState, CheckIn, CheckInChangeKind, CheckInResult, Goal, ISODate, Units } from "../types";
import {
  selectBlock,
  selectBlockSummary,
  selectCheckIn,
  selectGoalOptions,
  selectNeedsFreshWeight,
  selectToday,
  selectWeight,
  selectWins,
} from "./selectors";

type WeightUnit = Units["weight"];

export const LB_PER_KG = 2.20462;
/** Changes smaller than this read as "about the same" (C5: "under 0.5 kg ignored"). */
export const SAME_WORDS_KG = 0.5;
/** A sane range for a typed weight (kg). Anything outside is a typo. */
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;
/** P3: one gentle line when she has added a photo in the last week. */
export const PHOTO_NUDGE_DAYS = 7;
export const PHOTO_NUDGE = "Photos change slowly. Once a month is plenty.";
/** The one weigh-in message, everywhere it comes up (P1, T3, C2). */
export const WEIGH_IN_ADVICE = "Weigh in on 3 different days a week for the best picture. Fewer is fine.";

// ---------- words and numbers ----------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "29 Oct" (short), "Thursday 29 October" (long), "November 2026" (month), "September" (monthName). */
export function dateText(d: ISODate, style: "short" | "long" | "month" | "monthName" = "short"): string {
  const [y, m, day] = d.split("-").map(Number);
  if (style === "month") return `${MONTHS[m - 1]} ${y}`;
  if (style === "monthName") return MONTHS[m - 1];
  if (style === "long") return `${DAYS[E.weekday(d)]} ${day} ${MONTHS[m - 1]}`;
  return `${day} ${MONTHS[m - 1].slice(0, 3)}`;
}

function oneDecimal(x: number): string {
  return (Math.round(x * 10) / 10).toFixed(1);
}

/** "72.4 kg" or "159.6 lb". */
export function weightText(kg: number, unit: WeightUnit = "kg"): string {
  return unit === "lb" ? `${oneDecimal(kg * LB_PER_KG)} lb` : `${oneDecimal(kg)} kg`;
}

/** The number to prefill an edit field with, in her unit ("72.4"). */
export function inputFromKg(kg: number, unit: WeightUnit = "kg"): string {
  return oneDecimal(unit === "lb" ? kg * LB_PER_KG : kg);
}

/** A typed weight in her unit → kg, or null when it isn't a believable weight. */
export function kgFromInput(value: string | number, unit: WeightUnit = "kg"): number | null {
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const kg = unit === "lb" ? n / LB_PER_KG : n;
  if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) return null;
  return Math.round(kg * 10) / 10;
}

export type Direction = "down" | "same" | "up";
export function direction(deltaKg: number): Direction {
  if (Math.abs(deltaKg) < SAME_WORDS_KG) return "same";
  return deltaKg < 0 ? "down" : "up";
}

/** Words only (numbers hidden): no kg anywhere. */
export function changeWords(deltaKg: number): string {
  const d = direction(deltaKg);
  return d === "down" ? "Going down, slowly" : d === "same" ? "About the same as when you started" : "A little higher than when you started";
}

/** "2.1 kg down since you started", or words when numbers are hidden. */
export function changeText(deltaKg: number, unit: WeightUnit, showNumbers: boolean): string {
  if (!showNumbers) return changeWords(deltaKg);
  const d = direction(deltaKg);
  if (d === "same") return "About the same as when you started";
  return `${weightText(Math.abs(deltaKg), unit)} ${d} since you started`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------- P1 ----------

export type ProgressView = "wins" | "weight" | "strength" | "photos";

export const PROGRESS_VIEW_LABELS: Record<ProgressView, string> = {
  wins: "Wins",
  weight: "Weight",
  strength: "Strength",
  photos: "Photos",
};

/** P1 frame: heading, which views exist and which one opens first. The weight subline shows on Weight only. */
export function selectProgress(s: AppState, view?: ProgressView) {
  const w = selectWeight(s);
  const weighs = !w.hidden;
  const views: ProgressView[] = weighs ? ["wins", "weight", "strength", "photos"] : ["wins", "strength", "photos"];
  // Opens on Weight once she has a weigh-in, else Wins. Doesn't weigh: Wins, no Weight view.
  const startView = (weighs && w.count > 0 ? "weight" : "wins") as ProgressView;
  const shown = view && views.includes(view) ? view : startView;
  return {
    today: dateText(selectToday(s), "long"),
    weighs,
    views,
    startView,
    view: shown,
    heading: weighs ? "Progress" : "Your wins and strength",
    subline: shown === "weight" ? "Your average weight, and how far you've come since the start." : null,
  };
}

/** The pink weight card on P1 and the top of P2. Words only when numbers are hidden. */
export function selectWeightCard(s: AppState) {
  const w = selectWeight(s);
  const unit = s.settings.units.weight;
  const latest = w.list[0] ?? null;
  let title = "No weigh-ins yet";
  let detail: string | null = WEIGH_IN_ADVICE;
  if (w.count > 0) {
    if (w.showNumbers) {
      title = w.average !== null ? `${weightText(w.average, unit)} average weight` : `Last weigh-in ${weightText(latest!.kg, unit)}`;
    } else {
      title = "Your average weight";
    }
    detail =
      w.count === 1
        ? "Your first weigh-in. This is where you start."
        : w.changeSinceStart !== null
          ? changeText(w.changeSinceStart, unit, w.showNumbers)
          : null;
  }
  return { has: w.count > 0, showNumbers: w.showNumbers, title, detail, weighedToday: w.weighedToday };
}

export type ChartRange = "month" | "3months" | "all";
export const CHART_RANGE_LABELS: Record<ChartRange, string> = { month: "1 month", "3months": "3 months", all: "All" };
const RANGE_DAYS: Record<ChartRange, number | null> = { month: 30, "3months": 91, all: null };

export interface ChartBox {
  width: number;
  height: number;
  /** Space under the plot for the two date labels. */
  labelSpace: number;
  pad: number;
}
export const CHART_BOX: ChartBox = { width: 310, height: 96, labelSpace: 4, pad: 8 };

/**
 * Weight chart in SVG coordinates for a fixed viewBox: pale dots for each weigh-in and a bold
 * average-weight line (the 7-day average on each weigh-in day). No goal line, no forecast.
 * Numbers hidden: no dots, and the label has no numbers.
 */
export function selectWeightChart(s: AppState, range: ChartRange = "all", box: ChartBox = CHART_BOX) {
  const w = selectWeight(s);
  const today = selectToday(s);
  const all = [...w.list].reverse(); // oldest first
  const days = RANGE_DAYS[range];
  const from = days === null ? (all[0]?.date ?? today) : E.addDays(today, -(days - 1));
  const list = all.filter((x) => x.date >= from && x.date <= today);
  if (!list.length) return null;
  const avg = list.map((x) => ({ date: x.date, kg: x.kg, avg: E.sevenDayAverage(all, x.date) ?? x.kg }));
  const ys = avg.flatMap((p) => (w.showNumbers ? [p.kg, p.avg] : [p.avg]));
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.5;
    hi = mid + 0.5;
  }
  const start = list[0].date;
  const span = Math.max(1, E.diffDays(start, today));
  const plotTop = box.pad;
  const plotBottom = box.height - box.labelSpace - box.pad / 2;
  const left = box.pad + 11;
  const right = box.width - box.pad - 17;
  const x = (d: ISODate) => (list.length === 1 ? (left + right) / 2 : left + (E.diffDays(start, d) / span) * (right - left));
  const y = (kg: number) => plotTop + ((hi - kg) / (hi - lo)) * (plotBottom - plotTop);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const dots = w.showNumbers ? avg.map((p) => ({ cx: r1(x(p.date)), cy: r1(y(p.kg)) })) : [];
  const line = avg.map((p) => `${r1(x(p.date))},${r1(y(p.avg))}`).join(" ");
  const last = avg[avg.length - 1];
  const unit = s.settings.units.weight;
  const first = avg[0];
  const label = w.showNumbers
    ? `Average weight from ${weightText(first.avg, unit)} on ${dateText(first.date)} to ${weightText(last.avg, unit)} on ${dateText(last.date)}.`
    : `Average weight since ${dateText(first.date)}.`;
  return {
    viewBox: `0 0 ${box.width} ${box.height}`,
    width: box.width,
    height: box.height,
    dots,
    line,
    end: { cx: r1(x(last.date)), cy: r1(y(last.avg)) },
    labelY: box.height - 4,
    startLabel: { x: r1(left), text: dateText(start) },
    endLabel: { x: r1(right + 6), text: "Today" },
    ariaLabel: label,
  };
}

/** P2: one row per day, newest first. From the first real weigh-in; the setup weight is never listed. */
export function selectWeightRows(s: AppState) {
  const w = selectWeight(s);
  const unit = s.settings.units.weight;
  return w.list.map((x) => ({
    date: x.date,
    dateText: dateText(x.date, "long"),
    kgText: w.showNumbers ? weightText(x.kg, unit) : null,
    input: w.showNumbers ? inputFromKg(x.kg, unit) : "",
  }));
}

// ---------- P5 wins, strength ----------

export interface WinItem {
  key: string;
  title: string;
  detail: string | null;
  href: string | null;
  strong: boolean;
}

/** P5: wins from workouts, skills and check-in answers. Never weight. */
export function selectWinItems(s: AppState) {
  const w = selectWins(s);
  // Counts that are 0 are left out: day 1 never says "0 good weeks".
  const counts = [
    w.workoutsDone > 0 ? `${plural(w.workoutsDone, "workout")} done.` : null,
    w.goodWeeksOfLast8 > 0 ? `${plural(w.goodWeeksOfLast8, "good week")} of the last 8.` : null,
  ].filter(Boolean);
  const summary = counts.length ? counts.join(" ") : "Your wins show up here as you go.";
  const items: WinItem[] = [];
  if (w.goodWeeksOfLast8 > 0)
    items.push({ key: "weeks", title: `${plural(w.goodWeeksOfLast8, "good week")} of the last 8`, detail: null, href: null, strong: true });
  // Skills and strength rows aren't links: their screens are cut from v0.1.
  for (const k of w.skills) {
    if (k.level > 1 && k.current)
      items.push({ key: `skill-${k.key}`, title: k.current, detail: `${k.title}: level ${k.level} of ${k.levels}`, href: null, strong: true });
  }
  for (const u of w.strengthUps.slice(0, 3)) {
    items.push({ key: `up-${u.exerciseId}`, title: `Stronger: ${u.name} ${u.from} → ${u.to}`, detail: null, href: null, strong: false });
  }
  const next = w.skills.find((k) => k.next);
  if (next) items.push({ key: "next", title: `Next skill: ${next.next}`, detail: next.title, href: null, strong: false });
  if (w.clothesLooser > 0)
    items.push({ key: "clothes", title: `Clothes looser · ${plural(w.clothesLooser, "check-in")}`, detail: null, href: null, strong: false });
  return { summary, items };
}

/** P1 Strength view: moves that went up, and where each skill ladder stands. */
export function selectStrength(s: AppState) {
  const w = selectWins(s);
  return {
    ups: w.strengthUps.map((u) => ({ key: u.exerciseId, title: u.name, detail: `${u.from} → ${u.to}` })),
    skills: w.skills
      .filter((k) => k.levels > 0)
      .map((k) => ({
        key: k.key,
        title: k.title,
        detail: k.current ? `Level ${k.level} of ${k.levels}: ${k.current}` : `Level ${k.level} of ${k.levels}`,
        next: k.next ? `Next: ${k.next}` : "Top level reached",
      })),
    empty: w.strengthUps.length === 0,
  };
}

// ---------- P3 photos ----------

export function selectPhotos(s: AppState) {
  const today = selectToday(s);
  const list = [...s.photos]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .map((p) => ({ id: p.id, date: p.date, dateText: dateText(p.date) }));
  const recent = list.some((p) => E.diffDays(p.date, today) < PHOTO_NUDGE_DAYS);
  return {
    on: s.settings.photosOn,
    list,
    count: list.length,
    nudge: recent ? PHOTO_NUDGE : null,
    canCompare: list.length >= 2,
    compareDefault: list.length >= 2 ? { a: list[list.length - 1].id, b: list[0].id } : null,
  };
}

// ---------- C1–C5 ----------

const CHANGE_KINDS: CheckInChangeKind[] = [
  "speed_brake",
  "switch_to_steady",
  "food_down",
  "training_up",
  "training_easier",
  "plan_around_it",
];

/** C1 "Your week" and C2 "Weight this week", filled in from what she logged. */
export function selectCheckInWeek(s: AppState) {
  const v = selectCheckIn(s);
  if (!v.due || !("week" in v) || !v.week) return null;
  const wk = v.week;
  const notLogged = Math.max(0, wk.mealsPlanned - wk.mealsLogged);
  const meals =
    notLogged > 0
      ? `meals ${wk.mealsLogged} of ${wk.mealsPlanned} logged (${notLogged} not logged, that's fine)`
      : `meals ${wk.mealsLogged} of ${wk.mealsPlanned} logged`;
  const summary = `Workouts ${wk.workoutsDone} of ${wk.workoutsPlanned} · ${meals} · walks ticked ${wk.walks}.`;
  const w = selectWeight(s);
  const n = v.weighInsThisWeek ?? 0;
  let weightLine = "No weigh-ins this week";
  if (n > 0) {
    const avg = E.sevenDayAverage(s.weighIns, v.due);
    weightLine =
      w.showNumbers && avg !== null
        ? `Weighed on ${plural(n, "day")} · average weight ${weightText(avg, s.settings.units.weight)}`
        : `Weighed on ${plural(n, "day")}`;
  }
  return {
    due: v.due,
    dueText: dateText(v.due, "long"),
    nothingLogged: !!v.nothingLogged,
    weighs: !!v.weighs,
    askClothes: !!v.askClothes,
    summary,
    weightLine,
    needMoreWeighIns: n < E.WEIGH_INS_FOR_FOOD_CHANGE,
  };
}

function splitCopy(copy: string): { title: string; detail: string | null } {
  const parts = copy.split(/(?<=\.)\s+/).filter(Boolean);
  if (parts.length > 1 && parts[0] === "Meals stay the same.") {
    return { title: parts[1].replace(/\.$/, ""), detail: [parts[0], ...parts.slice(2)].join(" ") };
  }
  if (parts.length > 1) return { title: parts[0].replace(/\.$/, ""), detail: parts.slice(1).join(" ") };
  return { title: copy, detail: null };
}

/** C4: hero, the one change (title + detail, 25 words or fewer in all), from a result. */
export function resultView(r: CheckInResult) {
  const changed = CHANGE_KINDS.includes(r.change.kind);
  const f = r.facts;
  const allDone = f.workoutsPlanned > 0 && f.workoutsDone >= f.workoutsPlanned;
  const hero = changed ? (allDone ? "Good week. One small change." : "One small change.") : allDone ? "Good week. Same plan." : "Same plan next week.";
  const subline =
    f.workoutsPlanned > 0
      ? `${f.workoutsDone} of ${plural(f.workoutsPlanned, "workout")} this week. Thanks for checking in.`
      : "Thanks for checking in.";
  return { hero, subline, changed, copy: r.copy, words: E.wordCount(r.copy), ...splitCopy(r.copy) };
}

/** C4 from the live draft. */
export function selectCheckInResult(s: AppState) {
  const v = selectCheckIn(s);
  if (!v.due || !("result" in v) || !v.result) return null;
  return { result: v.result, ...resultView(v.result) };
}

/** C8: "Busy week" three weeks in a row. Is this your normal now? */
export function selectNormalNow(s: AppState) {
  const v = selectCheckIn(s);
  const a = v.due && "askNormalNow" in v ? v.askNormalNow : null;
  if (!a || a === "nothing") return null;
  return { answer: a, line: `"${E.ANSWER_LABELS[a]}" three weeks in a row. Is this your normal now?` };
}

/** C5 "Why this change": read from what was saved that week, never recalculated. */
export function whyLines(s: AppState, r: CheckInResult): string[] {
  const w = selectWeight(s);
  const unit = s.settings.units.weight;
  const out: string[] = [];
  if (r.change.kind === "nothing_logged") return [r.copy];
  if (!w.hidden && r.facts.averageKg !== null) {
    const change = r.facts.changeSinceStartKg;
    if (w.showNumbers) {
      out.push(
        change !== null
          ? `Your average weight was ${weightText(r.facts.averageKg, unit)}: ${changeText(change, unit, true).replace("since you started", "since your first weigh-in")}.`
          : `Your average weight was ${weightText(r.facts.averageKg, unit)}.`,
      );
    } else if (change !== null) {
      out.push(`Your average weight: ${changeWords(change).toLowerCase()}.`);
    }
  }
  return [...r.why, ...out];
}

export function selectStoredCheckIn(s: AppState, date: ISODate): CheckIn | null {
  return s.checkIns.find((c) => c.date === date) ?? null;
}

/** C5 for a past week (P4 → C5). */
export function selectCheckInWhy(s: AppState, date: ISODate) {
  const c = selectStoredCheckIn(s, date);
  if (!c) return null;
  return {
    dateText: dateText(c.date, "long"),
    copy: c.result.copy,
    status: statusFor(c),
    lines: whyLines(s, c.result),
  };
}

function statusFor(c: CheckIn): string {
  if (c.result.change.kind === "nothing_logged") return "Fresh start";
  if (!CHANGE_KINDS.includes(c.result.change.kind)) return "Same plan";
  return c.accepted ? "You took it" : "Not this week";
}

/** P4: every week, the one change and whether she took it, with a month summary at the top. */
export function selectCheckInMonths(s: AppState) {
  const sorted = [...s.checkIns].sort((a, b) => (a.date < b.date ? 1 : -1));
  const months: { key: string; title: string; summary: string; rows: { date: string; dateText: string; copy: string; status: string }[] }[] = [];
  for (const c of sorted) {
    const key = c.date.slice(0, 7);
    let m = months.find((x) => x.key === key);
    if (!m) {
      m = { key, title: dateText(c.date, "month"), summary: "", rows: [] };
      months.push(m);
    }
    m.rows.push({ date: c.date, dateText: dateText(c.date, "long"), copy: c.result.copy, status: statusFor(c) });
  }
  for (const m of months) {
    const inMonth = sorted.filter((c) => c.date.slice(0, 7) === m.key);
    const taken = inMonth.filter((c) => c.accepted && CHANGE_KINDS.includes(c.result.change.kind)).length;
    m.summary = `${plural(inMonth.length, "check-in")} · ${plural(taken, "change")} taken`;
  }
  return months;
}

// ---------- C6 / C7 ----------

/** C6: is her 12 weeks done (Sounds good goes to C6)? */
export function selectBlockDone(s: AppState): boolean {
  return !!selectBlock(s)?.done;
}

/** C6 "Your 12 weeks: done". */
export function selectBlockDoneView(s: AppState) {
  const b = selectBlock(s);
  const sum = selectBlockSummary(s);
  if (!b || !sum) return null;
  const w = selectWeight(s);
  const unit = s.settings.units.weight;
  const stronger = sum.strengthUps.length > 0;
  const hero = stronger ? `12 weeks done. Stronger than in ${dateText(b.start, "monthName")}.` : "12 weeks done.";
  const lines: string[] = [`${plural(sum.goodWeeks, "good week")}`, `${plural(sum.workoutsDone, "workout")} done`];
  if (stronger) lines.push(`Stronger at ${plural(sum.strengthUps.length, "move")}`);
  if (!w.hidden && sum.averageChangeKg !== null) {
    lines.push(w.showNumbers ? `Average weight: ${changeText(sum.averageChangeKg, unit, true)}` : `Average weight: ${changeWords(sum.averageChangeKg).toLowerCase()}`);
  }
  if (sum.newSkills.length) lines.push(`New skills: ${sum.newSkills.join(", ")}`);
  const share = `12 weeks done. ${plural(sum.workoutsDone, "workout")}, ${plural(sum.goodWeeks, "good week")}.${stronger ? ` Stronger than in ${dateText(b.start, "monthName")}.` : ""}`;
  return { hero, lines, share };
}

export const GOAL_LABELS: Record<Goal, string> = {
  steady: "Keep steady",
  stronger: "Get stronger",
  lose: "Lose some weight",
};

/** C7: Keep steady (suggested) first. "Lose some weight" is quietly hidden when it doesn't fit. */
export function selectNextGoals(s: AppState) {
  const allowed = new Set(selectGoalOptions(s));
  const order: Goal[] = ["steady", "stronger", "lose"];
  return {
    options: order
      .filter((g) => allowed.has(g))
      .map((g) => ({ goal: g, label: g === "steady" ? `${GOAL_LABELS[g]} (suggested)` : GOAL_LABELS[g] })),
    needsFreshWeight: selectNeedsFreshWeight(s),
    unit: s.settings.units.weight,
  };
}
