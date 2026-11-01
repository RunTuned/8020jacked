import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { Skeleton } from "@/components/train/common";
import { MoveScreen } from "@/components/train/screens";

export const metadata: Metadata = { title: "How to do it · 8020jacked" };

/** W6 from Skills or past workouts. In a workout, W6 opens inside the workout flow. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <Skeleton />
        </Screen>
      }
    >
      <MoveScreen />
    </Suspense>
  );
}
