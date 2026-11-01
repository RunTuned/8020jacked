"use client";

import { useState } from "react";
import { Button, Card, Hero, Screen, TopRow } from "@/components/ui";
import { selectMoveVersions, useAppStore } from "@/lib/store";

/**
 * W6 How to do it. MoveKit pictures aren't bought yet, so the picture is a neutral box with the
 * move's name. Versions switch the move shown; "Use this version" swaps it for today (workout only).
 */
export function MoveHowTo({
  exerciseId,
  back,
  onUse,
}: {
  exerciseId: string;
  back: { href?: string; onClick?: () => void };
  /** In a workout: swap the original move for the one shown. */
  onUse?: (toId: string) => void;
}) {
  const s = useAppStore();
  const [shownId, setShownId] = useState(exerciseId);
  const v = selectMoveVersions(s, shownId);
  if (!v) {
    return (
      <Screen>
        <TopRow back={back} label="How to do it" />
        <Hero title="Move not found" />
      </Screen>
    );
  }
  const ex = v.exercise;
  const versions = [
    { label: "Starter version", move: v.starter },
    { label: "No-floor version (chair or wall)", move: v.noFloor },
    { label: "Harder version", move: v.harder },
  ].filter((x) => x.move);

  return (
    <Screen>
      <TopRow back={back} label="How to do it" />
      <Hero title={ex.name} />
      <div
        role="img"
        aria-label={`Picture of ${ex.name} coming soon`}
        className="flex min-h-40 items-center justify-center rounded-card bg-neutral p-5 text-center text-title font-bold"
      >
        {ex.name}
      </div>
      <Card tone="blue" title="Steps" label="Steps">
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-6 text-body">
          {ex.cues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </Card>
      {versions.length ? (
        <div className="flex flex-col gap-2">
          {versions.map((x) => (
            <Button key={x.label} variant="secondary" block className="!justify-between" onClick={() => setShownId(x.move!.id)}>
              {x.label}: {x.move!.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        {onUse && shownId !== exerciseId ? (
          <Button block onClick={() => onUse(shownId)}>
            Use this version
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}
