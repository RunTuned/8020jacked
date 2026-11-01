"use client";

import { Button, Hero, Screen, Subline, TopRow } from "@/components/ui";
import { selectPickupList, selectShoppingList, useAppStore } from "@/lib/store";
import { useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { rangeText } from "@/components/today/format";
import { ShareButton, TickRow } from "./TickRow";

/** F8: Pick up this week ("I buy most food"). Size line on every item, no calories. */
export function PickupScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  if (!hydrated) return <BentoSkeleton cards={3} />;
  const cooks = !selectShoppingList(st).hidden;
  const list = selectPickupList(st);

  return (
    <Screen>
      <TopRow back={{ href: "/food" }}>
        <Hero
          title="Pick up this week"
          subline={`For ${rangeText(list.from, list.to)}, home days only. Main meals: 1 ready meal + 1 side. Breakfast and 4th meal: grab-and-go.`}
        />
      </TopRow>

      {cooks && list.hidden ? (
        <>
          <Subline>You cook most food, so your list is the shopping list.</Subline>
          <Button href="/food/list" block>
            Shopping list
          </Button>
        </>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Items">
          {list.items.map((i) => (
            <TickRow
              key={i.key}
              ticked={i.ticked}
              onTick={() => st.tickPickup(i.key)}
              name={i.name}
              amount={String(i.count)}
              lines={[i.sizeLine, i.flagged ? "New allergy: don't use this" : null, i.checkLabel ? "Check the label" : null]}
            />
          ))}
        </ul>
      )}

      {list.items.length ? (
        <div className="mt-auto">
          <ShareButton title="Pick up this week" text={list.shareText} />
        </div>
      ) : null}
    </Screen>
  );
}
