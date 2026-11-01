"use client";

import { useState } from "react";
import { Button, Card, Hero, Screen, Segmented, Sheet, Stack, TextField, TopRow } from "@/components/ui";
import { CHART_RANGE_LABELS, kgFromInput, selectWeight, selectWeightRows, type ChartRange } from "@/lib/store";
import { WEIGH_IN_HREF, WeightCard } from "./cards";
import { BentoSkeleton, Row, useHydrated, useStore } from "./parts";

const RANGES = (Object.keys(CHART_RANGE_LABELS) as ChartRange[]).map((value) => ({ value, label: CHART_RANGE_LABELS[value] }));

/** P2: weight history. Tap a weigh-in: Edit · Delete. */
export function WeightHistory() {
  const hydrated = useHydrated();
  const s = useStore();
  const [range, setRange] = useState<ChartRange>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "delete">("edit");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const back = { href: "/progress?view=weight", label: "Back to Progress" };
  if (!hydrated)
    return (
      <Screen>
        <BentoSkeleton />
      </Screen>
    );

  const w = selectWeight(s);
  if (w.hidden) {
    return (
      <Screen>
        <TopRow back={back} />
        <Hero title="Weight history" subline="You chose not to weigh yourself, so there's nothing here." />
        <Button href="/you/body" variant="secondary">
          Change this in You
        </Button>
      </Screen>
    );
  }

  const rows = selectWeightRows(s);
  const row = rows.find((r) => r.date === open) ?? null;
  const unit = s.settings.units.weight;

  const openRow = (date: string, input: string) => {
    setOpen(date);
    setMode("edit");
    setValue(input);
    setError(null);
  };
  const save = () => {
    const kg = kgFromInput(value, unit);
    if (kg === null || !row) {
      setError(`Type your weight in ${unit}, for example ${unit === "kg" ? "72.4" : "160"}.`);
      return;
    }
    s.editWeighIn(row.date, kg);
    setOpen(null);
  };

  return (
    <Screen>
      <TopRow back={back} />
      <Hero title="Weight history" />
      <Stack>
        <Segmented label="Show" options={RANGES} value={range} onChange={setRange} stretch />
        <WeightCard s={s} range={range} weighIn={false} />
        <Button href={WEIGH_IN_HREF} block>
          Add weigh-in
        </Button>
        {rows.length ? (
          <Card tone="neutral" title="Weigh-ins" detail="One a day counts. Tap one to edit or delete it." label="Weigh-ins">
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {rows.map((r) => (
                <li key={r.date}>
                  <button
                    type="button"
                    onClick={() => openRow(r.date, r.input)}
                    className="w-full border-0 bg-transparent p-0 text-left"
                    aria-label={`${r.dateText}${r.kgText ? `, ${r.kgText}` : ""}. Edit or delete`}
                  >
                    <Row title={r.kgText ?? "Weighed in"} detail={r.dateText} href={null} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </Stack>

      <Sheet open={!!row} onClose={() => setOpen(null)} title={row ? row.dateText : ""}>
        {row && mode === "edit" ? (
          <>
            <TextField
              label="Weight"
              unit={unit}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              error={error}
            />
            <Button block onClick={save}>
              Save
            </Button>
            <Button variant="text" onClick={() => setMode("delete")}>
              Delete this weigh-in
            </Button>
          </>
        ) : null}
        {row && mode === "delete" ? (
          <>
            <p className="m-0 text-body">Delete this weigh-in? This can&apos;t be undone.</p>
            <Button
              block
              onClick={() => {
                s.deleteWeighIn(row.date);
                setOpen(null);
              }}
            >
              Delete
            </Button>
            <Button variant="text" onClick={() => setMode("edit")}>
              Keep it
            </Button>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
