import clsx from "clsx";
import { ProgramPlate } from "@/components/program-sign";
import { lineVar } from "@/lib/lines";
import { DIR_PROGRAM_LABEL, type DirProgram } from "@/lib/directory-shared";
import type { ProgramRecord, ProgramWindow } from "@/lib/directory";
import { CadenceBadge } from "./org-parts";

/**
 * An organization's attendance drawn as a line: one station per year, filled
 * where it took part, with the project count above. Every program shares the
 * same year axis so you can see which programs an org used in which seasons.
 */
export function ServiceRecord({
  records,
  windows,
  colorIndex,
  axis,
}: {
  records: ProgramRecord[];
  windows: Partial<Record<DirProgram, ProgramWindow>>;
  colorIndex: number;
  axis: { first: number; last: number };
}) {
  const years = Array.from({ length: axis.last - axis.first + 1 }, (_, i) => axis.first + i);
  const color = lineVar(colorIndex);

  return (
    <div className="space-y-6">
      {records.map((rec) => {
        const win = windows[rec.id];
        const attended = new Set(rec.years);
        const span = win ? win.latest - Math.max(win.first, rec.first) + 1 : rec.years.length;
        return (
          <div key={rec.id}>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <ProgramPlate label={DIR_PROGRAM_LABEL[rec.id]} />
              <CadenceBadge cadence={rec.cadence} />
              <span className="text-sm text-ink-2">
                {rec.years.length} of {span} {span === 1 ? "year" : "years"}
                {rec.projects > 0 && <> · {rec.projects} {rec.projects === 1 ? "project" : "projects"}</>}
              </span>
            </div>
            <ol className="grid" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }} aria-label={`${DIR_PROGRAM_LABEL[rec.id]} attendance by year`}>
              {years.map((y) => {
                const inWindow = win ? y >= win.first && y <= win.latest : attended.has(y);
                const here = attended.has(y);
                const count = rec.byYear[y];
                const joinLeft = here && attended.has(y - 1);
                const joinRight = here && attended.has(y + 1);
                return (
                  <li
                    key={y}
                    className="relative flex h-14 flex-col items-center justify-end"
                    title={here ? `${y}: ${count === null ? "announced" : `${count} ${count === 1 ? "project" : "projects"}`}` : inWindow ? `${y}: not taking part` : undefined}
                  >
                    <span className="numerals mb-1 h-4 text-[0.8125rem] leading-4 text-ink-2">{here && count !== null ? count : ""}</span>
                    <span className="relative flex h-5 w-full items-center justify-center">
                      {inWindow && (
                        <>
                          <span className="absolute left-0 h-[3px] w-1/2" style={{ background: joinLeft ? color : "var(--rule)" }} />
                          <span className="absolute right-0 h-[3px] w-1/2" style={{ background: joinRight ? color : "var(--rule)" }} />
                        </>
                      )}
                      {inWindow && (
                        <span
                          className={clsx(
                            "relative block size-[15px] rounded-full border-[3px]",
                            here ? "" : "border-rule-strong bg-panel",
                          )}
                          style={here ? { background: count === null ? "var(--panel)" : color, borderColor: color } : undefined}
                        />
                      )}
                    </span>
                    <span className={clsx("numerals mt-1 text-[0.6875rem] leading-none sm:text-xs", here ? "text-ink" : "text-ink-3")}>
                      <span className="sm:hidden">’{String(y).slice(2)}</span>
                      <span className="hidden sm:inline">{y}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
