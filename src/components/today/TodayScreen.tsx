"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Banner, Button, Card, CardActions, Hero, Icon, Screen, Stack, Subline, TabBar, TopRow } from "@/components/ui";
import { SPEED_BRAKE_BANNER, UNDO_MS } from "@/lib/engine";
import { billing } from "@/lib/services";
import {
  appState,
  selectAllergyNotice,
  selectDoneToday,
  selectLastMealLog,
  selectMeal,
  selectNextMeal,
  selectSession,
  selectToday,
  selectTodayBanner,
  selectTodayWorkout,
  selectWalks,
  selectWeekCount,
  selectWelcomeBackDue,
  undoVisible,
  useAppStore,
  type MealView,
} from "@/lib/store";
import { longDate } from "./format";
import { useHydrated } from "./hooks";
import { LockedCard } from "./Locked";
import { BentoSkeleton } from "./Skeleton";
import { StoreUndo } from "./StoreUndo";

const TAB_HREFS = { today: "/today" } as const;

function weekLine(done: number, planned: number, walksLeft: number): string {
  const walks = walksLeft === 0 ? "walks done" : `${walksLeft} ${walksLeft === 1 ? "walk" : "walks"} to go`;
  return `${done} of ${planned} ${planned === 1 ? "workout" : "workouts"} · ${walks}`;
}

export function TodayScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  const preview = useSearchParams().get("preview");
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [jump, setJump] = useState<number | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let live = true;
    billing.state().then((b) => live && setPaymentFailed(b === "payment_failed"));
    billing.locked().then((l) => live && setLocked(l));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const s = appState();
    if (!s.planStart) {
      router.replace("/start");
      return;
    }
    if (selectWelcomeBackDue(s)) {
      router.replace("/today/welcome-back");
      return;
    }
    useAppStore.getState().markOpened();
  }, [hydrated, router]);

  if (!hydrated || !st.planStart || selectWelcomeBackDue(st)) return <BentoSkeleton tabBar current="today" />;

  const today = selectToday(st);
  const isLocked = locked || preview === "locked";
  const header = (hero: string, sub?: string) => (
    <div className="flex flex-col gap-1.5">
      <TopRow label={longDate(today)} you={{ href: "/you" }}>
        <Hero title={hero} />
      </TopRow>
      {sub ? <Subline>{sub}</Subline> : null}
    </div>
  );

  if (isLocked) {
    return (
      <>
        <Screen withTabBar>
          {header("Today")}
          <Stack>
            <LockedCard />
          </Stack>
        </Screen>
        <TabBar current="today" hrefs={TAB_HREFS} />
      </>
    );
  }

  const tw = selectTodayWorkout(st);
  const done = selectDoneToday(st);
  const walks = selectWalks(st);
  const count = selectWeekCount(st);
  const banner = selectTodayBanner(st, paymentFailed || preview === "payment");

  // Hero and the "do this now" card.
  let hero = "Rest day.";
  let sub: string | undefined;
  if (tw.away) {
    hero = "Away today.";
    sub = "Nothing to do. Meals stay simple.";
  } else if (done) {
    hero = st.profile.firstName ? `Hi, ${st.profile.firstName}.` : "Hi there.";
  } else if (tw.planned) {
    hero = "Training day.";
    sub = `${tw.name} · ${tw.minutes} minutes`;
  }

  const tickWalk = () => {
    st.tickWalk();
    router.push("/today/week");
  };
  const walkButton =
    walks.left > 0 ? (
      <Button variant="secondary" block onClick={tickWalk}>
        Tick a 15-minute walk
      </Button>
    ) : null;

  let doNow: ReactNode = null;
  if (tw.away) {
    doNow = null;
  } else if (done) {
    doNow = (
      <Card tone="blue" icon="check" title="Done for today." detail={`${done.name}, ${done.minutes} minutes. Well done.`} label="Workout">
        {walkButton}
      </Card>
    );
  } else if (tw.planned) {
    const moves = selectSession(st).moves.length;
    doNow = (
      <Card tone="blue" icon="train" title={`${moves} moves`} label="Workout">
        <Button href="/train/workout?from=today" block>
          Start
        </Button>
        <CardActions>
          {tw.minutes !== 10 ? (
            <Button variant="text" href="/train/workout?minutes=10&from=today">
              10-minute version
            </Button>
          ) : null}
          <Button
            variant="text"
            disabled={leaving}
            onClick={() => {
              const r = st.notToday();
              if (r) {
                setLeaving(true);
                router.push("/today/week");
              }
            }}
          >
            Not today
          </Button>
        </CardActions>
      </Card>
    );
  } else {
    doNow = (
      <Card tone="butter" icon="today" title="Rest day. A walk counts." label="Rest day">
        {walkButton}
      </Card>
    );
  }

  // Next meal: a just-logged meal stays on the card for its 5-second Undo.
  const undo = st.ui.undo;
  const last = selectLastMealLog(st, today);
  const held =
    undo && undoVisible(undo) && undo.kind === "meal" && last && last.at >= undo.expiresAt - UNDO_MS - 1000 ? last : null;
  const next = selectNextMeal(st, jump);
  const meal: MealView | null = held ? selectMeal(st, today, held.slot) : next.meal;

  const log = (kind: "plan" | "like") => {
    if (!meal) return;
    if (st.logMeal(meal.slot.index, kind)) setJump(undefined);
  };

  const mealCard = meal ? (
    <Card
      tone="lime"
      icon="food"
      label="Next meal"
      eyebrow={`Next meal · ${meal.slot.label}`}
      title={
        <Link
          href={`/food/meal/${meal.slot.date}/${meal.slot.index}?from=/today`}
          className="-my-2 inline-flex min-h-12 items-center no-underline"
        >
          {meal.title}
        </Link>
      }
      detail={
        <>
          {meal.lines[0] ? <span className="block">{meal.lines[0]}</span> : null}
          {meal.checkLabel ? <span className="block font-semibold text-ink">Check the label</span> : null}
        </>
      }
      headingExtra={
        !held && next.instead ? (
          <Button variant="text" small className="-my-[13px] -ml-1 self-start" onClick={() => setJump(next.instead!.index)}>
            {`${next.instead.label} instead`}
          </Button>
        ) : null
      }
    >
      {held ? (
        <p role="status" className="m-0 flex min-h-14 items-center gap-2 text-body font-bold">
          <Icon name="check" size={24} />
          Saved.
        </p>
      ) : (
        <>
          <Button block onClick={() => log("plan")}>
            Ate the plan
          </Button>
          <CardActions>
            <Button variant="text" onClick={() => log("like")}>
              Something like it
            </Button>
            <Button variant="text" href={`/food/other?date=${meal.slot.date}&slot=${meal.slot.index}&back=/today`}>
              Something else
            </Button>
          </CardActions>
        </>
      )}
    </Card>
  ) : (
    <Card tone="lime" icon="food" eyebrow="Meals" title="All of today's meals are logged." href="/food" />
  );

  const allergy = selectAllergyNotice(st);
  const bannerEl =
    banner === "allergy" && allergy ? (
      <Banner role="alert">{allergy.message}</Banner>
    ) : banner === "speed_brake" ? (
      <Banner icon="food">{SPEED_BRAKE_BANNER}</Banner>
    ) : banner === "payment" ? (
      <Banner
        action={
          <Button href="/you/subscription" variant="secondary" block>
            Update card
          </Button>
        }
      >
        Payment didn&apos;t go through.
      </Banner>
    ) : banner === "check_in" ? (
      <Banner
        icon="calendar"
        action={
          <Button href="/check-in" variant="secondary" block>
            Open check-in
          </Button>
        }
      >
        Check-in ready.
      </Banner>
    ) : null;

  return (
    <>
      <Screen withTabBar>
        {header(hero, sub)}
        {bannerEl}
        <Stack>
          {doNow}
          {mealCard}
          <Card
            tone="pink"
            icon="calendar"
            eyebrow="This week"
            title={weekLine(count.done, count.planned, walks.left)}
            href="/today/week"
          />
        </Stack>
      </Screen>
      <StoreUndo kinds={["meal"]} floating />
      <TabBar current="today" hrefs={TAB_HREFS} />
    </>
  );
}
