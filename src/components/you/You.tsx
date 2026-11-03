"use client";

import { useShallow } from "zustand/react/shallow";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Banner, Button, Card, Hero, Option, OptionGroup, Screen, Segmented, Sheet, Stack, Switch, TabBar, TextField, TopRow, cx } from "@/components/ui";
import { BodyFields, bodyDraft, readBody, type BodyErrors } from "@/components/start/BodyFields";
import { COOK, DAYS, GOAL_LABEL, MEALS, MINUTES, MINUTES_HINT, REMINDERS_NEXT, REMINDER_LABEL, TEST_DOWNLOAD } from "@/components/start/copy";
import { AllergyChoices, Bottom, EquipmentChoices, ImportButton, TermsLinks } from "@/components/start/Parts";
import { downloadFile } from "@/components/start/Screens";
import { isStandalone } from "@/lib/device";
import { PRICE_PREVIEW } from "@/lib/services";
import {
  appState,
  exportFileName,
  kgFrom,
  parseNumber,
  selectAllergyNotice,
  selectBlock,
  selectGoalNote,
  selectGoalOptions,
  selectNeedsFreshWeight,
  selectToday,
  useAppStore,
  weightOk,
} from "@/lib/store";
import type { Allergen, CookOrBuy, DaysPerWeek, Equipment, Goal, MealsPerDay, ReminderSlot, SessionMinutes, Theme, Weekday } from "@/lib/types";

import { SECTIONS, type Section } from "./sections";

const TITLES: Record<Section, string> = {
  goal: "Goal and plan",
  body: "Body and units",
  home: "At home",
  food: "Food",
  reminders: "Reminders",
  display: "Display",
  subscription: "Subscription",
  data: "My data and account",
};

/* ---------------- S1 You ---------------- */
export function YouHome() {
  const notice = useAppStore((s) => selectAllergyNotice(s)?.message ?? null);
  return (
    <>
      <Screen withTabBar>
        <Hero title="You" />
        {notice ? <Banner icon="hurts">{notice}</Banner> : null}
        <Stack label="Settings">
          {SECTIONS.map((s) => (
            <Card
              key={s}
              href={`/you/${s}`}
              title={TITLES[s]}
              detail={s === "subscription" ? "Test version, free" : undefined}
            />
          ))}
        </Stack>
      </Screen>
      <TabBar />
    </>
  );
}

function SectionPage({ title, children, onSave, saveLabel = "Save", extra }: { title: string; children: ReactNode; onSave?: () => void; saveLabel?: string; extra?: ReactNode }) {
  return (
    <Screen>
      <TopRow back={{ href: "/you" }} />
      <Hero title={title} />
      {children}
      {onSave || extra ? (
        <Bottom>
          {extra}
          {onSave ? (
            <Button block onClick={onSave}>
              {saveLabel}
            </Button>
          ) : null}
        </Bottom>
      ) : null}
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-label font-semibold">{label}</p>
      {children}
    </div>
  );
}

/* ---------------- S2 Goal and plan ---------------- */
function GoalSection() {
  const router = useRouter();
  const goal = useAppStore((s) => s.profile.goal);
  const training = useAppStore((s) => s.training);
  const weightUnit = useAppStore((s) => s.settings.units.weight);
  const block = useAppStore((s) => selectBlock(s));
  const options = useAppStore(useShallow(selectGoalOptions));
  const needsWeight = useAppStore((s) => selectNeedsFreshWeight(s));
  const goalNote = useAppStore(selectGoalNote);
  const proposeGoal = useAppStore((s) => s.proposeGoal);
  const saveTraining = useAppStore((s) => s.saveTraining);
  const [g, setG] = useState<Goal | null>(goal);
  const [days, setDays] = useState(`${training.daysPerWeek}` as `${DaysPerWeek}`);
  const [mins, setMins] = useState(`${training.minutes}` as `${SessionMinutes}`);
  const [fresh, setFresh] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const goalChanged = !!g && g !== goal;
  const askWeight = goalChanged && g === "lose" && needsWeight;

  function save() {
    let freshKg: number | undefined;
    if (askWeight) {
      const n = parseNumber(fresh);
      freshKg = n === null ? undefined : kgFrom(n, weightUnit);
      if (!weightOk(freshKg ?? null)) {
        setErr("Type your weight. Roughly is fine.");
        return;
      }
    }
    const d = Number(days) as DaysPerWeek;
    const m = Number(mins) as SessionMinutes;
    const trainingChanged = d !== training.daysPerWeek || m !== training.minutes;
    if (trainingChanged) saveTraining({ daysPerWeek: d, minutes: m });
    if (goalChanged) proposeGoal(g!, freshKg);
    router.push(goalChanged || trainingChanged ? "/plan-updated" : "/you");
  }

  return (
    <SectionPage
      title="Goal and plan"
      onSave={save}
      extra={
        goalChanged && block ? (
          <p className="m-0 text-body font-semibold">This starts a new 12 weeks (you&apos;re in week {block.weekNumber}).</p>
        ) : null
      }
    >
      {goal ? (
        <Card tone="neutral" title={`Now: ${GOAL_LABEL[goal]}${block ? ` · week ${block.weekNumber} of your 12 weeks` : ""}`} />
      ) : null}
      <Field label="Goal">
        <OptionGroup label="Goal">
          {options.map((o) => (
            <Option key={o} checked={g === o} onChange={() => setG(o)}>
              {GOAL_LABEL[o]}
            </Option>
          ))}
        </OptionGroup>
        {goalNote ? <p className="m-0 text-label text-ink-muted">{goalNote}</p> : null}
      </Field>
      {askWeight ? (
        <TextField
          label="Your weight now, roughly"
          inputMode="decimal"
          unit={weightUnit}
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          hint="Roughly is fine. We use it to size your meals."
          error={err}
        />
      ) : null}
      <Field label="Days a week">
        <Segmented label="Days a week" outlined stretch options={DAYS} value={days} onChange={setDays} />
      </Field>
      <Field label="Usual time">
        <Segmented label="Usual time" outlined stretch options={MINUTES} value={mins} onChange={setMins} />
        <p className="m-0 text-label text-ink-muted">{MINUTES_HINT}</p>
      </Field>
      <Button variant="text" href="/start/setup?step=about&edit=1">
        Redo my setup answers
      </Button>
    </SectionPage>
  );
}

/* ---------------- S3 Body and units ---------------- */
function BodySection() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const units = useAppStore((s) => s.settings.units);
  const saveBodyStats = useAppStore((s) => s.saveBodyStats);
  const saveUnits = useAppStore((s) => s.saveUnits);
  const [draft, setDraft] = useState(() => bodyDraft(profile, units));
  const [errors, setErrors] = useState<BodyErrors>({});
  return (
    <SectionPage
      title="Body and units"
      onSave={() => {
        const r = readBody(draft);
        const errs = { ...r.errors };
        if (r.ageCheck === "under18") errs.age = "8020jacked is for adults 18 and over.";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        saveBodyStats({ age: r.age!, heightCm: r.heightCm, setupWeightKg: r.kg!, noWeigh: draft.noWeigh });
        saveUnits(draft.units);
        router.push("/you");
      }}
    >
      <BodyFields draft={draft} onChange={(d) => { setDraft(d); setErrors({}); }} errors={errors} />
    </SectionPage>
  );
}

/* ---------------- S4 At home ---------------- */
function HomeSection() {
  const router = useRouter();
  const equipment = useAppStore((s) => s.training.equipment);
  const saveEquipment = useAppStore((s) => s.saveEquipment);
  const [eq, setEq] = useState<Equipment[]>(equipment);
  return (
    <SectionPage
      title="At home"
      onSave={() => {
        saveEquipment(eq);
        router.push("/you");
      }}
    >
      <p className="m-0 text-label font-semibold">What you have at home:</p>
      <EquipmentChoices value={eq} onChange={setEq} />
      <p className="m-0 text-label text-ink-muted">Something hurts in a workout? Tap “Hurts? Swap this move”.</p>
    </SectionPage>
  );
}

/* ---------------- S5 Food ---------------- */
function FoodSection() {
  const router = useRouter();
  const food = useAppStore((s) => s.food);
  const saveFoodPrefs = useAppStore((s) => s.saveFoodPrefs);
  const [meals, setMeals] = useState(`${food.mealsPerDay}` as `${MealsPerDay}`);
  const [cook, setCook] = useState<CookOrBuy>(food.cookOrBuy);
  const [allergies, setAllergies] = useState<Allergen[]>(food.allergies);
  const [fasting, setFasting] = useState(food.fasting);
  const [open, setOpen] = useState(false);
  // QA #7: say what changes and when ("Saved. From tomorrow …"), then Done goes back.
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <SectionPage
      title="Food"
      saveLabel={saved ? "Done" : "Save"}
      extra={
        <p role="status" className="m-0 text-body font-semibold">
          {saved ?? ""}
        </p>
      }
      onSave={() => {
        if (saved) {
          router.push("/you");
          return;
        }
        const m = Number(meals) as MealsPerDay;
        const msg = saveFoodPrefs({
          ...(m !== food.mealsPerDay ? { mealsPerDay: m } : {}),
          ...(cook !== food.cookOrBuy ? { cookOrBuy: cook } : {}),
          ...(fasting !== food.fasting ? { fasting } : {}),
          allergies,
        });
        if (msg) setSaved(msg);
        else router.push("/you");
      }}
    >
      <Field label="Meals a day">
        <Segmented label="Meals a day" outlined stretch options={MEALS} value={meals} onChange={setMeals} />
      </Field>
      <Segmented label="Cook or buy" outlined stretch options={COOK} value={cook} onChange={setCook} />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-field border-2 border-solid border-ink-muted bg-neutral px-4 py-2 text-left text-body font-bold"
        >
          <span className="flex flex-col">
            <span>Allergies</span>
            <span className="text-label font-normal text-ink-muted">{allergies.length ? `${allergies.length} ticked` : "None ticked"}</span>
          </span>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {open ? <AllergyChoices value={allergies} onChange={setAllergies} /> : null}
      </div>
      <Switch
        variant="boxed"
        label="Fasting mode (e.g. Ramadan)"
        description="Same daily food in 2 bigger meals."
        checked={fasting}
        onChange={setFasting}
      />
      <p className="m-0 text-label text-ink-muted">
        Allergies change your meals at once. Other changes start tomorrow, shopping list included.
      </p>
    </SectionPage>
  );
}

/* ---------------- S6 Reminders (v0.1: saves the choice only) ---------------- */
const WEEKDAYS: { d: Weekday; short: string; name: string }[] = [
  { d: 0, short: "M", name: "Monday" },
  { d: 1, short: "T", name: "Tuesday" },
  { d: 2, short: "W", name: "Wednesday" },
  { d: 3, short: "T", name: "Thursday" },
  { d: 4, short: "F", name: "Friday" },
  { d: 5, short: "S", name: "Saturday" },
  { d: 6, short: "S", name: "Sunday" },
];
const SLOTS: ReminderSlot[] = ["morning", "lunch", "evening", "never"];
const noop = () => () => {};

function RemindersSection() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const save = useAppStore((s) => s.saveReminderSettings);
  const standalone = useSyncExternalStore(noop, () => isStandalone(), () => false);
  const [dayStart, setDayStart] = useState(settings.dayStart);
  const [slot, setSlot] = useState<ReminderSlot>(settings.reminder);
  const [day, setDay] = useState<Weekday>(settings.checkInDay);
  const [email, setEmail] = useState(settings.emailReminders);
  return (
    <SectionPage
      title="Reminders"
      onSave={() => {
        save({ dayStart: dayStart || settings.dayStart, reminder: slot, checkInDay: day, emailReminders: email });
        router.push("/you");
      }}
    >
      <p className="m-0 text-label text-ink-muted">{REMINDERS_NEXT}</p>
      {standalone ? null : (
        <div className="flex flex-col">
          <p className="m-0 text-label text-ink-muted">Reminders need the home-screen app.</p>
          <Button variant="text" href="/start/install">
            Add to home screen
          </Button>
        </div>
      )}
      <TextField label="When my day starts" type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
      <Field label="Reminder">
        <OptionGroup label="Reminder">
          {SLOTS.map((r) => (
            <Option key={r} checked={slot === r} onChange={() => setSlot(r)}>
              {r === "never" ? "Never" : REMINDER_LABEL[r]}
            </Option>
          ))}
        </OptionGroup>
      </Field>
      <Field label="Check-in day">
        <div role="radiogroup" aria-label="Check-in day" className="flex flex-wrap gap-0.5">
          {WEEKDAYS.map((w) => (
            <button
              key={w.d}
              type="button"
              role="radio"
              aria-checked={day === w.d}
              aria-label={w.name}
              onClick={() => setDay(w.d)}
              className={cx(
                "size-12 rounded-full border-0 text-body font-bold",
                day === w.d ? "bg-ink text-on-ink" : "bg-neutral text-ink",
              )}
            >
              {w.short}
            </button>
          ))}
        </div>
      </Field>
      <Switch variant="boxed" label="Email reminders too" description="Off until you turn it on." checked={email} onChange={setEmail} />
    </SectionPage>
  );
}

/* ---------------- S7 Display ---------------- */
const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Follow phone" },
];

function DisplaySection() {
  const router = useRouter();
  const s = useAppStore((x) => x.settings);
  const saveDisplay = useAppStore((x) => x.saveDisplay);
  const [d, setD] = useState({
    theme: s.theme,
    showWeightNumbers: s.showWeightNumbers,
    bigScreen: s.bigScreen,
    stillPictures: s.stillPictures,
    sharedPhone: s.sharedPhone,
  });
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });
  return (
    <SectionPage
      title="Display"
      onSave={() => {
        saveDisplay(d);
        router.push("/you");
      }}
    >
      <Segmented label="Light, dark or follow phone" outlined stretch options={THEMES} value={d.theme} onChange={(theme) => set({ theme })} />
      <Switch variant="boxed" label="Show my weight numbers" description="Off: weight shows as words only." checked={d.showWeightNumbers} onChange={(v) => set({ showWeightNumbers: v })} />
      <Switch variant="boxed" label="Big screen mode for workouts" description="Big text you can see from across the room" checked={d.bigScreen} onChange={(v) => set({ bigScreen: v })} />
      <Switch variant="boxed" label="Still pictures (uses less data)" checked={d.stillPictures} onChange={(v) => set({ stillPictures: v })} />
      <Field label="Do others use this phone?">
        <Segmented
          label="Do others use this phone?"
          outlined
          stretch
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          value={d.sharedPhone ? "yes" : "no"}
          onChange={(v) => set({ sharedPhone: v === "yes" })}
        />
        <p className="m-0 text-label text-ink-muted">Yes: weight numbers hidden and plain reminder text.</p>
      </Field>
    </SectionPage>
  );
}

/* ---------------- S8 Subscription (v0.1 preview) ---------------- */
function SubscriptionSection() {
  return (
    <SectionPage title="Subscription">
      <Banner icon="check">Test version, free. There&apos;s nothing to pay.</Banner>
      <Card tone="neutral" eyebrow="Preview" title="When it opens to everyone">
        <p className="m-0 text-body">
          Monthly · {PRICE_PREVIEW.monthly} · tax included
          <br />
          Yearly · {PRICE_PREVIEW.yearly} · tax included
        </p>
        <p className="m-0 text-label text-ink-muted">Change or cancel any time here.</p>
      </Card>
    </SectionPage>
  );
}

/* ---------------- S9 My data and account ---------------- */
function DataSection() {
  const router = useRouter();
  const exportData = useAppStore((s) => s.exportData);
  const deleteEverything = useAppStore((s) => s.deleteEverything);
  const [saved, setSaved] = useState(false);
  const [imported, setImported] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toUpperCase() === "DELETE";
  return (
    <SectionPage title="My data and account">
      <Banner icon="you">{TEST_DOWNLOAD}</Banner>
      <div className="flex flex-col gap-1">
        <Button
          block
          onClick={() => {
            downloadFile(exportData(), exportFileName(selectToday(appState())));
            setSaved(true);
          }}
        >
          Download my data
        </Button>
        <p role="status" className="m-0 min-h-6 text-center text-label text-ink-muted">
          {saved ? "Saved to your phone" : ""}
        </p>
      </div>
      <ImportButton variant="secondary" onDone={() => setImported(true)} />
      {imported ? <p role="status" className="m-0 text-label">Your progress is back.</p> : null}
      <p className="m-0 text-label text-ink-muted">
        Photos stay on this phone and aren&apos;t in the file.{" "}
        <Button variant="quiet" href="/progress/photos">
          Switch them off in Progress
        </Button>
      </p>
      <Button variant="secondary" block onClick={() => setConfirm(true)}>
        Delete everything on this phone
      </Button>
      <TermsLinks />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete everything?">
        <p className="m-0">This removes your plan, logs and photos from this phone. It can&apos;t be undone.</p>
        <TextField label="Type DELETE to confirm" autoCapitalize="characters" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <Button
          block
          disabled={!ok}
          onClick={async () => {
            if (!ok) return;
            await deleteEverything();
            router.replace("/start");
          }}
        >
          Delete
        </Button>
      </Sheet>
    </SectionPage>
  );
}

export function YouSection({ section }: { section: Section }) {
  switch (section) {
    case "goal":
      return <GoalSection />;
    case "body":
      return <BodySection />;
    case "home":
      return <HomeSection />;
    case "food":
      return <FoodSection />;
    case "reminders":
      return <RemindersSection />;
    case "display":
      return <DisplaySection />;
    case "subscription":
      return <SubscriptionSection />;
    case "data":
      return <DataSection />;
  }
}
