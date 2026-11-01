import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { BackScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Welcome back · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <BackScreen />
      </Hydrated>
    </Suspense>
  );
}
