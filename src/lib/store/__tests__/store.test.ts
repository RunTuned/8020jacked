import { beforeEach, describe, expect, it, vi } from "vitest";

const idb = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => idb.get(k),
  set: async (k: string, v: unknown) => void idb.set(k, v),
  del: async (k: string) => void idb.delete(k),
}));

import { CONTENT } from "../../engine/__tests__/fixtures";
import * as E from "../../engine";
import type { Allergen, AppState } from "../../types";
import {
  appState,
  initialState,
  resetRepeatGuard,
  selectBanner,
  selectCheckIn,
  selectDayPlan,
  selectNextMeal,
  selectPickupList,
  selectSchedule,
  selectSession,
  selectSetAside,
  selectShoppingList,
  selectTargets,
  selectToday,
  selectTodayWorkout,
  selectWeekCount,
  selectWeight,
  setClock,
  setContent,
  STORAGE_KEY,
  undoVisible,
  useAppStore,
} from "..";

let t = 0;
const at = (date: string, h = 12) => {
  const [y, m, d] = date.split("-").map(Number);
  t = new Date(y, m - 1, d, h, 0).getTime();
};
const tick = (ms: number) => {
  t += ms;
};
const A = () => useAppStore.getState();

function onboard(p: { cook?: "cook" | "buy"; allergies?: Allergen[]; goal?: "lose" | "steady" | "stronger" } = {}) {
  A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 75, noWeigh: false });
  A().saveGoal(p.goal ?? "lose", true);
  A().markSafetySeen();
  A().saveTime({ minutes: 20, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: p.cook ?? "cook", allergies: p.allergies ?? [] });
  A().createPlan();
}

beforeEach(() => {
  idb.clear();
  setContent(CONTENT);
  setClock(() => t);
  at("2026-11-02"); // Monday
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("store basics", () => {
  it("persists under 8020jacked:v1 with a schema version", () => {
    expect(STORAGE_KEY).toBe("8020jacked:v1");
    expect(useAppStore.persist.getOptions().name).toBe("8020jacked:v1");
    expect(useAppStore.persist.getOptions().version).toBe(1);
  });

  it("setup creates a plan; the numbers come from the engine", () => {
    onboard();
    const s = appState();
    expect(s.planStart).toBe("2026-11-02");
    expect(s.blocks).toHaveLength(1);
    // 40 y, 165 cm, 75 kg, Lose → 1591 (food.test.ts)
    expect(selectTargets(s)!.daily).toBe(1591);
    expect(selectDayPlan(s).meals).toHaveLength(3);
  });

  it("the setup weight is NOT a weigh-in", () => {
    onboard();
    const w = selectWeight(appState());
    expect(appState().weighIns).toEqual([]);
    expect(w.count).toBe(0);
    expect(w.changeSinceStart).toBeNull();
    expect(w.average).toBeNull();
  });

  it("every record carries creatorId 8020jacked", () => {
    onboard();
    A().logMeal(0, "plan");
    A().addWeighIn(75);
    A().startWorkout();
    A().logSet("SQ1", 0, 8);
    A().tickWalk();
    const s = appState() as unknown as Record<string, unknown>;
    const records: unknown[] = [];
    const maps = new Set(["targets", "ladderSteps"]); // lookup maps, not records
    for (const [k, v] of Object.entries(s)) {
      if (maps.has(k)) continue;
      if (Array.isArray(v)) records.push(...v.filter((x) => typeof x === "object"));
      else if (v && typeof v === "object") records.push(v);
    }
    for (const r of records) expect((r as { creatorId?: string }).creatorId).toBe("8020jacked");
    for (const set of appState().workouts[0].sets) expect(set.creatorId).toBe("8020jacked");
  });
});

describe("meal logging", () => {
  it("logs, shows Saved. Undo for 5 s, then moves to the next meal", () => {
    onboard();
    expect(selectNextMeal(appState()).meal!.slot.index).toBe(0);
    expect(A().logMeal(0, "plan")).toBe(true);
    expect(A().ui.undo?.label).toBe("Saved. Undo");
    expect(selectNextMeal(appState()).meal!.slot.index).toBe(1);
    tick(4000);
    expect(undoVisible(A().ui.undo)).toBe(true);
    expect(A().undo()).toBe(true);
    expect(appState().mealLogs).toHaveLength(0);
  });

  it("undo expires after 5 s", () => {
    onboard();
    A().logMeal(0, "plan");
    tick(5001);
    expect(undoVisible(A().ui.undo)).toBe(false);
    expect(A().undo()).toBe(false);
    expect(appState().mealLogs).toHaveLength(1);
  });

  it("repeat taps within 1 s are ignored", () => {
    onboard();
    expect(A().logMeal(0, "plan")).toBe(true);
    tick(500);
    expect(A().logMeal(0, "plan")).toBe(false);
    tick(600);
    expect(A().logMeal(0, "plan")).toBe(true);
    expect(appState().mealLogs).toHaveLength(1);
  });

  it("Something else: home or bought, and size", () => {
    onboard();
    A().logMeal(1, "else", { where: "bought", size: "big" });
    expect(appState().mealLogs[0]).toMatchObject({ slot: 1, kind: "else", where: "bought", size: "big" });
  });
});

describe("workouts", () => {
  it("one workout per day", () => {
    onboard();
    expect(A().startWorkout()).toBeTruthy();
    A().finishWorkout("done", "just_right");
    expect(A().startWorkout()).toBeNull();
    expect(selectTodayWorkout(appState()).doneToday).toBe(true);
  });

  it("Not today moves the workout with a 5-second Undo", () => {
    onboard();
    expect(selectSchedule(appState())["2026-11-02"]).toBe("A");
    expect(A().notToday()).toEqual({ movedTo: "2026-11-03" });
    expect(A().ui.undo?.label).toBe("Moved. Undo");
    expect(selectSchedule(appState())["2026-11-03"]).toBe("A");
    expect(A().undo()).toBe(true);
    expect(selectSchedule(appState())["2026-11-02"]).toBe("A");
  });

  it("Not today with no free day: dropped, no mark", () => {
    onboard();
    at("2026-11-06"); // Friday
    A().saveAwayDays(["2026-11-07", "2026-11-08"], []);
    expect(A().notToday()).toEqual({ movedTo: null });
    expect(selectSchedule(appState())["2026-11-06"]).toBeNull();
    expect(selectWeekCount(appState()).planned).toBe(2);
  });

  it("sets save with Undo; finishing applies progression", () => {
    onboard();
    A().startWorkout();
    const session = selectSession(appState());
    const squat = session.moves[0];
    expect(squat.exerciseId).toBe("SQ2"); // a floor user starts on the bodyweight squat, not the chair (QA A)
    for (const set of squat.sets) {
      A().logSet("SQ2", set.setIndex, 10);
      tick(1100);
    }
    expect(A().ui.undo?.kind).toBe("set");
    A().rateMove("SQ2", "just_right");
    A().finishWorkout("done", "just_right");
    expect(appState().targets.SQ2).toBe(11);
  });

  it("big screen sets save the planned number", () => {
    onboard();
    A().setBigScreen(true);
    A().startWorkout();
    A().logSet("SQ1", 0, 8);
    expect(appState().workouts[0].sets[0].planned).toBe(true);
  });

  it("Hurts twice → set aside (W11) → Bring it back", () => {
    onboard();
    expect(A().tapHurts("SQ2").setAside).toBe(false);
    at("2026-11-04");
    expect(A().tapHurts("SQ2").setAside).toBe(true);
    expect(selectSetAside(appState()).map((x) => x.exerciseId)).toEqual(["SQ2"]);
    const legsAndPush = () => selectSession(appState(), { letter: "A" }).moves.map((m) => m.exerciseId);
    expect(legsAndPush()).not.toContain("SQ2");
    expect(legsAndPush()).toContain("WS1"); // the next squat ladder
    A().bringBack("SQ2");
    expect(selectSetAside(appState())).toEqual([]);
    expect(legsAndPush()).toContain("SQ2");
  });

  it("a part workout counts for the week but doesn't move the plan up", () => {
    onboard();
    A().startWorkout();
    A().logSet("SQ1", 0, 15);
    A().finishWorkout("part", "too_easy");
    expect(selectWeekCount(appState()).done).toBe(1);
    expect(appState().targets.SQ1 ?? 8).toBe(8);
  });
});

describe("weigh-ins", () => {
  it("one a day counts", () => {
    onboard();
    A().addWeighIn(75);
    tick(3600_000);
    A().addWeighIn(74.6);
    expect(appState().weighIns).toHaveLength(1);
    expect(appState().weighIns[0].kg).toBe(74.6);
  });

  it("speed brake runs on a weigh-in, outside check-ins, and shows the banner", () => {
    onboard();
    A().addWeighIn(76);
    at("2026-11-08");
    expect(A().addWeighIn(74.8).speedBrake).toBe(true); // 1.2 kg in 6 days > 0.76/week
    expect(appState().adjustments.kcalDelta).toBe(150);
    expect(selectBanner(appState())).toBe("speed_brake");
    // 1590.68 + 150 = 1740.68 at 74.8 kg: recompute — maint at 74.8 = (748+1031.25-200-161)*1.4 = 1960.35
    const maint = (748 + 1031.25 - 200 - 161) * 1.4;
    expect(selectTargets(appState())!.daily).toBe(Math.round(maint - 0.2 * maint + 150));
  });
});

describe("food", () => {
  it("a new allergy replaces today's unlogged meals at once and says so", () => {
    onboard();
    A().swapMeal("2026-11-02", 1, "nut-curry");
    A().swapMeal("2026-11-02", 2, "nut-curry");
    A().logMeal(1, "plan");
    A().saveFoodPrefs({ allergies: ["nuts"] });
    const day = selectDayPlan(appState());
    expect(day.meals[2].recipeId).not.toBe("nut-curry");
    expect(appState().mealLogs[0].itemId).toBe("nut-curry"); // history is kept as it was
    expect(appState().allergyNotices[0].flagged).toContain("cashews");
    const list = selectShoppingList(appState());
    for (const s of list.sections) for (const i of s.items) expect(i.checkLabel).toBe(true);
  });

  it("an allergen is never served, across the week, cook or buy", () => {
    for (const cook of ["cook", "buy"] as const) {
      useAppStore.setState({ ...initialState() });
      onboard({ cook, allergies: ["gluten", "dairy"] });
      const items = new Map([...CONTENT.recipes, ...CONTENT.bought].map((x) => [x.id, x]));
      for (let i = 0; i < 7; i++) {
        const d = selectDayPlan(appState(), E.addDays("2026-11-02", i));
        for (const m of d.meals)
          for (const id of [m.recipeId, m.boughtId, ...(m.sideIds ?? [])])
            if (id) expect(items.get(id)!.allergens.some((a) => a === "gluten" || a === "dairy")).toBe(false);
      }
    }
  });

  it("meals a day and cook/buy changes start tomorrow", () => {
    onboard();
    A().saveFoodPrefs({ mealsPerDay: 4 });
    expect(selectDayPlan(appState()).meals).toHaveLength(3);
    expect(selectDayPlan(appState(), "2026-11-03").meals).toHaveLength(4);
  });

  it("shopping list scales with Cooking for N and leaves out away days", () => {
    onboard();
    // In grams/ml/units: kg and l lines count ×1000 (the list shows big amounts in kg and l).
    const qty = () =>
      selectShoppingList(appState())
        .sections.flatMap((s) => s.items)
        .reduce((a, i) => a + i.qty * (i.unit === "kg" || i.unit === "l" ? 1000 : 1), 0);
    const one = qty();
    A().setCookingFor(2);
    expect(qty()).toBeGreaterThan(one);
    A().setCookingFor(1);
    A().saveAwayDays(["2026-11-02", "2026-11-03", "2026-11-04"], []);
    expect(qty()).toBeLessThan(one);
  });

  it("buyers get a pick-up list; the shopping list is hidden", () => {
    onboard({ cook: "buy" });
    expect(selectShoppingList(appState()).hidden).toBe(true);
    expect(selectPickupList(appState()).items.length).toBeGreaterThan(0);
  });
});

describe("check-in", () => {
  it("comes 7+ days after the start, on Sunday; nothing logged → C1b, week not counted", () => {
    onboard();
    at("2026-11-08");
    expect(selectCheckIn(appState()).due).toBeNull(); // only 6 days in
    at("2026-11-15");
    const v = selectCheckIn(appState());
    expect(v.due).toBe("2026-11-15");
    expect(selectBanner(appState())).toBe("check_in");
    const r = A().submitCheckIn(true)!;
    expect(r.change.kind).toBe("nothing_logged");
    expect(r.counts).toBe(false);
    expect(selectCheckIn(appState()).due).toBeNull();
  });

  it("draft answers feed the result; accepting applies the change", () => {
    onboard({ goal: "steady" });
    // a week with one of three workouts, some meals
    at("2026-11-10");
    A().logMeal(0, "plan");
    at("2026-11-15");
    A().saveCheckInDraft({ answers: ["nothing"] });
    const r = A().submitCheckIn(true)!;
    expect(r.change).toEqual({ kind: "training_easier", minutes: 10 });
    expect(appState().training.minutes).toBe(10);
    expect(appState().checkIns[0].accepted).toBe(true);
  });

  it("declining keeps targets unchanged", () => {
    onboard({ goal: "steady" });
    at("2026-11-10");
    A().logMeal(0, "plan");
    at("2026-11-15");
    A().submitCheckIn(false);
    expect(appState().training.minutes).toBe(20);
  });
});

describe("goal change (A9)", () => {
  it("starts a new 12 weeks only on Sounds good; Undo keeps the old goal", () => {
    onboard({ goal: "stronger" });
    A().proposeGoal("steady");
    expect(appState().blocks).toHaveLength(1);
    A().cancelGoal();
    expect(appState().profile.goal).toBe("stronger");
    A().proposeGoal("steady");
    A().confirmGoal();
    expect(appState().profile.goal).toBe("steady");
    expect(appState().blocks).toHaveLength(2);
  });
});

describe("my data", () => {
  it("export and import round-trip", () => {
    onboard();
    A().logMeal(0, "plan");
    const file = A().exportData();
    const before = appState();
    useAppStore.setState({ ...initialState() });
    const r = A().importData(file);
    expect(r.ok).toBe(true);
    expect(appState().mealLogs).toEqual(before.mealLogs);
    expect(appState().planStart).toBe("2026-11-02");
  });

  it("import rejects other files", () => {
    expect(A().importData("not json").ok).toBe(false);
    expect(A().importData(JSON.stringify({ app: "other", state: {} })).ok).toBe(false);
    expect(A().importData(JSON.stringify({ app: "8020jacked", creatorId: "8020jacked", schemaVersion: 99, state: {} })).ok).toBe(false);
  });

  it("photos live in IndexedDB; turning photos off deletes them", async () => {
    onboard();
    await A().setPhotosOn(true);
    const id = await A().addPhoto(new Blob(["x"]));
    expect(idb.size).toBe(1);
    expect(await A().getPhoto(id)).toBeTruthy();
    await A().setPhotosOn(false);
    expect(idb.size).toBe(0);
    expect(appState().photos).toEqual([]);
  });

  it("delete everything keeps only the trial-used marker", async () => {
    onboard();
    A().logMeal(0, "plan");
    await A().deleteEverything();
    const s: AppState = appState();
    expect(s.planStart).toBeNull();
    expect(s.mealLogs).toEqual([]);
    expect(s.subscription.trialUsed).toBe(true);
  });

  it("today follows the injected clock", () => {
    at("2026-11-05");
    expect(selectToday(appState())).toBe("2026-11-05");
  });
});
