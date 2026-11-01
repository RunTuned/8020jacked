import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { WeighInScreen } from "@/components/today/WeighInScreen";

export const metadata: Metadata = { title: "Weigh in · 8020jacked" };

/** T3 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={1} />}>
      <WeighInScreen />
    </Suspense>
  );
}
