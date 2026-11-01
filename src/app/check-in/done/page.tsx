import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { BentoSkeleton } from "@/components/progress/parts";
import { BlockDone } from "@/components/checkin/BlockDone";

export const metadata: Metadata = { title: "Your 12 weeks · 8020jacked" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <BentoSkeleton cards={1} />
        </Screen>
      }
    >
      <BlockDone />
    </Suspense>
  );
}
