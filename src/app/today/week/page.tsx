import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { WeekScreen } from "@/components/today/WeekScreen";

export const metadata: Metadata = { title: "This week · 8020jacked" };

/** T2 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton tabBar current="today" />}>
      <WeekScreen />
    </Suspense>
  );
}
