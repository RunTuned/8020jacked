import type { Metadata } from "next";
import { PhotosScreen } from "@/components/progress/PhotosScreen";

export const metadata: Metadata = { title: "Photos · 8020jacked" };

export default function Page() {
  return <PhotosScreen />;
}
