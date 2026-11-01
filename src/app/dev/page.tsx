import type { Metadata } from "next";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "Parts · 8020jacked", robots: { index: false } };

export default function Page() {
  return <Gallery />;
}
