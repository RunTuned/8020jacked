import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { AwayScreen } from "@/components/today/AwayScreen";

export const metadata: Metadata = { title: "Away days · 8020jacked" };

/** T6 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={2} />}>
      <AwayScreen />
    </Suspense>
  );
}
