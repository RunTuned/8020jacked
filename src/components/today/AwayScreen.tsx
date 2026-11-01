"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Hero, Icon, Screen, Subline, Switch, TopRow, cx } from "@/components/ui";
import { addDays, weekday, weekStart } from "@/lib/engine";
import { selectToday, useAppStore } from "@/lib/store";
import type { ISODate, Weekday } from "@/lib/types";
import { dayOfMonth, longDate, monthTitle } from "./format";
import { useHydrated } from "./hooks";
import { BentoSkeleton } from "./Skeleton";

const HEADS = ["M", "T", "W", "T", "F", "S", "S"];
const HEAD_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function firstOfMonth(d: ISODate, plus: number): ISODate {
  const [y, m] = d.split("-").map(Number);
  const x = new Date(y, m - 1 + plus, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Six calendar rows starting on the Monday on or before the 1st. */
function monthGrid(first: ISODate): ISODate[] {
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function AwayForm({ today, initialDates, initialWeekly }: { today: ISODate; initialDates: ISODate[]; initialWeekly: Weekday[] }) {
  const router = useRouter();
  const save = useAppStore((s) => s.saveAwayDays);
  const [month, setMonth] = useState(0);
  const [dates, setDates] = useState(() => new Set(initialDates));
  const [weekly, setWeekly] = useState(() => new Set(initialWeekly));
  const [repeat, setRepeat] = useState(initialWeekly.length > 0);

  const first = firstOfMonth(today, month);
  const grid = monthGrid(first);
  const thisMonth = first.slice(0, 7);
  const lastRowNeeded = grid.findLastIndex((d) => d.slice(0, 7) === thisMonth);
  const cells = grid.slice(0, Math.ceil((lastRowNeeded + 1) / 7) * 7);

  const isOn = (d: ISODate) => dates.has(d) || (repeat && weekly.has(weekday(d)));
  const toggle = (d: ISODate) => {
    if (repeat) {
      const w = weekday(d);
      const next = new Set(weekly);
      if (next.has(w)) {
        next.delete(w);
        const nd = new Set(dates);
        for (const x of nd) if (weekday(x) === w) nd.delete(x);
        setDates(nd);
      } else next.add(w);
      setWeekly(next);
    } else {
      const next = new Set(dates);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      setDates(next);
    }
  };

  return (
    <Screen>
      <TopRow back={{ href: "/today/week" }}>
        <Hero title="Away days" subline="Tap the days you're away." />
      </TopRow>

      <section aria-label="Calendar" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" aria-label="Last month" disabled={month === 0} onClick={() => setMonth((m) => Math.max(0, m - 1))} className="size-12 px-0">
            <Icon name="back" size={20} />
          </Button>
          <h2 className="m-0 text-title font-bold" aria-live="polite">
            {monthTitle(first)}
          </h2>
          <Button variant="secondary" aria-label="Next month" disabled={month >= 11} onClick={() => setMonth((m) => Math.min(11, m + 1))} className="size-12 px-0">
            <Icon name="chevron" size={20} />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-x-px gap-y-1" role="grid" aria-label={monthTitle(first)}>
          {HEADS.map((h, i) => (
            <div key={i} role="columnheader" aria-label={HEAD_NAMES[i]} className="text-center text-label font-semibold text-ink-muted">
              {h}
            </div>
          ))}
          {cells.map((d) => {
            const inMonth = d.slice(0, 7) === thisMonth;
            const past = d < today;
            if (!inMonth) return <div key={d} aria-hidden="true" />;
            const on = isOn(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={`${longDate(d)}${on ? ", away" : ""}`}
                disabled={past}
                onClick={() => toggle(d)}
                className={cx(
                  "flex min-h-12 min-w-0 items-center justify-center rounded-full border-0 text-body font-semibold tabular",
                  on ? "bg-ink text-on-ink" : "bg-transparent text-ink",
                  past && "text-ink-muted opacity-60",
                  d === today && !on && "outline-2 outline-solid outline-ink -outline-offset-2",
                )}
              >
                {dayOfMonth(d)}
              </button>
            );
          })}
        </div>
      </section>

      <Switch
        label="Repeat every week"
        description="The same weekdays, every week."
        checked={repeat}
        showState
        onChange={(on) => {
          if (on && weekly.size === 0) setWeekly(new Set([...dates].map((d) => weekday(d))));
          setRepeat(on);
        }}
      />

      <Subline size="label">No workout on away days. Meals stay simple and the shopping list leaves them out. Nothing counts against you.</Subline>

      <div className="mt-auto flex flex-col gap-3">
        <Button
          block
          onClick={() => {
            save([...dates], repeat ? [...weekly] : []);
            router.push("/today/week");
          }}
        >
          Save
        </Button>
        <Button variant="secondary" block href="/today/week">
          Cancel
        </Button>
      </div>
    </Screen>
  );
}

/** T6: Away days. */
export function AwayScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  if (!hydrated) return <BentoSkeleton cards={2} />;
  return <AwayForm today={selectToday(st)} initialDates={st.awayDays} initialWeekly={st.awayWeekly} />;
}
