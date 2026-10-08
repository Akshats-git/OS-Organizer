import clsx from "clsx";
import Link from "next/link";
import { NO_PROGRAM } from "@/lib/programs";

/**
 * A program reads as a zone on the network: a stamped plate, the way a platform
 * sign names the zone its lines belong to.
 */
export function ProgramPlate({ label, size = "md", className }: { label: string; size?: "sm" | "md"; className?: string }) {
  const none = label === "None" || label.startsWith("No program");
  return (
    <span
      className={clsx(
        "type-display inline-flex shrink-0 items-center rounded-[5px] leading-none tracking-[0.07em]",
        size === "sm" ? "px-1.5 py-[0.2rem] text-[0.625rem]" : "px-2 py-[0.3rem] text-xs",
        none ? "border border-dashed border-rule-strong text-ink-3" : "bg-ink text-page",
        className,
      )}
    >
      {label}
    </span>
  );
}

export type ProgramCount = { key: string; label: string; count: number };

/** Narrows a grouped view to one program. The choice lives in the URL. */
export function ProgramFilter({
  path,
  counts,
  active,
  total,
}: {
  path: string;
  counts: ProgramCount[];
  active: string | null;
  total: number;
}) {
  if (counts.length < 2) return null;
  const chips = [{ key: null as string | null, label: "All lines", count: total }, ...counts.map((c) => ({ ...c, key: c.key as string | null }))];

  return (
    <nav aria-label="Filter lines by program" className="mb-7 flex flex-wrap items-center gap-2">
      {chips.map(({ key, label, count }) => {
        const on = key === active;
        return (
          <Link
            key={key ?? "all"}
            href={key ? `${path}?program=${key}` : path}
            aria-current={on ? "true" : undefined}
            className={clsx(
              "chip border px-2.5 py-1 text-xs transition-colors",
              on ? "border-ink bg-ink text-page" : "border-rule-strong text-ink-2 hover:border-ink-3 hover:text-ink",
            )}
          >
            {key === NO_PROGRAM ? "No program" : label}
            <span className={clsx("numerals text-[0.6875rem]", on ? "text-page/70" : "text-ink-3")}>{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
