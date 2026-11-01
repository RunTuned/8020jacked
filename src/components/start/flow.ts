/** The setup steps (A2–A8), in order. Shared by the server redirect and the flow. */
export const FLOW = ["about", "goal", "ready", "time", "home", "food", "plan"] as const;
export type FlowStep = (typeof FLOW)[number];
