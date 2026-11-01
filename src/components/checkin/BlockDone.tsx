"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Hero, Option, OptionGroup, Screen, TextField, TopRow } from "@/components/ui";
import { BentoSkeleton, useHydrated, useStore } from "@/components/progress/parts";
import { kgFromInput, selectBlockDoneView, selectNextGoals } from "@/lib/store";
import type { Goal } from "@/lib/types";

const TODAY = "/today";

/** C6 "Your 12 weeks: done" and C7 "Your next 12 weeks", mirrored to ?step=next. */
export function BlockDone() {
  const hydrated = useHydrated();
  const s = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal>("steady");
  const [rough, setRough] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton cards={1} />
      </Screen>
    );

  const v = selectBlockDoneView(s);
  const step = params.get("step") === "next" ? "next" : "done";
  const go = (next: "done" | "next") => window.history.pushState(null, "", next === "next" ? "?step=next" : window.location.pathname);

  if (!v) {
    return (
      <Screen>
        <Hero title="Your 12 weeks" subline="Nothing to show yet." />
        <Button href={TODAY} block>
          Back to Today
        </Button>
      </Screen>
    );
  }

  if (step === "done") {
    return (
      <Screen>
        <Hero title="Your 12 weeks: done" subline={v.hero} />
        <Card tone="pink" icon="flag" title="Your 12 weeks" label="Your 12 weeks">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {v.lines.map((l) => (
              <li key={l} className="text-body">
                {l}
              </li>
            ))}
          </ul>
        </Card>
        <div className="mt-auto flex flex-col gap-2">
          <Button block onClick={() => go("next")}>
            What&apos;s next
          </Button>
          <Button variant="secondary" block href={TODAY}>
            Decide later
          </Button>
          <Button
            variant="text"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(v.share);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy to share"}
          </Button>
        </div>
      </Screen>
    );
  }

  const g = selectNextGoals(s);
  const askWeight = goal === "lose" && g.needsFreshWeight;
  const start = () => {
    let kg: number | undefined;
    if (askWeight) {
      const k = kgFromInput(rough, g.unit);
      if (k === null) {
        setError(`Type a rough weight in ${g.unit}.`);
        return;
      }
      kg = k;
    }
    s.proposeGoal(goal, kg);
    router.push("/plan-updated");
  };

  return (
    <Screen>
      <TopRow back={{ onClick: () => go("done"), label: "Back" }} />
      <Hero title="Your next 12 weeks" subline="Pick one." />
      <OptionGroup label="Your next 12 weeks">
        {g.options.map((o) => (
          <Option key={o.goal} checked={goal === o.goal} onChange={() => setGoal(o.goal)}>
            {o.label}
          </Option>
        ))}
      </OptionGroup>
      {askWeight ? (
        <TextField
          label="Roughly what do you weigh now?"
          hint="Roughly is fine. It sizes your meals and is never shown."
          unit={g.unit}
          inputMode="decimal"
          autoComplete="off"
          value={rough}
          onChange={(e) => setRough(e.target.value)}
          error={error}
        />
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        <Button block onClick={start}>
          Start it
        </Button>
        <Button variant="secondary" block href={TODAY}>
          Decide later
        </Button>
      </div>
    </Screen>
  );
}
