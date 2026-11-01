import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { SharedPhoneScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Do others use this phone? · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <SharedPhoneScreen />
      </Hydrated>
    </Suspense>
  );
}
