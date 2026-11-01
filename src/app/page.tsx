import { Suspense } from "react";
import { Hydrated } from "@/components/start/Page";
import { RootRedirect } from "@/components/start/Screens";
import { Skeleton } from "@/components/start/Skeleton";

/** `/`: Today when set up, else the setup screen she left, else Start. */
export default function Home() {
  return (
    <>
      <Skeleton />
      <Suspense>
        <Hydrated>
          <RootRedirect />
        </Hydrated>
      </Suspense>
    </>
  );
}
