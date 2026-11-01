import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ Screen */

export type ScreenProps = {
  children: ReactNode;
  /** Leave room at the bottom for the floating tab bar (its measured height + safe area). */
  withTabBar?: boolean;
  /** Push the last child to the bottom of the screen (onboarding "Next"). */
  className?: string;
  /** Space between the screen's sections. Default 24px, as the boards. */
  gap?: "default" | "tight";
};

/** One screen: safe-area aware 20px side margins, 24px top and bottom, vertical stack. */
export function Screen({ children, withTabBar, className, gap = "default" }: ScreenProps) {
  return (
    <main
      className={cx(
        "flex min-h-dvh w-full max-w-[40rem] mx-auto box-border flex-col",
        gap === "default" ? "gap-6" : "gap-5",
        className,
      )}
      style={{
        paddingTop: "var(--page-top)",
        paddingLeft: "var(--page-left)",
        paddingRight: "var(--page-right)",
        paddingBottom: withTabBar ? "var(--bar-space)" : "var(--page-bottom)",
      }}
    >
      {children}
    </main>
  );
}

/** A vertical stack of cards with the 12px bento gap. */
export function Stack({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cx("flex flex-col gap-3", className)} aria-label={label}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ TopRow */

type CircleAction = { href?: string; onClick?: () => void; label?: string };

function CircleLink({
  action,
  label,
  children,
}: {
  action: CircleAction;
  label: string;
  children: ReactNode;
}) {
  const cls =
    "shrink-0 inline-flex size-12 items-center justify-center rounded-full bg-neutral text-ink border-0 p-0";
  if (action.href) {
    return (
      <Link href={action.href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} className={cls} onClick={action.onClick}>
      {children}
    </button>
  );
}

export type TopRowProps = {
  /** The screen's short label, e.g. today's date. Plain text, not a button. */
  label?: ReactNode;
  /** A 48px Back circle on the left. */
  back?: CircleAction;
  /** The 48px "You" circle on the right, labelled "You". */
  you?: { href: string };
  /** Anything else for the right-hand end (e.g. "Step 1 of 6"). */
  end?: ReactNode;
  /** Content under the label in the same column (Today puts its h1 here). */
  children?: ReactNode;
};

export function TopRow({ label, back, you, end, children }: TopRowProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      {back ? (
        <CircleLink action={back} label={back.label ?? "Back"}>
          <Icon name="back" size={22} />
        </CircleLink>
      ) : null}
      {label || children ? (
        <div className={cx("flex min-w-0 flex-1 flex-col gap-1.5", back && "self-center")}>
          {label ? <div className="text-label font-semibold text-ink-muted">{label}</div> : null}
          {children}
        </div>
      ) : null}
      {end ? <div className="ml-auto self-center text-label font-semibold text-ink-muted">{end}</div> : null}
      {you ? (
        <Link
          href={you.href}
          aria-label="You: settings and records"
          className="-mr-1 inline-flex min-w-12 shrink-0 flex-col items-center gap-0.5 text-ink no-underline"
        >
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-neutral">
            <Icon name="you" size={22} />
          </span>
          <span aria-hidden="true" className="text-label font-semibold leading-[1.2]">
            You
          </span>
        </Link>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Hero */

export type HeroProps = {
  title: ReactNode;
  subline?: ReactNode;
  /** Hero size: "l" (2rem, phones) or "xl" (2.25rem). */
  size?: "l" | "xl";
  /** Subline style: body muted (Today) or label muted (About you). */
  sublineSize?: "body" | "label";
  className?: string;
};

export function Hero({ title, subline, size = "l", sublineSize = "body", className }: HeroProps) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <h1
        className={cx(
          "m-0 font-extrabold tracking-[-0.02em]",
          size === "xl" ? "text-display-xl" : "text-display-l",
        )}
      >
        {title}
      </h1>
      {subline ? <Subline size={sublineSize}>{subline}</Subline> : null}
    </div>
  );
}

/** The muted line under a hero, for when the hero sits inside a TopRow. */
export function Subline({ children, size = "body" }: { children: ReactNode; size?: "body" | "label" }) {
  return <p className={cx("m-0 text-ink-muted", size === "body" ? "text-body" : "text-label")}>{children}</p>;
}
