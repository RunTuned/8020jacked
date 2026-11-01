"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon, cx } from "@/components/ui";
import { useAppStore } from "@/lib/store";

/** True once the store has loaded from the phone. Until then screens show a skeleton. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}

/** The whole store (it is AppState plus actions); pass it straight to selectors. */
export function useStore() {
  return useAppStore();
}

/** Skeleton in the bento shape, shown while the store loads. */
export function BentoSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="h-12 w-40 rounded-full bg-neutral" />
      <div className="h-10 w-56 rounded-full bg-neutral" />
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="h-36 rounded-card bg-neutral" />
      ))}
    </div>
  );
}

/** A list row: bold title over a muted detail, chevron when it goes somewhere. 48px+ tall. */
export function Row({
  title,
  detail,
  href,
  strong = true,
  end,
}: {
  title: ReactNode;
  detail?: ReactNode;
  href?: string | null;
  strong?: boolean;
  end?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-[1_1_auto] flex-col">
        <span className={cx("text-body", strong && "font-bold")}>{title}</span>
        {detail ? <span className="text-label text-ink-muted">{detail}</span> : null}
      </span>
      {end}
      {href ? (
        <span aria-hidden="true" className="flex shrink-0 text-ink">
          <Icon name="chevron" size={20} />
        </span>
      ) : null}
    </>
  );
  const cls = "flex min-h-12 items-center gap-3 text-ink no-underline";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
