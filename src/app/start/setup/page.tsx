import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { SetupFlow } from "@/components/start/SetupFlow";

export const metadata: Metadata = { title: "Set up · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <SetupFlow />
      </Hydrated>
    </Suspense>
  );
}
