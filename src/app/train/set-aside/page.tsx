import type { Metadata } from "next";
import { Suspense } from "react";
import { Screen } from "@/components/ui";
import { Skeleton } from "@/components/train/common";
import { SetAsideScreen } from "@/components/train/screens";

export const metadata: Metadata = { title: "Moves I've set aside · 8020jacked" };

/** W11 Moves I've set aside. */
export default function Page() {
  return (
    <Suspense
      fallback={
        <Screen>
          <Skeleton />
        </Screen>
      }
    >
      <SetAsideScreen />
    </Suspense>
  );
}
