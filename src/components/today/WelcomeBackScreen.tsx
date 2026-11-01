"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Hero, Screen, Stack } from "@/components/ui";
import { SESSION_NAMES } from "@/lib/engine";
import { selectTodayWorkout, useAppStore } from "@/lib/store";
import { useHydrated } from "./hooks";
import { BentoSkeleton } from "./Skeleton";

function Choice({ title, hint, onClick }: { title: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 flex-col items-start gap-0.5 border-0 bg-transparent px-1 py-1 text-left">
      <span className="text-body font-semibold underline underline-offset-[3px]">{title}</span>
      {hint ? <span className="text-label text-ink-muted">{hint}</span> : null}
    </button>
  );
}

/** T4: You're back. After 5 or more days away. Never shows what was missed. */
export function WelcomeBackScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  if (!hydrated) return <BentoSkeleton cards={2} />;

  const tw = selectTodayWorkout(st);
  const nextLetter = tw.planned ? tw.letter : (tw.next?.letter ?? null);
  const nextLine = nextLetter ? `${SESSION_NAMES[nextLetter]} is next.` : undefined;

  return (
    <Screen>
      <Hero title="You're back." subline="Your plan and your wins are all here." />
      <Stack>
        <Card tone="neutral" icon="heart" label="A note from Jen" title={<span className="text-title font-semibold">Life gets busy for me too. Let&apos;s start again, gently.</span>}>
          <span className="pl-14 text-body font-bold">— Jen</span>
        </Card>
        <Card tone="neutral" icon="today" title={<h2 className="m-0 text-body font-bold">How do you want to start?</h2>} label="How do you want to start?">
          <div className="flex flex-col gap-2">
            <Button
              block
              onClick={() => {
                st.startEasyWeek();
                router.replace("/today");
              }}
            >
              Start with an easy week
            </Button>
            <p className="m-0 text-center text-label text-ink-muted">7 easy days, then back to normal.</p>
          </div>
          <Choice
            title="Carry on where I was"
            hint={nextLine}
            onClick={() => {
              st.markOpened();
              router.replace("/today");
            }}
          />
          <Choice
            title="Something's changed"
            hint="New times, new goal or new things at home."
            onClick={() => {
              st.markOpened();
              router.push("/you/goal");
            }}
          />
        </Card>
      </Stack>
    </Screen>
  );
}
