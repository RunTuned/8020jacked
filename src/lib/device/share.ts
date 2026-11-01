/** Web Share with a copy-to-clipboard fallback. */

export type ShareData = { title?: string; text?: string; url?: string };

type ShareNav = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> };
};

function defaultNav(): ShareNav | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as unknown as ShareNav);
}

export function canShare(data: ShareData, nav: ShareNav | undefined = defaultNav()): boolean {
  if (!nav || typeof nav.share !== "function") return false;
  if (typeof nav.canShare === "function") {
    try {
      return nav.canShare(data);
    } catch {
      return false;
    }
  }
  return true;
}

/** The text that gets copied when sharing isn't possible: text, then the link on its own line. */
export function shareText(data: ShareData): string {
  return [data.title && !data.text ? data.title : undefined, data.text, data.url].filter(Boolean).join("\n");
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

type CopyDoc = {
  createElement: (tag: "textarea") => HTMLTextAreaElement;
  body: { appendChild: (n: Node) => unknown; removeChild: (n: Node) => unknown };
  execCommand?: (cmd: string) => boolean;
};

/** Copy text: async clipboard first, then the old textarea trick. */
export async function copyText(
  text: string,
  nav: ShareNav | undefined = defaultNav(),
  doc: CopyDoc | undefined = typeof document === "undefined" ? undefined : (document as unknown as CopyDoc),
): Promise<boolean> {
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  if (!doc || typeof doc.execCommand !== "function") return false;
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  doc.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand("copy");
  } catch {
    ok = false;
  }
  doc.body.removeChild(ta);
  return ok;
}

/**
 * Open the phone's share sheet; if there is none, copy instead.
 * Returns what happened so the screen can say "Copied" or nothing.
 */
export async function shareOrCopy(
  data: ShareData,
  nav: ShareNav | undefined = defaultNav(),
  doc?: CopyDoc,
): Promise<ShareResult> {
  if (canShare(data, nav)) {
    try {
      await nav!.share!(data);
      return "shared";
    } catch (e) {
      if (e && typeof e === "object" && (e as { name?: string }).name === "AbortError") return "cancelled";
      // otherwise fall back to copy
    }
  }
  const ok = await copyText(shareText(data), nav, doc);
  return ok ? "copied" : "failed";
}
