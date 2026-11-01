import type { Metadata } from "next";
import { TodayMock } from "./TodayMock";

export const metadata: Metadata = { title: "Today mock · 8020jacked", robots: { index: false } };

/** Static Today screen built only from components, to compare with docs/design/shots/Main.png. */
export default function Page() {
  return <TodayMock />;
}
