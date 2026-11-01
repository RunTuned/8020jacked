import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { OtherScreen } from "@/components/food/OtherScreen";

export const metadata: Metadata = { title: "Something else · 8020jacked" };

/** F6, F7 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={1} />}>
      <OtherScreen />
    </Suspense>
  );
}
