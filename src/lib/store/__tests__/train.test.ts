import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import {
  appState,
  initialState,
  resetRepeatGuard,
  selectActiveHurtOptions,
  selectActiveWorkout,
  selectOtherWorkouts,
  selectTrainHome,
  selectWorkoutSummary,
  sessionKits,
  setClock,
  setContent,
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

function onboard(minutes: 10 | 20 = 10) {
  A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 75, noWeigh: false });
  A().saveGoal("steady", true);
  A().saveTime({ minutes, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: "cook", allergies: [] });
  A().createPlan();
}

/** Log every open set at its target. */
function doAll() {
  for (;;) {
    const c = selectActiveWorkout(appState())?.cursor;
    if (!c) return;
    A().logSet(c.move.exerciseId, c.setIndex, c.target);
    tick(1100);
  }
}

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => t);
  at("2026-11-02");
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("selectActiveWorkout", () => {
  it("is null with no workout in progress", () => {
    onboard();
    expect(selectActiveWorkout(appState())).toBeNull();
  });

  it("walks the sets in order, and Undo puts the cursor back", () => {
    onboard();
    A().startWorkout();
    let a = selectActiveWorkout(appState())!;
    expect(a.totalSets).toBe(6);
    expect(a.cursor).toMatchObject({ moveIndex: 0, setIndex: 0, lastOfWorkout: false });
    A().logSet(a.cursor!.move.exerciseId, 0, 8);
    a = selectActiveWorkout(appState())!;
    expect(a.cursor).toMatchObject({ moveIndex: 0, setIndex: 1 });
    expect(a.doneSets).toBe(1);
    A().undo();
    expect(selectActiveWorkout(appState())!.cursor).toMatchObject({ moveIndex: 0, setIndex: 0 });
  });

  it("flags the last set and ends with a null cursor", () => {
    onboard();
    A().startWorkout();
    for (let i = 0; i < 5; i++) {
      const c = selectActiveWorkout(appState())!.cursor!;
      A().logSet(c.move.exerciseId, c.setIndex, c.target);
      tick(1100);
    }
    expect(selectActiveWorkout(appState())!.cursor!.lastOfWorkout).toBe(true);
    doAll();
    const a = selectActiveWorkout(appState())!;
    expect(a.cursor).toBeNull();
    expect(a.minutesLeft).toBe(0);
  });

  it("fills in last time from the previous workout", () => {
    onboard();
    A().startWorkout();
    const id = selectActiveWorkout(appState())!.cursor!.move.exerciseId;
    A().logSet(id, 0, 11);
    doAll();
    A().finishWorkout("done", "just_right");
    at("2026-11-04");
    A().startWorkout({ letter: "A" });
    expect(selectActiveWorkout(appState())!.cursor!.lastTime).toBe(11);
  });

  it("minutes picks the 10-minute version of today's workout", () => {
    onboard(20);
    expect(A().startWorkout({ minutes: 10 })).toBeTruthy();
    const a = selectActiveWorkout(appState())!;
    expect(a.workout.minutes).toBe(10);
    expect(a.totalSets).toBe(6);
  });

  it("a taster is session A, 10 minutes", () => {
    onboard(20);
    A().startWorkout({ taster: true });
    const a = selectActiveWorkout(appState())!;
    expect(a.session.letter).toBe("A");
    expect(a.session.minutes).toBe(10);
  });

  it("swapping the move in a slot uses originId, even twice", () => {
    onboard();
    A().startWorkout();
    const first = selectActiveWorkout(appState())!.moves[0];
    A().swapToday(first.originId, "WS1");
    let m = selectActiveWorkout(appState())!.moves[0];
    expect(m.exerciseId).toBe("WS1");
    expect(m.unit).toBe("seconds");
    A().swapToday(m.originId, "SQ2");
    m = selectActiveWorkout(appState())!.moves[0];
    expect(m.exerciseId).toBe("SQ2");
  });
});

describe("hurts in a workout", () => {
  it("offers a different body part, never a move already in the workout", () => {
    onboard();
    A().startWorkout();
    const a = selectActiveWorkout(appState())!;
    const hurt = a.moves[0].exerciseId;
    A().tapHurts(hurt);
    const opts = selectActiveHurtOptions(appState(), hurt);
    expect(opts.length).toBeGreaterThan(0);
    const ids = a.moves.map((m) => m.exerciseId);
    for (const o of opts) {
      expect(ids).not.toContain(o.id);
      expect(o.primaryMuscle).not.toBe(CONTENT.exercises.find((e) => e.id === hurt)!.primaryMuscle);
    }
  });

  it("second hurt sets it aside; the swap still lands in the same slot", () => {
    onboard();
    A().tapHurts("SQ1");
    at("2026-11-04");
    A().startWorkout();
    expect(A().tapHurts("SQ1").setAside).toBe(true);
    const slot = selectActiveWorkout(appState())!.moves[0];
    expect(slot.exerciseId).not.toBe("SQ1");
    const opt = selectActiveHurtOptions(appState(), "SQ1")[0];
    A().swapToday(slot.originId, opt.id);
    expect(selectActiveWorkout(appState())!.moves[0].exerciseId).toBe(opt.id);
  });
});

describe("W7, W1", () => {
  it("summary lists sets and new bests", () => {
    onboard();
    A().startWorkout();
    doAll();
    A().finishWorkout("done", "just_right");
    at("2026-11-04");
    A().startWorkout({ letter: "A" });
    const c = selectActiveWorkout(appState())!.cursor!;
    A().logSet(c.move.exerciseId, 0, 14);
    const sum = selectWorkoutSummary(appState())!;
    expect(sum.setsDone).toBe(1);
    expect(sum.newBests).toEqual([expect.objectContaining({ exerciseId: c.move.exerciseId, value: 14 })]);
    expect(sum.shareText).toContain("New best");
  });

  it("other workouts and home card", () => {
    onboard();
    expect(selectOtherWorkouts(appState(), "A")).toEqual([{ letter: "B", name: "Hips and pull" }]);
    const h = selectTrainHome(appState());
    expect(h).toMatchObject({ doneToday: false, letter: "A", name: "Legs and push" });
    A().startWorkout();
    doAll();
    A().finishWorkout("done");
    expect(selectTrainHome(appState()).doneToday).toBe(true);
  });

  it("kits beyond chair and wall", () => {
    onboard();
    A().startWorkout();
    expect(sessionKits(selectActiveWorkout(appState())!.session)).toEqual([]);
  });
});
