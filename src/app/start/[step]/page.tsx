import { notFound, redirect } from "next/navigation";
import { FLOW } from "@/components/start/flow";

export function generateStaticParams() {
  return FLOW.map((step) => ({ step }));
}

/** `/start/about` etc. (ROUTES.md) open the one setup route at that step. */
export default async function Page({ params }: PageProps<"/start/[step]">) {
  const { step } = await params;
  if (!(FLOW as readonly string[]).includes(step)) notFound();
  redirect(`/start/setup?step=${step}`);
}
