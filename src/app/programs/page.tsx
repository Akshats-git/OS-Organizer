import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { LineBullet } from "@/components/line-bullet";
import { AddEvent, CopyField, EventControls } from "@/components/program-widgets";
import type { ProgramEvent } from "@/db/schema";
import { getPrograms } from "@/lib/data";
import { programShortName } from "@/lib/programs";
import { daysUntil, formatDate } from "@/lib/time";
import Link from "next/link";

export const metadata: Metadata = { title: "Programs" };

const KIND_LABEL: Record<ProgramEvent["kind"], string> = {
  open: "Opens",
  deadline: "Deadline",
  announce: "Announcement",
  coding: "Coding starts",
  result: "Results",
};

function Stop({ kind }: { kind: ProgramEvent["kind"] }) {
  if (kind === "deadline") return <span className="block size-3 rotate-45 rounded-[2px] bg-ink" />;
  if (kind === "coding") return <span className="block h-3.5 w-[5px] rounded-full bg-ink" />;
  return <span className="block size-3 rounded-full border-[3px] border-ink bg-panel" />;
}

export default async function ProgramsPage() {
  await connection();
  const programs = await getPrograms();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 12, 1);
  const span = end.getTime() - start.getTime();
  const pos = (date: string) => ((new Date(date + "T00:00:00").getTime() - start.getTime()) / span) * 100;
  const months = Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));
  const todayX = ((now.getTime() - start.getTime()) / span) * 100;

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const feed = `${origin}/api/calendar${process.env.INGEST_SECRET ? `?key=${process.env.INGEST_SECRET}` : ""}`;

  return (
    <>
      <header className="mb-8 lg:mb-10">
        <h1 className="type-display text-[2.5rem] leading-none sm:text-[3rem]">Programs</h1>
        <p className="mt-2 max-w-[62ch] text-ink-2">
          The next twelve months. Dates marked estimated follow last year’s pattern. Confirm or correct each one when its program publishes the official timeline.
        </p>
      </header>

      <section aria-labelledby="season-title" className="panel px-4 pb-5 pt-4 sm:px-6">
        <h2 id="season-title" className="sr-only">Season at a glance</h2>
        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <span />
          <div className="relative h-6 border-b border-rule">
            {months.map((m, i) => (
              <span key={i} className="type-display absolute top-0 text-xs text-ink-3 sm:text-sm" style={{ left: `${(i / 12) * 100}%` }}>
                {m.toLocaleDateString("en-US", { month: "short" })}
                {m.getMonth() === 0 && <span className="hidden sm:inline"> {m.getFullYear()}</span>}
              </span>
            ))}
          </div>
          {programs.map((p) => (
            <div key={p.id} className="contents">
              <span className="truncate py-3.5 text-sm font-semibold">{programShortName(p)}</span>
              <div className="relative">
                <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-rule" />
                <span aria-hidden className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-focus/60" style={{ left: `${todayX}%` }} />
                {p.events.length > 1 && (
                  <span
                    className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/70"
                    style={{ left: `${Math.max(0, pos(p.events[0].date))}%`, width: `${Math.min(100, pos(p.events.at(-1)!.date)) - Math.max(0, pos(p.events[0].date))}%` }}
                  />
                )}
                {p.events
                  .filter((e) => pos(e.date) >= 0 && pos(e.date) <= 100)
                  .map((e) => (
                    <span key={e.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(e.date)}%` }} title={`${e.title}, ${formatDate(e.date)}`}>
                      <Stop kind={e.kind} />
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3 text-xs text-ink-2">
          <span className="flex items-center gap-2"><Stop kind="open" /> Opens, announcements, results</span>
          <span className="flex items-center gap-2"><Stop kind="deadline" /> Deadline</span>
          <span className="flex items-center gap-2"><Stop kind="coding" /> Coding starts</span>
          <span className="flex items-center gap-2"><span className="block h-3.5 w-[2px] bg-focus/60" /> Today</span>
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {programs.map((p) => (
            <section key={p.id} id={`program-${p.id}`} aria-labelledby={`p-${p.id}`} className="scroll-mt-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id={`p-${p.id}`} className="type-display text-2xl">{p.name}</h2>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm text-ink-2">
                    Website <ExternalLink className="size-3" />
                  </a>
                )}
                <span className="text-sm text-ink-3">
                  {p.repos.length ? `${p.repos.length} of your lines` : "None of your lines yet"}
                </span>
              </div>
              {p.summary && <p className="mt-1 max-w-[64ch] text-sm text-ink-2">{p.summary}</p>}
              {p.repos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {p.repos.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/repos/${r.slug}`}
                        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-rule-strong px-2 py-1 text-sm transition-colors hover:border-ink-3"
                      >
                        <LineBullet code={r.code} colorIndex={r.colorIndex} size="sm" />
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-xs text-ink-3">{r.orgName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {p.events.length > 0 && (
                <ol className="mt-3 divide-y divide-rule border-y border-rule">
                  {p.events.map((e) => {
                    const days = daysUntil(e.date, now);
                    const past = days < 0;
                    return (
                      <li key={e.id} className={clsx("flex items-center gap-3 py-2.5", past && "opacity-55")}>
                        <span className="numerals w-16 shrink-0 text-base">{formatDate(e.date)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{e.title}</span>
                          <span className="block text-xs text-ink-3">
                            {KIND_LABEL[e.kind]}
                            {e.estimated && <span className="text-soon">, estimated</span>}
                          </span>
                        </span>
                        <span className="numerals hidden w-20 shrink-0 text-right text-sm text-ink-2 sm:block">
                          {past ? "passed" : days === 0 ? "today" : `in ${days} days`}
                        </span>
                        <EventControls id={e.id} estimated={e.estimated} />
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="mt-1">
                <AddEvent programId={p.id} />
              </div>
            </section>
          ))}
        </div>

        <aside>
          <section aria-labelledby="cal-title" className="panel p-5 lg:sticky lg:top-10">
            <h2 id="cal-title" className="type-display text-xl">Put it in your calendar</h2>
            <p className="mb-4 mt-1 text-sm text-ink-2">
              One feed with every program date plus the day each claimed issue’s window closes. It stays current as you add dates.
            </p>
            <CopyField value={feed} label="Calendar feed URL" />
            <ol className="mt-4 list-decimal space-y-1 pl-4 text-sm text-ink-2">
              <li>In Google Calendar, open Other calendars and choose From URL.</li>
              <li>Paste the link. Google needs a public address, so deploy the app first or download the file and import it.</li>
            </ol>
            <a href={feed} className="btn btn-quiet mt-4 w-full">Download .ics</a>
          </section>
        </aside>
      </div>
    </>
  );
}
