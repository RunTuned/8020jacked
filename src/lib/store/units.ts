// Units for showing and typing body numbers. Stored in metric underneath (S3).
// Screens convert typed text through these, never by hand.

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

/** Parse a typed number ("72", "72,5"). null when it isn't a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Typed weight in her unit → kg (1 decimal). */
export function kgFrom(value: number, unit: "kg" | "lb"): number {
  const kg = unit === "lb" ? value * KG_PER_LB : value;
  return Math.round(kg * 10) / 10;
}

/** kg → the number to show in her unit: kg to 1 decimal (no ".0"), lb whole. */
export function weightIn(kg: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? Math.round(kg / KG_PER_LB) : Math.round(kg * 10) / 10;
}

/** feet + inches → whole cm. */
export function cmFromFtIn(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * CM_PER_IN);
}

/** cm → whole feet and inches. */
export function ftInFromCm(cm: number): { ft: number; in: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), in: total % 12 };
}

/**
 * Typed weight → kg, keeping the stored kg exactly when the box still shows it in her unit.
 * Switching kg ↔ lb only changes what's shown; 75 kg never comes back as 74.8 kg.
 */
export function resolveWeightKg(text: string, unit: "kg" | "lb", storedKg: number | null): number | null {
  const n = parseNumber(text);
  if (n === null) return null;
  if (storedKg !== null && n === weightIn(storedKg, unit)) return storedKg;
  return kgFrom(n, unit);
}

/** Typed height → cm, keeping the stored cm exactly when the boxes still show it in her unit. */
export function resolveHeightCm(
  h: { unit: "cm" | "ftin"; cm: string; ft: string; inch: string },
  storedCm: number | null,
): number | null {
  if (h.unit === "cm") {
    const cm = parseNumber(h.cm);
    return cm;
  }
  const ft = parseNumber(h.ft);
  const inch = h.inch.trim() ? parseNumber(h.inch) : 0;
  if (ft === null || inch === null) return null;
  if (storedCm !== null) {
    const shown = ftInFromCm(storedCm);
    if (shown.ft === ft && shown.in === inch) return storedCm;
  }
  return cmFromFtIn(ft, inch);
}

/** Units the phone's region expects: the US uses lb and feet, everyone else kg and cm. */
export function unitsForLocale(locale: string | undefined): { weight: "kg" | "lb"; height: "cm" | "ftin" } {
  const region = (locale ?? "").split(/[-_]/)[1]?.toUpperCase();
  return region === "US" || region === "LR" || region === "MM" ? { weight: "lb", height: "ftin" } : { weight: "kg", height: "cm" };
}

/** Body limits for setup and S3 (outside these the number is almost certainly a typo). */
export const BODY_LIMITS = {
  adultAge: 18,
  maxAge: 100,
  minCm: 120,
  maxCm: 220,
  minKg: 30,
  maxKg: 250,
} as const;

export type AgeCheck = "ok" | "under18" | "invalid";

export function checkAge(age: number | null): AgeCheck {
  if (age === null || !Number.isInteger(age) || age < 1 || age > BODY_LIMITS.maxAge) return "invalid";
  return age < BODY_LIMITS.adultAge ? "under18" : "ok";
}

export function heightOk(cm: number | null): boolean {
  return cm !== null && cm >= BODY_LIMITS.minCm && cm <= BODY_LIMITS.maxCm;
}

export function weightOk(kg: number | null): boolean {
  return kg !== null && kg >= BODY_LIMITS.minKg && kg <= BODY_LIMITS.maxKg;
}
