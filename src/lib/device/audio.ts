/**
 * Workout sounds. Phones only allow audio after a tap, so call unlock() inside the Start tap handler;
 * after that beep() and speak() work for the rest of the session. Everything degrades to silence.
 */

type Ctx = {
  state: string;
  currentTime: number;
  destination: unknown;
  resume: () => Promise<void>;
  createOscillator: () => {
    type: string;
    frequency: { value: number };
    connect: (n: unknown) => unknown;
    start: (t?: number) => void;
    stop: (t?: number) => void;
  };
  createGain: () => {
    gain: { value: number; setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void };
    connect: (n: unknown) => unknown;
  };
  createBuffer?: (ch: number, len: number, rate: number) => unknown;
  createBufferSource?: () => { buffer: unknown; connect: (n: unknown) => unknown; start: (t?: number) => void };
};
type CtxCtor = new () => Ctx;

type Speech = {
  speak: (u: unknown) => void;
  cancel: () => void;
  getVoices?: () => Array<{ lang: string; name: string; localService?: boolean }>;
};
type UtteranceCtor = new (text: string) => { lang: string; rate: number; volume: number; voice?: unknown };

export type AudioEnv = {
  AudioContext?: CtxCtor;
  speechSynthesis?: Speech;
  SpeechSynthesisUtterance?: UtteranceCtor;
};

function browserEnv(): AudioEnv {
  if (typeof window === "undefined") return {};
  const w = window as unknown as {
    AudioContext?: CtxCtor;
    webkitAudioContext?: CtxCtor;
    speechSynthesis?: Speech;
    SpeechSynthesisUtterance?: UtteranceCtor;
  };
  return {
    AudioContext: w.AudioContext ?? w.webkitAudioContext,
    speechSynthesis: w.speechSynthesis,
    SpeechSynthesisUtterance: w.SpeechSynthesisUtterance,
  };
}

export type BeepOptions = { frequency?: number; durationMs?: number; volume?: number };

export type WorkoutAudio = {
  /** Call from a tap. Returns true when sound is ready. */
  unlock: () => Promise<boolean>;
  /** A short tone; silent if audio isn't unlocked or supported. */
  beep: (opts?: BeepOptions) => void;
  /** Say a cue aloud with the phone's voice. Cancels any cue still speaking. */
  speak: (text: string, opts?: { lang?: string; rate?: number }) => void;
  /** Stop any voice cue. */
  hush: () => void;
  readonly canBeep: () => boolean;
  readonly canSpeak: () => boolean;
};

export function createWorkoutAudio(env: AudioEnv = browserEnv()): WorkoutAudio {
  let ctx: Ctx | null = null;

  const canSpeak = () => !!env.speechSynthesis && !!env.SpeechSynthesisUtterance;

  return {
    async unlock() {
      try {
        if (!ctx && env.AudioContext) ctx = new env.AudioContext();
        if (ctx && ctx.state !== "running") await ctx.resume();
        // iOS: play one silent frame inside the gesture so later sounds are allowed.
        if (ctx?.createBuffer && ctx.createBufferSource) {
          const src = ctx.createBufferSource();
          src.buffer = ctx.createBuffer(1, 1, 22050);
          src.connect(ctx.destination);
          src.start(0);
        }
      } catch {
        ctx = null;
      }
      // Prime speech inside the gesture too (iOS speaks only after a tap-started utterance).
      if (canSpeak()) {
        try {
          const u = new env.SpeechSynthesisUtterance!("");
          u.volume = 0;
          env.speechSynthesis!.speak(u);
        } catch {
          // no voice: fine
        }
      }
      return !!ctx && ctx.state === "running";
    },

    beep({ frequency = 880, durationMs = 180, volume = 0.25 } = {}) {
      if (!ctx || ctx.state !== "running") return;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + durationMs / 1000 + 0.02);
      } catch {
        // ignore
      }
    },

    speak(text, { lang = "en-GB", rate = 1 } = {}) {
      if (!canSpeak() || !text) return;
      try {
        const s = env.speechSynthesis!;
        s.cancel();
        const u = new env.SpeechSynthesisUtterance!(text);
        u.lang = lang;
        u.rate = rate;
        u.volume = 1;
        const voice = s.getVoices?.().find((v) => v.lang === lang) ?? s.getVoices?.().find((v) => v.lang.startsWith("en"));
        if (voice) u.voice = voice;
        s.speak(u);
      } catch {
        // ignore
      }
    },

    hush() {
      try {
        env.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    },

    canBeep: () => !!ctx && ctx.state === "running",
    canSpeak,
  };
}
