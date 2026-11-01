import type { Metadata } from "next";
import { Suspense } from "react";
import { BentoSkeleton } from "@/components/today/Skeleton";
import { WelcomeBackScreen } from "@/components/today/WelcomeBackScreen";

export const metadata: Metadata = { title: "You're back · 8020jacked" };

/** T4 */
export default function Page() {
  return (
    <Suspense fallback={<BentoSkeleton cards={2} />}>
      <WelcomeBackScreen />
    </Suspense>
  );
}
