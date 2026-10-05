import clsx from "clsx";
import type { Stage, Workflow } from "@/db/schema";
import { lineVar } from "@/lib/lines";
import { STATION_LABELS, WORKFLOW_STATIONS } from "@/lib/stages";

/**
 * A compact strip of a repo's stations. Stations with a loop on them get a
 * larger stop with an ink center; stations already passed are filled.
 */
export function MiniLine({
  workflow,
  colorIndex,
  occupied,
  labels = false,
  className,
}: {
  workflow: Workflow;
  colorIndex: number;
  occupied: Stage[];
  labels?: boolean;
  className?: string;
}) {
  const stations = WORKFLOW_STATIONS[workflow];
  const furthest = Math.max(-1, ...occupied.map((s) => stations.indexOf(s)));
  const color = lineVar(colorIndex);
  const label = occupied.length
    ? `Loops at ${[...new Set(occupied)].map((s) => STATION_LABELS[s]).join(", ")}`
    : "No loops in motion";

  return (
    <div className={clsx("min-w-0", className)}>
      <div role="img" aria-label={label} className="relative flex h-5 items-center">
        <span className="absolute inset-x-[6px] top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: color, opacity: occupied.length ? 1 : 0.35 }} />
        <div className="relative flex w-full justify-between">
          {stations.map((s, i) => {
            const here = occupied.includes(s);
            const passed = i < furthest;
            return (
              <span
                key={s}
                className={clsx("grid place-items-center rounded-full border-[3px]", here ? "size-[18px]" : "size-3")}
                style={{ borderColor: color, background: passed && !here ? color : "var(--panel)" }}
              >
                {here && <span className="size-1.5 rounded-full bg-ink" />}
              </span>
            );
          })}
        </div>
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between">
          {stations.map((s) => (
            <span key={s} className={clsx("type-display text-[0.8125rem]", occupied.includes(s) ? "text-ink" : "text-ink-3")}>
              {STATION_LABELS[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
