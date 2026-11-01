/** Keep the screen on during a workout where the Screen Wake Lock API exists; do nothing elsewhere. */

type Sentinel = { released?: boolean; release: () => Promise<void>; addEventListener?: (t: "release", f: () => void) => void };
type WakeNav = { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
type VisDoc = {
  visibilityState: string;
  addEventListener: (t: "visibilitychange", f: () => void) => void;
  removeEventListener: (t: "visibilitychange", f: () => void) => void;
};

export type WakeLockHandle = {
  /** False when the phone has no wake lock API: the screen may sleep. */
  readonly supported: boolean;
  /** True while the lock is held. */
  isActive: () => boolean;
  /** Let the screen sleep again and stop re-acquiring. */
  release: () => Promise<void>;
};

export function wakeLockSupported(nav: WakeNav | undefined = typeof navigator === "undefined" ? undefined : (navigator as unknown as WakeNav)): boolean {
  return !!nav?.wakeLock && typeof nav.wakeLock.request === "function";
}

/**
 * Ask for a screen wake lock. The browser drops it when the page is hidden, so it is asked for again
 * when the page is visible. Never throws.
 */
export async function keepScreenOn(
  nav: WakeNav | undefined = typeof navigator === "undefined" ? undefined : (navigator as unknown as WakeNav),
  doc: VisDoc | undefined = typeof document === "undefined" ? undefined : (document as unknown as VisDoc),
): Promise<WakeLockHandle> {
  if (!wakeLockSupported(nav)) {
    return { supported: false, isActive: () => false, release: async () => {} };
  }
  let sentinel: Sentinel | null = null;
  let stopped = false;

  const acquire = async () => {
    if (stopped) return;
    try {
      sentinel = await nav!.wakeLock!.request("screen");
      sentinel.addEventListener?.("release", () => {
        sentinel = null;
      });
    } catch {
      sentinel = null; // e.g. low battery or page not visible: carry on without it
    }
  };
  const onVisible = () => {
    if (doc?.visibilityState === "visible" && !sentinel) void acquire();
  };

  await acquire();
  doc?.addEventListener("visibilitychange", onVisible);

  return {
    supported: true,
    isActive: () => !!sentinel && !sentinel.released,
    release: async () => {
      stopped = true;
      doc?.removeEventListener("visibilitychange", onVisible);
      const s = sentinel;
      sentinel = null;
      try {
        await s?.release();
      } catch {
        // already released
      }
    },
  };
}
