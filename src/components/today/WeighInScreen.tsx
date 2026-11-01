"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Hero, Screen, Subline, TextField, TopRow } from "@/components/ui";
import { useAppStore, weightInputToKg } from "@/lib/store";
import { safeBack, useHydrated } from "./hooks";
import { BentoSkeleton } from "./Skeleton";

/** T3: Weigh in. Opened from P1, P2 or C2; goes back to the opener (?from=). */
export function WeighInScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  const back = safeBack(useSearchParams().get("from"), "/progress");
  const [value, setValue] = useState("");
  const [tried, setTried] = useState(false);

  if (!hydrated) return <BentoSkeleton cards={1} />;

  if (st.profile.noWeigh) {
    return (
      <Screen>
        <TopRow back={{ href: back }}>
          <Hero title="Weigh in" />
        </TopRow>
        <Subline>You chose not to weigh yourself. You can change that in You.</Subline>
        <Button href={back} variant="secondary" block className="mt-auto">
          Back
        </Button>
      </Screen>
    );
  }

  const unit = st.settings.units.weight;
  const kg = weightInputToKg(value, unit);

  return (
    <Screen>
      <TopRow back={{ href: back }}>
        <Hero title="Weigh in" />
      </TopRow>
      <TextField
        label={`Your weight in ${unit}`}
        unit={unit}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint={`Shown in ${unit}. Change this in You.`}
        error={tried && kg === null ? "Type your weight as a number, like 72.5." : undefined}
      />
      <Subline size="label">Morning is best. 3 a week is plenty. Only one weigh-in a day counts.</Subline>
      <div className="mt-auto flex flex-col gap-3">
        <Button
          block
          onClick={() => {
            setTried(true);
            if (kg === null) return;
            st.addWeighIn(kg);
            router.push(back);
          }}
        >
          Save
        </Button>
        <Button href={back} variant="secondary" block>
          Cancel
        </Button>
      </div>
    </Screen>
  );
}
