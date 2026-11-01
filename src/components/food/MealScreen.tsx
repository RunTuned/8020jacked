"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Hero, Icon, Screen, Stepper, Subline, TopRow } from "@/components/ui";
import { selectMealDetail, useAppStore } from "@/lib/store";
import { safeBack, useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";

export function CheckLabel() {
  return (
    <p className="m-0 flex items-center gap-2 text-body font-semibold">
      <Icon name="hurts" size={22} className="shrink-0" />
      Check the label
    </p>
  );
}

/** F2 (I cook) and F2b (I buy most food): one meal. Servings and hand portions, never calories. */
export function MealScreen({ date, slot }: { date: string; slot: number }) {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  const back = safeBack(useSearchParams().get("from"), "/food");

  if (!hydrated) return <BentoSkeleton cards={2} />;

  const m = Number.isInteger(slot) ? selectMealDetail(st, date, slot) : null;
  if (!m) {
    return (
      <Screen>
        <TopRow back={{ href: back }}>
          <Hero title="Meal not found" />
        </TopRow>
        <Button href="/food" variant="secondary" block>
          Back to Food
        </Button>
      </Screen>
    );
  }

  const here = `/food/meal/${date}/${slot}?from=${encodeURIComponent(back)}`;
  const log = (kind: "plan" | "like") => {
    st.logMeal(slot, kind, { date });
    router.push(back);
  };
  const title = m.view.recipe || m.view.bought ? `${m.label}: ${m.view.title}` : m.label;

  return (
    <Screen>
      <TopRow back={{ href: back }}>
        <Hero title={title} />
      </TopRow>

      {m.source === "cook" ? (
        <Card tone="lime" icon="food" eyebrow="Your size" title={m.servingsLabel ?? m.view.title} label="Your size">
          {m.handLine ? <p className="m-0 text-body">{m.handLine}</p> : null}
          {m.away ? <p className="m-0 text-label text-ink-muted">Away. Meals stay simple.</p> : null}
          {m.checkLabel ? <CheckLabel /> : null}
        </Card>
      ) : (
        <Card tone="lime" icon="food" title={m.view.title} label="What to get">
          {m.sizeLines.map((l, i) => (
            <p key={i} className="m-0 text-body">
              {l}
            </p>
          ))}
          {m.checkLabel ? <CheckLabel /> : null}
        </Card>
      )}

      {m.extrasLines.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Good to know">
          {m.extrasLines.map((l) => (
            <li key={l.key} className="text-body">
              {l.text}
            </li>
          ))}
        </ul>
      ) : null}

      {m.view.recipe ? (
        <section aria-label="Recipe" className="flex flex-col gap-4 rounded-card bg-neutral p-5">
          <div className="flex flex-col gap-2">
            <span className="text-label font-semibold">Cooking for</span>
            <Stepper
              value={m.cookingFor}
              min={1}
              max={8}
              unit="people"
              decreaseLabel="One person fewer"
              increaseLabel="One person more"
              onChange={(n) => st.setCookingFor(n)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-title font-bold">You need</h2>
            <ul className="m-0 flex flex-col gap-1 pl-5 text-body">
              {m.ingredients.map((g, i) => (
                <li key={i}>
                  {g.name}
                  <span className="text-ink-muted">{g.amount ? ` · ${g.amount}` : " · to taste"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-title font-bold">Method</h2>
            {m.minutes ? <Subline size="label">{`About ${m.minutes} minutes`}</Subline> : null}
            <ol className="m-0 flex flex-col gap-2 pl-5 text-body">
              {m.method.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        {m.logged ? (
          <p role="status" className="m-0 text-label text-ink-muted">
            Logged. Tap again to change it.
          </p>
        ) : null}
        <Button block onClick={() => log("plan")}>
          Ate the plan
        </Button>
        <Button variant="secondary" block onClick={() => log("like")}>
          Something like it
        </Button>
        <Button variant="secondary" block href={`/food/other?date=${date}&slot=${slot}&back=${encodeURIComponent(back)}`}>
          Something else
        </Button>
        <Button variant="secondary" block icon="swap" href={`/food/swap/${date}/${slot}?from=${encodeURIComponent(here)}`}>
          Swap
        </Button>
      </div>
    </Screen>
  );
}
