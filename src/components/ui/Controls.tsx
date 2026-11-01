"use client";

import { useId, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ Option */

export type OptionProps = {
  /** "radio" for one-of-many (put it in an OptionGroup), "checkbox" for on/off. */
  kind?: "radio" | "checkbox";
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** Muted second line. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * Radio or checkbox card, 64px minimum. Unselected: neutral fill, 2px muted edge.
 * Selected: ink fill, on-ink text, an ink tick in a canvas circle.
 */
export function Option({ kind = "radio", checked, onChange, children, hint, disabled, className }: OptionProps) {
  const box = kind === "checkbox";
  const mark = (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-7 shrink-0 items-center justify-center box-border bg-canvas text-ink",
        box ? "rounded-lg" : "rounded-full",
        checked ? "border-0" : "border-2 border-solid border-ink-muted",
      )}
    >
      {checked ? <Icon name="check" size={18} strokeWidth={2.5} /> : null}
    </span>
  );
  return (
    <button
      type="button"
      role={kind}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        onChange(kind === "radio" ? true : !checked);
      }}
      className={cx(
        "flex w-full min-h-16 items-center gap-3 box-border rounded-field px-4 py-3 text-left text-body font-bold border-2 border-solid",
        checked ? "bg-ink text-on-ink border-ink" : "bg-neutral text-ink border-ink-muted",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      {box ? mark : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{children}</span>
        {hint ? (
          <span className={cx("text-label font-normal", checked ? "text-on-ink" : "text-ink-muted")}>{hint}</span>
        ) : null}
      </span>
      {box ? null : mark}
    </button>
  );
}

/** Groups radio Options; arrow keys move the choice, as a native radio group does. */
export function OptionGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(e.key)) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = radios[(i + step + radios.length) % radios.length];
    next.focus();
    next.click();
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cx("flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Choice pills */

/** A row of equal pills where one can be picked ("Too easy · Just right · Too hard"). */
export function ChoicePills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="sr-only">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={cx(
                "min-h-12 flex-[1_1_6rem] rounded-full border-2 border-solid px-3 text-label font-semibold",
                on ? "bg-ink text-on-ink border-ink" : "bg-canvas text-ink border-ink-muted",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Segmented */

/** Small one-of-many pill switcher (kg / lb, Wins / Weight / Strength / Photos). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  outlined = false,
  stretch = false,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** 2px muted edge (inside forms); plain neutral otherwise. */
  outlined?: boolean;
  /** Fill the width, each segment equal. */
  stretch?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "flex flex-wrap gap-1 rounded-[2rem] bg-neutral p-1 box-border",
        outlined && "border-2 border-solid border-ink-muted",
        stretch ? "w-full" : "w-fit",
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = options[(i + d + options.length) % options.length];
              onChange(next.value);
              const sib = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
              sib?.[(i + d + options.length) % options.length]?.focus();
            }}
            className={cx(
              "min-h-12 min-w-14 rounded-full px-4 text-body font-bold border-0",
              stretch && "flex-1",
              on ? "bg-ink text-on-ink" : "bg-transparent text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Switch */

export type SwitchProps = {
  label: ReactNode;
  /** Muted second line under the label. */
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Say "On"/"Off" next to the track (Today's big screen switch). */
  showState?: boolean;
  /** "plain" sits on a card; "boxed" is a neutral field with a 2px edge (About you). */
  variant?: "plain" | "boxed";
  className?: string;
};

/** 52x32 switch, whole row is the 48px+ tap area, role="switch". */
export function Switch({
  label,
  description,
  checked,
  onChange,
  showState = false,
  variant = "plain",
  className,
}: SwitchProps) {
  const descId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? descId : undefined}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 box-border text-left text-ink",
        variant === "boxed"
          ? "min-h-14 rounded-field border-2 border-solid border-ink-muted bg-neutral px-4 py-2 text-body font-bold leading-[1.4]"
          : "min-h-12 border-0 bg-transparent px-1 text-body font-semibold leading-[1.3]",
        className,
      )}
    >
      <span className="flex min-w-0 flex-[1_1_9rem] flex-col">
        <span>{label}</span>
        {description ? (
          <span id={descId} className="text-label font-normal leading-[1.3] text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-2.5">
        {showState ? (
          <span aria-hidden="true" className="text-label font-semibold">
            {checked ? "On" : "Off"}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className={cx(
            "flex h-8 w-[52px] shrink-0 items-center rounded-full box-border border-2 border-solid px-1",
            checked ? "justify-end bg-ink border-ink" : "justify-start bg-canvas",
            !checked && (variant === "boxed" ? "border-ink-muted" : "border-ink"),
          )}
        >
          <span
            className={cx(
              "size-5 rounded-full",
              checked ? "bg-canvas" : variant === "boxed" ? "bg-ink-muted" : "bg-ink",
            )}
          />
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ Stepper */

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What the number is, for screen readers, e.g. "reps". */
  unit: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** Show the value with this formatter (engine-provided text). */
  format?: (value: number) => string;
};

/** −/value/+ in one pill; the − and + are 48px circles; the value is a numeral. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  decreaseLabel = `One ${unit.replace(/s$/, "")} fewer`,
  increaseLabel = `One ${unit.replace(/s$/, "")} more`,
  format,
}: StepperProps) {
  const btn =
    "flex size-12 shrink-0 items-center justify-center rounded-full border-0 bg-neutral text-ink disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center justify-between gap-1 rounded-full bg-canvas p-1.5">
      <button
        type="button"
        aria-label={decreaseLabel}
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Icon name="minus" size={22} />
      </button>
      <output aria-live="polite" aria-label={`${format ? format(value) : value} ${unit}`} className="text-numeral font-extrabold tabular">
        {format ? format(value) : value}
      </output>
      <button
        type="button"
        aria-label={increaseLabel}
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Icon name="plus" size={22} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ TextField */

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: ReactNode;
  hint?: ReactNode;
  /** Unit shown inside the field on the right ("cm", "kg"). */
  unit?: string;
  error?: ReactNode;
};

/** Labelled input: neutral fill, 2px muted edge, radius 20, 56px, 16px+ text. */
export function TextField({ label, hint, unit, error, id, className, ...rest }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={fid} className="text-label font-semibold">
        {label}
      </label>
      <div className="flex min-h-14 items-center box-border rounded-field border-2 border-solid border-ink-muted bg-neutral px-4 focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-[var(--focus)]">
        <input
          id={fid}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="min-h-[52px] min-w-0 flex-1 border-0 bg-transparent p-0 text-ink outline-none"
          {...rest}
        />
        {unit ? <span className="text-body text-ink-muted">{unit}</span> : null}
      </div>
      {hint ? (
        <div id={hintId} className="text-label text-ink-muted">
          {hint}
        </div>
      ) : null}
      {error ? (
        <div id={errId} className="flex items-center gap-2 text-label text-ink">
          <Icon name="hurts" size={20} className="text-error shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
