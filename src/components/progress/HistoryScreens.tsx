"use client";

import { Card, Hero, Screen, Stack, TopRow } from "@/components/ui";
import { selectCheckInMonths } from "@/lib/store";
import { WinsCard } from "./cards";
import { BentoSkeleton, Row, useHydrated, useStore } from "./parts";

/** P4: every week, the one change and whether she took it. Month summary at the top. Read-only. */
export function CheckInHistoryScreen() {
  const hydrated = useHydrated();
  const s = useStore();
  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton />
      </Screen>
    );
  const months = selectCheckInMonths(s);
  return (
    <Screen>
      <TopRow back={{ href: "/progress", label: "Back to Progress" }} />
      <Hero title="Check-in history" subline={months.length ? "Tap a week to see why." : "Your weekly check-ins show up here."} />
      <Stack>
        {months.map((m) => (
          <Card key={m.key} tone="aqua" icon="calendar" title={m.title} detail={m.summary} label={m.title}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {m.rows.map((r) => (
                <li key={r.date}>
                  <Row title={r.dateText} detail={`${r.copy} ${r.status}.`} href={`/check-in/history/${r.date}`} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}

/** P5: wins. No weight shown here, ever. */
export function WinsScreen() {
  const hydrated = useHydrated();
  const s = useStore();
  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton />
      </Screen>
    );
  return (
    <Screen>
      <TopRow back={{ href: "/progress?view=wins", label: "Back to Progress" }} />
      <Hero title="Wins" />
      <WinsCard s={s} />
    </Screen>
  );
}
