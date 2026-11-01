"use client";

import { Icon, Segmented, Switch, TextField, cx } from "@/components/ui";
import { checkAge, ftInFromCm, heightOk, parseNumber, resolveHeightCm, resolveWeightKg, weightIn, weightOk } from "@/lib/store";
import type { Profile, Units } from "@/lib/types";

/** What she has typed, in her units. Converted to metric only through the store helpers. */
export interface BodyDraft {
  age: string;
  cm: string;
  ft: string;
  inch: string;
  notSure: boolean;
  weight: string;
  noWeigh: boolean;
  units: Units;
  /** The stored numbers (metric). Kept exactly while the boxes still show them, whatever the unit. */
  storedKg: number | null;
  storedCm: number | null;
}

export function bodyDraft(p: Profile, units: Units): BodyDraft {
  const fi = p.heightCm ? ftInFromCm(p.heightCm) : null;
  return {
    age: p.age ? String(p.age) : "",
    cm: p.heightCm ? String(p.heightCm) : "",
    ft: fi ? String(fi.ft) : "",
    inch: fi ? String(fi.in) : "",
    notSure: p.age !== null && p.heightCm === null,
    weight: p.setupWeightKg ? String(weightIn(p.setupWeightKg, units.weight)) : "",
    noWeigh: p.noWeigh,
    units,
    storedKg: p.setupWeightKg ?? null,
    storedCm: p.heightCm ?? null,
  };
}

export type BodyErrors = Partial<Record<"age" | "height" | "weight", string>>;

export function readBody(d: BodyDraft) {
  const age = parseNumber(d.age);
  const ageCheck = checkAge(age);
  const heightCm = d.notSure
    ? null
    : resolveHeightCm({ unit: d.units.height, cm: d.cm, ft: d.ft, inch: d.inch }, d.storedCm);
  const kg = resolveWeightKg(d.weight, d.units.weight, d.storedKg);
  const errors: BodyErrors = {};
  if (ageCheck === "invalid") errors.age = "Type your age in years.";
  if (!d.notSure && !heightOk(heightCm)) errors.height = "Type your height, or tap Not sure.";
  if (!weightOk(kg)) errors.weight = "Type your weight. Roughly is fine.";
  return { age, ageCheck, heightCm, kg, errors };
}

/** Switch kg/lb or cm/ft without losing what she typed. */
function withUnits(d: BodyDraft, units: Units): BodyDraft {
  const r = readBody(d);
  // What she has typed so far becomes the number to keep, so switching back shows it unchanged.
  const next = { ...d, units, storedKg: r.kg ?? d.storedKg, storedCm: r.heightCm ?? d.storedCm };
  if (units.weight !== d.units.weight && r.kg !== null) next.weight = String(weightIn(r.kg, units.weight));
  if (units.height !== d.units.height && r.heightCm !== null) {
    const fi = ftInFromCm(r.heightCm);
    next.cm = String(r.heightCm);
    next.ft = String(fi.ft);
    next.inch = String(fi.in);
  }
  return next;
}

function Err({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <div id={id} className="flex items-center gap-2 text-label">
      <Icon name="hurts" size={20} className="shrink-0 text-error" />
      {children}
    </div>
  );
}

const box =
  "flex min-h-14 min-w-0 items-center box-border rounded-field border-2 border-solid border-ink-muted bg-neutral px-4 focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-[var(--focus)]";
const inputCls = "min-h-[52px] min-w-0 flex-1 border-0 bg-transparent p-0 text-ink outline-none";

/** A2 "About you" and S3 "Body and units": age, height or Not sure, rough weight, the no-weigh switch. */
export function BodyFields({
  draft,
  onChange,
  errors,
}: {
  draft: BodyDraft;
  onChange: (d: BodyDraft) => void;
  errors: BodyErrors;
}) {
  const set = (p: Partial<BodyDraft>) => onChange({ ...draft, ...p });
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Age"
        inputMode="numeric"
        autoComplete="off"
        value={draft.age}
        onChange={(e) => set({ age: e.target.value })}
        error={errors.age}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="body-height" className="text-label font-semibold">
            Height
          </label>
          {/* A2 and S3: cm or ft and in, starting from the phone's region, like the weight switch. */}
          <Segmented
            label="Height in"
            outlined
            options={[
              { value: "cm", label: "cm" },
              { value: "ftin", label: "ft and in" },
            ]}
            value={draft.units.height}
            onChange={(h) => onChange(withUnits(draft, { ...draft.units, height: h }))}
          />
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {draft.units.height === "cm" ? (
            <div className={cx(box, "flex-[1_1_8rem]", draft.notSure && "opacity-60")}>
              <input
                id="body-height"
                inputMode="numeric"
                className={inputCls}
                value={draft.notSure ? "" : draft.cm}
                disabled={draft.notSure}
                aria-describedby="body-height-hint body-height-err"
                onChange={(e) => set({ cm: e.target.value })}
              />
              <span className="text-body text-ink-muted">cm</span>
            </div>
          ) : (
            <>
              <div className={cx(box, "flex-[1_1_5rem]", draft.notSure && "opacity-60")}>
                <input
                  id="body-height"
                  inputMode="numeric"
                  className={inputCls}
                  value={draft.notSure ? "" : draft.ft}
                  disabled={draft.notSure}
                  aria-describedby="body-height-hint body-height-err"
                  onChange={(e) => set({ ft: e.target.value })}
                />
                <span className="text-body text-ink-muted">ft</span>
              </div>
              <div className={cx(box, "flex-[1_1_5rem]", draft.notSure && "opacity-60")}>
                <input
                  aria-label="Inches"
                  inputMode="numeric"
                  className={inputCls}
                  value={draft.notSure ? "" : draft.inch}
                  disabled={draft.notSure}
                  onChange={(e) => set({ inch: e.target.value })}
                />
                <span className="text-body text-ink-muted">in</span>
              </div>
            </>
          )}
          <button
            type="button"
            aria-pressed={draft.notSure}
            aria-describedby="body-height-hint"
            onClick={() => set({ notSure: !draft.notSure })}
            className={cx(
              "min-h-14 flex-none rounded-full border-2 border-solid px-5 text-body font-bold",
              draft.notSure ? "border-ink bg-ink text-on-ink" : "border-ink-muted bg-neutral text-ink",
            )}
          >
            Not sure
          </button>
        </div>
        <div id="body-height-hint" className="text-label text-ink-muted">
          Not sure? We use an average.
        </div>
        <Err id="body-height-err">{errors.height}</Err>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="body-weight" className="text-label font-semibold">
            Weight
          </label>
          <Segmented
            label="Weight in"
            outlined
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
            value={draft.units.weight}
            onChange={(w) => onChange(withUnits(draft, { ...draft.units, weight: w }))}
          />
        </div>
        <div className={box}>
          <input
            id="body-weight"
            inputMode="decimal"
            className={inputCls}
            value={draft.weight}
            aria-describedby="body-weight-hint body-weight-err"
            onChange={(e) => set({ weight: e.target.value })}
          />
          <span className="text-body text-ink-muted">{draft.units.weight}</span>
        </div>
        <div id="body-weight-hint" className="text-label text-ink-muted">
          Roughly is fine.
        </div>
        <Err id="body-weight-err">{errors.weight}</Err>
      </div>

      <div className="flex flex-col gap-1">
        <Switch variant="boxed" label="I'd rather not weigh myself" checked={draft.noWeigh} onChange={(on) => set({ noWeigh: on })} />
        <p className="m-0 text-label text-ink-muted">
          On: we never ask you to weigh in and never show your weight. We still need this rough number once.
        </p>
      </div>
    </div>
  );
}
