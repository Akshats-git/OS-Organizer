import { ArrowLeft, ExternalLink, Lightbulb, Mail, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CadenceBadge, OrgRoundel, TechChip } from "@/components/directory/org-parts";
import { ServiceRecord } from "@/components/directory/service-record";
import { GitHubMark } from "@/components/icons";
import { LineBullet } from "@/components/line-bullet";
import { ProgramPlate } from "@/components/program-sign";
import { getOrg, getTrackedLines, getWindows, OVERALL_FIRST } from "@/lib/directory";
import { DIR_PROGRAM_LABEL, DIR_PROJECT_NOTE, techLabel } from "@/lib/directory-shared";

export async function generateMetadata(props: PageProps<"/orgs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const data = getOrg(id);
  return { title: data?.org.name ?? "Org" };
}

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export default async function OrgPage(props: PageProps<"/orgs/[id]">) {
  await connection();
  const { id } = await props.params;
  const data = getOrg(id);
  if (!data) notFound();
  const { org, records, cadence, tech, projectYears, similar } = data;
  const tracked = await getTrackedLines(org);
  const windows = getWindows();
  const axisLast = Math.max(...Object.values(windows).map((w) => w.latest));
  const maxTech = tech[0]?.[1] ?? 0;
  const candidates: { label: string; url: string; icon: React.ReactElement }[] = [];
  if (org.website) candidates.push({ label: host(org.website), url: org.website, icon: <ExternalLink className="size-3.5" /> });
  if (org.ideas) candidates.push({ label: "Ideas list", url: org.ideas, icon: <Lightbulb className="size-3.5" /> });
  if (org.source) candidates.push({ label: /github\.com/.test(org.source) ? host(org.source) : "Source code", url: org.source, icon: <GitHubMark className="size-3.5" /> });
  // Ideas and source often point at the same page.
  const links = candidates.filter((l, i) => candidates.findIndex((o) => o.url === l.url) === i);
  const years = data.years;
  const thisYear = years.at(-1);

  return (
    <>
      <Link href="/orgs" className="link mb-5 inline-flex items-center gap-1.5 text-sm text-ink-2 no-underline hover:text-ink">
        <ArrowLeft className="size-4" /> All orgs
      </Link>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <OrgRoundel id={org.id} name={org.name} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="type-display text-[2.25rem] leading-none sm:text-[3rem]">{org.name}</h1>
          {org.tagline && <p className="mt-2 max-w-[64ch] text-lg text-ink-2">{org.tagline}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {records.map((r) => (
              <Link key={r.id} href={`/programs/${r.id}`} className="rounded-[5px] outline-offset-2 hover:opacity-80">
                <ProgramPlate label={DIR_PROGRAM_LABEL[r.id]} />
              </Link>
            ))}
            <CadenceBadge cadence={cadence} />
            {org.license && (
              <span className="chip border border-rule text-ink-2"><Scale className="size-3" /> {org.license}</span>
            )}
          </div>
          {links.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5 text-ink-2">
                  {l.icon} {l.label}
                </a>
              ))}
              {org.contact && (
                <a href={`mailto:${org.contact}`} className="link inline-flex items-center gap-1.5 text-ink-2">
                  <Mail className="size-3.5" /> {org.contact}
                </a>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="record-title" className="panel px-4 pb-5 pt-4 sm:px-6">
            <h2 id="record-title" className="type-display text-xl">Service record</h2>
            <p className="mb-5 mt-1 text-sm text-ink-2">{cadence.detail} Each station is a year. Filled stations are years the organization took part, with the number of projects above.</p>
            <ServiceRecord records={records} windows={windows} colorIndex={data.colorIndex} axis={{ first: OVERALL_FIRST, last: axisLast }} />
            <ul className="mt-5 space-y-1 border-t border-rule pt-3 text-xs text-ink-3">
              {records.map((r) => (
                <li key={r.id}><span className="font-semibold text-ink-2">{DIR_PROGRAM_LABEL[r.id]}.</span> {DIR_PROJECT_NOTE[r.id]}</li>
              ))}
            </ul>
          </section>

          {org.description && (
            <section aria-labelledby="about-title">
              <h2 id="about-title" className="type-display text-xl">What they do</h2>
              <p className="mt-2 max-w-[68ch] text-ink-2">{org.description}</p>
              {(org.categories.length > 0 || org.topics.length > 0) && (
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {org.categories.map((c) => <TechChip key={c} className="border-rule-strong text-ink">{c}</TechChip>)}
                  {org.topics.map((t) => <TechChip key={t}>{techLabel(t)}</TechChip>)}
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="projects-title">
            <h2 id="projects-title" className="type-display text-xl">Projects by year</h2>
            <div className="mt-3 divide-y divide-rule border-y border-rule">
              {projectYears.map((py, i) => (
                <details key={`${py.program}-${py.year}`} open={i < 2} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="numerals w-12 text-lg">{py.year}</span>
                    <ProgramPlate label={DIR_PROGRAM_LABEL[py.program]} size="sm" />
                    <span className="flex-1 text-sm text-ink-2">
                      {py.projects === null ? "Announced" : `${py.projects} ${py.projects === 1 ? "project" : "projects"}`}
                    </span>
                    <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">›</span>
                  </summary>
                  {py.list.length > 0 ? (
                    <ul className="mt-2 space-y-2.5 pl-0 sm:pl-[3.75rem]">
                      {py.list.map((p, j) => (
                        <li key={j} className="text-sm">
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noreferrer" className="link">{p.title}</a>
                          ) : (
                            <span>{p.title}</span>
                          )}
                          {p.tech.length > 0 && (
                            <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                              {p.tech.map((t) => <TechChip key={t}>{techLabel(t)}</TechChip>)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-3 sm:pl-[3.75rem]">
                      {py.projects === null ? "The organization is in this cycle’s roster. Projects are not published yet." : "No project details recorded."}
                    </p>
                  )}
                </details>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="mine-title" className="panel p-5">
            <h2 id="mine-title" className="type-display text-xl">In your network</h2>
            {tracked.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {tracked.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/repos/${r.slug}`} className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-rule-strong px-2.5 py-2 text-sm transition-colors hover:border-ink-3">
                      <LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-xs text-ink-3">{r.owner}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink-2">You are not tracking a repo for this organization.</p>
                <Link href="/lines?add=1" className="btn btn-quiet mt-3 w-full">Add a repo as a line</Link>
              </>
            )}
          </section>

          {tech.length > 0 && (
            <section aria-labelledby="stack-title">
              <h2 id="stack-title" className="type-display text-xl">Tech stack</h2>
              {maxTech > 1 ? (
                <>
                  <p className="mb-2 mt-1 text-xs text-ink-3">Counted across the projects they have run.</p>
                  <ul className="space-y-1.5">
                    {tech.slice(0, 12).map(([t, n]) => (
                      <li key={t} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-2 text-sm">
                        <span className="truncate">{techLabel(t)}</span>
                        <span className="h-1.5 rounded-full bg-panel-2">
                          <span className="block h-full rounded-full bg-ink-2" style={{ width: `${Math.max(6, (n / maxTech) * 100)}%` }} />
                        </span>
                        <span className="numerals text-right text-xs text-ink-3">{n}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {tech.map(([t]) => <TechChip key={t}>{techLabel(t)}</TechChip>)}
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="regular-title">
            <h2 id="regular-title" className="type-display text-xl">How regularly</h2>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="numerals text-4xl leading-none">{years.length}</span>
              <span className="text-sm text-ink-2">{years.length === 1 ? "year" : "years"} between {years[0]} and {thisYear}</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">{cadence.detail}</p>
          </section>

          {similar.length > 0 && (
            <section aria-labelledby="similar-title">
              <h2 id="similar-title" className="type-display text-xl">Similar stack</h2>
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link href={`/orgs/${s.id}`} className="flex items-center gap-2.5 py-2 text-sm hover:text-ink">
                      <OrgRoundel id={s.id} name={s.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                      <CadenceBadge cadence={s.cadence} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
