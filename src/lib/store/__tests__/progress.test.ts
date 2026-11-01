import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import type { AppState, CheckInResult } from "../../types";
import {
  appState,
  changeText,
  dateText,
  initialState,
  kgFromInput,
  resetRepeatGuard,
  resultView,
  selectBlockDoneView,
  selectCheckInMonths,
  selectCheckInResult,
  selectCheckInWeek,
  selectCheckInWhy,
  selectNextGoals,
  selectPhotos,
  selectProgress,
  selectWeightCard,
  selectWeightChart,
  selectWeightRows,
  selectWinItems,
  setClock,
  setContent,
  useAppStore,
  weightText,
  whyLines,
} from "..";

let t = 0;
const at = (date: string, h = 12) => {
  const [y, m, d] = date.split("-").map(Number);
  t = new Date(y, m - 1, d, h, 0).getTime();
};
const A = () => useAppStore.getState();

function onboard(noWeigh = false) {
  A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 75, noWeigh });
  A().saveGoal("lose", true);
  A().saveTime({ minutes: 20, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: "cook", allergies: [] });
  A().createPlan();
}

/** Anything that would show a weight number. */
const hasNumbers = (x: unknown) => /\d\s?(kg|lb)\b/.test(JSON.stringify(x));

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => t);
  at("2026-11-02");
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("words and numbers", () => {
  it("formats weight in her unit", () => {
    expect(weightText(72.44)).toBe("72.4 kg");
    expect(weightText(72.4, "lb")).toBe("159.6 lb");
  });
  it("reads a typed weight, rejecting typos", () => {
    expect(kgFromInput("72,4")).toBe(72.4);
    expect(kgFromInput("160", "lb")).toBe(72.6);
    expect(kgFromInput("7")).toBeNull();
    expect(kgFromInput("abc")).toBeNull();
  });
  it("change since start: numbers, or words only", () => {
    expect(changeText(-2.1, "kg", true)).toBe("2.1 kg down since you started");
    expect(changeText(-0.3, "kg", true)).toBe("About the same as when you started");
    expect(changeText(-2.1, "kg", false)).toBe("Going down, slowly");
    expect(changeText(1.2, "kg", false)).not.toMatch(/kg/);
  });
  it("dates", () => {
    expect(dateText("2026-10-29", "long")).toBe("Thursday 29 October");
    expect(dateText("2026-09-01")).toBe("1 Sep");
    expect(dateText("2026-11-01", "month")).toBe("November 2026");
  });
});

describe("P1 progress", () => {
  it("opens on Wins with no weigh-ins, on Weight once she has one", () => {
    onboard();
    expect(selectProgress(appState()).startView).toBe("wins");
    A().addWeighIn(74);
    expect(selectProgress(appState()).startView).toBe("weight");
  });

  it("doesn't weigh herself: no Weight view, its own heading", () => {
    onboard(true);
    const p = selectProgress(appState());
    expect(p.views).not.toContain("weight");
    expect(p.startView).toBe("wins");
    expect(p.heading).toBe("Your wins and strength");
  });

  it("average weight and change since the first real weigh-in; the setup weight is not one", () => {
    onboard();
    A().addWeighIn(74, "2026-10-20");
    A().addWeighIn(73, "2026-10-27");
    A().addWeighIn(72, "2026-11-01");
    const c = selectWeightCard(appState());
    expect(c.title).toBe("72.5 kg average weight");
    expect(c.detail).toBe("1.5 kg down since you started");
    expect(selectWeightRows(appState()).map((r) => r.date)).toEqual(["2026-11-01", "2026-10-27", "2026-10-20"]);
  });

  it("numbers off: words only, no kg anywhere, no dots", () => {
    onboard();
    A().addWeighIn(74, "2026-10-20");
    A().addWeighIn(72, "2026-11-01");
    A().saveDisplay({ showWeightNumbers: false });
    const s = appState();
    const chart = selectWeightChart(s)!;
    expect(chart.dots).toEqual([]);
    for (const x of [selectWeightCard(s), chart, selectWeightRows(s), selectProgress(s)]) expect(hasNumbers(x)).toBe(false);
  });

  it("chart: one dot per weigh-in, an average line, a neutral label, inside the box", () => {
    onboard();
    A().addWeighIn(74, "2026-10-20");
    A().addWeighIn(73, "2026-10-27");
    A().addWeighIn(72, "2026-11-01");
    const c = selectWeightChart(appState())!;
    expect(c.dots).toHaveLength(3);
    expect(c.line.split(" ")).toHaveLength(3);
    expect(c.ariaLabel).toMatch(/^Average weight from/);
    for (const d of c.dots) {
      expect(d.cx).toBeGreaterThanOrEqual(0);
      expect(d.cx).toBeLessThanOrEqual(c.width);
      expect(d.cy).toBeGreaterThanOrEqual(0);
      expect(d.cy).toBeLessThanOrEqual(c.height);
    }
    expect(selectWeightChart(appState(), "month")!.dots).toHaveLength(3);
  });

  it("wins never show weight", () => {
    onboard();
    A().addWeighIn(74);
    const w = selectWinItems(appState());
    expect(w.summary).toBe("Your wins show up here as you go.");
    expect(hasNumbers(w)).toBe(false);
  });

  it("photos: off by default, newest first", () => {
    onboard();
    const p = selectPhotos(appState());
    expect(p.on).toBe(false);
    useAppStore.setState({
      photos: [
        { creatorId: "8020jacked", id: "a", date: "2026-09-01" },
        { creatorId: "8020jacked", id: "b", date: "2026-11-01" },
      ],
    });
    const q = selectPhotos(appState());
    expect(q.list.map((x) => x.id)).toEqual(["b", "a"]);
    expect(q.compareDefault).toEqual({ a: "a", b: "b" });
    expect(q.nudge).toMatch(/Once a month/);
  });
});

describe("check-in views", () => {
  it("C1 week summary says not-logged meals plainly", () => {
    onboard();
    at("2026-11-10");
    A().logMeal(0, "plan");
    at("2026-11-15");
    const w = selectCheckInWeek(appState())!;
    expect(w.summary).toMatch(/^Workouts 0 of \d+ · meals 1 of \d+ logged \(\d+ not logged, that's fine\) · walks ticked 0\.$/);
    expect(w.summary).not.toMatch(/missed/i);
    expect(w.weightLine).toBe("No weigh-ins this week");
    expect(w.askClothes).toBe(true);
  });

  it("C4 result: 25 words or fewer, Meals stay the same moves under the change", () => {
    const r = {
      copy: "Meals stay the same. Legs get one extra set.",
      change: { kind: "training_up", area: "legs" },
      facts: { workoutsDone: 3, workoutsPlanned: 3 },
    } as unknown as CheckInResult;
    const v = resultView(r);
    expect(v.title).toBe("Legs get one extra set");
    expect(v.detail).toBe("Meals stay the same.");
    expect(v.hero).toBe("Good week. One small change.");
    expect(v.subline).toBe("3 of 3 workouts this week. Thanks for checking in.");
    expect(v.words).toBeLessThanOrEqual(25);
  });

  it("C5 is read from what was saved; P4 groups by month", () => {
    onboard();
    at("2026-11-10");
    A().logMeal(0, "plan");
    A().addWeighIn(74);
    at("2026-11-15");
    expect(selectCheckInResult(appState())).not.toBeNull();
    A().submitCheckIn(false);
    const why = selectCheckInWhy(appState(), "2026-11-15")!;
    expect(why.lines.length).toBeGreaterThan(0);
    expect(why.lines.join(" ")).toMatch(/74\.0 kg/);
    // later edits don't change what was saved
    A().editWeighIn("2026-11-10", 80);
    expect(selectCheckInWhy(appState(), "2026-11-15")!.lines.join(" ")).toMatch(/74\.0 kg/);
    A().saveDisplay({ showWeightNumbers: false });
    expect(hasNumbers(whyLines(appState(), appState().checkIns[0].result))).toBe(false);
    const m = selectCheckInMonths(appState());
    expect(m[0].title).toBe("November 2026");
    expect(m[0].summary).toBe("1 check-in · 0 changes taken");
  });

  it("C6 summary and C7 options: Keep steady suggested first; fresh weight needed with no weigh-ins", () => {
    onboard();
    const s: AppState = appState();
    expect(selectBlockDoneView(s)!.hero).toBe("12 weeks done.");
    useAppStore.setState({ profile: { ...s.profile, goal: "steady" } });
    const g = selectNextGoals(appState());
    expect(g.options[0]).toEqual({ goal: "steady", label: "Keep steady (suggested)" });
    expect(g.needsFreshWeight).toBe(true);
  });
});
