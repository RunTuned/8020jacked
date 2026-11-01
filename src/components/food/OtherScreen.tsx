"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Hero, Option, OptionGroup, Screen, Subline, TopRow } from "@/components/ui";
import { selectNextMeal, selectToday, useAppStore } from "@/lib/store";
import type { MealSize } from "@/lib/types";
import { safeBack, useHydrated } from "@/components/today/hooks";
import { BentoSkeleton } from "@/components/today/Skeleton";

const SIZES: { value: MealSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "same", label: "Same as my meal" },
  { value: "big", label: "Big" },
];

/** F6 (home or bought?) then F7 (how big was it?). The step is mirrored in ?step= so a reload resumes. */
export function OtherScreen() {
  const hydrated = useHydrated();
  const st = useAppStore();
  const router = useRouter();
  const sp = useSearchParams();
  const back = safeBack(sp.get("back"), "/food");
  const step = sp.get("step") === "size" ? "size" : "where";
  const where = sp.get("where") === "bought" ? "bought" : "home";
  const [size, setSize] = useState<MealSize | null>(null);

  if (!hydrated) return <BentoSkeleton cards={1} />;

  const date = sp.get("date") ?? selectToday(st);
  const slotParam = sp.get("slot");
  const slot = slotParam !== null && /^\d+$/.test(slotParam) ? Number(slotParam) : (selectNextMeal(st).meal?.slot.index ?? null);

  const go = (p: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) q.set(k, v);
    router.replace(`/food/other?${q.toString()}`);
  };

  if (step === "where") {
    return (
      <Screen>
        <TopRow back={{ href: back, label: "Cancel" }}>
          <Hero title="Something else" subline="Home or bought?" />
        </TopRow>
        <div className="flex flex-col gap-3">
          <Button block onClick={() => go({ step: "size", where: "home" })}>
            Made at home
          </Button>
          <Button variant="secondary" block onClick={() => go({ step: "size", where: "bought" })}>
            Bought or eaten out
          </Button>
        </div>
        <Button variant="secondary" block href={back} className="mt-auto">
          Cancel
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopRow back={{ onClick: () => go({ step: "where" }) }}>
        <Hero title="How big was it?" />
      </TopRow>
      <OptionGroup label="How big was it?">
        {SIZES.map((s) => (
          <Option key={s.value} checked={size === s.value} onChange={() => setSize(s.value)}>
            {s.label}
          </Option>
        ))}
      </OptionGroup>
      <Subline>Counts as logged. Your plan stays the same.</Subline>
      <div className="mt-auto flex flex-col gap-3">
        <Button
          block
          disabled={!size || slot === null}
          onClick={() => {
            if (!size || slot === null) return;
            st.logMeal(slot, "else", { where, size, date });
            router.push(back);
          }}
        >
          Done
        </Button>
        <Button variant="secondary" block onClick={() => go({ step: "where" })}>
          Back
        </Button>
      </div>
    </Screen>
  );
}
