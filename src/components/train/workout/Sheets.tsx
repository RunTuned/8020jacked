"use client";

import { useEffect, useState } from "react";
import { Button, Sheet } from "@/components/ui";
import { selectActiveHurtOptions, undoVisible, useAppStore, type ActiveWorkout } from "@/lib/store";

/* ------------------------------------------------------------------ W4 Paused */

export function PauseSheet({
  open,
  a,
  onKeepGoing,
  onKeep,
  onDiscard,
}: {
  open: boolean;
  a: ActiveWorkout;
  onKeepGoing: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setConfirm(false);
    onKeepGoing();
  };
  const taster = a.workout.taster;
  return (
    <Sheet open={open} onClose={close} title="Paused" closeLabel="Keep going">
      <p className="m-0 text-body">
        {a.minutesDone} min done · {a.doneSets} of {a.totalSets} sets
      </p>
      {confirm ? (
        <>
          <p className="m-0 text-body font-bold">Nothing from this workout is saved.</p>
          <Button block onClick={onDiscard}>
            Stop, don&apos;t save
          </Button>
          <Button variant="secondary" block onClick={close}>
            Keep going
          </Button>
        </>
      ) : (
        <>
          <Button block onClick={close}>
            Keep going
          </Button>
          <Button variant="secondary" block onClick={onKeep}>
            Stop here, keep what I did
          </Button>
          {!taster ? (
            <p className="m-0 text-label text-ink-muted">
              A part workout counts as done for the week. It doesn&apos;t move the plan up.
            </p>
          ) : null}
          <Button variant="secondary" block onClick={() => (taster ? onDiscard() : setConfirm(true))}>
            Stop, don&apos;t save
          </Button>
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ W5 Swap this move */

export function HurtSheet({
  open,
  a,
  hurtId,
  slot,
  setAside,
  onUndo,
  onCancel,
  onClose,
}: {
  open: boolean;
  a: ActiveWorkout;
  /** The move she tapped Hurts on (the current move, after any swap). */
  hurtId: string;
  /** Which move in the workout it was. */
  slot: number;
  setAside: boolean;
  onUndo: () => void;
  /** Cancel (and the close button) change nothing: the hurt is taken back. */
  onCancel: () => void;
  /** After a swap is picked. */
  onClose: () => void;
}) {
  const s = useAppStore();
  const swapToday = useAppStore((x) => x.swapToday);
  const options = selectActiveHurtOptions(s, hurtId);
  const [undoOn, setUndoOn] = useState(() => undoVisible(s.ui.undo) && s.ui.undo?.kind === "hurt");
  useEffect(() => {
    if (!undoOn || !s.ui.undo) return;
    const t = window.setTimeout(() => setUndoOn(false), Math.max(0, s.ui.undo.expiresAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [undoOn, s.ui.undo]);

  const pick = (toId: string) => {
    const from = a.moves[slot]?.originId ?? hurtId;
    swapToday(from, toId);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onCancel} title="Swap this move" closeLabel="Cancel">
      <div
        role="status"
        className="on-bar flex min-h-12 flex-wrap items-center justify-between gap-x-2 rounded-full bg-ink py-0 pl-4 pr-1 text-label text-on-ink"
      >
        <span className="py-2">Hurts saved</span>
        {undoOn ? (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex min-h-12 items-center border-0 bg-transparent px-3 font-bold text-on-ink underline underline-offset-[3px] whitespace-nowrap"
          >
            Undo (5 sec)
          </button>
        ) : null}
      </div>
      {setAside ? (
        <p className="m-0 text-body">That&apos;s twice, so it&apos;s set aside. Bring it back in Moves I&apos;ve set aside.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <Button key={o.id} variant="secondary" block onClick={() => pick(o.id)}>
            {o.name}
          </Button>
        ))}
      </div>
      <Button variant="text" onClick={onCancel} className="self-start">
        Cancel
      </Button>
    </Sheet>
  );
}
