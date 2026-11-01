import type { Metadata } from "next";
import { Suspense } from "react";
import { NeedsPlan } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { YouHome } from "@/components/you/You";

export const metadata: Metadata = { title: "You · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NeedsPlan>
        <YouHome />
      </NeedsPlan>
    </Suspense>
  );
}
