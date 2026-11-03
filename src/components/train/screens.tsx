"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Card, Hero, Screen, Sheet, Stack, Subline, TabBar, TopRow } from "@/components/ui";
import {
  selectOtherWorkouts,
  selectSetAside,
  selectTrainHome,
  selectWeekCount,
  useAppStore,
} from "@/lib/store";
import { MoveHowTo } from "./MoveHowTo";
import { Skeleton, shortDay, useHydrated } from "./common";

function Loading({ tabs }: { tabs?: boolean }) {
  return (
    <>
      <Screen withTabBar={tabs}>
        <Skeleton />
      </Screen>
      {tabs ? <TabBar current="train" /> : null}
    </>
  );
}

function Gate({ children, tabs }: { children: ReactNode; tabs?: boolean }) {
  return useHydrated() ? <>{children}</> : <Loading tabs={tabs} />;
}

/* ------------------------------------------------------------------ W1 Train */

function Home() {
  const s = useAppStore();
  const h = selectTrainHome(s);
  const week = selectWeekCount(s);
  const others = selectOtherWorkouts(s, h.letter);
  const [pick, setPick] = useState(false);
  return (
    <>
      <Screen withTabBar>
        <Hero title="Train" />
        <Stack>
          {h.doneToday ? (
            <Card tone="blue" icon="check" title="Done for today" detail={h.doneName} label="Today" />
          ) : (
            <Card tone="blue" icon="train" title={`Next: ${h.name} · about ${h.minutes} min`} href="/train/workout" />
          )}
          <Card tone="neutral" title={`This week: ${week.done} of ${week.planned} done.`} label="This week" />
          {!h.doneToday && !h.inProgress && others.length ? (
            <Button variant="secondary" block onClick={() => setPick(true)}>
              Pick another workout
            </Button>
          ) : null}
          <Card tone="neutral" title="Moves I've set aside" href="/train/set-aside" />
        </Stack>
      </Screen>
      <TabBar current="train" />
      {pick ? (
        <Sheet open onClose={() => setPick(false)} title="Pick another workout">
          {others.map((o) => (
            <Button key={o.letter} variant="secondary" block href={`/train/workout?letter=${o.letter}`}>
              {o.name} · about {h.minutes} min
            </Button>
          ))}
        </Sheet>
      ) : null}
    </>
  );
}
export function TrainHome() {
  return (
    <Gate tabs>
      <Home />
    </Gate>
  );
}

/* ------------------------------------------------------------------ W11 Moves I've set aside */

function SetAside() {
  const s = useAppStore();
  const bringBack = useAppStore((x) => x.bringBack);
  const list = selectSetAside(s);
  return (
    <Screen>
      <TopRow back={{ href: "/train" }} label="Train" />
      <Hero title="Moves I've set aside" subline="Moves you tapped Hurts on twice." />
      {list.length === 0 ? <Subline>Nothing set aside.</Subline> : null}
      <Stack>
        {list.map((x) => (
          <Card key={x.exerciseId} tone="neutral" title={x.name} detail={`Set aside ${shortDay(x.on)}`} label={x.name}>
            <Button variant="secondary" onClick={() => bringBack(x.exerciseId)} className="self-start">
              Bring it back
            </Button>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
export function SetAsideScreen() {
  return (
    <Gate>
      <SetAside />
    </Gate>
  );
}

/* ------------------------------------------------------------------ W6 route */

function Move() {
  const { id } = useParams<{ id: string }>();
  const from = useSearchParams().get("from");
  const back = from === "set-aside" ? "/train/set-aside" : "/train";
  return <MoveHowTo exerciseId={decodeURIComponent(id)} back={{ href: back }} />;
}
export function MoveScreen() {
  return (
    <Gate>
      <Move />
    </Gate>
  );
}
