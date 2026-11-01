import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NeedsPlan } from "@/components/start/Page";
import { Skeleton } from "@/components/start/Skeleton";
import { SECTIONS, type Section } from "@/components/you/sections";
import { YouSection } from "@/components/you/You";

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}

export const metadata: Metadata = { title: "You · 8020jacked" };

export default async function Page({ params }: PageProps<"/you/[section]">) {
  const { section } = await params;
  if (!(SECTIONS as readonly string[]).includes(section)) notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <NeedsPlan>
        <YouSection section={section as Section} />
      </NeedsPlan>
    </Suspense>
  );
}
