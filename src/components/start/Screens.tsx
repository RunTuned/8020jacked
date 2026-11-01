"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Banner, Button, Card, Hero, Option, OptionGroup, Screen, Stack, TextField, TopRow } from "@/components/ui";
import { copyText, inAppBrowser, installFirst, isStandalone, platform, type Platform } from "@/lib/device";
import { PRICE_PREVIEW } from "@/lib/services";
import { appState, selectResumeRoute, selectSetupDone, useAppStore } from "@/lib/store";
import type { ReminderSlot } from "@/lib/types";
import { INSTALL_FIRST, REMINDERS_NEXT, REMINDER_LABEL, TEST_NOTICE, inAppCopy } from "./copy";
import { Bottom, ImportButton, StepHeader } from "./Parts";

const noop = () => () => {};
/** Device facts (user agent, home-screen mode) are only known in the browser. */
function useDevice() {
  const plat = useSyncExternalStore<Platform | null>(noop, () => platform(), () => null);
  const inApp = useSyncExternalStore(noop, () => inAppBrowser(), () => null);
  const standalone = useSyncExternalStore(noop, () => isStandalone(), () => false);
  return { plat, inApp, standalone };
}

const SKIP_IN_APP = "8020jacked:in-app-ok";
const SAFARI_OK = "8020jacked:safari-ok";

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function setFlag(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}

/* ---------------- / ---------------- */
export function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    let to = selectResumeRoute(appState());
    // The home-screen app already has the app: skip the install steps.
    if (to === "/start/install" && isStandalone()) to = "/start/shared-phone";
    router.replace(to);
  }, [router]);
  return null;
}

/* ---------------- A1 Start ---------------- */
export function StartScreen() {
  const router = useRouter();
  const done = useAppStore((s) => selectSetupDone(s));
  const device = useDevice();
  const safariOk = useSyncExternalStore(noop, () => readFlag(SAFARI_OK), () => false);
  const [inSafari, setInSafari] = useState(false);
  useEffect(() => {
    if (done) router.replace(selectResumeRoute(appState()));
    else if (inAppBrowser() && !readFlag(SKIP_IN_APP)) router.replace("/start/browser");
  }, [done, router]);

  if (!done && !safariOk && !inSafari && installFirst(device)) {
    return (
      <InstallFirst
        onSafari={() => {
          setFlag(SAFARI_OK);
          setInSafari(true);
        }}
      />
    );
  }

  return (
    <Screen>
      <div aria-hidden="true" className="flex min-h-40 items-center justify-center rounded-card bg-pink p-5">
        <span className="text-display-xl font-extrabold tracking-[-0.02em]">8020jacked</span>
      </div>
      <Hero title="Simple workouts and easy meals, made for your week." size="l" />
      <Card tone="neutral" eyebrow="Test version, free" title="Price when it opens to everyone">
        <p className="m-0 text-label">
          Free workout, then 7 days free (card needed, cancel any time), then {PRICE_PREVIEW.monthly} or{" "}
          {PRICE_PREVIEW.yearly}.
        </p>
      </Card>
      <p className="m-0 text-body text-ink-muted">About 2 minutes. You can stop and come back.</p>
      <Bottom>
        <Button block href="/start/setup">
          New here
        </Button>
        <Button block href="/start/back">
          I&apos;ve used it before
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A1 on iPhone Safari: add to the Home Screen first ---------------- */
function InstallFirst({ onSafari }: { onSafari: () => void }) {
  return (
    <Screen>
      <div className="flex min-h-36 items-center justify-center rounded-card bg-pink p-5">
        <Image src="/icons/icon-192.png" alt="The 8020jacked icon" width={88} height={88} className="rounded-[22px]" />
      </div>
      <Hero title={INSTALL_FIRST.title} subline={INSTALL_FIRST.subline} />
      <Card tone="blue" icon="share" title="In Safari">
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-6">
          {INSTALL_FIRST.steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </Card>
      <Bottom>
        <Button variant="text" onClick={onSafari}>
          {INSTALL_FIRST.safari}
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A14w In-app browser ---------------- */
export function BrowserScreen() {
  const router = useRouter();
  const { plat } = useDevice();
  const [copied, setCopied] = useState(false);
  const c = inAppCopy(plat);
  return (
    <Screen>
      <Hero title="Open this in your phone's browser" subline="WhatsApp, Facebook and Instagram can't add apps to your home screen." />
      <Card tone="blue" icon="share" title={c.steps} />
      {c.lines.map((x) => (
        <p key={x} className="m-0 text-body font-semibold">
          {x}
        </p>
      ))}
      <div className="flex flex-col gap-1">
        <Button
          variant="secondary"
          block
          onClick={async () => setCopied(await copyText(window.location.origin + "/start"))}
        >
          Copy link
        </Button>
        <p role="status" className="m-0 min-h-6 text-center text-label text-ink-muted">
          {copied ? "Copied" : ""}
        </p>
      </div>
      <Bottom>
        <Button
          block
          onClick={() => {
            setFlag(SKIP_IN_APP);
            router.push("/start");
          }}
        >
          {c.done}
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A3b Under 18 ---------------- */
export function Under18Screen() {
  const clearSetup = useAppStore((s) => s.clearSetup);
  const planStart = useAppStore((s) => s.planStart);
  // Nothing is saved; answers so far are cleared (never on a phone that already has a plan).
  useEffect(() => {
    if (!planStart) clearSetup();
  }, [planStart, clearSetup]);
  return (
    <Screen>
      <div aria-hidden="true" className="flex min-h-36 items-center justify-center rounded-card bg-lime p-5">
        <span className="text-display-l font-extrabold">See you then</span>
      </div>
      <Hero title="Thanks for stopping by" subline="8020jacked is for adults 18 and over. We'd love to see you then." />
      <Bottom>
        <Button block href="/start">
          Close
        </Button>
        <Button variant="secondary" block href="/start/setup?step=about">
          I made a mistake
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A11 (v0.1): I've used it before ---------------- */
export function BackScreen() {
  const router = useRouter();
  return (
    <Screen>
      <TopRow back={{ href: "/start" }} />
      <Hero title="Welcome back" subline="Pick the file you downloaded from You → My data." />
      <Banner icon="you">{TEST_NOTICE}</Banner>
      <Bottom>
        <ImportButton onDone={() => router.replace(selectResumeRoute(appState()))} />
        <Button variant="secondary" block href="/start/setup?step=about">
          Start new
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A10 (v0.1): Save your progress ---------------- */
export function SaveScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const taster = params.get("from") === "taster";
  const name = useAppStore((s) => s.profile.firstName);
  const saveFirstName = useAppStore((s) => s.saveFirstName);
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);
  const [first, setFirst] = useState(name ?? "");
  useEffect(() => saveSetupStep("save"), [saveSetupStep]);
  return (
    <Screen>
      <StepHeader back={{ href: "/start/setup?step=plan" }} />
      <Hero
        title={taster ? "Save your progress" : "Save your plan"}
        subline={taster ? "Nice work. Save it so nothing gets lost." : undefined}
      />
      <Banner icon="you">{TEST_NOTICE}</Banner>
      <TextField label="First name" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} />
      <Bottom>
        <Button
          block
          onClick={() => {
            saveFirstName(first);
            // iPhone in Safari chose "Use it in Safari instead" on A1: no install step (the home-screen app
            // would start empty). Android keeps the install step; it shares storage.
            const next = isStandalone() || platform() === "ios" ? "shared-phone" : "install";
            saveSetupStep(next);
            router.push(next === "shared-phone" ? "/start/shared-phone?from=save" : "/start/install");
          }}
        >
          Next
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A14 / A14b Install ---------------- */
export function downloadFile(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function InstallScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { plat, inApp } = useDevice();
  const markInstallShown = useAppStore((s) => s.markInstallShown);
  const open = params.get("step") === "open";
  useEffect(() => markInstallShown(), [markInstallShown]);

  if (inApp) return <BrowserScreen />;

  if (open) {
    return (
      <Screen>
        <StepHeader back={{ href: "/start/install" }} />
        <div className="flex min-h-36 items-center justify-center rounded-card bg-neutral p-5">
          <Image src="/icons/icon-192.png" alt="The 8020jacked icon on a home screen" width={88} height={88} className="rounded-[22px]" />
        </div>
        <Hero title="Now open the app" />
        <p className="m-0 text-body font-semibold">Open the app from your home screen.</p>
        <p className="m-0 text-body">You can close this page.</p>
        {plat !== "android" ? (
          <p className="m-0 text-body">On iPhone, the home-screen app starts fresh. Set it up there.</p>
        ) : null}
        <Bottom>
          <Button block href="/start/shared-phone">
            Opened from the home screen
          </Button>
        </Bottom>
      </Screen>
    );
  }

  const ios = (
    <Card tone="blue" title="iPhone (Safari)">
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-6">
        <li>Tap Share.</li>
        <li>Tap Add to Home Screen.</li>
        <li>Tap Add.</li>
      </ol>
    </Card>
  );
  const android = (
    <Card tone="blue" title="Android (Chrome)">
      <ol className="m-0 flex list-decimal flex-col gap-1 pl-6">
        <li>Tap the ⋮ menu.</li>
        <li>Tap Install app.</li>
      </ol>
    </Card>
  );
  return (
    <Screen>
      <StepHeader back={{ href: "/start/save" }} />
      <Hero title="Add to your home screen" subline="So reminders reach you, and it opens like an app." />
      <Stack>
        {plat !== "android" ? ios : null}
        {plat !== "ios" ? android : null}
      </Stack>
      <p className="m-0 text-body">
        {plat === "android"
          ? "Don't see Install app? Open this page in Chrome."
          : "Don't see Add to Home Screen? Open this page in Safari."}
      </p>
      <Bottom>
        <Button block onClick={() => router.push("/start/install?step=open")}>
          Done, it&apos;s added
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            useAppStore.getState().saveSetupStep("shared-phone");
            router.push("/start/shared-phone?from=install");
          }}
        >
          Not now
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A12 Shared phone ---------------- */
export function SharedPhoneScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const shared = useAppStore((s) => s.settings.sharedPhone);
  const saveSharedPhone = useAppStore((s) => s.saveSharedPhone);
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);
  const [value, setValue] = useState<boolean>(shared);
  useEffect(() => saveSetupStep("shared-phone"), [saveSetupStep]);
  // Back goes to the screen before: A14 after "Not now", A14b after "Done, it's added", A10 in the home-screen app.
  const from = params.get("from");
  const back =
    from === "install" ? "/start/install" : from === "save" || isStandaloneSafe() ? "/start/save" : "/start/install?step=open";
  return (
    <Screen>
      <StepHeader back={{ href: back }} />
      <Hero title="Do others use this phone?" />
      <OptionGroup label="Do others use this phone?">
        <Option checked={value} onChange={() => setValue(true)} hint="Weight numbers hidden, plain reminder text.">
          Yes
        </Option>
        <Option checked={!value} onChange={() => setValue(false)}>
          No, just me
        </Option>
      </OptionGroup>
      <p className="m-0 text-label text-ink-muted">Change any time in You.</p>
      <Bottom>
        <Button
          block
          onClick={() => {
            saveSharedPhone(value);
            saveSetupStep("reminders");
            router.push("/start/reminders");
          }}
        >
          Next
        </Button>
      </Bottom>
    </Screen>
  );
}

function isStandaloneSafe() {
  return typeof window !== "undefined" && isStandalone();
}

/* ---------------- A13 Reminders (v0.1: saves the choice only) ---------------- */
export function RemindersScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const saveReminders = useAppStore((s) => s.saveReminders);
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);
  const { standalone } = useDevice();
  const [dayStart, setDayStart] = useState(settings.dayStart);
  const [slot, setSlot] = useState<ReminderSlot>(settings.reminder);
  useEffect(() => saveSetupStep("reminders"), [saveSetupStep]);
  return (
    <Screen>
      <StepHeader back={{ href: "/start/shared-phone" }} />
      <Hero title="Reminders" />
      <TextField label="When does your day start?" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
      <OptionGroup label="Reminder">
        {(Object.keys(REMINDER_LABEL) as ReminderSlot[]).map((r) => (
          <Option key={r} checked={slot === r} onChange={() => setSlot(r)}>
            {REMINDER_LABEL[r]}
          </Option>
        ))}
      </OptionGroup>
      <p className="m-0 text-label text-ink-muted">{REMINDERS_NEXT}</p>
      {standalone ? null : (
        <div className="flex flex-col">
          <p className="m-0 text-label text-ink-muted">Reminders need the home-screen app.</p>
          <Button variant="text" href="/start/install">
            Add to home screen
          </Button>
        </div>
      )}
      <Bottom>
        <Button
          block
          onClick={() => {
            saveReminders({ dayStart: dayStart || settings.dayStart, reminder: slot });
            saveSetupStep("free-week");
            router.push("/start/free-week");
          }}
        >
          Next
        </Button>
      </Bottom>
    </Screen>
  );
}

/* ---------------- A15 (v0.1): free week preview ---------------- */
export function FreeWeekScreen() {
  const router = useRouter();
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);
  return (
    <Screen>
      <StepHeader back={{ href: "/start/reminders" }} />
      <Hero title="Your free week" />
      <Banner icon="check">Test version, free. There&apos;s nothing to pay.</Banner>
      <Card tone="neutral" eyebrow="Preview" title="When it opens to everyone">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-[1_1_8rem] flex-col rounded-field bg-canvas p-4">
            <span className="font-bold">Monthly</span>
            <span>{PRICE_PREVIEW.monthly}</span>
          </div>
          <div className="flex flex-[1_1_8rem] flex-col rounded-field bg-canvas p-4">
            <span className="font-bold">Yearly</span>
            <span>{PRICE_PREVIEW.yearly}</span>
          </div>
        </div>
        <p className="m-0 text-label">7 days free first, tax included. Cancel before then and pay nothing.</p>
      </Card>
      <Bottom>
        <Button
          block
          onClick={() => {
            saveSetupStep(null);
            router.push("/today");
          }}
        >
          Go to Today
        </Button>
      </Bottom>
    </Screen>
  );
}
