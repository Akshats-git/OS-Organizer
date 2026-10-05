import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionList, WaitingList, type RepoChip } from "@/components/action-list";
import { DemoBanner } from "@/components/demo-banner";
import { LineBullet } from "@/components/line-bullet";
import { LoopSheet } from "@/components/loop-sheet";
import { MiniLine } from "@/components/mini-line";
import { getIntegrationStatus, getNetwork, getUpcoming } from "@/lib/data";
import { age, daysUntil, formatDate } from "@/lib/time";

export default async function TodayPage() {
  await connection();
  const [{ lines, actions, waiting, loopEvents }, upcoming, status] = await Promise.all([getNetwork(), getUpcoming(4), getIntegrationStatus()]);

  const repos: RepoChip[] = lines.map((l) => ({ id: l.repo.id, code: l.repo.code, colorIndex: l.repo.colorIndex, name: l.repo.name }));
  const ages = Object.fromEntries([...actions, ...waiting].map((a) => [a.id, age(a.since)]));
  const now = new Date();
  const urgent = actions.filter((a) => a.tone !== "nudge").length;

  return (
    <>
      {status.demo && <DemoBanner />}

      <header className="mb-9 lg:mb-12">
        <p className="text-sm font-semibold text-ink-3">{now.toLocaleDateString("en-US", { weekday: "long" })}</p>
        <h1 className="type-display mt-1 text-[2.75rem] leading-[0.95] sm:text-[3.5rem]">
          {now.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
        </h1>
        <p className="mt-3 max-w-[60ch] text-lg text-ink-2">
          {lines.length === 0
            ? "Add the repos you want to be known in, and this page will tell you what to do next."
            : `${urgent === 0 ? "Nothing urgent" : `${urgent} thing${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} you`}. ${
                waiting.length ? `${waiting.length} ${waiting.length === 1 ? "is" : "are"} waiting on maintainers.` : "Nothing is waiting on maintainers."
              }`}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0 space-y-12">
          {lines.length === 0 ? (
            <div className="panel px-6 py-8">
              <p className="type-display text-2xl">Start your first line</p>
              <p className="mt-2 max-w-[52ch] text-ink-2">Each repo you target becomes a line. Every contribution travels it: ask, get approval, open the issue, raise the PR, get merged.</p>
              <Link href="/lines?add=1" className="btn btn-primary mt-5">Add a repo</Link>
            </div>
          ) : (
            <ActionList actions={actions} repos={repos} ages={ages} />
          )}

          {lines.length > 0 && (
            <section aria-labelledby="waiting-title">
              <h2 id="waiting-title" className="mb-1 text-sm font-semibold text-ink-2">Waiting on others</h2>
              <WaitingList items={waiting} repos={repos} ages={ages} />
            </section>
          )}
        </div>

        <aside className="space-y-10">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-title">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="upcoming-title" className="text-sm font-semibold text-ink-2">Coming up</h2>
                <Link href="/programs" className="link text-xs text-ink-2">All dates</Link>
              </div>
              <ol className="panel divide-y divide-rule">
                {upcoming.map(({ event, program }) => {
                  const days = daysUntil(event.date, now);
                  return (
                    <li key={event.id} className="flex items-center gap-4 px-4 py-3.5">
                      <span className="w-14 shrink-0 text-center">
                        <span className="numerals block text-[1.75rem] leading-none">{days}</span>
                        <span className="text-[0.6875rem] text-ink-3">{days === 1 ? "day" : "days"}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs text-ink-3">{program.name}</span>
                        <span className="block text-sm font-semibold leading-snug">{event.title}</span>
                        <span className="block text-xs text-ink-3">
                          {formatDate(event.date, { month: "short", day: "numeric", year: "numeric" })}
                          {event.estimated && <span className="ml-1.5 text-soon">estimated</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {lines.length > 0 && (
            <section aria-labelledby="network-title">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="network-title" className="text-sm font-semibold text-ink-2">Your lines</h2>
                <Link href="/lines" className="link text-xs text-ink-2">Open the map</Link>
              </div>
              <ul className="panel divide-y divide-rule">
                {lines.map((l) => (
                  <li key={l.repo.id}>
                    <Link href={`/repos/${l.repo.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel-2/60">
                      <LineBullet code={l.repo.code} colorIndex={l.repo.colorIndex} size="sm" />
                      <span className="w-[5.5rem] shrink-0 truncate text-sm font-semibold">{l.repo.name}</span>
                      <MiniLine workflow={l.repo.workflow} colorIndex={l.repo.colorIndex} occupied={l.active.map((x) => x.stage)} className="flex-1" />
                      <span className="w-12 shrink-0 text-right text-xs text-ink-3">{l.presence.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <Suspense>
        <LoopSheet loops={lines.flatMap((l) => l.active)} repos={lines.map((l) => l.repo)} events={loopEvents} />
      </Suspense>
    </>
  );
}
