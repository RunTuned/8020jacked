import { describe, expect, it } from "vitest";
import {
  bmi,
  bmr,
  buyerSidesPerSlot,
  dailyKcal,
  effectiveMealsPerDay,
  foodTargets,
  handLine,
  handPortions,
  loseAllowedByBmi,
  maintenanceKcal,
  maintenanceOnly,
  proteinG,
  reachedSteadySwitch,
  servingMultiplier,
  servingsLabel,
  slotMealTypes,
} from "../food";

describe("3.1 BMR, maintenance, target, protein (hand-checked)", () => {
  it("woman of 40, 165 cm, 75 kg, Lose some weight", () => {
    // BMR = 10*75 + 6.25*165 - 5*40 - 161 = 750 + 1031.25 - 200 - 161 = 1420.25
    expect(bmr(40, 165, 75)).toBeCloseTo(1420.25, 6);
    // Maintenance = 1420.25 * 1.4 = 1988.35
    expect(maintenanceKcal(1420.25)).toBeCloseTo(1988.35, 6);
    // Cut = min(500, 20% of 1988.35 = 397.67) = 397.67 → 1988.35 - 397.67 = 1590.68 → 1591
    const t = foodTargets({ age: 40, heightCm: 165, kg: 75, goal: "lose", kcalDelta: 0, mealsPerDay: 3, fasting: false });
    expect(t.daily).toBe(1591);
    // BMI = 75 / 1.65² = 75 / 2.7225 = 27.55 (under 30, so own weight). Protein 2.0 g/kg × 75 = 150 g
    expect(t.bmi).toBeCloseTo(27.548, 3);
    expect(t.proteinG).toBe(150);
    // Meal kcal = 1591 / 3 = 530.33
    expect(t.mealKcal).toBeCloseTo(530.33, 2);
  });

  it("same woman, Keep steady and Get stronger = maintenance, protein 1.6 g/kg", () => {
    for (const goal of ["steady", "stronger"] as const) {
      const t = foodTargets({ age: 40, heightCm: 165, kg: 75, goal, kcalDelta: 0, mealsPerDay: 3, fasting: false });
      expect(t.daily).toBe(1988); // round(1988.35)
      expect(t.proteinG).toBe(120); // 1.6 × 75
    }
  });

  it("cut is capped at 500 when 20% is more", () => {
    // 30 y, 180 cm, 110 kg: BMR = 1100 + 1125 - 150 - 161 = 1914; maint = 2679.6; 20% = 535.92 → cut 500
    const t = foodTargets({ age: 30, heightCm: 180, kg: 110, goal: "lose", kcalDelta: 0, mealsPerDay: 3, fasting: false });
    expect(t.bmr).toBeCloseTo(1914, 6);
    expect(t.daily).toBe(2180); // 2679.6 - 500 = 2179.6
  });

  it("protein over BMI 30 uses the weight at BMI 25", () => {
    // 180 cm, 110 kg: BMI = 110 / 3.24 = 33.95 > 30 → ref = 25 × 3.24 = 81 kg; Lose 2.0 → 162 g
    expect(proteinG(110, 180, "lose")).toBe(162);
    // Steady: 1.6 × 81 = 129.6 → 130
    expect(proteinG(110, 180, "steady")).toBe(130);
  });

  it('height "Not sure" uses 162 cm', () => {
    // 750 + 6.25 × 162 (= 1012.5) - 200 - 161 = 1401.5
    expect(bmr(40, null, 75)).toBeCloseTo(1401.5, 6);
    expect(bmi(75, null)).toBeCloseTo(75 / (1.62 * 1.62), 6);
  });
});

describe("3.1 floor at 1,500", () => {
  it("never under 1,500, for any goal", () => {
    // 60 y, 150 cm, 50 kg: BMR = 500 + 937.5 - 300 - 161 = 976.5; maint = 1367.1 (< 1500)
    for (const goal of ["lose", "steady", "stronger"] as const) {
      const t = foodTargets({ age: 60, heightCm: 150, kg: 50, goal, kcalDelta: 0, mealsPerDay: 3, fasting: false });
      expect(t.daily).toBe(1500);
    }
  });

  it("floor applies after check-in changes", () => {
    // 1988.35 - 397.67 - 150 = 1440.68 → floor 1500
    expect(dailyKcal({ goal: "lose", maintenance: 1988.35, kcalDelta: -150, bmi: 27 })).toBe(1500);
  });

  it("never more than 500 below maintenance after changes", () => {
    // maint 2679.6; base cut already 500 → a further −150 is held at 2179.6
    expect(dailyKcal({ goal: "lose", maintenance: 2679.6, kcalDelta: -150, bmi: 33 })).toBe(2180);
  });

  it("speed brake +150 never goes above maintenance", () => {
    expect(dailyKcal({ goal: "lose", maintenance: 1988.35, kcalDelta: 150, bmi: 27 })).toBe(1741); // 1590.68 + 150
    expect(dailyKcal({ goal: "lose", maintenance: 1988.35, kcalDelta: 600, bmi: 27 })).toBe(1988);
  });
});

describe("3.1 BMI rules", () => {
  it("BMI under 20 hides Lose some weight", () => {
    // 165 cm: 54 kg → 54 / 2.7225 = 19.83; 55 kg → 20.20
    expect(loseAllowedByBmi(bmi(54, 165))).toBe(false);
    expect(loseAllowedByBmi(bmi(55, 165))).toBe(true);
    expect(foodTargets({ age: 40, heightCm: 165, kg: 54, goal: "steady", kcalDelta: 0, mealsPerDay: 3, fasting: false }).loseAllowed).toBe(false);
  });

  it("BMI under 18.5 = maintenance only, even on Lose", () => {
    // 165 cm, 50 kg → 18.37. BMR = 500 + 1031.25 - 200 - 161 = 1170.25; maint = 1638.35
    expect(maintenanceOnly(bmi(50, 165))).toBe(true);
    const t = foodTargets({ age: 40, heightCm: 165, kg: 50, goal: "lose", kcalDelta: -150, mealsPerDay: 3, fasting: false });
    expect(t.daily).toBe(1638);
    expect(t.maintenanceOnly).toBe(true);
  });

  it("BMI exactly 18.5 is not maintenance-only", () => {
    expect(maintenanceOnly(18.5)).toBe(false);
    expect(maintenanceOnly(18.49)).toBe(true);
  });

  it("reaching BMI 20 on Lose triggers the Keep steady switch", () => {
    expect(reachedSteadySwitch(20)).toBe(true);
    expect(reachedSteadySwitch(19.9)).toBe(true);
    expect(reachedSteadySwitch(20.01)).toBe(false);
  });
});

describe("3.1 meals, servings, hands, fasting, buyers", () => {
  it("serving multiplier rounds to 0.25", () => {
    // 530.33 / 400 = 1.326 → 1.25
    expect(servingMultiplier(530.33, 400)).toBe(1.25);
    // 600 / 400 = 1.5
    expect(servingMultiplier(600, 400)).toBe(1.5);
    expect(servingsLabel(1.5)).toBe("1½ servings");
    expect(servingsLabel(1)).toBe("1 serving");
    expect(servingsLabel(0.75)).toBe("¾ serving");
    expect(servingsLabel(2.25)).toBe("2¼ servings");
  });

  it("serving multiplier is kept between ½ and 3", () => {
    expect(servingMultiplier(1000, 100)).toBe(3);
    expect(servingMultiplier(100, 600)).toBe(0.5);
  });

  it("hand portions: 300 kcal = 1 of each, rounded to ½", () => {
    expect(handPortions(300)).toEqual({ palm: 1, cuppedHand: 1, fist: 1, thumb: 1 });
    // 530 / 300 = 1.77 → 2
    expect(handPortions(530).palm).toBe(2);
    // 450 / 300 = 1.5
    expect(handPortions(450).fist).toBe(1.5);
    expect(handLine(handPortions(450))).toBe("1½ palms protein · 1½ cupped hands carbs · 1½ fists veg · 1½ thumbs fat");
    expect(handLine(handPortions(300))).toBe("1 palm protein · 1 cupped hand carbs · 1 fist veg · 1 thumb fat");
  });

  it("fasting: the same daily total in 2 bigger meals", () => {
    expect(effectiveMealsPerDay(4, true)).toBe(2);
    const a = foodTargets({ age: 40, heightCm: 165, kg: 75, goal: "lose", kcalDelta: 0, mealsPerDay: 3, fasting: true });
    expect(a.daily).toBe(1591);
    expect(a.mealsPerDay).toBe(2);
    expect(a.mealKcal).toBeCloseTo(795.5, 6);
  });

  it("meal types per slot for 2, 3, 4 meals", () => {
    expect(slotMealTypes(2)).toEqual(["main", "main"]);
    expect(slotMealTypes(3)).toEqual(["breakfast", "main", "main"]);
    expect(slotMealTypes(4)).toEqual(["breakfast", "main", "main", "snack"]);
  });

  it("buyers: each main is 1 ready meal + 1 side; a size change adds or removes a side", () => {
    const t = slotMealTypes(3);
    expect(buyerSidesPerSlot(t, 0)).toEqual([0, 1, 1]);
    expect(buyerSidesPerSlot(t, 1)).toEqual([0, 2, 1]);
    expect(buyerSidesPerSlot(t, -1)).toEqual([0, 1, 0]);
    expect(buyerSidesPerSlot(t, -5)).toEqual([0, 0, 0]);
  });
});
