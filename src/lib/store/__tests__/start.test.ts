import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import {
  appState,
  checkAge,
  cmFromFtIn,
  ftInFromCm,
  heightOk,
  initialState,
  kgFrom,
  parseNumber,
  resetRepeatGuard,
  selectPlanSentence,
  selectResumeRoute,
  setClock,
  setContent,
  unitsForLocale,
  useAppStore,
  weightIn,
  weightOk,
} from "..";

const A = () => useAppStore.getState();

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => new Date(2026, 10, 2, 12).getTime());
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("setup resume point", () => {
  it("starts empty and opens on Start", () => {
    expect(appState().setupStep).toBeNull();
    expect(selectResumeRoute(appState())).toBe("/start");
  });

  it("resumes the setup step she left", () => {
    A().saveSetupStep("time");
    expect(appState().setupStep).toBe("time");
    expect(selectResumeRoute(appState())).toBe("/start/setup?step=time");
  });

  it("after the plan exists, resumes a later setup screen, then Today", () => {
    A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 70, noWeigh: false });
    A().createPlan();
    A().saveSetupStep("reminders");
    expect(selectResumeRoute(appState())).toBe("/start/reminders");
    A().saveSetupStep(null);
    expect(selectResumeRoute(appState())).toBe("/today");
  });

  it("a plan with a stale setup-flow step still opens Today", () => {
    A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 70, noWeigh: false });
    A().saveSetupStep("plan");
    A().createPlan();
    expect(selectResumeRoute(appState())).toBe("/today");
  });

  it("is cleared by clearSetup (under 18)", () => {
    A().saveSetupStep("goal");
    A().clearSetup();
    expect(appState().setupStep).toBeNull();
  });

  it("old saved data without the field still works", () => {
    const s = { ...appState() } as Record<string, unknown>;
    delete s.setupStep;
    expect(selectResumeRoute(s as never)).toBe("/start");
  });
});

describe("plan sentence (A8, A9)", () => {
  it("is built from days and meals", () => {
    expect(selectPlanSentence(appState())).toBe("3 short workouts a week and 3 easy meals a day.");
    A().saveTime({ minutes: 15, daysPerWeek: 4 });
    A().saveFoodSetup({ mealsPerDay: 4, cookOrBuy: "cook", allergies: [] });
    expect(selectPlanSentence(appState())).toBe("4 short workouts a week and 4 easy meals a day.");
  });

  it("fasting mode means 2 bigger meals", () => {
    A().saveFoodPrefs({ fasting: true });
    expect(selectPlanSentence(appState())).toBe("3 short workouts a week and 2 easy meals a day.");
  });
});

describe("units", () => {
  it("parses typed numbers", () => {
    expect(parseNumber("72")).toBe(72);
    expect(parseNumber(" 72,5 ")).toBe(72.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("-3")).toBeNull();
  });

  it("converts weight both ways", () => {
    expect(kgFrom(72, "kg")).toBe(72);
    expect(kgFrom(160, "lb")).toBe(72.6);
    expect(weightIn(72.57, "kg")).toBe(72.6);
    expect(weightIn(72.6, "lb")).toBe(160);
  });

  it("converts height both ways", () => {
    expect(cmFromFtIn(5, 5)).toBe(165);
    expect(ftInFromCm(165)).toEqual({ ft: 5, in: 5 });
    expect(ftInFromCm(183)).toEqual({ ft: 6, in: 0 });
  });

  it("picks units from the phone's region", () => {
    expect(unitsForLocale("en-US")).toEqual({ weight: "lb", height: "ftin" });
    expect(unitsForLocale("en-ZA")).toEqual({ weight: "kg", height: "cm" });
    expect(unitsForLocale("nl")).toEqual({ weight: "kg", height: "cm" });
    expect(unitsForLocale(undefined)).toEqual({ weight: "kg", height: "cm" });
  });

  it("checks age and body limits", () => {
    expect(checkAge(17)).toBe("under18");
    expect(checkAge(18)).toBe("ok");
    expect(checkAge(null)).toBe("invalid");
    expect(checkAge(140)).toBe("invalid");
    expect(heightOk(165)).toBe(true);
    expect(heightOk(16)).toBe(false);
    expect(weightOk(72)).toBe(true);
    expect(weightOk(7)).toBe(false);
  });
});
