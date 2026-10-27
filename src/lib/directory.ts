import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs, repos } from "@/db/schema";
import raw from "@/data/directory/directory.json";
import {
  CADENCE_ORDER,
  DIRECTORY_PROGRAMS,
  cadenceOf,
  orgCode,
  orgColorIndex,
  type Cadence,
  type CadenceKey,
  type DirFile,
  type DirOrgRaw,
  type DirProgram,
} from "./directory-shared";

const FILE = raw as unknown as DirFile;

export const PAGE_SIZE = 40;

// ---------- per-program windows ----------

export type ProgramWindow = {
  id: DirProgram;
  /** Every year the program has data for, oldest first. */
  years: number[];
  first: number;
  /** Newest cycle with a full roster. A stub for next year (a couple of rows) is ignored. */
  latest: number;
  perYear: { year: number; orgs: number; projects: number | null }[];
};

function windowFor(id: DirProgram): ProgramWindow | null {
  const stats = FILE.stats[id];
  if (!stats) return null;
  const perYear = Object.entries(stats)
    .map(([y, v]) => ({ year: Number(y), orgs: v.orgs, projects: v.projects }))
    .sort((a, b) => a.year - b.year);
  if (!perYear.length) return null;
  // A year is a complete roster unless it is far smaller than the years before it
  // (next year's first few entries, or a program still partway through its rounds).
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const complete = perYear.filter((p, i) => {
    const prior = perYear.slice(Math.max(0, i - 3), i).map((x) => x.orgs);
    return !prior.length || p.orgs >= median(prior) * 0.35;
  });
  return { id, years: perYear.map((p) => p.year), first: perYear[0].year, latest: complete.at(-1)!.year, perYear };
}

const WINDOWS = Object.fromEntries(DIRECTORY_PROGRAMS.flatMap((id) => {
  const w = windowFor(id);
  return w ? [[id, w] as const] : [];
})) as Partial<Record<DirProgram, ProgramWindow>>;

export const getProgramWindow = (id: DirProgram) => WINDOWS[id] ?? null;
const OVERALL_LATEST = Math.max(...Object.values(WINDOWS).map((w) => w.latest));
export const OVERALL_FIRST = Math.min(...Object.values(WINDOWS).map((w) => w.first));
export const GENERATED_AT = FILE.generatedAt;

// ---------- derived view of each organization ----------

export type ProgramRecord = {
  id: DirProgram;
  years: number[];
  /** Projects per year; null when the program had not published a count (the current year). */
  byYear: Record<number, number | null>;
  projects: number;
  first: number;
  last: number;
  cadence: Cadence;
};

type OrgView = {
  raw: DirOrgRaw;
  records: ProgramRecord[];
  years: number[];
  cadence: Cadence;
  projects: number;
  /** Technologies ordered by how many of the organization's projects used them. */
  tech: [string, number][];
  haystack: string;
};

function build(o: DirOrgRaw): OrgView {
  const records: ProgramRecord[] = [];
  const counts = new Map<string, number>();

  for (const id of DIRECTORY_PROGRAMS) {
    const part = o.participation[id];
    if (!part) continue;
    const years = Object.keys(part).map(Number).sort((a, b) => a - b);
    if (!years.length) continue;
    const win = WINDOWS[id];
    records.push({
      id,
      years,
      byYear: Object.fromEntries(years.map((y) => [y, part[y]?.projects ?? null])),
      projects: years.reduce((n, y) => n + (part[y]?.projects ?? 0), 0),
      first: years[0],
      last: years.at(-1)!,
      cadence: cadenceOf(years, win?.latest ?? years.at(-1)!),
    });
    for (const y of years) for (const p of part[y]?.list ?? []) for (const t of p.tech) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // What the org itself says it uses counts even before any project data exists.
  for (const t of o.tech) counts.set(t, (counts.get(t) ?? 0) + 1);

  const years = [...new Set(records.flatMap((r) => r.years))].sort((a, b) => a - b);
  const tech = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    raw: o,
    records,
    years,
    cadence: cadenceOf(years, OVERALL_LATEST),
    projects: records.reduce((n, r) => n + r.projects, 0),
    tech,
    haystack: [o.name, o.tagline, ...o.topics, ...o.categories, ...tech.map(([t]) => t)].join(" ").toLowerCase(),
  };
}

const VIEWS = FILE.orgs.map(build);
const BY_ID = new Map(VIEWS.map((v) => [v.raw.id, v]));

// ---------- listing ----------

export type OrgRow = {
  id: string;
  name: string;
  tagline?: string;
  code: string;
  colorIndex: number;
  programs: DirProgram[];
  years: number[];
  cadence: Cadence;
  projects: number;
  tech: string[];
};

export const SORTS = ["regular", "projects", "name"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = { regular: "Most regular", projects: "Most projects", name: "A to Z" };

export type DirectoryQuery = {
  program?: DirProgram | null;
  q?: string;
  tech?: string;
  cadence?: CadenceKey | null;
  sort?: Sort;
  page?: number;
};

function rowOf(v: OrgView, scope: DirProgram | null): OrgRow {
  const rec = scope ? v.records.find((r) => r.id === scope) : null;
  return {
    id: v.raw.id,
    name: v.raw.name,
    tagline: v.raw.tagline,
    code: orgCode(v.raw.name),
    colorIndex: orgColorIndex(v.raw.id),
    programs: v.records.map((r) => r.id),
    years: rec ? rec.years : v.years,
    cadence: rec ? rec.cadence : v.cadence,
    projects: rec ? rec.projects : v.projects,
    tech: v.tech.slice(0, 4).map(([t]) => t),
  };
}

export type Facet<K extends string = string> = { key: K; count: number };

export function queryOrgs(query: DirectoryQuery) {
  const scope = query.program ?? null;
  const q = (query.q ?? "").trim().toLowerCase();
  const sort = query.sort ?? "regular";

  const inScope = VIEWS.filter((v) => !scope || v.records.some((r) => r.id === scope));
  const rows = inScope.map((v) => ({ v, row: rowOf(v, scope) }));

  // Facets count against the search text so the chips never promise an empty page,
  // but ignore their own dimension so you can swap one choice for another.
  const matchesText = ({ v }: { v: OrgView }) => !q || q.split(/\s+/).every((word) => v.haystack.includes(word));
  const matchesTech = ({ v }: { v: OrgView }) => !query.tech || v.tech.some(([t]) => t === query.tech);
  const matchesCadence = ({ row }: { row: OrgRow }) => !query.cadence || row.cadence.key === query.cadence;

  const base = rows.filter(matchesText);
  const cadenceCounts = new Map<CadenceKey, number>();
  for (const r of base.filter(matchesTech)) cadenceCounts.set(r.row.cadence.key, (cadenceCounts.get(r.row.cadence.key) ?? 0) + 1);
  const techCounts = new Map<string, number>();
  for (const r of base.filter(matchesCadence)) for (const [t] of r.v.tech.slice(0, 12)) techCounts.set(t, (techCounts.get(t) ?? 0) + 1);

  const matched = base.filter(matchesTech).filter(matchesCadence);
  const cmp: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    regular: (a, b) =>
      b.row.years.length - a.row.years.length ||
      (b.row.years.at(-1) ?? 0) - (a.row.years.at(-1) ?? 0) ||
      b.row.projects - a.row.projects ||
      a.row.name.localeCompare(b.row.name),
    projects: (a, b) => b.row.projects - a.row.projects || a.row.name.localeCompare(b.row.name),
    name: (a, b) => a.row.name.localeCompare(b.row.name),
  };
  matched.sort(cmp[sort]);

  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  const win = scope ? WINDOWS[scope] : null;

  return {
    total: matched.length,
    scopeTotal: inScope.length,
    page,
    pages,
    rows: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.row),
    window: { first: win?.first ?? OVERALL_FIRST, last: win?.latest ?? OVERALL_LATEST },
    cadences: CADENCE_ORDER.flatMap((key) => (cadenceCounts.get(key) ? [{ key, count: cadenceCounts.get(key)! } as Facet<CadenceKey>] : [])),
    techs: [...techCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([key, count]) => ({ key, count }) as Facet),
  };
}

export function programCounts() {
  return DIRECTORY_PROGRAMS.map((id) => ({
    id,
    count: VIEWS.filter((v) => v.records.some((r) => r.id === id)).length,
  }));
}

// ---------- a program as a whole ----------

export function getProgramOverview(id: DirProgram) {
  const win = WINDOWS[id];
  if (!win) return null;
  const members = VIEWS.filter((v) => v.records.some((r) => r.id === id));
  const recordOf = (v: OrgView) => v.records.find((r) => r.id === id)!;

  const cadence = new Map<CadenceKey, number>();
  const tech = new Map<string, number>();
  for (const v of members) {
    const key = recordOf(v).cadence.key;
    cadence.set(key, (cadence.get(key) ?? 0) + 1);
    for (const [t] of v.tech.slice(0, 10)) tech.set(t, (tech.get(t) ?? 0) + 1);
  }

  const present = (v: OrgView) => recordOf(v).years.includes(win.latest);
  return {
    window: win,
    orgCount: members.length,
    /** Organizations present in the newest full cycle. */
    current: members.filter(present).length,
    cadence: CADENCE_ORDER.flatMap((key) => (cadence.get(key) ? [{ key, count: cadence.get(key)! } as Facet<CadenceKey>] : [])),
    tech: [...tech.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([key, count]) => ({ key, count }) as Facet),
    /** Newcomers worth a look: first appeared in the newest cycle. */
    newcomers: members.filter((v) => recordOf(v).first === win.latest).slice(0, 8).map((v) => rowOf(v, id)),
  };
}

// ---------- one organization ----------

export type ProjectYear = {
  program: DirProgram;
  year: number;
  projects: number | null;
  list: { title: string; tech: string[]; url?: string }[];
};

export function getOrg(id: string) {
  const v = BY_ID.get(id);
  if (!v) return null;
  const o = v.raw;
  const projectYears: ProjectYear[] = [];
  for (const rec of v.records) {
    for (const y of rec.years) {
      const slot = o.participation[rec.id]?.[y];
      projectYears.push({ program: rec.id, year: y, projects: slot?.projects ?? null, list: slot?.list ?? [] });
    }
  }
  projectYears.sort((a, b) => b.year - a.year || a.program.localeCompare(b.program));

  return {
    org: o,
    code: orgCode(o.name),
    colorIndex: orgColorIndex(o.id),
    records: v.records,
    years: v.years,
    cadence: v.cadence,
    projects: v.projects,
    tech: v.tech.slice(0, 24),
    projectYears,
    similar: similarTo(v),
  };
}

/** Organizations that work with the most of the same technologies. */
function similarTo(v: OrgView): OrgRow[] {
  const mine = new Map(v.tech.slice(0, 10).map(([t, n]) => [t, n]));
  if (!mine.size) return [];
  return VIEWS.filter((w) => w !== v)
    .map((w) => ({ w, score: w.tech.slice(0, 10).reduce((s, [t]) => s + (mine.has(t) ? 1 : 0), 0) }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || b.w.years.length - a.w.years.length)
    .slice(0, 5)
    .map((x) => rowOf(x.w, null));
}

export function getWindows() {
  return WINDOWS;
}

// ---------- your lines that belong to a directory organization ----------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function githubOwner(url?: string) {
  const m = url?.match(/github\.com\/([^/?#]+)/i);
  return m?.[1]?.toLowerCase();
}

/** Repos you track that belong to this organization, matched by name or by GitHub owner. */
export async function getTrackedLines(org: DirOrgRaw) {
  const rows = await db
    .select({ repo: repos, org: orgs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .where(eq(repos.archived, false));
  const owner = githubOwner(org.source) ?? githubOwner(org.website);
  const name = norm(org.name);
  return rows
    .filter((r) => norm(r.org.name) === name || (owner && r.repo.owner.toLowerCase() === owner))
    .map((r) => ({ slug: r.repo.slug, code: r.repo.code, colorIndex: r.repo.colorIndex, name: r.repo.name, owner: r.repo.owner }));
}
