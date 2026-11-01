import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { Skeleton } from "@/components/train/common";
import { TrainHome } from "@/components/train/screens";

export const metadata: Metadata = { title: "Train · 8020jacked" };

/** W1 Train tab. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen withTabBar>
          <Skeleton />
        </Screen>
      }
    >
      <TrainHome />
    </Suspense>
  );
}
