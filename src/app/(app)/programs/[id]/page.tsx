import clsx from "clsx";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OrgDirectory, parseParams } from "@/components/directory/org-directory";
import { OrgRoundel } from "@/components/directory/org-parts";
import { YearBars } from "@/components/directory/year-bars";
import { LineBullet } from "@/components/line-bullet";
import { PROGRAM_PROFILES } from "@/data/program-profiles";
import { getPrograms } from "@/lib/data";
import { GENERATED_AT, getProgramOverview } from "@/lib/directory";
import { CADENCE_LABEL, CADENCE_TONE, DIR_ORG_NOUN, DIR_PROGRAM_LABEL, DIR_PROJECT_NOTE, isDirProgram, techLabel, type Cadence } from "@/lib/directory-shared";
import { programShortName } from "@/lib/programs";
import { daysUntil, formatDate } from "@/lib/time";

export async function generateMetadata(props: PageProps<"/programs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: (DIR_PROGRAM_LABEL as Record<string, string>)[id] ?? "Program" };
}

const TONE_COLOR: Record<Cadence["tone"], string> = {
  good: "var(--ok)",
  mid: "var(--soon)",
  new: "var(--focus)",
  quiet: "var(--rule-strong)",
};
export default async function ProgramPage(props: PageProps<"/programs/[id]">) {
  await connection();
  const { id } = await props.params;
  const programs = await getPrograms();
  const program = programs.find((p) => p.id === id);
  if (!program) notFound();

  const profile = PROGRAM_PROFILES[id];
  const overview = isDirProgram(id) ? getProgramOverview(id) : null;
  const params = parseParams(await props.searchParams);
  const now = new Date();
  const name = programShortName(program);
  const hasFilter = Boolean(params.q || params.tech || params.cadence || params.page);

  return (
    <>
      <Link href="/programs" className="link mb-5 inline-flex items-center gap-1.5 text-sm text-ink-2 no-underline hover:text-ink">
        <ArrowLeft className="size-4" /> All programs
      </Link>

      <header className="mb-8 lg:mb-10">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">{program.name}</h1>
          {(program.url ?? profile?.links[0]?.url) && (
            <a href={program.url ?? profile!.links[0].url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm text-ink-2">
              Official site <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <p className="mt-2 max-w-[64ch] text-ink-2">{profile?.tagline ?? program.summary}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-12">
          {profile ? (
            <section aria-labelledby="how-title">
              <h2 id="how-title" className="type-display text-2xl">How it works</h2>
              <ol className="relative mt-4">
                <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-[3px] rounded-full bg-ink/80" />
                {profile.steps.map((s, i) => (
                  <li key={s.title} className="relative pb-5 pl-9 last:pb-0">
                    <span aria-hidden className="absolute left-0 top-[0.35rem] block size-[17px] rounded-full border-[3px] border-ink bg-panel" />
                    <p className="flex items-baseline gap-2">
                      <span className="numerals text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-semibold">{s.title}</span>
                    </p>
                    <p className="max-w-[62ch] text-sm text-ink-2">{s.body}</p>
                  </li>
                ))}
              </ol>
              {profile.advice.length > 0 && (
                <div className="mt-6 rounded-[var(--radius-panel)] border border-rule bg-panel-2 px-4 py-3">
                  <h3 className="text-sm font-semibold">Worth knowing</h3>
                  <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-sm text-ink-2">
                    {profile.advice.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            program.summary && (
              <section>
                <h2 className="type-display text-2xl">About</h2>
                <p className="mt-2 max-w-[64ch] text-ink-2">{program.summary}</p>
              </section>
            )
          )}

          {overview ? (
            <>
              <section aria-labelledby="years-title">
                <h2 id="years-title" className="type-display text-2xl">
                  {DIR_ORG_NOUN[id as keyof typeof DIR_ORG_NOUN].replace(/^./, (c) => c.toUpperCase())} by year
                </h2>
                <div className="panel mt-3 px-4 pb-4 pt-5 sm:px-6">
                  <YearBars data={overview.window.perYear} latest={overview.window.latest} noun={DIR_ORG_NOUN[overview.window.id]} />
                </div>
                <p className="mt-2 text-xs text-ink-3">{DIR_PROJECT_NOTE[overview.window.id]}</p>
              </section>

              <section aria-labelledby="regularity-title">
                <h2 id="regularity-title" className="type-display text-2xl">How regularly they come back</h2>
                <p className="mt-1 max-w-[62ch] text-sm text-ink-2">
                  Of the {overview.orgCount} {DIR_ORG_NOUN[overview.window.id]} on record, {overview.current} took part in {overview.window.latest}. Pick a group to list it.
                </p>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label={overview.cadence.map((c) => `${CADENCE_LABEL[c.key]} ${c.count}`).join(", ")}>
                  {overview.cadence.map((c) => (
                    <span key={c.key} style={{ width: `${(c.count / overview.orgCount) * 100}%`, background: TONE_COLOR[CADENCE_TONE[c.key]], opacity: c.key === "lapsed" ? 0.5 : 1 }} className="border-r-2 border-page last:border-r-0" />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                  {overview.cadence.map((c) => (
                    <li key={c.key}>
                      <Link href={`/programs/${id}?cadence=${c.key}#organizations`} className="link no-underline">
                        <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: TONE_COLOR[CADENCE_TONE[c.key]], opacity: c.key === "lapsed" ? 0.5 : 1 }} />
                        {CADENCE_LABEL[c.key]} <span className="numerals text-ink-3">{c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {overview.tech.length > 0 && (
                <section aria-labelledby="tech-title">
                  <h2 id="tech-title" className="type-display text-2xl">What they build with</h2>
                  <p className="mt-1 text-sm text-ink-2">The technologies used by the most {DIR_ORG_NOUN[overview.window.id]}. Pick one to list them.</p>
                  <p className="mt-3 flex flex-wrap gap-2">
                    {overview.tech.map((t) => (
                      <Link key={t.key} href={`/programs/${id}?tech=${encodeURIComponent(t.key)}#organizations`} className="chip border border-rule-strong px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink">
                        {techLabel(t.key)} <span className="numerals text-[0.6875rem] text-ink-3">{t.count}</span>
                      </Link>
                    ))}
                  </p>
                </section>
              )}

              {overview.newcomers.length > 0 && !hasFilter && (
                <section aria-labelledby="new-title">
                  <h2 id="new-title" className="type-display text-2xl">New in {overview.window.latest}</h2>
                  <p className="mt-1 text-sm text-ink-2">First appearance in this program. No history to go on yet.</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {overview.newcomers.map((o) => (
                      <li key={o.id}>
                        <Link href={`/orgs/${o.id}`} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rule-strong px-2 py-1 text-sm transition-colors hover:border-ink-3">
                          <OrgRoundel id={o.id} name={o.name} size="sm" />
                          <span className="font-semibold">{o.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section id="organizations" aria-labelledby="orgs-title" className="scroll-mt-8">
                <h2 id="orgs-title" className="type-display mb-3 text-2xl">
                  {DIR_ORG_NOUN[overview.window.id].replace(/^./, (c) => c.toUpperCase())}
                </h2>
                <OrgDirectory basePath={`/programs/${id}`} params={params} fixedProgram={overview.window.id} />
                {profile && (
                  <p className="mt-8 border-t border-rule pt-3 text-xs text-ink-3">
                    {profile.source} Built on {formatDate(GENERATED_AT, { month: "long", day: "numeric", year: "numeric" })}.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="panel px-6 py-8 text-center">
              <p className="type-display text-xl">No organization history for {name} yet</p>
              <p className="mx-auto mt-1 max-w-[48ch] text-sm text-ink-2">
                This program has no public archive to read from. Add its dates on the <Link href="/programs" className="link">Programs timeline</Link> and its description will appear here when it has one.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          {profile && (
            <section aria-labelledby="glance-title" className="panel p-5">
              <h2 id="glance-title" className="type-display text-xl">At a glance</h2>
              <dl className="mt-3 divide-y divide-rule">
                {profile.facts.map((f) => (
                  <div key={f.label} className="py-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">{f.label}</dt>
                    <dd className="text-sm text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="dates-title">
            <div className="flex items-baseline justify-between">
              <h2 id="dates-title" className="type-display text-xl">Dates</h2>
              <Link href={`/programs#program-${id}`} className="link text-xs text-ink-2">Edit on timeline</Link>
            </div>
            {program.events.length > 0 ? (
              <ol className="mt-2 divide-y divide-rule border-y border-rule">
                {program.events.map((e) => {
                  const days = daysUntil(e.date, now);
                  return (
                    <li key={e.id} className={clsx("flex items-center gap-3 py-2", days < 0 && "opacity-55")}>
                      <span className="numerals w-14 shrink-0">{formatDate(e.date)}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        {e.title}
                        {e.estimated && <span className="text-soon">, estimated</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-ink-2">No dates yet. Add them on the timeline when the program publishes them.</p>
            )}
          </section>

          <section aria-labelledby="yours-title">
            <h2 id="yours-title" className="type-display text-xl">Your lines</h2>
            {program.repos.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {program.repos.map((r) => (
                  <li key={r.id}>
                    <Link href={`/repos/${r.slug}`} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rule-strong px-2 py-1 text-sm transition-colors hover:border-ink-3">
                      <LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />
                      <span className="font-semibold">{r.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-2">None of your lines are aimed at {name} yet.</p>
            )}
          </section>

          {profile && profile.links.length > 0 && (
            <section aria-labelledby="links-title">
              <h2 id="links-title" className="type-display text-xl">Official links</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {profile.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5">
                      {l.label} <ExternalLink className="size-3 text-ink-3" />
                    </a>
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
