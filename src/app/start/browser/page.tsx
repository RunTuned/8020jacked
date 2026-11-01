import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { BrowserScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Open in your browser · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <BrowserScreen />
      </Hydrated>
    </Suspense>
  );
}
