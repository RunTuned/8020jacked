import { describe, expect, it } from "vitest";
import { CREATOR_ID, type WeighIn } from "../../types";
import {
  addWeighIn,
  changeSinceStart,
  currentWeight,
  dedupe,
  sevenDayAverage,
  speedBrake,
  speedBrakeBannerOn,
} from "../weighins";

const w = (date: string, kg: number, at = 0): WeighIn => ({ creatorId: CREATOR_ID, date, kg, at });

describe("3.2 weigh-ins", () => {
  it("only one weigh-in a day counts: a later one replaces the earlier one", () => {
    let l = addWeighIn([], "2026-11-02", 80, 1);
    l = addWeighIn(l, "2026-11-02", 79.6, 2);
    expect(l).toHaveLength(1);
    expect(l[0].kg).toBe(79.6);
    expect(l[0].creatorId).toBe("8020jacked");
  });

  it("dedupe keeps the latest saved per day", () => {
    expect(dedupe([w("2026-11-02", 80, 5), w("2026-11-02", 81, 3)])).toEqual([w("2026-11-02", 80, 5)]);
  });

  it("average = mean of the weigh-ins over the last 7 days", () => {
    const l = [w("2026-10-26", 90), w("2026-11-02", 80), w("2026-11-04", 79), w("2026-11-08", 78)];
    // window 2 Nov .. 8 Nov: (80 + 79 + 78) / 3 = 79
    expect(sevenDayAverage(l, "2026-11-08")).toBeCloseTo(79, 6);
    expect(sevenDayAverage([], "2026-11-08")).toBeNull();
  });

  it("change since start runs from the first real weigh-in; the setup weight is not one", () => {
    // setup weight 85 never appears; first weigh-in 80; now average 79 → −1
    const l = [w("2026-11-02", 80), w("2026-11-04", 79), w("2026-11-08", 78)];
    expect(changeSinceStart(l, "2026-11-08")).toBeCloseTo(-1, 6);
    expect(changeSinceStart([], "2026-11-08")).toBeNull();
    expect(currentWeight([], 85, "2026-11-08")).toBe(85);
    expect(currentWeight(l, 85, "2026-11-08")).toBe(78);
  });
});

describe("3.3 speed brake", () => {
  it("2 weigh-ins on different days within 14 days, faster than 1% a week → hit", () => {
    // 80 → 78.9 over 7 days = 1.1 kg/week > 0.8 (1% of 80)
    expect(speedBrake([w("2026-11-01", 80), w("2026-11-08", 78.9)], "2026-11-08")).not.toBeNull();
  });

  it("at or under 1% a week → no hit", () => {
    // 0.7 kg in 7 days < 0.8
    expect(speedBrake([w("2026-11-01", 80), w("2026-11-08", 79.3)], "2026-11-08")).toBeNull();
    // exactly 0.8 is not faster than 1%
    expect(speedBrake([w("2026-11-01", 80), w("2026-11-08", 79.2)], "2026-11-08")).toBeNull();
  });

  it("losses under 0.5 kg are ignored (day-to-day wobble)", () => {
    // 0.4 kg in 2 days would be 1.4 kg/week, but it's under 0.5 kg
    expect(speedBrake([w("2026-11-06", 80), w("2026-11-08", 79.6)], "2026-11-08")).toBeNull();
    // 0.6 kg in 3 days = 1.4 kg/week, over 0.5 kg → hit
    expect(speedBrake([w("2026-11-05", 80), w("2026-11-08", 79.4)], "2026-11-08")).not.toBeNull();
  });

  it("weigh-ins more than 14 days apart don't pair", () => {
    expect(speedBrake([w("2026-10-20", 80), w("2026-11-08", 77)], "2026-11-08")).toBeNull();
  });

  it("only pairs after the last brake count", () => {
    const l = [w("2026-11-01", 80), w("2026-11-08", 78.9)];
    expect(speedBrake(l, "2026-11-09", "2026-11-08")).toBeNull();
  });

  it("the T1 banner shows for 7 days", () => {
    expect(speedBrakeBannerOn("2026-11-08", "2026-11-08")).toBe(true);
    expect(speedBrakeBannerOn("2026-11-08", "2026-11-14")).toBe(true);
    expect(speedBrakeBannerOn("2026-11-08", "2026-11-15")).toBe(false);
    expect(speedBrakeBannerOn(null, "2026-11-08")).toBe(false);
  });
});
