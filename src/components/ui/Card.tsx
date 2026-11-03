import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type CardTone = "blue" | "lime" | "aqua" | "pink" | "butter" | "neutral";

export const toneClass: Record<CardTone, string> = {
  blue: "bg-blue",
  lime: "bg-lime",
  aqua: "bg-aqua",
  pink: "bg-pink",
  butter: "bg-butter",
  neutral: "bg-neutral",
};

/** 44px ink circle with a 22px on-ink outline icon. */
export function IconCircle({ name, className }: { name: IconName; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink", className)}
    >
      <Icon name={name} size={22} />
    </span>
  );
}

export type CardProps = {
  tone?: CardTone;
  /** Category word above the title, e.g. "Next meal · Meal 2". */
  eyebrow?: ReactNode;
  icon?: IconName;
  title?: ReactNode;
  /** Larger title (1.25rem) instead of the board's 17px bold. */
  titleSize?: "body" | "title";
  /** Muted line(s) under the title inside the heading block. */
  detail?: ReactNode;
  /** Muted status line at the bottom of the card. */
  status?: ReactNode;
  /** Controls and content under the heading. A card with controls is never a link. */
  children?: ReactNode;
  /** Makes the whole card one link with a chevron. Only for cards without controls. */
  href?: string;
  /** Accessible name for the section (cards with controls). */
  label?: string;
  /** Extra content in the heading column (e.g. a "Meal 3 instead" button). */
  headingExtra?: ReactNode;
  className?: string;
};

/** Pastel bento card: radius 30, 1.25rem padding, no borders or shadows. */
export function Card({
  tone = "neutral",
  eyebrow,
  icon,
  title,
  titleSize = "body",
  detail,
  status,
  children,
  href,
  label,
  headingExtra,
  className,
}: CardProps) {
  const hasHeading = Boolean(icon || eyebrow || title || detail || headingExtra);
  // Link cards and one-line headings centre the icon; cards with a longer heading top-align it (as the boards).
  const centred = Boolean(href) || (!eyebrow && !detail && !headingExtra);

  const heading = hasHeading ? (
    <div className={cx("flex flex-wrap gap-3", centred ? "items-center" : "items-start")}>
      {icon ? <IconCircle name={icon} /> : null}
      <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1">
        {eyebrow ? <div className="text-label font-semibold text-ink-muted">{eyebrow}</div> : null}
        {title ? (
          <div className={titleSize === "title" ? "text-title font-bold" : "text-body font-bold"}>{title}</div>
        ) : null}
        {detail ? <div className="text-label text-ink-muted">{detail}</div> : null}
        {headingExtra}
      </div>
      {href ? (
        <span aria-hidden="true" className="flex shrink-0 self-center text-ink">
          <Icon name="chevron" size={20} />
        </span>
      ) : null}
    </div>
  ) : null;

  const statusLine = status ? <div className="text-label text-ink-muted">{status}</div> : null;
  const cls = cx(
    "flex flex-col gap-3 rounded-card p-5 text-ink box-border",
    toneClass[tone],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cx(cls, "min-h-12 no-underline")}>
        {heading}
        {children}
        {statusLine}
      </Link>
    );
  }

  return (
    <section aria-label={label} className={cls}>
      {heading}
      {children}
      {statusLine}
    </section>
  );
}

/** A row of text buttons spread across the card ("8-minute version · Not today"). */
export function CardActions({ children, spread = true }: { children: ReactNode; spread?: boolean }) {
  return (
    <div className={cx("flex flex-wrap gap-x-4 gap-y-1", spread ? "justify-between" : "justify-start")}>
      {children}
    </div>
  );
}
