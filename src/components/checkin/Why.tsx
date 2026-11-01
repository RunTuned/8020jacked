"use client";

import { useParams } from "next/navigation";
import { Button, Card, Hero, Screen, Sheet } from "@/components/ui";
import { selectCheckInWhy, whyLines } from "@/lib/store";
import type { CheckInResult } from "@/lib/types";
import { BentoSkeleton, useHydrated, useStore } from "@/components/progress/parts";

function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {lines.map((l, i) => (
        <li key={i} className="text-body">
          {l}
        </li>
      ))}
    </ul>
  );
}

/** C5 as a sheet over C4: built from the decision about to be saved, never recalculated. */
export function WhySheet({ open, onClose, result }: { open: boolean; onClose: () => void; result: CheckInResult }) {
  const s = useStore();
  return (
    <Sheet open={open} onClose={onClose} title="Why this change" closeLabel="Close">
      <Lines lines={whyLines(s, result)} />
      <Button variant="secondary" block onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}

/** C5 for a past week (P4 → C5): read from what was saved that week. */
export function PastWhy() {
  const hydrated = useHydrated();
  const s = useStore();
  const { week } = useParams<{ week: string }>();
  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton cards={1} />
      </Screen>
    );
  const w = selectCheckInWhy(s, week);
  return (
    <Screen>
      <Hero title="Why this change" subline={w ? `Check-in on ${w.dateText}` : "This check-in isn't on this phone."} />
      {w ? (
        <Card tone="aqua" title={w.copy} detail={`${w.status}.`} label="That week">
          <Lines lines={w.lines} />
        </Card>
      ) : null}
      <Button href="/progress/check-ins" variant="secondary" block>
        Close
      </Button>
    </Screen>
  );
}
