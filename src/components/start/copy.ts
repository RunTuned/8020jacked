// Fixed words for start and You screens (wireframe copy). Never numbers.
import type { Allergen, CookOrBuy, Equipment, Goal, ReminderSlot, SessionMinutes, DaysPerWeek, MealsPerDay } from "@/lib/types";

export const GOAL_LABEL: Record<Goal, string> = {
  stronger: "Get stronger",
  lose: "Lose some weight",
  steady: "Keep steady",
};

export const ALLERGY_LABEL: Record<Allergen, string> = {
  nuts: "Nuts (all tree nuts)",
  peanuts: "Peanuts",
  egg: "Egg",
  shellfish: "Shellfish",
  fish: "Fish",
  soy: "Soy",
  sesame: "Sesame",
  gluten: "Gluten",
  dairy: "Dairy",
};

export const EQUIPMENT: ReadonlyArray<{ value: Equipment; label: string }> = [
  { value: "floor", label: "Floor space" },
  { value: "noFloor", label: "No floor (chair and wall)" },
  { value: "bands", label: "Bands" },
  { value: "dumbbells", label: "Dumbbells" },
];

export const MINUTES: ReadonlyArray<{ value: `${SessionMinutes}`; label: string }> = [
  { value: "10", label: "10 min" },
  { value: "20", label: "20 min" },
  { value: "35", label: "35 min" },
];

export const DAYS: ReadonlyArray<{ value: `${DaysPerWeek}`; label: string }> = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

export const MEALS: ReadonlyArray<{ value: `${MealsPerDay}`; label: string }> = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

export const COOK: ReadonlyArray<{ value: CookOrBuy; label: string }> = [
  { value: "cook", label: "I cook" },
  { value: "buy", label: "I buy most food" },
];

export const REMINDER_LABEL: Record<ReminderSlot, string> = {
  morning: "Morning",
  lunch: "Lunch",
  evening: "Evening",
  never: "No reminders",
};

export const TEST_NOTICE = "Test version: no account needed. Your progress stays on this phone.";
export const TEST_DOWNLOAD = "Test version: your progress stays on this phone. Download it in You → My data.";
export const REMINDERS_NEXT = "Reminders come in the next version.";

/** A14w in-app browser: the steps and the button, worded for her phone. Each line says one thing once. */
export function inAppCopy(plat: "ios" | "android" | "other" | null): { steps: string; lines: string[]; done: string } {
  if (plat === "ios")
    return {
      steps: "Tap ⋯ or the share icon, then Open in Safari.",
      lines: ["Then add it to your Home Screen from Safari."],
      done: "I'm in Safari now",
    };
  if (plat === "android")
    return {
      steps: "Tap ⋮, then Open in Chrome.",
      lines: ["Then install it from Chrome."],
      done: "I'm in Chrome now",
    };
  return {
    steps: "Tap ⋯ or the share icon, then open this page in your phone's browser.",
    lines: ["iPhone: open it in Safari.", "Android: open it in Chrome."],
    done: "I'm in my browser now",
  };
}

export const INSTALL_FIRST = {
  title: "Add 8020jacked to your Home Screen first",
  subline: "Then set it up there, so everything stays in the app.",
  steps: ["Tap Share.", "Tap Add to Home Screen, then Add.", "Open 8020jacked from your Home Screen."],
  safari: "Use it in Safari instead",
} as const;
