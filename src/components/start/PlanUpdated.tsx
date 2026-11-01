"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Hero, Screen, Sheet, TopRow } from "@/components/ui";
import { selectPlanSentence, useAppStore } from "@/lib/store";
import { GOAL_LABEL } from "./copy";
import { Bottom } from "./Parts";

/** A9: one sentence, no numbers. Nothing is written until "Sounds good". */
export function PlanUpdated() {
  const router = useRouter();
  const sentence = useAppStore((s) => selectPlanSentence(s));
  const pending = useAppStore((s) => s.ui.pendingGoal);
  const confirmGoal = useAppStore((s) => s.confirmGoal);
  const cancelGoal = useAppStore((s) => s.cancelGoal);
  const [why, setWhy] = useState(false);
  const newGoal = pending?.startsNew ? pending.goal : null;

  return (
    <Screen>
      <TopRow
        back={{
          onClick: () => {
            cancelGoal();
            router.push("/you/goal");
          },
        }}
      />
      <Hero title="Your plan updated" />
      <p className="m-0 text-title font-bold">Now: {sentence}</p>
      <Button variant="text" onClick={() => setWhy(true)}>
        Why this change
      </Button>
      <Sheet open={why} onClose={() => setWhy(false)} title="Why this change">
        {newGoal ? (
          <p className="m-0">
            You picked a new goal: {GOAL_LABEL[newGoal]}. A new goal starts a new 12 weeks, so your plan fits it from
            day one.
          </p>
        ) : (
          <p className="m-0">You changed your answers. Your workouts and meals now follow them.</p>
        )}
      </Sheet>
      <Bottom>
        <Button
          block
          onClick={() => {
            confirmGoal();
            router.push("/today");
          }}
        >
          Sounds good
        </Button>
        {newGoal ? (
          <Button
            variant="secondary"
            block
            onClick={() => {
              cancelGoal();
              router.push("/you/goal");
            }}
          >
            Undo, keep my old goal
          </Button>
        ) : null}
      </Bottom>
    </Screen>
  );
}
