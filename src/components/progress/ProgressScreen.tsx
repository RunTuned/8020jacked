"use client";

import { useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { Hero, Screen, Stack, TabBar, TopRow, cx } from "@/components/ui";
import { PROGRESS_VIEW_LABELS, selectProgress, type ProgressView } from "@/lib/store";
import { CheckInHistoryLink, PhotosCard, StrengthCard, WeightCard, WinsCard } from "./cards";
import { BentoSkeleton, useHydrated, useStore } from "./parts";

/** P1: Wins · Weight · Strength · Photos, switched in place. The view is mirrored to ?view=. */
export function ProgressScreen() {
  const hydrated = useHydrated();
  const s = useStore();
  const params = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);

  if (!hydrated) {
    return (
      <>
        <Screen withTabBar>
          <BentoSkeleton />
        </Screen>
        <TabBar current="progress" />
      </>
    );
  }

  const p = selectProgress(s, (params.get("view") as ProgressView | null) ?? undefined);
  const view: ProgressView = p.view;
  const pick = (v: ProgressView) => window.history.replaceState(null, "", `?view=${v}`);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = p.views.indexOf(view);
    const next = p.views[(i + d + p.views.length) % p.views.length];
    pick(next);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
  };

  return (
    <>
      <Screen withTabBar>
        <div className="flex flex-col gap-1.5">
          <TopRow label={p.today} you={{ href: "/you" }} />
          <Hero title={p.heading} subline={p.subline} />
        </div>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Progress view"
          onKeyDown={onKey}
          className="flex flex-wrap gap-1 rounded-[2rem] bg-neutral p-1"
        >
          {p.views.map((v) => {
            const on = v === view;
            return (
              <button
                key={v}
                id={`tab-${v}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`view-${v}`}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(v)}
                className={cx(
                  "flex min-h-12 flex-[1_0_auto] items-center justify-center rounded-full border-0 px-2 text-label",
                  on ? "bg-ink font-bold text-on-ink" : "bg-transparent font-semibold text-ink",
                )}
              >
                {PROGRESS_VIEW_LABELS[v]}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id={`view-${view}`} aria-labelledby={`tab-${view}`} className="-mt-3">
          <Stack>
            {view === "weight" ? (
              <>
                <WeightCard s={s} chartHref="/progress/weight" />
                <WinsCard s={s} title="Other wins" limit={3} />
              </>
            ) : null}
            {view === "wins" ? <WinsCard s={s} /> : null}
            {view === "strength" ? <StrengthCard s={s} /> : null}
            {view === "photos" ? <PhotosCard s={s} /> : null}
            <CheckInHistoryLink />
          </Stack>
        </div>
      </Screen>
      <TabBar current="progress" />
    </>
  );
}
