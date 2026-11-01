import { describe, expect, it, vi } from "vitest";
import { createWorkoutAudio } from "./audio";
import * as cd from "./countdown";
import { canShare, copyText, shareOrCopy, shareText } from "./share";
import { inAppBrowser, isAndroid, isIOS, isStandalone, platform } from "./ua";
import { keepScreenOn, wakeLockSupported } from "./wakeLock";

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadOS: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  whatsapp:
    "Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0]",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0",
  desktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

describe("ua", () => {
  it("detects iOS, including iPadOS posing as a Mac", () => {
    expect(isIOS(UA.iphone, 5)).toBe(true);
    expect(isIOS(UA.ipadOS, 5)).toBe(true);
    expect(isIOS(UA.ipadOS, 0)).toBe(false);
    expect(isIOS(UA.android, 5)).toBe(false);
  });
  it("detects Android", () => {
    expect(isAndroid(UA.android)).toBe(true);
    expect(isAndroid(UA.iphone)).toBe(false);
  });
  it("detects in-app browsers", () => {
    expect(inAppBrowser(UA.whatsapp)).toBe("whatsapp");
    expect(inAppBrowser(UA.facebook)).toBe("facebook");
    expect(inAppBrowser(UA.instagram)).toBe("instagram");
    expect(inAppBrowser(UA.iphone)).toBeNull();
  });
  it("names the platform", () => {
    expect(platform(UA.iphone, 5)).toBe("ios");
    expect(platform(UA.android, 5)).toBe("android");
    expect(platform(UA.desktop, 0)).toBe("other");
  });
  it("detects standalone from display-mode or navigator.standalone", () => {
    expect(isStandalone(undefined)).toBe(false);
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" }) })).toBe(true);
    expect(isStandalone({ matchMedia: () => ({ matches: false }) })).toBe(false);
  });
});

describe("share", () => {
  it("canShare is false without the API", () => {
    expect(canShare({ text: "x" }, {})).toBe(false);
    expect(canShare({ text: "x" }, undefined)).toBe(false);
    expect(canShare({ text: "x" }, { share: async () => {}, canShare: () => false })).toBe(false);
    expect(canShare({ text: "x" }, { share: async () => {} })).toBe(true);
  });
  it("shares when possible", async () => {
    const share = vi.fn(async () => {});
    expect(await shareOrCopy({ text: "List" }, { share })).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
  });
  it("reports a cancelled share without copying", async () => {
    const writeText = vi.fn(async () => {});
    const share = async () => {
      throw Object.assign(new Error("no"), { name: "AbortError" });
    };
    expect(await shareOrCopy({ text: "List" }, { share, clipboard: { writeText } })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("copies when sharing isn't there", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareOrCopy({ text: "Eggs", url: "https://x.test" }, { clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("Eggs\nhttps://x.test");
  });
  it("falls back to execCommand, then reports failure", async () => {
    const ta = { value: "", style: {} as Record<string, string>, setAttribute() {}, select() {} };
    const doc = {
      createElement: () => ta as unknown as HTMLTextAreaElement,
      body: { appendChild: () => {}, removeChild: () => {} },
      execCommand: () => true,
    };
    expect(await copyText("hi", {}, doc)).toBe(true);
    expect(ta.value).toBe("hi");
    expect(await shareOrCopy({ text: "x" }, {}, { ...doc, execCommand: () => false })).toBe("failed");
  });
  it("builds copy text", () => {
    expect(shareText({ title: "T" })).toBe("T");
    expect(shareText({ title: "T", text: "body" })).toBe("body");
  });
});

describe("wake lock", () => {
  it("degrades when unsupported", async () => {
    expect(wakeLockSupported({})).toBe(false);
    const h = await keepScreenOn({}, undefined);
    expect(h.supported).toBe(false);
    expect(h.isActive()).toBe(false);
    await h.release();
  });
  it("re-acquires when the page comes back", async () => {
    let listener: (() => void) | undefined;
    const doc = {
      visibilityState: "visible",
      addEventListener: (_: "visibilitychange", f: () => void) => {
        listener = f;
      },
      removeEventListener: vi.fn(),
    };
    const sentinels: Array<{ released: boolean; release: () => Promise<void>; fire?: () => void }> = [];
    const request = vi.fn(async () => {
      const s = {
        released: false,
        fire: undefined as undefined | (() => void),
        release: async () => {
          s.released = true;
        },
        addEventListener: (_: "release", f: () => void) => {
          s.fire = f;
        },
      };
      sentinels.push(s);
      return s;
    });
    const h = await keepScreenOn({ wakeLock: { request } }, doc);
    expect(h.supported).toBe(true);
    expect(h.isActive()).toBe(true);
    // the browser drops the lock when the page hides
    sentinels[0].released = true;
    sentinels[0].fire?.();
    expect(h.isActive()).toBe(false);
    listener?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    expect(h.isActive()).toBe(true);
    await h.release();
    expect(h.isActive()).toBe(false);
    expect(doc.removeEventListener).toHaveBeenCalled();
  });
  it("never throws when the request is refused", async () => {
    const h = await keepScreenOn(
      {
        wakeLock: {
          request: async () => {
            throw new Error("NotAllowed");
          },
        },
      },
      undefined,
    );
    expect(h.supported).toBe(true);
    expect(h.isActive()).toBe(false);
  });
});

describe("audio", () => {
  it("is silent without any audio support", async () => {
    const a = createWorkoutAudio({});
    expect(await a.unlock()).toBe(false);
    expect(() => a.beep()).not.toThrow();
    expect(() => a.speak("Go")).not.toThrow();
    expect(a.canSpeak()).toBe(false);
  });
  it("unlocks on a tap, then beeps and speaks", async () => {
    const started: number[] = [];
    class FakeCtx {
      state = "suspended";
      currentTime = 1;
      destination = {};
      async resume() {
        this.state = "running";
      }
      createOscillator() {
        return { type: "", frequency: { value: 0 }, connect: () => {}, start: (t = 0) => started.push(t), stop: () => {} };
      }
      createGain() {
        return {
          gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: () => {},
        };
      }
    }
    const spoken: string[] = [];
    class Utt {
      lang = "";
      rate = 1;
      volume = 1;
      constructor(public text: string) {}
    }
    const speech = { speak: (u: unknown) => spoken.push((u as Utt).text), cancel: vi.fn(), getVoices: () => [] };
    const a = createWorkoutAudio({ AudioContext: FakeCtx, speechSynthesis: speech, SpeechSynthesisUtterance: Utt });
    a.beep();
    expect(started).toHaveLength(0); // locked until a tap
    expect(await a.unlock()).toBe(true);
    a.beep();
    expect(started).toEqual([1]);
    a.speak("Rest");
    expect(spoken).toEqual(["", "Rest"]);
    expect(speech.cancel).toHaveBeenCalled();
  });
});

describe("countdown", () => {
  it("uses the end time, so a locked phone still reads right", () => {
    let s = cd.start(cd.idle(45_000), 1_000);
    expect(cd.remaining(s, 1_000)).toBe(45_000);
    // phone locked for 30 s: no ticks happened
    expect(cd.remaining(s, 31_000)).toBe(15_000);
    expect(cd.formatClock(cd.remaining(s, 31_000))).toBe("0:15");
    s = cd.settle(s, 60_000);
    expect(s.status).toBe("done");
    expect(cd.remaining(s, 60_000)).toBe(0);
  });
  it("pauses, resumes and adds time", () => {
    let s = cd.start(cd.idle(45_000), 0);
    s = cd.pause(s, 10_000);
    expect(s).toEqual({ status: "paused", remainingMs: 35_000 });
    expect(cd.remaining(s, 99_000)).toBe(35_000);
    s = cd.start(s, 100_000);
    s = cd.addTime(s, 100_000, 15_000);
    expect(cd.remaining(s, 100_000)).toBe(50_000);
    expect(cd.addTime(s, 100_000, -60_000).status).toBe("done");
  });
  it("formats clocks and spoken time", () => {
    expect(cd.formatClock(45_000)).toBe("0:45");
    expect(cd.formatClock(44_001)).toBe("0:45");
    expect(cd.formatClock(65_000)).toBe("1:05");
    expect(cd.formatClock(-5)).toBe("0:00");
    expect(cd.spokenClock(45_000)).toBe("45 seconds");
    expect(cd.spokenClock(61_000)).toBe("1 minute 1 second");
    expect(cd.spokenClock(120_000)).toBe("2 minutes");
  });
});
