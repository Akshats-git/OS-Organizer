import clsx from "clsx";
import { LineBullet } from "@/components/line-bullet";
import { lineVar } from "@/lib/lines";
import { orgCode, orgColorIndex, type Cadence } from "@/lib/directory-shared";

const TONE: Record<Cadence["tone"], string> = {
  good: "bg-ok-bg text-ok",
  mid: "bg-soon-bg text-soon",
  new: "bg-panel-2 text-focus",
  quiet: "bg-panel-2 text-ink-2",
};

/** How regularly an organization comes back, as a small colored tag. */
export function CadenceBadge({ cadence, className }: { cadence: Cadence; className?: string }) {
  return (
    <span className={clsx("chip", TONE[cadence.tone], className)} title={cadence.detail}>
      {cadence.label}
    </span>
  );
}

/** An organization's roundel: two letters on the line color it keeps everywhere. */
export function OrgRoundel({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return <LineBullet code={orgCode(name)} colorIndex={orgColorIndex(id)} size={size} />;
}

/**
 * A row of dots, one per year, filled where the organization took part. Small
 * enough to sit beside a name, so a list can be scanned for steady attendees.
 */
export function YearStrip({
  years,
  first,
  last,
  colorIndex,
  className,
}: {
  years: number[];
  first: number;
  last: number;
  colorIndex: number;
  className?: string;
}) {
  const attended = new Set(years);
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const summary = years.length ? `Took part in ${years.join(", ")}` : "No years on record";
  return (
    <span role="img" aria-label={summary} title={summary} className={clsx("inline-flex items-center gap-[3px]", className)}>
      {all.map((y) => (
        <span
          key={y}
          aria-hidden
          className={clsx("block size-[7px] rounded-full", !attended.has(y) && "bg-rule-strong/70")}
          style={attended.has(y) ? { background: lineVar(colorIndex) } : undefined}
        />
      ))}
    </span>
  );
}

export function TechChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("chip border border-rule bg-panel-2 font-medium text-ink-2", className)}>{children}</span>
  );
}
