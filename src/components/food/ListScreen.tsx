"use client";

import { Button, Hero, Screen, Stepper, Subline, TopRow } from "@/components/ui";
import { selectShoppingList, useAppStore } from "@/lib/store";
import { useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { ShareButton, TickRow } from "./TickRow";

/** F4: Shopping list. This week's home days, by shop area, scaled by "Cooking for". */
export function ListScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  if (!hydrated) return <BentoSkeleton cards={3} />;
  const list = selectShoppingList(st);

  if (list.hidden) {
    return (
      <Screen>
        <TopRow back={{ href: "/food" }}>
          <Hero title="Shopping list" />
        </TopRow>
        <Subline>You buy most food, so your list is Pick up this week.</Subline>
        <Button href="/food/pickup" block>
          Pick up this week
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopRow back={{ href: "/food" }}>
        <Hero title="Shopping list" subline="This week's home days only. Away days are left out." />
      </TopRow>

      <div className="flex flex-col gap-2 rounded-card bg-neutral p-5">
        <span className="text-label font-semibold">Cooking for</span>
        <Stepper
          value={list.cookingFor}
          min={1}
          max={8}
          unit="people"
          decreaseLabel="One person fewer"
          increaseLabel="One person more"
          onChange={(n) => st.setCookingFor(n)}
        />
      </div>

      {list.sections.length === 0 ? <Subline>Nothing to buy this week.</Subline> : null}
      {list.sections.map((sec) => (
        <section key={sec.area} aria-labelledby={`area-${sec.area}`} className="flex flex-col gap-1">
          <h2 id={`area-${sec.area}`} className="m-0 text-title font-bold">
            {sec.title}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {sec.items.map((i) => (
              <TickRow
                key={i.key}
                ticked={i.ticked}
                onTick={() => st.tickShopping(i.key)}
                name={i.name}
                amount={i.toTaste ? null : `${i.qty}${i.unit ? ` ${i.unit}` : ""}`}
                lines={[
                  i.flagged ? "New allergy: don't use this" : null,
                  i.checkLabel ? "Check the label" : null,
                ]}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-auto">
        <ShareButton title="Shopping list" text={list.shareText} />
      </div>
    </Screen>
  );
}
