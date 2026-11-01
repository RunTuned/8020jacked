import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { RemindersScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Reminders · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <RemindersScreen />
      </Hydrated>
    </Suspense>
  );
}
