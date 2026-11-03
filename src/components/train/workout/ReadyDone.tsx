"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Card, ChoicePills, Hero, Screen, Stepper, TopRow } from "@/components/ui";
import { copyText } from "@/lib/device";
import { sessionKits, selectWorkoutSummary, useAppStore } from "@/lib/store";
import type { Effort, ExerciseKit, PlannedSession } from "@/lib/types";
import { EFFORT_OPTIONS, amount, sideWords } from "../common";

const KIT_WORDS: Partial<Record<ExerciseKit, string>> = { band: "a band", dumbbell: "dumbbells", bar: "a bar", chair: "a chair" };

/* ------------------------------------------------------------------ W2 Before you start */

export function Ready({
  session,
  backHref,
  canStart,
  onHow,
  onStart,
}: {
  session: PlannedSession;
  backHref: string;
  canStart: boolean;
  onHow: (exerciseId: string) => void;
  onStart: () => void;
}) {
  const kits = sessionKits(session).map((k) => KIT_WORDS[k] ?? k);
  const kitLine = kits.length ? `you need ${kits.join(" and ")}` : "no kit needed";
  const main = session.moves.filter((m) => m.pattern !== "core");
  const core = session.moves.filter((m) => m.pattern === "core");
  const setsEach = main[0]?.sets.length ?? 0;
  const same = main.every((m) => m.sets.length === setsEach);
  const sets = (n: number) => `${n} ${n === 1 ? "set" : "sets"}`;
  const shape = same
    ? `${main.length} moves × ${sets(setsEach)}${core.length ? ` + core × ${sets(core[0].sets.length)}` : ""}`
    : `${session.moves.length} moves · ${sets(session.totalSets)}`;

  return (
    <Screen>
      <TopRow back={{ href: backHref }} label="Before you start" />
      <Hero title={session.name} />
      <Card tone="blue" icon="train" title={`${shape} · about ${session.estMinutes} min${session.easy ? " · easy week" : ""} · ${kitLine}`} label="This workout">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {session.moves.map((m) => (
            <li key={m.exerciseId}>
              <button
                type="button"
                onClick={() => onHow(m.exerciseId)}
                className="flex min-h-12 w-full flex-wrap items-center justify-between gap-x-3 rounded-[20px] border-0 bg-canvas px-4 py-2 text-left text-ink"
              >
                <span className="text-body font-bold">{m.name}</span>
                <span className="text-label text-ink-muted">
                  {m.sets.length} × {amount(m.sets[0].target, m.unit)}
                  {m.perSide ? ` ${sideWords(true, m.pattern)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-auto flex flex-col gap-2">
        {canStart ? (
          <Button block onClick={onStart}>
            Start
          </Button>
        ) : (
          <p className="m-0 text-body font-bold">Done for today. Next one shows tomorrow.</p>
        )}
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ W7 Well done */

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function Done({ part, onFinish }: { part: boolean; onFinish: (effort: Effort | undefined) => void }) {
  const s = useAppStore();
  const fixSet = useAppStore((x) => x.fixSet);
  const sum = selectWorkoutSummary(s);
  const [effort, setEffort] = useState<Effort | null>(null);
  const [fixing, setFixing] = useState(false);
  const [copied, setCopied] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (!sum) return null;

  const best = sum.newBests[0];
  const line = [`${sum.minutesDone} min`, `${sum.setsDone} sets`, best ? `new best: ${best.name.toLowerCase()} ${best.value}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen>
      <Hero title="Well done" subline={sum.name} />
      <Card tone="blue" icon="check" title={line} label="What you did" />
      <div className="flex flex-col gap-3">
        <Button variant="secondary" block onClick={() => setFixing((f) => !f)} aria-expanded={fixing}>
          Fix a set&apos;s reps or seconds
        </Button>
        {fixing
          ? sum.moves.map((m) => (
              <section key={m.exerciseId} aria-label={m.name} className="flex flex-col gap-3 rounded-card bg-neutral p-5">
                <div className="text-body font-bold">{m.name}</div>
                {m.sets.map((x) => (
                  <div key={x.setIndex} className="flex flex-col gap-1">
                    <span className="text-label font-semibold text-ink-muted">Set {x.setIndex + 1}</span>
                    <Stepper
                      value={x.value}
                      onChange={(v) => fixSet(sum.workoutId, m.exerciseId, x.setIndex, v)}
                      min={0}
                      max={300}
                      step={m.unit === "seconds" ? 5 : 1}
                      unit={m.unit === "seconds" ? "seconds" : "reps"}
                      decreaseLabel={m.unit === "seconds" ? "5 seconds fewer" : "One rep fewer"}
                      increaseLabel={m.unit === "seconds" ? "5 seconds more" : "One rep more"}
                    />
                  </div>
                ))}
              </section>
            ))
          : null}
      </div>
      <Card tone="neutral" title="How was it?" label="How was it?">
        <ChoicePills label="How was it?" options={EFFORT_OPTIONS} value={effort} onChange={setEffort} />
      </Card>
      {!online ? <p className="m-0 text-label text-ink-muted">Saved on phone.</p> : null}
      <div className="mt-auto flex flex-col gap-2">
        {sum.taster ? (
          <Button block onClick={() => onFinish(effort ?? undefined)}>
            Save your progress
          </Button>
        ) : (
          <>
            <Button block onClick={() => onFinish(effort ?? undefined)}>
              Done for today
            </Button>
            <Button
              variant="secondary"
              block
              onClick={async () => {
                await copyText(sum.shareText);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy result to share"}
            </Button>
          </>
        )}
      </div>
      {part ? <span className="sr-only">Part workout</span> : null}
    </Screen>
  );
}
