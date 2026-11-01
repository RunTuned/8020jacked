"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Hero, Icon, Screen, Sheet, Stack, Subline, TabBar, TopRow, cx } from "@/components/ui";
import {
  selectLastWalkThisWeek,
  selectMoveDays,
  selectWalks,
  selectWeekRows,
  useAppStore,
} from "@/lib/store";
import type { ISODate } from "@/lib/types";
import { dayName, shortDate } from "./format";
import { useHydrated } from "./hooks";
import { BentoSkeleton } from "./Skeleton";
import { StoreUndo } from "./StoreUndo";

/** T2: This week. One row per day, Mon to Sun; move a workout; tick walks; away days. */
export function WeekScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const [moving, setMoving] = useState<ISODate | null>(null);
  const [walkNote, setWalkNote] = useState<string | null>(null);

  if (!hydrated) return <BentoSkeleton tabBar current="today" />;

  const rows = selectWeekRows(st);
  const walks = selectWalks(st);
  const moveDays = moving ? selectMoveDays(st, moving) : [];

  const tapWalk = (i: number) => {
    setWalkNote(null);
    if (i < walks.ticked) {
      const d = selectLastWalkThisWeek(st);
      if (d) st.untickWalk(d);
    } else if (!st.tickWalk()) {
      setWalkNote("Walks count on home days.");
    }
  };

  return (
    <>
      <Screen withTabBar>
        <TopRow back={{ href: "/today" }}>
          <Hero title="This week" />
        </TopRow>

        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Days">
          {rows.map((r) => {
            const workout =
              r.workout === "away"
                ? "Away"
                : r.workout === "rest"
                  ? "Rest"
                  : r.workout === "done"
                    ? `${r.name} · done`
                    : r.name;
            const meals =
              r.workout === "away"
                ? "Meals stay simple"
                : r.mealsLogged === 0
                  ? "Meals not logged"
                  : `${r.mealsLogged} of ${r.mealsPlanned} meals logged`;
            return (
              <li
                key={r.date}
                aria-current={r.isToday ? "date" : undefined}
                className={cx("flex flex-col gap-2 rounded-card p-4", r.isToday ? "bg-blue" : "bg-neutral")}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-body font-bold">
                    {shortDate(r.date)}
                    {r.isToday ? " · today" : ""}
                  </span>
                  {r.workout === "done" ? <Icon name="check" size={22} label="Done" /> : null}
                </div>
                {r.workout === "planned" && r.isToday ? (
                  <Link href="/train/workout" className="inline-flex min-h-12 items-center text-body font-semibold underline underline-offset-[3px]">
                    {workout}
                  </Link>
                ) : (
                  <span className={cx("text-body", r.workout === "planned" || r.workout === "done" ? "font-semibold" : "text-ink-muted")}>
                    {workout}
                  </span>
                )}
                <span className="text-label text-ink-muted">{meals}</span>
                {r.workout === "planned" && selectMoveDays(st, r.date).length > 0 ? (
                  <Button variant="secondary" className="self-start" onClick={() => setMoving(r.date)}>
                    Move to another day
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <Card tone="pink" icon="today" title="15-minute walks" detail="Three a week, home days only. No steps." label="Walks">
          <div className="flex flex-wrap gap-3" role="group" aria-label="Walks this week">
            {Array.from({ length: walks.target }, (_, i) => {
              const on = i < walks.ticked;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Walk ${i + 1}`}
                  onClick={() => tapWalk(i)}
                  className={cx(
                    "flex size-14 items-center justify-center rounded-full border-2 border-solid border-ink text-body font-bold",
                    on ? "bg-ink text-on-ink" : "bg-canvas text-ink",
                  )}
                >
                  {on ? <Icon name="check" size={24} /> : i + 1}
                </button>
              );
            })}
          </div>
          {walkNote ? (
            <p role="status" className="m-0 text-label">
              {walkNote}
            </p>
          ) : null}
        </Card>

        <Stack>
          <Card tone="neutral" icon="flag" title="I'm away: away days" href="/today/away" />
        </Stack>
      </Screen>

      <Sheet open={!!moving} onClose={() => setMoving(null)} title="Move to another day">
        {moveDays.length ? (
          <div className="flex flex-col gap-2">
            {moveDays.map((d) => (
              <Button
                key={d}
                variant="secondary"
                block
                onClick={() => {
                  if (moving) st.moveWorkout(moving, d);
                  setMoving(null);
                }}
              >
                {dayName(d)}
              </Button>
            ))}
          </div>
        ) : (
          <Subline>No free day left this week.</Subline>
        )}
      </Sheet>

      <StoreUndo
        kinds={["not_today"]}
        floating
        message={() => {
          const last = st.scheduleMoves[st.scheduleMoves.length - 1];
          return last?.to ? `Moved to ${dayName(last.to)}.` : "No free day left, so it's off this week.";
        }}
      />
      <TabBar current="today" hrefs={{ today: "/today" }} />
    </>
  );
}
