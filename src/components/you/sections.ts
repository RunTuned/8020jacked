/** You (S2–S9) sections, in S1's order. */
export const SECTIONS = ["goal", "body", "home", "food", "reminders", "display", "subscription", "data"] as const;
export type Section = (typeof SECTIONS)[number];
