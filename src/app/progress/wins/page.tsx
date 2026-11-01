import type { Metadata } from "next";
import { WinsScreen } from "@/components/progress/HistoryScreens";

export const metadata: Metadata = { title: "Wins · 8020jacked" };

export default function Page() {
  return <WinsScreen />;
}
