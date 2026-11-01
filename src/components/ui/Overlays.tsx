"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ Sheet */

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Label for the close circle. */
  closeLabel?: string;
};

/**
 * Bottom sheet on a native modal <dialog>: focus is trapped and returned, Escape closes,
 * a tap on the scrim closes. Sheet panel with 30px top corners and a 48px neutral Close circle.
 */
export function Sheet({ open, onClose, title, children, closeLabel = "Close" }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the dialog element itself (not its panel) is a click on the scrim.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col gap-4 px-5 pt-5"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="m-0 self-center text-title font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-0 bg-neutral text-ink"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ UndoToast */

export type UndoToastProps = {
  message: ReactNode;
  onUndo: () => void;
  /** Called when the time runs out without Undo. */
  onExpire?: () => void;
  /** Milliseconds; 5 s by default. */
  duration?: number;
  /** Float above the tab bar instead of sitting in the page flow. */
  floating?: boolean;
  /** Change this to restart the timer for a new action. */
  id?: string | number;
};

/** Ink pill: the message, an "Undo" button, and a bar that shrinks over 5 seconds. */
export function UndoToast({ message, onUndo, onExpire, duration = 5000, floating, id }: UndoToastProps) {
  const [done, setDone] = useState(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const started = Date.now();
    const t = window.setTimeout(() => {
      setDone(true);
      expire.current?.();
    }, duration);
    // If the phone sleeps past the deadline, expire as soon as it wakes.
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - started >= duration) {
        window.clearTimeout(t);
        setDone(true);
        expire.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      setDone(false);
    };
  }, [duration, id]);

  if (done) return null;

  return (
    <div
      role="status"
      className={cx(
        "on-bar relative overflow-hidden rounded-full bg-ink text-on-ink",
        floating && "fixed z-50 mx-auto max-w-[38rem]",
      )}
      style={
        floating
          ? {
              left: "max(16px, env(safe-area-inset-left))",
              right: "max(16px, env(safe-area-inset-right))",
              bottom: "calc(var(--bar-h) + 28px + env(safe-area-inset-bottom))",
            }
          : undefined
      }
    >
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-2 py-0 pl-4 pr-1 text-label">
        <span className="py-2">{message}</span>
        <button
          type="button"
          onClick={() => {
            setDone(true);
            onUndo();
          }}
          className="inline-flex min-h-12 items-center border-0 bg-transparent px-3 font-bold text-on-ink underline underline-offset-[3px] whitespace-nowrap"
        >
          Undo
        </button>
      </div>
      <span
        key={id}
        aria-hidden="true"
        className="undo-bar absolute bottom-0 left-4 right-4 block h-[3px] rounded-full bg-on-ink"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}
