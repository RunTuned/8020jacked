// The rest clock as saved for this tab (sessionStorage), so a reload resumes the same clock.
// While paused, the time left is kept instead of an end time (QA 12).

export type RestSaved = {
  workoutId: string;
  exerciseId: string;
  label: string;
  endsAt: number;
  /** Set while paused: ms left when she paused. */
  pausedLeft?: number;
};

export function restLeft(r: RestSaved, now: number): number {
  return Math.max(0, r.pausedLeft ?? r.endsAt - now);
}

export function pauseRest(r: RestSaved, now: number): RestSaved {
  return r.pausedLeft !== undefined ? r : { ...r, pausedLeft: restLeft(r, now) };
}

export function resumeRest(r: RestSaved, now: number): RestSaved {
  if (r.pausedLeft === undefined) return r;
  const { pausedLeft, ...rest } = r;
  return { ...rest, endsAt: now + pausedLeft };
}

export function addRest(r: RestSaved, now: number, ms: number): RestSaved {
  return r.pausedLeft !== undefined ? { ...r, pausedLeft: r.pausedLeft + ms } : { ...r, endsAt: Math.max(r.endsAt, now) + ms };
}
