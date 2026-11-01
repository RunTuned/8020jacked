"use client";

import { Button, Card } from "@/components/ui";
import {
  selectPhotos,
  selectStrength,
  selectWeightCard,
  selectWeightChart,
  selectWinItems,
  type ChartRange,
} from "@/lib/store";
import type { AppState } from "@/lib/types";
import { Row } from "./parts";
import { PhotoImage } from "./photo";
import { ChartKey, WeightChart } from "./WeightChart";

export const WEIGH_IN_HREF = "/today/weigh-in";

/** P1 Weight view / P2 top: average weight, change since start, the chart. No goal line, no forecast. */
export function WeightCard({ s, range = "all", chartHref, weighIn = true }: { s: AppState; range?: ChartRange; chartHref?: string; weighIn?: boolean }) {
  const c = selectWeightCard(s);
  const chart = selectWeightChart(s, range);
  return (
    <Card tone="pink" icon="progress" title={c.title} detail={c.detail} label="Average weight">
      {chart ? (
        <>
          <WeightChart chart={chart} href={chartHref} />
          <ChartKey dots={chart.dots.length > 0} />
        </>
      ) : null}
      {weighIn ? (
        <Button href={WEIGH_IN_HREF} variant="secondary" block className="text-body! font-bold!">
          Weigh in
        </Button>
      ) : null}
    </Card>
  );
}

/** P5 wins: workouts, skills, check-in answers. Never weight. */
export function WinsCard({ s, title = "Your wins", limit }: { s: AppState; title?: string; limit?: number }) {
  const w = selectWinItems(s);
  const items = limit ? w.items.slice(0, limit) : w.items;
  return (
    <Card tone="neutral" icon="flag" title={title} label={title}>
      {limit ? null : <p className="m-0 text-body font-bold">{w.summary}</p>}
      {items.length ? (
        <div className="flex flex-col gap-1">
          {items.map((i) => (
            <Row key={i.key} title={i.title} detail={i.detail} href={i.href} strong={i.strong} />
          ))}
        </div>
      ) : limit ? (
        <p className="m-0 text-body">{w.summary}</p>
      ) : null}
    </Card>
  );
}

/** P1 Strength view. Rows aren't links: the move history and skills screens are cut from v0.1. */
export function StrengthCard({ s }: { s: AppState }) {
  const st = selectStrength(s);
  return (
    <>
      <Card tone="blue" icon="train" title="Moves that got stronger" label="Moves that got stronger">
        {st.empty ? (
          <p className="m-0 text-body">Finish a few workouts and your stronger moves show up here.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {st.ups.map((u) => (
              <Row key={u.key} title={u.title} detail={u.detail} />
            ))}
          </div>
        )}
      </Card>
      <Card tone="neutral" icon="flag" title="Your skills" label="Your skills">
        <div className="flex flex-col gap-1">
          {st.skills.map((k) => (
            <Row key={k.key} title={k.title} detail={`${k.detail}. ${k.next}`} />
          ))}
        </div>
      </Card>
    </>
  );
}

/** P1 Photos view: a look at the latest two, then P3 to add or compare. */
export function PhotosCard({ s }: { s: AppState }) {
  const p = selectPhotos(s);
  const two = p.list.slice(0, 2);
  return (
    <Card
      tone="lime"
      icon="you"
      title={p.on ? "Progress photos" : "Progress photos: off"}
      detail={p.on ? (p.count ? null : "No photos yet.") : "Private, on this phone only. Off until you turn it on."}
      label="Progress photos"
    >
      {p.on && two.length ? (
        <div className="grid grid-cols-2 gap-3">
          {two.map((x) => (
            <figure key={x.id} className="m-0 flex flex-col gap-1">
              <PhotoImage id={x.id} alt={`Photo from ${x.dateText}`} className="aspect-[3/4] w-full rounded-[20px] object-cover" />
              <figcaption className="text-label text-ink-muted">{x.dateText}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <Button href="/progress/photos" variant="secondary" block className="text-body! font-bold!">
        {p.on ? "Add or compare" : "Turn on photos"}
      </Button>
    </Card>
  );
}

export function CheckInHistoryLink() {
  return <Card tone="aqua" icon="calendar" title="Check-in history" href="/progress/check-ins" />;
}
