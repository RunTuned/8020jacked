import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import type { SessionMinutes } from "../../types";
import { patternArea } from "../../engine";
import {
  appState,
  initialState,
  resetRepeatGuard,
  selectActiveHurtOptions,
  selectActiveWorkout,
  selectOtherWorkouts,
  selectTrainHome,
  selectWorkoutSummary,
  selectSession,
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

function onboard(minutes: SessionMinutes = 15) {
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
    expect(a.totalSets).toBe(8); // 4 moves × 2 sets
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
    for (let i = 0; i < 7; i++) {
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

  it("minutes picks the 8-minute version (Short) of today's workout: the same moves, 1 set each", () => {
    onboard(15);
    const std = selectSession(appState()).moves.map((m) => m.exerciseId);
    expect(A().startWorkout({ minutes: 8 })).toBeTruthy();
    const a = selectActiveWorkout(appState())!;
    expect(a.workout.minutes).toBe(8);
    expect(a.totalSets).toBe(4);
    expect(a.moves.map((m) => m.exerciseId)).toEqual(std);
    expect(a.minutesLeft).toBe(8);
  });

  it("a taster is session A, Short (8 minutes)", () => {
    onboard(15);
    A().startWorkout({ taster: true });
    const a = selectActiveWorkout(appState())!;
    expect(a.session.letter).toBe("A");
    expect(a.session.minutes).toBe(8);
    expect(a.session.name).toBe("Full body A");
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
  it("offers the same body area only, never a move already in the workout", () => {
    onboard();
    A().startWorkout();
    const a = selectActiveWorkout(appState())!;
    const ids = a.moves.map((m) => m.exerciseId);
    for (const m of a.moves) {
      const area = patternArea(m.pattern);
      for (const o of selectActiveHurtOptions(appState(), m.exerciseId)) {
        expect(ids).not.toContain(o.id);
        expect(patternArea(o.pattern)).toBe(area);
      }
    }
    expect(selectActiveHurtOptions(appState(), a.moves[0].exerciseId).length).toBeGreaterThan(0);
  });

  it("Cancel changes nothing: the hurt and any set-aside are taken back", () => {
    onboard();
    A().startWorkout();
    const id = selectActiveWorkout(appState())!.cursor!.move.exerciseId;
    A().tapHurts(id);
    A().cancelHurt(id);
    expect(appState().hurts).toEqual([]);
    expect(appState().setAside).toEqual([]);
    // twice, cancelled the second time: still one hurt, not set aside, the move stays
    A().tapHurts(id);
    tick(10_000); // past the 5-second Undo
    expect(A().tapHurts(id).setAside).toBe(true);
    A().cancelHurt(id);
    expect(appState().hurts).toHaveLength(1);
    expect(appState().setAside).toEqual([]);
    expect(selectActiveWorkout(appState())!.cursor!.move.exerciseId).toBe(id);
  });

  it("a hurt counts on the move she tapped, after a swap; twice means the same move twice", () => {
    onboard();
    A().startWorkout();
    const first = selectActiveWorkout(appState())!.moves[0];
    A().tapHurts(first.exerciseId);
    const opt = selectActiveHurtOptions(appState(), first.exerciseId)[0];
    A().swapToday(first.originId, opt.id);
    const c = selectActiveWorkout(appState())!.cursor!;
    expect(c.move.exerciseId).toBe(opt.id);
    expect(A().tapHurts(c.move.exerciseId).setAside).toBe(false); // a different move: not "twice"
    expect(appState().hurts.map((h) => h.exerciseId)).toEqual([first.exerciseId, opt.id]);
    expect(appState().setAside).toEqual([]);
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

describe("time left matches the session length (QA 19)", () => {
  it("15 min → about 15 min left at the start, 0 at the end", () => {
    onboard(15);
    A().startWorkout();
    const a = selectActiveWorkout(appState())!;
    expect(a.session.minutes).toBe(15);
    expect(a.minutesLeft).toBe(15);
    doAll();
    expect(selectActiveWorkout(appState())!.minutesLeft).toBe(0);
  });

  it("8 min → about 8, 25 min → about 25 at the start", () => {
    onboard(8);
    A().startWorkout();
    expect(selectActiveWorkout(appState())!.minutesLeft).toBe(8);
    A().discardWorkout();
    A().saveTraining({ daysPerWeek: 3, minutes: 25 });
    A().startWorkout();
    const a = selectActiveWorkout(appState())!;
    expect(a.minutesLeft).toBe(25);
    expect(a.totalSets).toBe(14); // 4 moves × 3 sets + core × 2
  });

  it("an easy week shows its real length and set count", () => {
    onboard(15);
    A().startEasyWeek();
    A().startWorkout();
    const a = selectActiveWorkout(appState())!;
    expect(a.session.easy).toBe(true);
    expect(a.totalSets).toBe(4); // 4 moves × 1 set
    expect(a.session.estMinutes).toBe(8);
    expect(a.minutesLeft).toBe(8);
    expect(selectTrainHome(appState()).minutes).toBe(8);
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
    expect(selectOtherWorkouts(appState(), "A")).toEqual([{ letter: "B", name: "Full body B" }]);
    const h = selectTrainHome(appState());
    expect(h).toMatchObject({ doneToday: false, letter: "A", name: "Full body A", minutes: 15 });
    A().startWorkout();
    doAll();
    A().finishWorkout("done");
    expect(selectTrainHome(appState()).doneToday).toBe(true);
  });

  it("kits beyond wall and no kit: a chair is named, never 'no kit needed'", () => {
    onboard();
    A().startWorkout();
    expect(sessionKits(selectActiveWorkout(appState())!.session)).toEqual([]);
    A().discardWorkout();
    A().saveEquipment(["noFloor"]);
    expect(sessionKits(selectSession(appState()))).toEqual(["chair"]); // sit-to-stand
  });
});
