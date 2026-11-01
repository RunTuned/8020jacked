import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { BentoSkeleton } from "@/components/progress/parts";
import { CheckInFlow } from "@/components/checkin/CheckInFlow";

export const metadata: Metadata = { title: "Weekly check-in · 8020jacked" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <BentoSkeleton cards={1} />
        </Screen>
      }
    >
      <CheckInFlow />
    </Suspense>
  );
}
