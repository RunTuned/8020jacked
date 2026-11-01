import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { SaveScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Save your progress · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <SaveScreen />
      </Hydrated>
    </Suspense>
  );
}
