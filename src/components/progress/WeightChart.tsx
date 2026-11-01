import Link from "next/link";
import type { selectWeightChart } from "@/lib/store";

type Chart = NonNullable<ReturnType<typeof selectWeightChart>>;

/**
 * Plain inline SVG: the bold average-weight line and pale weigh-in dots. All coordinates come
 * from selectWeightChart. Date labels sit under the SVG as text so they grow with the phone's text size.
 */
export function WeightChart({ chart, href }: { chart: Chart; href?: string }) {
  const svg = (
    <svg
      viewBox={chart.viewBox}
      width="100%"
      role={href ? undefined : "img"}
      aria-hidden={href ? true : undefined}
      aria-label={href ? undefined : chart.ariaLabel}
      className="block h-auto max-w-full"
    >
      {chart.dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={3.5} fill="var(--ink-muted)" />
      ))}
      <polyline
        points={chart.line}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={chart.end.cx} cy={chart.end.cy} r={6} fill="var(--ink)" />
    </svg>
  );
  const labels = (
    <div aria-hidden="true" className="flex justify-between gap-3 px-2 text-label font-semibold text-ink-muted">
      <span>{chart.startLabel.text}</span>
      <span>{chart.endLabel.text}</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} aria-label={`${chart.ariaLabel} Open weight history.`} className="flex flex-col gap-1 no-underline">
        {svg}
        {labels}
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {svg}
      {labels}
    </div>
  );
}

/** Key under the chart: Average weight · Weigh-ins (no dots when numbers are hidden). */
export function ChartKey({ dots }: { dots: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-label text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-1 w-3 rounded-sm bg-ink" />
        Average weight
      </span>
      {dots ? (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full bg-ink-muted" />
          Weigh-ins
        </span>
      ) : null}
    </div>
  );
}
