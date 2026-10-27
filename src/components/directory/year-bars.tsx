import clsx from "clsx";

/** Organizations per year for one program, as plain bars with the numbers printed on them. */
export function YearBars({
  data,
  latest,
  noun,
}: {
  data: { year: number; orgs: number; projects: number | null }[];
  latest: number;
  noun: string;
}) {
  const peak = Math.max(...data.map((d) => d.orgs), 1);
  return (
    <div>
      <ol className="flex items-end gap-1.5 sm:gap-2.5" aria-label={`Number of ${noun} each year`}>
        {data.map((d) => {
          const partial = d.year > latest || d.projects === null;
          return (
            <li key={d.year} className="flex min-w-0 flex-1 flex-col items-center" title={`${d.year}: ${d.orgs} ${noun}${d.projects !== null ? `, ${d.projects} projects` : ""}`}>
              <span className="numerals text-[0.8125rem] text-ink">{d.orgs}</span>
              <span
                className={clsx("mt-1 block w-full rounded-t-[3px]", partial ? "border border-dashed border-ink-3 bg-transparent" : "bg-ink")}
                style={{ height: `${Math.max(4, Math.round((d.orgs / peak) * 112))}px` }}
              />
              <span className="numerals mt-1.5 text-[0.6875rem] text-ink-2 sm:text-xs">
                <span className="sm:hidden">’{String(d.year).slice(2)}</span>
                <span className="hidden sm:inline">{d.year}</span>
              </span>
              <span className="numerals h-4 text-[0.6875rem] text-ink-3">{d.projects ?? ""}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-3">
        Bars show {noun} per year. The small figure underneath is the project count. Dashed bars are partial or announced-only years.
      </p>
    </div>
  );
}
