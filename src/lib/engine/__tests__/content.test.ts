import { describe, expect, it } from "vitest";
import { parseBought, parseExercises, parseRecipes } from "../content";

describe("content parsing", () => {
  it("accepts cues as a string or a list", () => {
    const e = parseExercises([
      { id: "A", pattern: "squat", ladder: "l", ladderStep: 1, cues: "Stand tall." },
      { id: "B", pattern: "squat", ladder: "l", ladderStep: 2, cues: ["One.", "Two."] },
    ]);
    expect(e[0].cues).toEqual(["Stand tall."]);
    expect(e[1].cues).toEqual(["One.", "Two."]);
  });

  it("drops recipes and bought items without an allergens list (never served unchecked)", () => {
    expect(parseRecipes([{ id: "r", kcal: 300, mealTypes: ["main"] }])).toEqual([]);
    expect(parseRecipes([{ id: "r", kcal: 300, mealTypes: ["main"], allergens: [] }])).toHaveLength(1);
    expect(parseBought([{ id: "b", kind: "ready" }])).toEqual([]);
  });

  it("bad input gives an empty list, not a crash", () => {
    expect(parseExercises(null)).toEqual([]);
    expect(parseRecipes({})).toEqual([]);
    expect(parseBought("x")).toEqual([]);
  });
});
