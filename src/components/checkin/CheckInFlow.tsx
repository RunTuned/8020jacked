"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  ChoicePills,
  Hero,
  Option,
  OptionGroup,
  ProgressBar,
  Screen,
  Sheet,
  Stack,
  TopRow,
  type IconName,
} from "@/components/ui";
import { BentoSkeleton, useHydrated, useStore } from "@/components/progress/parts";
import {
  selectBlockDone,
  selectCheckInResult,
  selectCheckInWeek,
  selectNormalNow,
  useAppStore,
} from "@/lib/store";
import { ANSWER_LABELS } from "@/lib/engine";
import type { CheckInAnswer, CheckInChangeKind, ClothesFeel } from "@/lib/types";
import { WhySheet } from "./Why";

type Step = "week" | "weight" | "clothes" | "way" | "normal" | "result";
const STEPS: Step[] = ["week", "weight", "clothes", "way", "normal", "result"];
const ANSWERS: CheckInAnswer[] = ["sore", "bad_sleep", "busy", "fasting", "nothing"];
const CLOTHES: { value: ClothesFeel; label: string }[] = [
  { value: "looser", label: "Looser" },
  { value: "same", label: "Same" },
  { value: "tighter", label: "Tighter" },
];
const STEP_NUMBER: Record<Step, number> = { week: 1, weight: 2, clothes: 2, way: 3, normal: 3, result: 3 };
const TODAY = "/today";

const KIND_ICON: Partial<Record<CheckInChangeKind, IconName>> = {
  speed_brake: "food",
  speed_brake_already: "food",
  food_down: "food",
  switch_to_steady: "flag",
  training_up: "train",
  training_easier: "train",
  plan_around_it: "calendar",
};

function Head({ step, back, later }: { step: Step; back?: () => void; later?: boolean }) {
  const n = STEP_NUMBER[step];
  const label = step === "result" ? "Weekly check-in · result" : `Weekly check-in · step ${n} of 3`;
  return (
    <div className="flex flex-col gap-3">
      {back || later ? (
        <TopRow
          back={back ? { onClick: back, label: "Back" } : undefined}
          end={
            later ? (
              <Button variant="text" icon="close" href={TODAY}>
                Later, kept for you
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <div className="text-label font-semibold text-ink-muted">{label}</div>
      <ProgressBar value={step === "result" ? 3 : n} max={3} label="Check-in progress" valueText={label} />
    </div>
  );
}

function Bottom({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2">{children}</div>;
}

/** C1–C4, C1b, C2b and C8: one route, steps held in state and mirrored to ?step=. The draft saves at every step. */
export function CheckInFlow() {
  const hydrated = useHydrated();
  const s = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const week = hydrated ? selectCheckInWeek(s) : null;
  const due = week?.due ?? null;
  const hasDraft = s.checkInDraft?.date === due;

  // Start (or keep) the draft as soon as she opens the check-in.
  useEffect(() => {
    if (hydrated && due && !hasDraft && !leaving) useAppStore.getState().saveCheckInDraft({});
  }, [hydrated, due, hasDraft, leaving]);

  if (!hydrated || leaving)
    return (
      <Screen>
        <BentoSkeleton cards={1} />
      </Screen>
    );

  if (!week) {
    return (
      <Screen>
        <Hero title="No check-in today" subline="Your check-in shows on Today when it's due." />
        <Bottom>
          <Button href={TODAY} block>
            Back to Today
          </Button>
        </Bottom>
      </Screen>
    );
  }

  const leave = (to: string) => {
    setLeaving(true);
    router.push(to);
  };

  const finish = (accepted: boolean) => {
    useAppStore.getState().submitCheckIn(accepted);
    const after = useAppStore.getState();
    if (accepted && after.ui.pendingGoal) leave("/plan-updated");
    else if (accepted && selectBlockDone(after)) leave("/check-in/done");
    else leave(TODAY);
  };

  // C1b: nothing logged this week.
  if (week.nothingLogged) {
    return (
      <Screen>
        <Hero title="Your week" />
        <Card tone="aqua" icon="calendar" title="Nothing logged this week. Same plan, fresh start." label="Your week" />
        <Bottom>
          <Button block onClick={() => finish(true)}>
            Sounds good
          </Button>
        </Bottom>
      </Screen>
    );
  }

  const draft = s.checkInDraft?.date === due ? s.checkInDraft : null;
  const answers = draft?.answers ?? [];
  const normal = selectNormalNow(s);
  const second: Step = week.weighs ? "weight" : "clothes";

  const raw = params.get("step") as Step | null;
  let step: Step = raw && STEPS.includes(raw) ? raw : "week";
  if (step === "weight" && !week.weighs) step = "clothes";
  if (step === "clothes" && week.weighs) step = "weight";
  if (step === "normal" && !normal) step = "result";

  const go = (next: Step) => window.history.pushState(null, "", `?step=${next}`);
  const save = useAppStore.getState().saveCheckInDraft;
  const setClothes = (feel: ClothesFeel) => save({ clothes: feel });
  const toggle = (a: CheckInAnswer) => {
    const on = answers.includes(a);
    const next = a === "nothing" ? (on ? [] : ["nothing" as const]) : on ? answers.filter((x) => x !== a) : [...answers.filter((x) => x !== "nothing"), a];
    save({ answers: next });
  };

  if (step === "week") {
    return (
      <Screen>
        <Head step="week" />
        <Hero title="Your week" />
        <Card tone="aqua" icon="calendar" label="Your week" title={week.summary} detail="Filled in from what you logged.">
          <Button variant="text" onClick={() => setEditOpen(true)}>
            Something wrong? Edit a number
          </Button>
        </Card>
        <Bottom>
          <Button block onClick={() => go(second)}>
            Next
          </Button>
          <Button variant="secondary" block href={TODAY}>
            Later
          </Button>
        </Bottom>
        <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Something wrong?">
          <p className="m-0 text-body">These numbers come from what you logged. Fix a day in This week, then come back. Your answers are kept.</p>
          <Button href="/today/week" block>
            Open this week
          </Button>
        </Sheet>
      </Screen>
    );
  }

  if (step === "weight") {
    return (
      <Screen>
        <Head step="weight" back={() => go("week")} later />
        <Hero title="Weight this week" />
        <Stack>
          <Card tone="aqua" icon="scale" title={week.weightLine} label="Weight this week">
            {week.needMoreWeighIns && s.profile.goal === "lose" ? (
              <Button variant="text" href="/today/weigh-in">
                Weigh in on 3 different days for a food change
              </Button>
            ) : null}
          </Card>
          {week.askClothes ? (
            <Card tone="neutral" title="How do your clothes feel?" label="Clothes">
              <ChoicePills label="How do your clothes feel?" options={CLOTHES} value={draft?.clothes ?? null} onChange={setClothes} />
            </Card>
          ) : null}
        </Stack>
        <Bottom>
          <Button block onClick={() => go("way")}>
            Next
          </Button>
        </Bottom>
      </Screen>
    );
  }

  if (step === "clothes") {
    return (
      <Screen>
        <Head step="clothes" back={() => go("week")} later />
        <Hero title="How do your clothes feel?" />
        <OptionGroup label="How do your clothes feel?">
          {CLOTHES.map((c) => (
            <Option key={c.value} checked={draft?.clothes === c.value} onChange={() => setClothes(c.value)}>
              {c.label}
            </Option>
          ))}
        </OptionGroup>
        <Bottom>
          <Button block onClick={() => go("way")}>
            Next
          </Button>
        </Bottom>
      </Screen>
    );
  }

  if (step === "way") {
    return (
      <Screen>
        <Head step="way" back={() => go(second)} later />
        <Hero title="Anything get in the way?" subline="Pick any." />
        <div role="group" aria-label="Anything get in the way?" className="flex flex-col gap-2">
          {ANSWERS.map((a) => (
            <Option key={a} kind="checkbox" checked={answers.includes(a)} onChange={() => toggle(a)}>
              {ANSWER_LABELS[a]}
            </Option>
          ))}
        </div>
        <Bottom>
          <Button block onClick={() => go(normal ? "normal" : "result")}>
            See my result
          </Button>
        </Bottom>
      </Screen>
    );
  }

  if (step === "normal" && normal) {
    return (
      <Screen>
        <Head step="normal" back={() => go("way")} />
        <Hero title="Is this your normal now?" />
        <Card tone="aqua" icon="calendar" title={normal.line} label="Same answer three weeks running" />
        <Bottom>
          <Button
            block
            onClick={() => {
              save({ normalNow: true });
              go("result");
            }}
          >
            Yes, plan around it
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              save({ normalNow: false });
              go("result");
            }}
          >
            No, it will pass
          </Button>
        </Bottom>
      </Screen>
    );
  }

  // C4 result
  const r = selectCheckInResult(s);
  if (!r) return null;
  return (
    <Screen>
      <Head step="result" />
      <Hero title={r.hero} subline={r.subline} />
      <Card
        tone="aqua"
        icon={KIND_ICON[r.result.change.kind] ?? "check"}
        eyebrow="Next week"
        title={r.title}
        detail={r.detail}
        label="Next week"
      >
        <Button block onClick={() => finish(true)}>
          Sounds good
        </Button>
        {r.changed ? (
          <Button variant="text" onClick={() => finish(false)}>
            Not this week, keep things the same
          </Button>
        ) : null}
        <Button variant="text" onClick={() => setWhyOpen(true)}>
          Why this change?
        </Button>
      </Card>
      <WhySheet open={whyOpen} onClose={() => setWhyOpen(false)} result={r.result} />
    </Screen>
  );
}
