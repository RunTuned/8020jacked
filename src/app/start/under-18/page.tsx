import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { Under18Screen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Thanks for stopping by · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <Under18Screen />
      </Hydrated>
    </Suspense>
  );
}
