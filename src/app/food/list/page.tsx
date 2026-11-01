import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { ListScreen } from "@/components/food/ListScreen";

export const metadata: Metadata = { title: "Shopping list · 8020jacked" };

/** F4 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={3} />}>
      <ListScreen />
    </Suspense>
  );
}
