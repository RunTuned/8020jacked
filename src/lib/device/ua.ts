/** User-agent and display-mode checks. Each takes its inputs so tests can pass fakes. */

type NavLike = { userAgent?: string; maxTouchPoints?: number; platform?: string; standalone?: boolean };

function nav(): NavLike | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as NavLike);
}

/** iPhone, iPod or iPad, including iPadOS that reports itself as a Mac. */
export function isIOS(ua = nav()?.userAgent ?? "", maxTouchPoints = nav()?.maxTouchPoints ?? 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export function isAndroid(ua = nav()?.userAgent ?? ""): boolean {
  return /Android/i.test(ua);
}

export type InAppBrowser = "whatsapp" | "facebook" | "instagram";

/** WhatsApp, Facebook (FBAN/FBAV) and Instagram open links in their own browsers, where install doesn't work. */
export function inAppBrowser(ua = nav()?.userAgent ?? ""): InAppBrowser | null {
  if (/WhatsApp/i.test(ua)) return "whatsapp";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "facebook";
  return null;
}

type WinLike = { matchMedia?: (q: string) => { matches: boolean }; navigator?: NavLike };

/** True when running from the home screen (installed). */
export function isStandalone(win: WinLike | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win) return false;
  if (win.navigator?.standalone === true) return true;
  const mm = win.matchMedia;
  if (typeof mm !== "function") return false;
  return ["(display-mode: standalone)", "(display-mode: fullscreen)", "(display-mode: minimal-ui)"].some(
    (q) => mm.call(win, q).matches,
  );
}

export type Platform = "ios" | "android" | "other";

export function platform(ua = nav()?.userAgent ?? "", maxTouchPoints = nav()?.maxTouchPoints ?? 0): Platform {
  if (isIOS(ua, maxTouchPoints)) return "ios";
  if (isAndroid(ua)) return "android";
  return "other";
}
