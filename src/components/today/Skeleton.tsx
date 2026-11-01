import { Screen, TabBar } from "@/components/ui";

/** The bento shape while the store loads from the phone: heading, then soft blocks. */
export function BentoSkeleton({ cards = 3, tabBar = false, current }: { cards?: number; tabBar?: boolean; current?: "today" | "food" }) {
  const tones = ["bg-blue", "bg-lime", "bg-pink", "bg-neutral"];
  return (
    <>
      <Screen withTabBar={tabBar}>
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 rounded-full bg-neutral" />
            <div className="h-9 w-56 rounded-full bg-neutral" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className={`h-36 rounded-card opacity-60 ${tones[i % tones.length]}`} />
            ))}
          </div>
        </div>
      </Screen>
      {tabBar ? <TabBar current={current} hrefs={{ today: "/today" }} /> : null}
    </>
  );
}
