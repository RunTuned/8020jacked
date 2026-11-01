import type { Metadata } from "next";
import { Suspense } from "react";
import { NeedsPlan } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { PlanUpdated } from "@/components/start/PlanUpdated";

export const metadata: Metadata = { title: "Your plan updated · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NeedsPlan>
        <PlanUpdated />
      </NeedsPlan>
    </Suspense>
  );
}
