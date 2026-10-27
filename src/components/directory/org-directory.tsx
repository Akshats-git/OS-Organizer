import clsx from "clsx";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { ProgramPlate } from "@/components/program-sign";
import { queryOrgs, SORTS, SORT_LABEL, type Sort } from "@/lib/directory";
import {
  CADENCE_LABEL,
  CADENCE_ORDER,
  DIRECTORY_PROGRAMS,
  DIR_PROGRAM_LABEL,
  isDirProgram,
  orgColorIndex,
  techLabel,
  type CadenceKey,
  type DirProgram,
} from "@/lib/directory-shared";
import { CadenceBadge, OrgRoundel, TechChip, YearStrip } from "./org-parts";

type Params = { q?: string; program?: DirProgram; tech?: string; cadence?: CadenceKey; sort?: Sort; page?: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads and validates the filter state from the URL. Anything unrecognised is dropped. */
export function parseParams(sp: Record<string, string | string[] | undefined>): Params {
  const program = first(sp.program);
  const cadence = first(sp.cadence);
  const sort = first(sp.sort);
  const page = Number(first(sp.page));
  return {
    q: first(sp.q)?.slice(0, 80) || undefined,
    program: program && isDirProgram(program) ? program : undefined,
    tech: first(sp.tech)?.slice(0, 40) || undefined,
    cadence: cadence && (CADENCE_ORDER as string[]).includes(cadence) ? (cadence as CadenceKey) : undefined,
    sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

function href(base: string, current: Params, change: Partial<Params>) {
  const next: Params = { ...current, page: undefined, ...change };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.program) qs.set("program", next.program);
  if (next.tech) qs.set("tech", next.tech);
  if (next.cadence) qs.set("cadence", next.cadence);
  if (next.sort && next.sort !== "regular") qs.set("sort", next.sort);
  if (next.page) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function Chip({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={clsx(
        "chip border px-2.5 py-1 text-xs transition-colors",
        on ? "border-ink bg-ink text-page" : "border-rule-strong text-ink-2 hover:border-ink-3 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

const Count = ({ n, on }: { n: number; on?: boolean }) => (
  <span className={clsx("numerals text-[0.6875rem]", on ? "text-page/70" : "text-ink-3")}>{n}</span>
);

/**
 * The searchable, filterable list of organizations. All state lives in the URL,
 * so it works without client code and any view can be linked or bookmarked.
 * `fixedProgram` pins it to one program and hides the program filter.
 */
export function OrgDirectory({
  basePath,
  params,
  fixedProgram,
  programCounts,
}: {
  basePath: string;
  params: Params;
  fixedProgram?: DirProgram;
  programCounts?: { id: DirProgram; count: number }[];
}) {
  const current: Params = fixedProgram ? { ...params, program: fixedProgram } : params;
  const result = queryOrgs({ ...current, program: fixedProgram ?? current.program });
  const filtered = Boolean(current.q || current.tech || current.cadence);
  const at = (change: Partial<Params>) => href(basePath, fixedProgram ? { ...current, program: undefined } : current, change);
  const topTech = result.techs.slice(0, 12);
  const moreTech = result.techs.slice(12);

  return (
    <div>
      <form action={basePath} method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        {!fixedProgram && current.program && <input type="hidden" name="program" value={current.program} />}
        {current.tech && <input type="hidden" name="tech" value={current.tech} />}
        {current.cadence && <input type="hidden" name="cadence" value={current.cadence} />}
        {current.sort && <input type="hidden" name="sort" value={current.sort} />}
        <label className="relative block flex-1">
          <span className="sr-only">Search organizations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={current.q} placeholder="Search by name, topic or technology" className="field pl-9" autoComplete="off" />
        </label>
        <button className="btn btn-primary">Search</button>
      </form>

      <div className="mt-4 space-y-3">
        {!fixedProgram && programCounts && (
          <nav aria-label="Filter by program" className="flex flex-wrap items-center gap-2">
            <Chip to={at({ program: undefined })} on={!current.program}>All programs</Chip>
            {DIRECTORY_PROGRAMS.map((id) => {
              const count = programCounts.find((p) => p.id === id)?.count ?? 0;
              return (
                <Chip key={id} to={at({ program: id })} on={current.program === id}>
                  {DIR_PROGRAM_LABEL[id]} <Count n={count} on={current.program === id} />
                </Chip>
              );
            })}
          </nav>
        )}

        <nav aria-label="Filter by how regularly they take part" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-3">How regular</span>
          <Chip to={at({ cadence: undefined })} on={!current.cadence}>Any</Chip>
          {result.cadences.map(({ key, count }) => (
            <Chip key={key} to={at({ cadence: key })} on={current.cadence === key}>
              {CADENCE_LABEL[key]} <Count n={count} on={current.cadence === key} />
            </Chip>
          ))}
        </nav>

        {result.techs.length > 0 && (
          <nav aria-label="Filter by technology" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Tech</span>
            <Chip to={at({ tech: undefined })} on={!current.tech}>Any</Chip>
            {current.tech && !result.techs.some((t) => t.key === current.tech) && (
              <Chip to={at({ tech: current.tech })} on>{techLabel(current.tech)}</Chip>
            )}
            {topTech.map(({ key, count }) => (
              <Chip key={key} to={at({ tech: key })} on={current.tech === key}>
                {techLabel(key)} <Count n={count} on={current.tech === key} />
              </Chip>
            ))}
            {moreTech.length > 0 && (
              <details className="contents">
                <summary className="chip cursor-pointer list-none border border-dashed border-rule-strong px-2.5 py-1 text-xs text-ink-2 hover:border-ink-3 [&::-webkit-details-marker]:hidden">
                  {moreTech.length} more
                </summary>
                {moreTech.map(({ key, count }) => (
                  <Chip key={key} to={at({ tech: key })} on={current.tech === key}>
                    {techLabel(key)} <Count n={count} on={current.tech === key} />
                  </Chip>
                ))}
              </details>
            )}
          </nav>
        )}
      </div>

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule pb-2">
        <p className="text-sm text-ink-2" aria-live="polite">
          <span className="numerals text-base text-ink">{result.total}</span> of {result.scopeTotal} organizations
          {filtered && (
            <>
              {" "}
              <Link href={at({ q: undefined, tech: undefined, cadence: undefined })} className="link ml-1 text-xs">
                Clear filters
              </Link>
            </>
          )}
        </p>
        <nav aria-label="Sort" className="flex items-center gap-1 text-xs text-ink-3">
          Sort
          {SORTS.map((s) => (
            <Link
              key={s}
              href={at({ sort: s })}
              scroll={false}
              aria-current={(current.sort ?? "regular") === s ? "true" : undefined}
              className={clsx("rounded px-1.5 py-0.5 transition-colors", (current.sort ?? "regular") === s ? "bg-panel-2 font-semibold text-ink" : "hover:text-ink")}
            >
              {SORT_LABEL[s]}
            </Link>
          ))}
        </nav>
      </div>

      {result.rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="type-display text-xl">No organizations match</p>
          <p className="mx-auto mt-1 max-w-[44ch] text-sm text-ink-2">Try fewer filters, or search for a broader term like “python” or “data”.</p>
        </div>
      ) : (
        <ul className="divide-y divide-rule">
          {result.rows.map((o) => (
            <li key={o.id}>
              <Link href={`/orgs/${o.id}`} className="group -mx-2 flex items-start gap-3 rounded-[var(--radius-control)] px-2 py-3 transition-colors hover:bg-panel-2">
                <span className="mt-0.5"><OrgRoundel id={o.id} name={o.name} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="type-display text-lg group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">{o.name}</span>
                    {!fixedProgram && o.programs.map((p) => <ProgramPlate key={p} label={DIR_PROGRAM_LABEL[p]} size="sm" />)}
                  </span>
                  {o.tagline && <span className="block truncate text-sm text-ink-2">{o.tagline}</span>}
                  {o.tech.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {o.tech.map((t) => <TechChip key={t}>{techLabel(t)}</TechChip>)}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                  <CadenceBadge cadence={o.cadence} />
                  <YearStrip years={o.years} first={result.window.first} last={result.window.last} colorIndex={orgColorIndex(o.id)} className="max-sm:hidden" />
                  <span className="numerals text-xs text-ink-3">
                    {o.years.length} {o.years.length === 1 ? "yr" : "yrs"}
                    {o.projects > 0 && <> · {o.projects}</>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-sm">
          {result.page > 1 ? (
            <Link href={at({ page: result.page - 1 })} className="btn btn-quiet"><ChevronLeft className="size-4" /> Previous</Link>
          ) : <span />}
          <span className="numerals text-ink-2">Page {result.page} of {result.pages}</span>
          {result.page < result.pages ? (
            <Link href={at({ page: result.page + 1 })} className="btn btn-quiet">Next <ChevronRight className="size-4" /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
