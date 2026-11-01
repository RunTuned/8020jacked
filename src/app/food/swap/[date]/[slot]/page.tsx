import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { SwapScreen } from "@/components/food/SwapScreen";

export const metadata: Metadata = { title: "Swap this meal · 8020jacked" };

async function Load({ params }: { params: Promise<{ date: string; slot: string }> }) {
  const { date, slot } = await params;
  return <SwapScreen date={date} slot={Number(slot)} />;
}

/** F3 */
export default function Page({ params }: PageProps<"/food/swap/[date]/[slot]">) {
  return (
    <Suspense fallback={<BentoSkeleton cards={2} />}>
      <Load params={params} />
    </Suspense>
  );
}
