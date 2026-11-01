import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { TodayScreen } from "@/components/today/TodayScreen";

export const metadata: Metadata = { title: "Today · 8020jacked" };

/** T1, T1b (preview), T4 redirect, T5, T7, T8 (locked). */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton tabBar current="today" />}>
      <TodayScreen />
    </Suspense>
  );
}
