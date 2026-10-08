import { Ban, Check, CircleDot, ExternalLink, Eye, GitMerge, GitPullRequest, ListChecks, Mail, MessageSquare, NotebookPen, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ActivityBars } from "@/components/activity-bars";
import { DiscordMark, GitHubMark } from "@/components/icons";
import { LineBullet } from "@/components/line-bullet";
import { ProgramPlate } from "@/components/program-sign";
import { LoopSheet } from "@/components/loop-sheet";
import { AddContact, Checklist, CopyProofPack, LogActivity, LoopRows, RepoSettings, SetupNotes, StartLoopForm, TouchContact } from "@/components/repo-widgets";
import type { EventKind } from "@/db/schema";
import { getRepoDetail } from "@/lib/data";
import { ghUrl } from "@/lib/links";
import { lineVar, onLineVar } from "@/lib/lines";
import { NO_PROGRAM_LABEL, programShortName } from "@/lib/programs";
import { WORKFLOW_LABELS } from "@/lib/stages";
import { age, formatDate } from "@/lib/time";

export async function generateMetadata(props: PageProps<"/repos/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: slug.replace(/-/g, "/").replace(/\/([^/]*)$/, "/$1") };
}

const EVENT_ICON: Record<EventKind, ReactNode> = {
  asked: <MessageSquare className="size-3.5" />,
  approved: <Check className="size-3.5" strokeWidth={2.75} />,
  issue: <CircleDot className="size-3.5" />,
  pr: <GitPullRequest className="size-3.5" />,
  merged: <GitMerge className="size-3.5" />,
  closed: <Ban className="size-3.5" />,
  review: <Eye className="size-3.5" />,
  "review-given": <ListChecks className="size-3.5" />,
  help: <Sparkles className="size-3.5" />,
  discord: <DiscordMark className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  note: <NotebookPen className="size-3.5" />,
  collision: <TriangleAlert className="size-3.5" />,
};

export default async function RepoPage(props: PageProps<"/repos/[slug]">) {
  await connection();
  const { slug } = await props.params;
  const showAll = (await props.searchParams).all === "1";
  const data = await getRepoDetail(slug);
  if (!data) notFound();
  const { repo, org, program, programOptions, loops, events, contacts, presence } = data;
  const color = lineVar(repo.colorIndex);
  const active = loops.filter((l) => l.status === "active");
  const merged = loops.filter((l) => l.stage === "merged");
  const checklist = repo.rules?.checklist ?? [];
  const MILESTONES: EventKind[] = ["asked", "approved", "issue", "pr", "merged", "review", "closed", "collision"];
  const shown = showAll ? events : events.filter((e) => MILESTONES.includes(e.kind));
  const stageSince = (l: (typeof loops)[number]) =>
    ({ ask: l.askedAt, approved: l.approvedAt, issue: l.issueAt, pr: l.lastMaintainerAt ?? l.prAt, merged: l.mergedAt })[l.stage] ?? l.createdAt;
  const loopAges = Object.fromEntries(active.map((l) => [l.id, age(stageSince(l))]));

  const proofPack = [
    `### Contributions to ${org.name} (${repo.owner}/${repo.name})`,
    "",
    "| Contribution | Pull request | Status |",
    "| --- | --- | --- |",
    ...loops
      .filter((l) => l.prNumber)
      .map((l) => `| ${l.title.replace(/\|/g, "\\|")} | [#${l.prNumber}](${ghUrl(repo.owner, repo.name, `/pull/${l.prNumber}`)}) | ${l.stage === "merged" ? `Merged ${l.mergedAt ? formatDate(l.mergedAt, { month: "short", day: "numeric", year: "numeric" }) : ""}` : l.status === "dropped" ? "Closed" : "Open"} |`),
  ].join("\n");
  const prCount = loops.filter((l) => l.prNumber).length;

  const reviewDays = repo.medianReviewHours ? repo.medianReviewHours / 24 : null;
  const links = [
    { href: ghUrl(repo.owner, repo.name), label: "Repository", icon: <GitHubMark className="size-4" /> },
    { href: ghUrl(repo.owner, repo.name, "/issues?q=is%3Aopen+label%3A%22good+first+issue%22+no%3Aassignee"), label: "Good first issues", icon: <CircleDot className="size-4" /> },
    org.chatUrl && { href: repo.discordChannelUrl ?? org.chatUrl, label: org.chatPlatform === "discord" ? "Discord" : "Chat", icon: org.chatPlatform === "discord" ? <DiscordMark className="size-4" /> : <MessageSquare className="size-4" /> },
    org.ideasUrl && { href: org.ideasUrl, label: "Ideas page", icon: <Sparkles className="size-4" /> },
    repo.rules?.contributingUrl && { href: repo.rules.contributingUrl, label: "Contributing guide", icon: <NotebookPen className="size-4" /> },
  ].filter(Boolean) as { href: string; label: string; icon: ReactNode }[];

  return (
    <>
      <header className="mb-10">
        {/* The line runs through the header like a platform sign. */}
        <div className="relative mb-6 flex items-center">
          <span className="absolute inset-x-0 h-2 rounded-full" style={{ background: color }} />
          <span className="relative rounded-full bg-page p-1.5">
            <LineBullet code={repo.code} colorIndex={repo.colorIndex} size="xl" />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-ink-3">
          <Link href={program ? `/lines?program=${program.id}` : "/lines"} aria-label={program ? `All ${program.name} lines` : "All lines"}>
            <ProgramPlate label={program ? programShortName(program) : NO_PROGRAM_LABEL} size="sm" />
          </Link>
          <span>
            {org.name}
            {program && <> for {program.name}</>}
          </span>
        </div>
        <h1 className="type-display mt-1 break-words text-[2.5rem] leading-none sm:text-[3.25rem]">
          <span className="text-ink-3">{repo.owner}/</span>
          {repo.name}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          <span className="font-semibold text-ink">{WORKFLOW_LABELS[repo.workflow].name}.</span> {WORKFLOW_LABELS[repo.workflow].hint}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noreferrer" className="btn btn-quiet">
                {l.icon} {l.label} <ExternalLink className="size-3 text-ink-3" />
              </a>
            </li>
          ))}
        </ul>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="motion-title">
            <h2 id="motion-title" className="type-display mb-4 text-2xl">In motion</h2>
            <StartLoopForm repoId={repo.id} workflow={repo.workflow} />
            <div className="mt-2">
              <LoopRows loops={active} repo={repo} ages={loopAges} />
            </div>
          </section>

          <section aria-labelledby="timeline-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="timeline-title" className="type-display text-2xl">Timeline</h2>
              <span className="flex items-center gap-3 text-sm text-ink-3">
                {merged.length} merged so far
                <Link href={showAll ? `/repos/${repo.slug}` : `/repos/${repo.slug}?all=1`} scroll={false} className="link text-ink-2">
                  {showAll ? "Milestones only" : `Show all ${events.length}`}
                </Link>
              </span>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing yet. Your asks, PRs, reviews and merges will appear here.</p>
            ) : (
              <ol className="relative">
                <span className="absolute bottom-3 left-[13px] top-3 w-[3px] rounded-full" style={{ background: color, opacity: 0.35 }} />
                {shown.slice(0, showAll ? 120 : 40).map((e) => {
                  const milestone = e.kind === "merged" || e.kind === "pr" || e.kind === "approved";
                  return (
                    <li key={e.id} className="relative flex items-start gap-4 py-2">
                      <span
                        className="relative z-[1] mt-0.5 grid size-[29px] shrink-0 place-items-center rounded-full border-[3px]"
                        style={milestone ? { background: color, borderColor: color, color: onLineVar(repo.colorIndex) } : { background: "var(--page)", borderColor: color, color: "var(--ink-2)" }}
                      >
                        {EVENT_ICON[e.kind]}
                      </span>
                      <span className="min-w-0 flex-1 pt-1">
                        <span className={milestone ? "font-semibold" : ""}>
                          {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="link">{e.title}</a> : e.title}
                        </span>
                      </span>
                      <time dateTime={e.occurredAt} className="numerals shrink-0 pt-1 text-sm text-ink-3" title={new Date(e.occurredAt).toLocaleString("en-US")}>
                        {formatDate(e.occurredAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-10">
          <section aria-labelledby="presence-title">
            <h2 id="presence-title" className="text-sm font-semibold text-ink-2">Presence</h2>
            <p className="type-display mt-1 text-3xl">{presence.label}</p>
            <p className="mb-4 text-sm text-ink-2">{presence.hint}</p>
            <ActivityBars days={presence.days} colorIndex={repo.colorIndex} label={`Activity in ${repo.name}`} />
          </section>

          <section aria-labelledby="rhythm-title">
            <h2 id="rhythm-title" className="text-sm font-semibold text-ink-2">Maintainer rhythm</h2>
            {reviewDays !== null ? (
              <p className="mt-1 text-sm">
                First replies usually come within{" "}
                <span className="numerals text-lg">{reviewDays < 1 ? `${repo.medianReviewHours} hours` : `${Math.round(reviewDays * 10) / 10} days`}</span>. You’ll get a nudge to ping after {Math.max(repo.staleDays, Math.ceil((repo.medianReviewHours! * 2) / 24))} quiet days.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-3">Sync GitHub to measure how fast maintainers reply here.</p>
            )}
          </section>

          <section aria-labelledby="checklist-title">
            <h2 id="checklist-title" className="mb-2 text-sm font-semibold text-ink-2">Before you open a PR</h2>
            <Checklist repoId={repo.id} items={checklist} />
          </section>

          <section aria-labelledby="people-title">
            <h2 id="people-title" className="mb-2 text-sm font-semibold text-ink-2">People</h2>
            {contacts.length > 0 && (
              <ul className="divide-y divide-rule">
                {contacts.map((c) => {
                  let local: string | null = null;
                  try {
                    local = c.timezone ? new Date().toLocaleTimeString("en-US", { timeZone: c.timezone, hour: "numeric", minute: "2-digit" }) : null;
                  } catch {}
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {c.name} {c.handle && <span className="font-normal text-ink-3">{c.handle}</span>}
                        </span>
                        <span className="block text-xs text-ink-3">
                          {[c.role, local && `${local} for them`, c.lastContactAt && `last talked ${age(c.lastContactAt)} ago`].filter(Boolean).join(", ")}
                        </span>
                      </span>
                      <TouchContact id={c.id} />
                    </li>
                  );
                })}
              </ul>
            )}
            <AddContact orgId={org.id} />
          </section>

          <section aria-labelledby="proof-title">
            <h2 id="proof-title" className="text-sm font-semibold text-ink-2">Proof pack</h2>
            <p className="mb-3 mt-1 text-sm text-ink-2">Every PR you’ve opened here, formatted for the contributions section of a proposal.</p>
            <CopyProofPack markdown={proofPack} count={prCount} />
          </section>

          <section aria-labelledby="log-title">
            <h2 id="log-title" className="mb-2 text-sm font-semibold text-ink-2">Log something GitHub can’t see</h2>
            <LogActivity repoId={repo.id} />
          </section>

          <section aria-labelledby="notes-title">
            <h2 id="notes-title" className="mb-2 text-sm font-semibold text-ink-2">Setup notes</h2>
            <SetupNotes repoId={repo.id} initial={repo.setupNotes ?? ""} />
          </section>

          <details className="group rounded-[var(--radius-panel)] border border-rule px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-ink-2 marker:hidden">
              Repo settings
              <span className="float-right text-ink-3 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="mt-4">
              <RepoSettings repo={repo} programs={programOptions} />
            </div>
          </details>
        </aside>
      </div>

      <Suspense>
        <LoopSheet loops={loops} repos={[repo]} events={events} />
      </Suspense>
    </>
  );
}
