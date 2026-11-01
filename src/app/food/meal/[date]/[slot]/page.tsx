import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { MealScreen } from "@/components/food/MealScreen";

export const metadata: Metadata = { title: "Meal · 8020jacked" };

async function Load({ params }: { params: Promise<{ date: string; slot: string }> }) {
  const { date, slot } = await params;
  return <MealScreen date={date} slot={Number(slot)} />;
}

/** F2 (I cook) and F2b (I buy most food) */
export default function Page({ params }: PageProps<"/food/meal/[date]/[slot]">) {
  return (
    <Suspense fallback={<BentoSkeleton cards={2} />}>
      <Load params={params} />
    </Suspense>
  );
}
