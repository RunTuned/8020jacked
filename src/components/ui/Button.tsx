"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "text" | "quiet";

type Common = {
  variant?: ButtonVariant;
  /** Stretch to the full width of its container (primary buttons on cards do). */
  block?: boolean;
  /** Text buttons only: the 15px size used inside a card's heading ("Meal 3 instead"). */
  small?: boolean;
  /** Leading icon. */
  icon?: IconName;
  /** Looks and behaves disabled but stays focusable and announces why (aria-describedby). */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children"> & { href?: undefined };
type AsLink = Common & {
  href: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  "aria-describedby"?: string;
  "aria-label"?: string;
};

export type ButtonProps = AsButton | AsLink;

const base =
  "inline-flex items-center gap-2 box-border no-underline";

const variants: Record<ButtonVariant, string> = {
  // Ink pill, 56px tall, white 17px/700 text.
  primary:
    "justify-center min-h-14 px-6 py-2 rounded-full border-0 bg-ink text-on-ink text-body font-bold leading-[1.3] text-center",
  // Neutral pill, 48px tall.
  secondary:
    "justify-center min-h-12 px-4 py-1.5 rounded-full border-0 bg-neutral text-ink text-label font-semibold leading-[1.3] text-center",
  // White pill with a 2px ink edge ("Hurts? Swap this move").
  outline:
    "justify-center min-h-12 pl-3 pr-4 py-1.5 rounded-full bg-canvas border-2 border-solid border-ink text-ink text-label font-bold leading-[1.3] text-center",
  // Underlined text button, 48x48 tap area.
  text: "text-ink border-0 bg-transparent min-h-12 min-w-12 px-1 py-1 text-body font-semibold leading-[1.3] underline underline-offset-[3px] text-left",
  // Quieter text button: 15px muted, underlined, pulled back to align with the line above.
  quiet:
    "border-0 bg-transparent min-h-12 min-w-12 px-1 -ml-1 py-1 text-label font-normal leading-[1.45] text-ink-muted underline underline-offset-[3px] text-left",
};

const disabledPrimary =
  "justify-center min-h-14 px-6 py-2 rounded-full bg-neutral text-ink-muted border-2 border-dashed border-ink-muted text-body font-bold leading-[1.3] text-center cursor-not-allowed";

const smallText =
  "text-ink border-0 bg-transparent min-h-12 min-w-12 px-1 py-1 text-label font-semibold leading-[1.45] underline underline-offset-[3px] text-left";

export function buttonClass(
  variant: ButtonVariant,
  opts: { block?: boolean; disabled?: boolean; small?: boolean } = {},
) {
  return cx(
    base,
    opts.disabled && variant === "primary"
      ? disabledPrimary
      : opts.small && variant === "text"
        ? smallText
        : variants[variant],
    opts.disabled && variant !== "primary" && "opacity-60 cursor-not-allowed",
    opts.block && "w-full flex",
  );
}

export function Button(props: ButtonProps) {
  const { variant = "primary", block, small, icon, disabled, className, children } = props;
  const cls = cx(buttonClass(variant, { block, disabled, small }), className);
  const content = (
    <>
      {icon ? <Icon name={icon} size={variant === "primary" ? 22 : 20} className="shrink-0" /> : null}
      <span>{children}</span>
    </>
  );

  if (props.href !== undefined) {
    const { href, onClick } = props;
    return (
      <Link
        href={href}
        className={cls}
        aria-disabled={disabled || undefined}
        aria-describedby={props["aria-describedby"]}
        aria-label={props["aria-label"]}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, block: _b, small: _s, icon: _i, disabled: _d, className: _c, children: _ch, href: _h, onClick, type, ...rest } =
    props as AsButton;
  return (
    <button
      type={type ?? "button"}
      className={cls}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {content}
    </button>
  );
}
