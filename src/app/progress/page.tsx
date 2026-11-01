import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { BentoSkeleton } from "@/components/progress/parts";
import { ProgressScreen } from "@/components/progress/ProgressScreen";

export const metadata: Metadata = { title: "Progress · 8020jacked" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen withTabBar>
          <BentoSkeleton />
        </Screen>
      }
    >
      <ProgressScreen />
    </Suspense>
  );
}
