"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { selectSetupDone, useAppStore } from "@/lib/store";
import { Hydrated } from "./Parts";
import { Skeleton } from "./Skeleton";
import { useHydrated } from "./useHydrated";

export { Hydrated };

/** You and A9 need a plan: without one she goes to Start. */
export function NeedsPlan({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const done = useAppStore((s) => selectSetupDone(s));
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !done) router.replace("/start");
  }, [hydrated, done, router]);
  return hydrated && done ? <>{children}</> : <Skeleton />;
}
