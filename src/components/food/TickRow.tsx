"use client";

import { useState, type ReactNode } from "react";
import { Button, Icon, cx } from "@/components/ui";
import { shareOrCopy } from "@/lib/device";

/** One tickable list line: a 48px+ row with a box, the item and muted lines under it. */
export function TickRow({
  ticked,
  onTick,
  name,
  amount,
  lines,
}: {
  ticked: boolean;
  onTick: () => void;
  name: ReactNode;
  amount?: ReactNode;
  lines?: ReactNode[];
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={ticked}
        onClick={onTick}
        className="flex min-h-14 w-full items-start gap-3 border-0 bg-transparent px-1 py-2.5 text-left text-ink"
      >
        <span
          aria-hidden="true"
          className={cx(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-solid",
            ticked ? "border-ink bg-ink text-on-ink" : "border-ink-muted bg-canvas",
          )}
        >
          {ticked ? <Icon name="check" size={18} strokeWidth={2.5} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx("text-body font-semibold", ticked && "text-ink-muted line-through")}>
            {name}
            {amount ? <span className="font-normal text-ink-muted">{` · ${amount}`}</span> : null}
          </span>
          {lines?.filter(Boolean).map((l, i) => (
            <span key={i} className="text-label text-ink-muted">
              {l}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

/** "Share list": the phone's share sheet, or copy when there is none. */
export function ShareButton({ title, text }: { title: string; text: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        block
        icon="share"
        onClick={async () => {
          const r = await shareOrCopy({ title, text });
          setNote(r === "copied" ? "Copied. Paste it where you like." : r === "failed" ? "Couldn't share. Try again." : null);
        }}
      >
        Share list
      </Button>
      <p role="status" className="m-0 min-h-[1.45em] text-center text-label text-ink-muted">
        {note}
      </p>
    </div>
  );
}
