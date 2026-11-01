import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { BentoSkeleton } from "@/components/progress/parts";
import { PastWhy } from "@/components/checkin/Why";

export const metadata: Metadata = { title: "Why this change · 8020jacked" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <BentoSkeleton cards={1} />
        </Screen>
      }
    >
      <PastWhy />
    </Suspense>
  );
}
