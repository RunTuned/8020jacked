import type { ReactNode } from "react";
import { IconCircle } from "./Card";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/* ------------------------------------------------------------------ Banner */

export type BannerProps = {
  children: ReactNode;
  icon?: IconName;
  /** "status" (ink circle icon) or "error" (error-coloured icon straight on the card). */
  tone?: "status" | "error";
  /** The next step: a Button, normally. */
  action?: ReactNode;
  /** "note" for standing advice (the safety line), "status" for live news, "alert" for errors. */
  role?: "note" | "status" | "alert";
  className?: string;
};

/** One-line status card on the neutral fill: icon, plain bold message, optional next step. */
export function Banner({ children, icon = "hurts", tone = "status", action, role = "status", className }: BannerProps) {
  return (
    <div role={role} className={cx("flex flex-col gap-3 rounded-card bg-neutral p-5 text-ink", className)}>
      <div className="flex items-center gap-3">
        {tone === "error" ? (
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center text-error">
            <Icon name={icon} size={28} />
          </span>
        ) : (
          <IconCircle name={icon} />
        )}
        <span className="min-w-0 flex-1 text-body font-bold">{children}</span>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ ProgressBar */

export type ProgressBarProps = {
  /** 0..max. The number comes from the engine; this only draws it. */
  value: number;
  max?: number;
  label: string;
  /** Words for screen readers, e.g. "7 of 15 sets done". */
  valueText?: string;
};

/** 8px neutral track with an ink fill. */
export function ProgressBar({ value, max = 100, label, valueText }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="h-2 w-full overflow-hidden rounded-full bg-neutral"
    >
      <div className="h-2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ BigNumber */

export type BigNumberProps = {
  value: ReactNode;
  /** Words under the number ("reps each leg"). */
  unit?: ReactNode;
  /** "big" = 9rem (big screen mode reps), "timer" = 4.5rem (rest clock). */
  size?: "big" | "timer";
  /** Spoken label for the whole block, e.g. "8 reps each leg". */
  label?: string;
  align?: "center" | "start";
  /** role="timer" for clocks. */
  timer?: boolean;
};

/** The huge numeral for big screen mode and the rest clock. Tabular figures, 800 weight. */
export function BigNumber({ value, unit, size = "big", label, align = "center", timer }: BigNumberProps) {
  return (
    <div
      role={timer ? "timer" : label ? "group" : undefined}
      aria-label={label}
      aria-live={timer ? "off" : undefined}
      className={cx("flex flex-col", align === "center" ? "items-center text-center" : "items-start")}
    >
      <span
        aria-hidden={label ? true : undefined}
        className={cx(
          "font-extrabold tabular",
          size === "big" ? "text-big tracking-[-0.04em]" : "text-timer tracking-[-0.02em]",
        )}
      >
        {value}
      </span>
      {unit ? (
        <span aria-hidden={label ? true : undefined} className="text-[1.5rem] font-bold leading-[1.2]">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
