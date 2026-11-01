import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { Skeleton } from "@/components/train/common";
import { WorkoutFlow } from "@/components/train/workout/WorkoutFlow";

export const metadata: Metadata = { title: "Workout · 8020jacked" };

/** W2–W7 as one flow; the step is mirrored in ?step= so a reload resumes. No tab bar. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <Skeleton />
        </Screen>
      }
    >
      <WorkoutFlow />
    </Suspense>
  );
}
