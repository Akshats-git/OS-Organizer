"use client";

import { useState } from "react";
import { lineVar } from "@/lib/lines";
import { formatDate } from "@/lib/time";

/** Eight weeks of activity as thin daily bars in the repo's line color. */
export function ActivityBars({ days, colorIndex, label }: { days: { date: string; count: number }[]; colorIndex: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(3, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;

  return (
    <figure className="relative">
      <div
        role="img"
        aria-label={`${label}: ${total} activities on ${active} of the last ${days.length} days`}
        className="relative flex h-14 items-end gap-[2px] border-b border-rule-strong"
        onMouseLeave={() => setHover(null)}
      >
        {days.map((d, i) => (
          <div key={d.date} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-t-[2px] transition-opacity duration-150"
              style={{
                height: d.count ? `${Math.max(14, (d.count / max) * 100)}%` : "2px",
                background: d.count ? lineVar(colorIndex) : "var(--rule)",
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-page shadow-float"
          style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
        >
          {formatDate(days[hover].date, { weekday: "short", month: "short", day: "numeric" })}: {days[hover].count || "no"} {days[hover].count === 1 ? "activity" : "activities"}
        </div>
      )}
      <figcaption className="mt-1.5 flex justify-between text-[0.6875rem] text-ink-3">
        <span>8 weeks ago</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
