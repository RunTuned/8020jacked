"use client";

import { useRouter } from "next/navigation";
import { Banner, BigNumber, Button, Card, Hero, Screen, Subline, TopRow } from "@/components/ui";
import { useCountdown } from "@/lib/device";
import { cookStepSeconds, selectAllergyNotice, selectCookDay, selectShoppingList, useAppStore } from "@/lib/store";
import { useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";

function StepTimer({ seconds }: { seconds: number }) {
  const t = useCountdown(seconds * 1000);
  return (
    <div className="flex flex-col items-center gap-3">
      <BigNumber value={t.clock} size="timer" timer label={`Timer ${t.clock}`} />
      {t.status === "done" ? (
        <p role="status" className="m-0 text-body font-bold">
          Time&apos;s up.
        </p>
      ) : null}
      {t.status === "running" ? (
        <Button variant="secondary" block onClick={t.pause}>
          Pause timer
        </Button>
      ) : t.status === "paused" ? (
        <Button variant="secondary" block onClick={t.resume}>
          Carry on timer
        </Button>
      ) : t.status === "done" ? null : (
        <Button variant="secondary" block onClick={() => t.start()}>
          Start timer
        </Button>
      )}
    </div>
  );
}

/** F5: Cook day. One step at a time, each with a big timer when the step has a time. */
export function CookScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  if (!hydrated) return <BentoSkeleton cards={2} />;

  const head = (
    <TopRow back={{ href: "/food" }}>
      <Hero title="Cook day" />
    </TopRow>
  );

  if (selectShoppingList(st).hidden) {
    return (
      <Screen>
        {head}
        <Subline>You buy most food, so there&apos;s no cook day.</Subline>
        <Button href="/food/pickup" block>
          Pick up this week
        </Button>
      </Screen>
    );
  }

  const cook = selectCookDay(st);
  const allergy = selectAllergyNotice(st);
  const n = cook.steps.length;
  const i = Math.min(cook.step, Math.max(0, n - 1));
  const step = cook.steps[i];
  const last = i >= n - 1;
  const secs = step ? cookStepSeconds(step.text) : null;
  const intro =
    cook.cookingFor > 1
      ? `Cook this week's meals for ${cook.cookingFor}. One step at a time.`
      : "Cook this week's meals. One step at a time.";

  return (
    <Screen>
      {head}
      <Subline>{intro}</Subline>
      {allergy ? <Banner role="alert">{allergy.message}</Banner> : null}

      {n === 0 ? (
        <Subline>Nothing to cook for this part of the week.</Subline>
      ) : cook.done ? (
        <Card tone="lime" icon="check" title="All done for this cook." label="Cook day" />
      ) : (
        <Card tone="lime" icon="food" eyebrow={`Step ${i + 1} of ${n} · ${step.recipe}`} label="Step">
          <p className="m-0 text-title font-semibold">{step.text}</p>
          {secs ? <StepTimer key={`${step.recipeId}:${step.index}`} seconds={secs} /> : null}
        </Card>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {n > 0 && !cook.done ? (
          last ? (
            <Button
              block
              onClick={() => {
                st.cookDayDone();
                router.push("/food");
              }}
            >
              All done
            </Button>
          ) : (
            <Button block onClick={() => st.saveCookStep(i + 1)}>
              Done step
            </Button>
          )
        ) : null}
        <Button variant="secondary" block href="/food">
          {n > 0 && !cook.done ? "Pause" : "Back to Food"}
        </Button>
      </div>
    </Screen>
  );
}
