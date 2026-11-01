"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Hero, Icon, Option, OptionGroup, Screen, Subline, TopRow, cx } from "@/components/ui";
import { selectSwapOptions, useAppStore } from "@/lib/store";
import { safeBack, useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";

/** F3: Swap this meal. Same kind of meal, never an allergen, favourites first. */
export function SwapScreen({ date, slot }: { date: string; slot: number }) {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  const back = safeBack(useSearchParams().get("from"), `/food/meal/${date}/${slot}`);
  const [pick, setPick] = useState<string | null>(null);

  if (!hydrated) return <BentoSkeleton cards={3} />;
  const options = Number.isInteger(slot) ? selectSwapOptions(st, date, slot) : [];

  return (
    <Screen>
      <TopRow back={{ href: back, label: "Cancel" }}>
        <Hero title="Swap this meal" />
      </TopRow>

      {options.length ? (
        <OptionGroup label="Meals to swap to">
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Option checked={pick === o.id} onChange={() => setPick(o.id)} hint={o.sizeLine} className="flex-1">
                {o.name}
              </Option>
              <button
                type="button"
                aria-pressed={o.favourite}
                aria-label={`Favourite: ${o.name}`}
                onClick={() => st.toggleFavourite(o.id)}
                className={cx(
                  "flex size-12 shrink-0 items-center justify-center rounded-full border-0",
                  o.favourite ? "bg-pink text-ink" : "bg-neutral text-ink",
                )}
              >
                <Icon name="heart" size={22} fill={o.favourite ? "currentColor" : "none"} />
              </button>
            </div>
          ))}
        </OptionGroup>
      ) : (
        <Subline>No other meals fit right now.</Subline>
      )}

      <Subline size="label">Never shows meals with your allergies. The shopping list updates by itself. Heart a meal to see it first.</Subline>

      <div className="mt-auto flex flex-col gap-3">
        <Button
          block
          disabled={!pick}
          onClick={() => {
            if (!pick) return;
            st.swapMeal(date, slot, pick);
            router.push(back);
          }}
        >
          Pick this one
        </Button>
        <Button variant="secondary" block href={back}>
          Cancel
        </Button>
      </div>
    </Screen>
  );
}
