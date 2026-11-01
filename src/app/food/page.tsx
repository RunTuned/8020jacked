import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { FoodScreen } from "@/components/food/FoodScreen";

export const metadata: Metadata = { title: "Food · 8020jacked" };

/** F1 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton tabBar current="food" cards={4} />}>
      <FoodScreen />
    </Suspense>
  );
}
