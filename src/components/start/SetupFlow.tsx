"use client";

import { useShallow } from "zustand/react/shallow";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Hero, Option, OptionGroup, Screen, Segmented } from "@/components/ui";
import { appState, selectGoalNote, selectGoalOptions, selectPlanSentence, unitsForLocale, useAppStore } from "@/lib/store";
import type { Allergen, CookOrBuy, DaysPerWeek, Equipment, Goal, MealsPerDay, SessionMinutes, SetupStep } from "@/lib/types";
import { BodyFields, bodyDraft, readBody, type BodyErrors } from "./BodyFields";
import { COOK, DAYS, GOAL_LABEL, MEALS, MINUTES } from "./copy";
import { AllergyChoices, Bottom, EquipmentChoices, StepHeader, TermsLinks } from "./Parts";

import { FLOW, type FlowStep } from "./flow";
const NUMBER: Partial<Record<FlowStep, number>> = { about: 1, goal: 2, ready: 3, time: 4, home: 5, food: 6 };

function isStep(x: string | null): x is FlowStep {
  return !!x && (FLOW as readonly string[]).includes(x);
}

/** A2–A8 as one route. The step lives in ?step= (a reload resumes) and in the store (the app resumes). */
export function SetupFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);
  const saved = useAppStore((s) => s.setupStep);
  const planStart = useAppStore((s) => s.planStart);
  const edit = params.get("edit") === "1";
  const fromUrl = params.get("step");
  const step: FlowStep = isStep(fromUrl) ? fromUrl : isStep(saved ?? null) ? (saved as FlowStep) : "about";
  const heading = useRef<HTMLDivElement>(null);

  // Keep the URL and the store's resume point in step with the screen.
  useEffect(() => {
    if (fromUrl !== step) router.replace(`/start/setup?step=${step}${edit ? "&edit=1" : ""}`, { scroll: false });
    if (!edit && !planStart) saveSetupStep(step as SetupStep);
  }, [step, fromUrl, edit, planStart, router, saveSetupStep]);

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.querySelector<HTMLElement>("h1 [tabindex]")?.focus({ preventScroll: true });
  }, [step]);

  const go = (s: FlowStep) => router.push(`/start/setup?step=${s}${edit ? "&edit=1" : ""}`, { scroll: false });

  const props = { edit, go };
  return (
    <div ref={heading} className="contents">
      {step === "about" && <About {...props} />}
      {step === "goal" && <GoalStep {...props} />}
      {step === "ready" && <Ready {...props} />}
      {step === "time" && <Time {...props} />}
      {step === "home" && <Home {...props} />}
      {step === "food" && <Food {...props} />}
      {step === "plan" && <PlanStep {...props} />}
    </div>
  );
}

type StepProps = { edit: boolean; go: (s: FlowStep) => void };

function Shell({ step, back, title, subline, children }: { step: FlowStep; back: { href?: string; onClick?: () => void }; title: string; subline?: string; children: React.ReactNode }) {
  return (
    <Screen>
      <StepHeader back={back} step={NUMBER[step]} />
      <Hero title={<span tabIndex={-1} className="outline-none">{title}</span>} subline={subline} sublineSize="label" />
      {children}
    </Screen>
  );
}

/* ---------------- A2 About you ---------------- */
function About({ edit, go }: StepProps) {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const units = useAppStore((s) => s.settings.units);
  const createdOn = useAppStore((s) => s.createdOn);
  const saveAbout = useAppStore((s) => s.saveAbout);
  const saveBodyStats = useAppStore((s) => s.saveBodyStats);
  const saveUnits = useAppStore((s) => s.saveUnits);
  // First time on this phone: units start from the phone's region (S3).
  const [draft, setDraft] = useState(() =>
    bodyDraft(profile, createdOn ? units : unitsForLocale(typeof navigator === "undefined" ? undefined : navigator.language)),
  );
  const [errors, setErrors] = useState<BodyErrors>({});

  function next() {
    const r = readBody(draft);
    if (r.ageCheck === "under18" && !edit) {
      router.push("/start/under-18");
      return;
    }
    const errs = { ...r.errors };
    if (r.ageCheck === "under18") errs.age = "8020jacked is for adults 18 and over.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveUnits(draft.units);
    if (edit) saveBodyStats({ age: r.age!, heightCm: r.heightCm, setupWeightKg: r.kg!, noWeigh: draft.noWeigh });
    else saveAbout({ age: r.age!, heightCm: r.heightCm, setupWeightKg: r.kg!, noWeigh: draft.noWeigh });
    go("goal");
  }

  return (
    <Shell step="about" back={{ href: edit ? "/you/goal" : "/start" }} title="About you" subline="Roughly is fine. We use this to size your meals.">
      <BodyFields draft={draft} onChange={(d) => { setDraft(d); setErrors({}); }} errors={errors} />
      <Bottom>
        <Button block onClick={next}>
          Next
        </Button>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A3 Your goal ---------------- */
function GoalStep({ edit, go }: StepProps) {
  const current = useAppStore((s) => s.profile.goal);
  const terms = useAppStore((s) => s.profile.termsAcceptedOn);
  const options = useAppStore(useShallow(selectGoalOptions));
  const note = useAppStore(selectGoalNote);
  const saveGoal = useAppStore((s) => s.saveGoal);
  const proposeGoal = useAppStore((s) => s.proposeGoal);
  const pending = useAppStore((s) => s.ui.pendingGoal);
  const [goal, setGoal] = useState<Goal | null>(() => {
    const g = pending?.goal ?? current;
    return g && options.includes(g) ? g : null;
  });
  const [tick, setTick] = useState(!!terms);
  const ready = !!goal && (edit || tick);

  function next() {
    if (!ready || !goal) return;
    if (edit) {
      proposeGoal(goal);
      go("time");
    } else {
      saveGoal(goal, true);
      go("ready");
    }
  }

  return (
    <Shell step="goal" back={{ onClick: () => go("about") }} title="What's your goal?">
      <OptionGroup label="Your goal">
        {options.map((g) => (
          <Option key={g} checked={goal === g} onChange={() => setGoal(g)}>
            {GOAL_LABEL[g]}
          </Option>
        ))}
      </OptionGroup>
      {note ? <p className="m-0 text-label text-ink-muted">{note}</p> : null}
      <Bottom>
        {edit ? null : (
          <div className="flex flex-col">
            <Option kind="checkbox" checked={tick} onChange={setTick}>
              I agree to the terms and privacy note
            </Option>
            <TermsLinks />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button block disabled={!ready} aria-describedby={ready ? undefined : "goal-wait"} onClick={next}>
            Next
          </Button>
          {ready ? null : (
            <div id="goal-wait" className="text-center text-label text-ink-muted">
              {edit ? "Pick a goal to go on." : "Pick a goal and tick the box to go on."}
            </div>
          )}
        </div>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A4 Before you start ---------------- */
function Ready({ go }: StepProps) {
  const markSafetySeen = useAppStore((s) => s.markSafetySeen);
  return (
    <Shell step="ready" back={{ onClick: () => go("goal") }} title="Before you start">
      <p className="m-0 text-body font-semibold">
        This is a general fitness and eating plan for healthy adults. If you&apos;re pregnant, injured, or have a health
        condition, check with your doctor first.
      </p>
      <Bottom>
        <Button
          block
          onClick={() => {
            markSafetySeen();
            go("time");
          }}
        >
          I&apos;m good to go
        </Button>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A5 Time ---------------- */
function Time({ edit, go }: StepProps) {
  const training = useAppStore((s) => s.training);
  const saveTime = useAppStore((s) => s.saveTime);
  const [minutes, setMinutes] = useState(`${training.minutes}` as `${SessionMinutes}`);
  const [days, setDays] = useState(`${training.daysPerWeek}` as `${DaysPerWeek}`);
  return (
    <Shell step="time" back={{ onClick: () => go(edit ? "goal" : "ready") }} title="Time">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-label font-semibold">How long do you usually get?</p>
        <Segmented label="How long do you usually get?" outlined stretch options={MINUTES} value={minutes} onChange={setMinutes} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="m-0 text-label font-semibold">Days a week</p>
        <Segmented label="Days a week" outlined stretch options={DAYS} value={days} onChange={setDays} />
      </div>
      <Bottom>
        <Button
          block
          onClick={() => {
            saveTime({ minutes: Number(minutes) as SessionMinutes, daysPerWeek: Number(days) as DaysPerWeek });
            go("home");
          }}
        >
          Next
        </Button>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A6 At home ---------------- */
function Home({ go }: StepProps) {
  const equipment = useAppStore((s) => s.training.equipment);
  const saveEquipment = useAppStore((s) => s.saveEquipment);
  const [eq, setEq] = useState<Equipment[]>(equipment);
  return (
    <Shell step="home" back={{ onClick: () => go("time") }} title="At home" subline="What you have (pick all):">
      <EquipmentChoices value={eq} onChange={setEq} />
      <p className="m-0 text-label text-ink-muted">Something hurts in a workout? Tap “Hurts? Swap this move”.</p>
      <Bottom>
        <Button
          block
          onClick={() => {
            saveEquipment(eq);
            go("food");
          }}
        >
          Next
        </Button>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A7 Food ---------------- */
function Food({ edit, go }: StepProps) {
  const router = useRouter();
  const food = useAppStore((s) => s.food);
  const saveFoodSetup = useAppStore((s) => s.saveFoodSetup);
  const saveFoodPrefs = useAppStore((s) => s.saveFoodPrefs);
  const [meals, setMeals] = useState(`${food.mealsPerDay}` as `${MealsPerDay}`);
  const [cook, setCook] = useState<CookOrBuy>(food.cookOrBuy);
  const [allergies, setAllergies] = useState<Allergen[]>(food.allergies);

  function next() {
    const mealsPerDay = Number(meals) as MealsPerDay;
    if (edit) {
      const s = appState();
      saveFoodPrefs({
        ...(mealsPerDay !== s.food.mealsPerDay ? { mealsPerDay } : {}),
        ...(cook !== s.food.cookOrBuy ? { cookOrBuy: cook } : {}),
        allergies,
      });
      router.push("/plan-updated");
    } else {
      saveFoodSetup({ mealsPerDay, cookOrBuy: cook, allergies });
      go("plan");
    }
  }

  return (
    <Shell step="food" back={{ onClick: () => go("home") }} title="Food">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-label font-semibold">Meals a day</p>
        <Segmented label="Meals a day" outlined stretch options={MEALS} value={meals} onChange={setMeals} />
      </div>
      <Segmented label="Cook or buy" outlined stretch options={COOK} value={cook} onChange={setCook} />
      <div className="flex flex-col gap-2">
        <p className="m-0 text-body font-semibold">Allergies (tick any)</p>
        <AllergyChoices value={allergies} onChange={setAllergies} />
        <p className="m-0 text-label text-ink-muted">We never put these in your meals. Check labels on anything you buy.</p>
      </div>
      <Bottom>
        <Button block onClick={next}>
          Next
        </Button>
      </Bottom>
    </Shell>
  );
}

/* ---------------- A8 Your plan ---------------- */
function PlanStep({ go }: StepProps) {
  const router = useRouter();
  const sentence = useAppStore((s) => selectPlanSentence(s));
  const createPlan = useAppStore((s) => s.createPlan);
  const saveSetupStep = useAppStore((s) => s.saveSetupStep);

  function leave(to: string) {
    createPlan();
    saveSetupStep("save");
    router.push(to);
  }

  return (
    <Shell step="plan" back={{ onClick: () => go("food") }} title="Your plan">
      <div aria-hidden="true" className="flex min-h-40 items-center justify-center rounded-card bg-blue p-5">
        <span className="text-display-l font-extrabold tracking-[-0.02em]">8020jacked</span>
      </div>
      <p className="m-0 text-title font-bold">{sentence}</p>
      <Bottom>
        <Button block onClick={() => leave("/train/workout?taster=1&next=/start/save?from=taster")}>
          Try a free workout now
        </Button>
        <Button variant="secondary" block onClick={() => leave("/start/save?from=later")}>
          Do it later
        </Button>
      </Bottom>
    </Shell>
  );
}
