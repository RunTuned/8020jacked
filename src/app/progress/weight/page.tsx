import type { Metadata } from "next";
import { WeightHistory } from "@/components/progress/WeightHistory";

export const metadata: Metadata = { title: "Weight history · 8020jacked" };

export default function Page() {
  return <WeightHistory />;
}
