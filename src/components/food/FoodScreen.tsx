"use client";

import { useEffect, useState } from "react";
import { Banner, Button, Card, Hero, Screen, Sheet, Stack, Subline, TabBar, TopRow, cx } from "@/components/ui";
import { billing } from "@/lib/services";
import {
  mealView,
  selectAllergyNotice,
  selectAwayUntil,
  selectNextMeal,
  selectShoppingList,
  selectToday,
  selectWeekMeals,
  useAppStore,
} from "@/lib/store";
import type { ISODate } from "@/lib/types";
import { longDate, shortDate, shortDay, dayOfMonth } from "@/components/today/format";
import { useHydrated } from "@/components/today/hooks";
import { LockedCard } from "@/components/today/Locked";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { StoreUndo } from "@/components/today/StoreUndo";

const TAB_HREFS = { today: "/today" } as const;

const TIPS = [
  "Pick a meal with protein you can see: chicken, fish, eggs, beans or meat.",
  "Add veg or a salad.",
  "Eat until you're comfortably full, then stop.",
  "Your next meal is the plan again. Nothing to make up.",
];

/** F1: Food. This week's days; tap a meal for F2 or F2b. */
export function FoodScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const [picked, setPicked] = useState<ISODate | null>(null);
  const [tips, setTips] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let live = true;
    billing.locked().then((l) => live && setLocked(l));
    return () => {
      live = false;
    };
  }, []);

  if (!hydrated) return <BentoSkeleton tabBar current="food" cards={4} />;

  const today = selectToday(st);

  if (locked) {
    return (
      <>
        <Screen withTabBar>
          <TopRow label={longDate(today)}>
            <Hero title="Food" />
          </TopRow>
          <LockedCard />
        </Screen>
        <TabBar current="food" hrefs={TAB_HREFS} />
      </>
    );
  }

  const week = selectWeekMeals(st);
  const day = week.find((d) => d.date === (picked ?? today)) ?? week.find((d) => d.date === today)!;
  const awayUntil = selectAwayUntil(st);
  const allergy = selectAllergyNotice(st);
  const list = selectShoppingList(st);
  const next = selectNextMeal(st);
  const isToday = day.date === today;

  return (
    <>
      <Screen withTabBar>
        <TopRow label={longDate(today)}>
          <Hero title="Food" />
        </TopRow>

        {allergy ? <Banner role="alert">{allergy.message}</Banner> : null}
        {awayUntil ? (
          <Banner icon="calendar" role="note">
            {`Away until ${shortDate(awayUntil)}`}
          </Banner>
        ) : null}

        <div role="tablist" aria-label="Day" className="flex gap-0.5 overflow-x-auto pb-1">
          {week.map((d) => {
            const on = d.date === day.date;
            return (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={`${longDate(d.date)}${d.date === today ? ", today" : ""}`}
                onClick={() => setPicked(d.date)}
                className={cx(
                  "flex min-h-14 min-w-12 flex-1 shrink-0 flex-col items-center justify-center rounded-[20px] border-0 px-1 py-1 text-label font-semibold leading-[1.2]",
                  on ? "bg-ink text-on-ink" : d.date === today ? "bg-lime text-ink" : "bg-neutral text-ink",
                )}
              >
                <span aria-hidden="true">{shortDay(d.date)}</span>
                <span aria-hidden="true" className="tabular">
                  {dayOfMonth(d.date)}
                </span>
              </button>
            );
          })}
        </div>

        <section role="tabpanel" aria-label={longDate(day.date)} className="flex flex-col gap-3">
          {day.away ? <Subline>Away. Meals stay simple.</Subline> : null}
          {day.meals.map((m) => {
            const v = mealView(st, m);
            return (
              <Card
                key={m.index}
                tone="lime"
                icon="food"
                eyebrow={v.logged ? `${m.label} · logged` : m.label}
                title={v.title}
                detail={v.lines[0]}
                href={`/food/meal/${m.date}/${m.index}?from=/food`}
              />
            );
          })}
        </section>

        <Stack>
          {isToday && next.meal ? (
            <Card
              tone="neutral"
              icon="swap"
              title="Something else"
              href={`/food/other?date=${today}&slot=${next.meal.slot.index}&back=/food`}
            />
          ) : null}
          {list.hidden ? (
            <Card tone="neutral" icon="list" title="Pick up this week" href="/food/pickup" />
          ) : (
            <>
              <Card tone="neutral" icon="list" title="Shopping list" href="/food/list" />
              <Card tone="neutral" icon="calendar" title="Cook day" href="/food/cook" />
            </>
          )}
          <Button variant="secondary" block onClick={() => setTips(true)}>
            Eating out tips
          </Button>
        </Stack>
      </Screen>

      <Sheet open={tips} onClose={() => setTips(false)} title="Eating out tips">
        <ul className="m-0 flex flex-col gap-2 pl-5 text-body">
          {TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Button variant="secondary" block onClick={() => setTips(false)}>
          Back
        </Button>
      </Sheet>

      <StoreUndo kinds={["meal"]} floating />
      <TabBar current="food" hrefs={TAB_HREFS} />
    </>
  );
}
