import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { InstallScreen } from "@/components/start/Screens";

export const metadata: Metadata = { title: "Add to your home screen · 8020jacked" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Hydrated>
        <InstallScreen />
      </Hydrated>
    </Suspense>
  );
}
