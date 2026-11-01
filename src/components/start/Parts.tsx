"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Icon, Option, ProgressBar, Sheet, TopRow, cx } from "@/components/ui";
import { useAppStore } from "@/lib/store";
import type { Allergen, Equipment } from "@/lib/types";
import { ALLERGENS } from "@/lib/types";
import { ALLERGY_LABEL, EQUIPMENT } from "./copy";
import { Skeleton } from "./Skeleton";
import { useHydrated } from "./useHydrated";

/** Shows the screen once the store has loaded; a bento skeleton until then. */
export function Hydrated({ children }: { children: ReactNode }) {
  return useHydrated() ? <>{children}</> : <Skeleton />;
}

/** Back circle, "Step 1 of 6 · Saved as you go", and the progress bar (OnboardingYou board). */
export function StepHeader({ back, step, total = 6 }: { back: { href?: string; onClick?: () => void }; step?: number; total?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <TopRow back={back} end={step ? `Step ${step} of ${total} · Saved as you go` : undefined} />
      {step ? <ProgressBar value={step} max={total} label={`Step ${step} of ${total}`} /> : null}
    </div>
  );
}

/** Pinned to the bottom of the screen (onboarding "Next"). */
export function Bottom({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3">{children}</div>;
}

/** A6, S4: what you have at home. "No floor" and "Floor space" can't both be on. */
export function EquipmentChoices({ value, onChange }: { value: Equipment[]; onChange: (v: Equipment[]) => void }) {
  return (
    <div role="group" aria-label="What you have at home" className="flex flex-col gap-2">
      {EQUIPMENT.map((e) => (
        <Option
          key={e.value}
          kind="checkbox"
          checked={value.includes(e.value)}
          onChange={(on) => {
            let next = value.filter((x) => x !== e.value);
            if (on) {
              next = [...next, e.value];
              if (e.value === "floor") next = next.filter((x) => x !== "noFloor");
              if (e.value === "noFloor") next = next.filter((x) => x !== "floor");
            }
            onChange(next);
          }}
        >
          {e.label}
        </Option>
      ))}
    </div>
  );
}

/** A7, S5: allergies, list shown open, none ticked at the start. */
export function AllergyChoices({ value, onChange }: { value: Allergen[]; onChange: (v: Allergen[]) => void }) {
  return (
    <div role="group" aria-label="Allergies" className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
      {ALLERGENS.map((a) => (
        <Option
          key={a}
          kind="checkbox"
          checked={value.includes(a)}
          onChange={(on) => onChange(on ? [...value, a] : value.filter((x) => x !== a))}
        >
          {ALLERGY_LABEL[a]}
        </Option>
      ))}
    </div>
  );
}

/** A11 (v0.1) and S9: pick the downloaded file and bring the progress back. */
export function ImportButton({ onDone, variant = "primary" }: { onDone: () => void; variant?: "primary" | "secondary" }) {
  const importData = useAppStore((s) => s.importData);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const r = importData(await f.text());
          if (r.ok) {
            setError(null);
            onDone();
          } else setError(r.error);
        }}
      />
      <Button variant={variant} block icon="plus" onClick={() => input.current?.click()}>
        Bring back my progress
      </Button>
      {error ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-label">
          <Icon name="hurts" size={20} className="shrink-0 text-error" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Terms and privacy note (A3, S9). Test-version wording until the real pages are written. */
export function TermsLinks({ className }: { className?: string }) {
  const [open, setOpen] = useState<"terms" | "privacy" | null>(null);
  return (
    <div className={cx("flex flex-wrap gap-x-6", className)}>
      <Button variant="text" onClick={() => setOpen("terms")}>
        Read the terms
      </Button>
      <Button variant="text" onClick={() => setOpen("privacy")}>
        Read the privacy note
      </Button>
      <Sheet open={open === "terms"} onClose={() => setOpen(null)} title="Terms">
        <p className="m-0">This is a test version, free to use.</p>
        <p className="m-0">
          It is a general fitness and eating plan for healthy adults 18 and over. If you&apos;re pregnant, injured, or
          have a health condition, check with your doctor first.
        </p>
        <p className="m-0 text-ink-muted">The full terms come before the app opens to everyone.</p>
      </Sheet>
      <Sheet open={open === "privacy"} onClose={() => setOpen(null)} title="Privacy note">
        <p className="m-0">Everything you type stays on this phone. Nothing is sent to us.</p>
        <p className="m-0">You can download it or delete it any time in You → My data and account.</p>
      </Sheet>
    </div>
  );
}
