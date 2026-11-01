import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { PickupScreen } from "@/components/food/PickupScreen";

export const metadata: Metadata = { title: "Pick up this week · 8020jacked" };

/** F8 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={3} />}>
      <PickupScreen />
    </Suspense>
  );
}
