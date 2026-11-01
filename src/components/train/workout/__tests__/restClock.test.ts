import { describe, expect, it } from "vitest";
import { addRest, pauseRest, restLeft, resumeRest, type RestSaved } from "../restClock";

const saved = (endsAt: number): RestSaved => ({ workoutId: "w", exerciseId: "x", label: "Set 1 saved", endsAt });

describe("QA 12: pause during rest moves the saved end time", () => {
  it("a reload while paused shows the time left when she paused", () => {
    const r = pauseRest(saved(45_000), 10_000); // paused with 35 s left
    expect(restLeft(r, 60_000)).toBe(35_000); // 50 s later, reloaded: still 35 s
  });

  it("resuming moves the end time by the length of the pause", () => {
    const r = resumeRest(pauseRest(saved(45_000), 10_000), 70_000); // 60 s pause
    expect(r.endsAt).toBe(105_000);
    expect(r.pausedLeft).toBeUndefined();
    expect(restLeft(r, 80_000)).toBe(25_000); // a reload after the pause is right
  });

  it("pausing twice keeps the first time left; resume without a pause changes nothing", () => {
    const p = pauseRest(saved(45_000), 10_000);
    expect(pauseRest(p, 30_000)).toEqual(p);
    const s = saved(45_000);
    expect(resumeRest(s, 20_000)).toEqual(s);
  });

  it("+15 sec works running or paused", () => {
    expect(addRest(saved(45_000), 10_000, 15_000).endsAt).toBe(60_000);
    expect(restLeft(addRest(pauseRest(saved(45_000), 10_000), 20_000, 15_000), 99_000)).toBe(50_000);
  });
});
