import type { Metadata } from "next";
import { CheckInHistoryScreen } from "@/components/progress/HistoryScreens";

export const metadata: Metadata = { title: "Check-in history · 8020jacked" };

export default function Page() {
  return <CheckInHistoryScreen />;
}
