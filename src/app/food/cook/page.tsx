import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { CookScreen } from "@/components/food/CookScreen";

export const metadata: Metadata = { title: "Cook day · 8020jacked" };

/** F5 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={2} />}>
      <CookScreen />
    </Suspense>
  );
}
