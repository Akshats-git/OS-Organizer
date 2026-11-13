import "server-only";
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { contacts, events, inbox, loops, orgs, programEvents, programs, repos, settings, snoozes } from "@/db/schema";
import { computeActions } from "./next-actions";
import { groupByProgram } from "./programs";
import { dailyActivity, presenceLevel, presenceScore } from "./presence";

const DAY = 86_400_000;

export async function getSetting(key: string) {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

export async function getRepoList() {
  const rows = await db
    .select({ repo: repos, org: orgs, program: programs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .leftJoin(programs, eq(repos.programId, programs.id))
    .where(eq(repos.archived, false))
    .orderBy(asc(repos.colorIndex), asc(repos.id));
  return rows;
}

export async function getProgramOptions() {
  return db.select({ id: programs.id, name: programs.name }).from(programs).orderBy(asc(programs.name));
}

export type RepoWithOrg = Awaited<ReturnType<typeof getRepoList>>[number];

export async function getNetwork() {
  const list = await getRepoList();
  const repoIds = list.map((r) => r.repo.id);
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const nowIso = new Date().toISOString();
  const [loopRows, eventRows, inboxRows, contactRows, snoozeRows] = await Promise.all([
    repoIds.length ? db.select().from(loops).where(inArray(loops.repoId, repoIds)).orderBy(asc(loops.createdAt)) : [],
    repoIds.length
      ? db.select().from(events).where(and(inArray(events.repoId, repoIds), gte(events.occurredAt, since))).orderBy(desc(events.occurredAt))
      : [],
    db.select().from(inbox).where(eq(inbox.status, "new")).orderBy(desc(inbox.receivedAt)),
    db.select().from(contacts),
    db.select().from(snoozes).where(gte(snoozes.until, nowIso)),
  ]);

  const lines = list.map(({ repo, org, program }) => {
    const repoEvents = eventRows.filter((e) => e.repoId === repo.id);
    const score = presenceScore(repoEvents);
    return {
      repo,
      org,
      program,
      active: loopRows.filter((l) => l.repoId === repo.id && l.status === "active"),
      merged: loopRows.filter((l) => l.repoId === repo.id && l.stage === "merged").length,
      presence: { score, ...presenceLevel(score), days: dailyActivity(repoEvents) },
      lastEventAt: repoEvents[0]?.occurredAt ?? null,
    };
  });

  const { actions: allActions, waiting } = computeActions(
    list.map((l) => l.repo),
    loopRows,
    eventRows,
    inboxRows,
    Date.now(),
    contactRows,
  );
  const snoozed = new Set(snoozeRows.map((s) => s.actionId));
  const actions = allActions.filter((a) => !snoozed.has(a.id));
  const activeIds = new Set(loopRows.filter((l) => l.status === "active").map((l) => l.id));
  const programRows = await db.select().from(programs).orderBy(asc(programs.name));
  return {
    lines,
    /** The same lines, split by the program each repo is aimed at. */
    groups: groupByProgram(lines, programRows),
    programs: programRows,
    actions,
    snoozedCount: allActions.length - actions.length,
    waiting,
    inboxCount: inboxRows.length,
    loopEvents: eventRows.filter((e) => e.loopId && activeIds.has(e.loopId)),
  };
}

export type NetworkLine = Awaited<ReturnType<typeof getNetwork>>["lines"][number];

export async function getRepoDetail(slug: string) {
  const row = await db
    .select({ repo: repos, org: orgs, program: programs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .leftJoin(programs, eq(repos.programId, programs.id))
    .where(eq(repos.slug, slug))
    .get();
  if (!row) return null;
  const [loopRows, eventRows, contactRows, programOptions] = await Promise.all([
    db.select().from(loops).where(eq(loops.repoId, row.repo.id)).orderBy(desc(loops.createdAt)),
    db.select().from(events).where(eq(events.repoId, row.repo.id)).orderBy(desc(events.occurredAt)),
    db.select().from(contacts).where(eq(contacts.orgId, row.org.id)).orderBy(asc(contacts.name)),
    getProgramOptions(),
  ]);
  const score = presenceScore(eventRows);
  return {
    ...row,
    programOptions,
    loops: loopRows,
    events: eventRows,
    contacts: contactRows,
    presence: { score, ...presenceLevel(score), days: dailyActivity(eventRows) },
  };
}

export async function getInbox() {
  const [items, list] = await Promise.all([
    db.select().from(inbox).where(ne(inbox.status, "dismissed")).orderBy(desc(inbox.receivedAt)).limit(100),
    getRepoList(),
  ]);
  return { items, repos: list };
}

export async function getPrograms() {
  const [progs, evs, repoRows] = await Promise.all([
    db.select().from(programs).orderBy(asc(programs.name)),
    db.select().from(programEvents).orderBy(asc(programEvents.date)),
    getRepoList(),
  ]);
  return progs.map((p) => ({
    ...p,
    events: evs.filter((e) => e.programId === p.id),
    repos: repoRows.filter((r) => r.repo.programId === p.id).map((r) => ({ ...r.repo, orgName: r.org.name })),
  }));
}

export async function getUpcoming(limit = 4) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({ event: programEvents, program: programs })
    .from(programEvents)
    .innerJoin(programs, eq(programEvents.programId, programs.id))
    .where(gte(programEvents.date, today))
    .orderBy(asc(programEvents.date))
    .limit(limit);
}

export async function getIntegrationStatus() {
  const [lastSync, lastSyncResult, lastDiscord, lastGmail, demo, login] = await Promise.all([
    getSetting("github.lastSync"),
    getSetting("github.lastResult"),
    getSetting("discord.lastIngest"),
    getSetting("gmail.lastIngest"),
    getSetting("demo"),
    getSetting("github.login"),
  ]);
  return {
    github: { configured: Boolean(process.env.GITHUB_TOKEN), lastSync, lastResult: lastSyncResult, login },
    discord: {
      botConfigured: Boolean(process.env.DISCORD_BOT_TOKEN),
      webhookConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL),
      lastIngest: lastDiscord,
    },
    gmail: { lastIngest: lastGmail },
    ingestSecretConfigured: Boolean(process.env.INGEST_SECRET),
    demo: demo === "true",
  };
}

export type PortfolioPr = { title: string; number: number; url: string; status: "merged" | "open" | "closed"; at: string | null };
export type PortfolioRepo = {
  repoId: number; slug: string; code: string; colorIndex: number; owner: string; name: string; orgName: string;
  language: string | null; prs: PortfolioPr[]; reviews: number; issues: number; helped: number;
};

/** Everything you have done, across every repo you have ever tracked. */
export async function getPortfolio() {
  const [rows, loopRows, eventRows] = await Promise.all([
    db.select({ repo: repos, org: orgs }).from(repos).innerJoin(orgs, eq(repos.orgId, orgs.id)).orderBy(asc(repos.colorIndex), asc(repos.id)),
    db.select().from(loops),
    db.select().from(events).orderBy(desc(events.occurredAt)),
  ]);
  const perRepo: PortfolioRepo[] = rows.map(({ repo, org }) => {
    const prs = loopRows
      .filter((l) => l.repoId === repo.id && l.prNumber)
      .map<PortfolioPr>((l) => ({
        title: l.title,
        number: l.prNumber!,
        url: `https://github.com/${repo.owner}/${repo.name}/pull/${l.prNumber}`,
        status: l.stage === "merged" ? "merged" : l.status === "dropped" ? "closed" : "open",
        at: l.mergedAt ?? l.prAt,
      }))
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    const mine = eventRows.filter((e) => e.repoId === repo.id);
    return {
      repoId: repo.id, slug: repo.slug, code: repo.code, colorIndex: repo.colorIndex, owner: repo.owner, name: repo.name, orgName: org.name,
      language: repo.rules?.language ?? null,
      prs,
      reviews: mine.filter((e) => e.kind === "review-given").length,
      issues: mine.filter((e) => e.kind === "issue").length,
      helped: mine.filter((e) => e.kind === "help").length,
    };
  });
  const byRepo = new Map(perRepo.map((r) => [r.repoId, r]));
  const HISTORY = new Set(["pr", "merged", "issue", "review-given", "help"]);
  const history = eventRows
    .filter((e) => HISTORY.has(e.kind) && byRepo.has(e.repoId))
    .slice(0, 80)
    .map((e) => ({ id: e.id, kind: e.kind, title: e.title, url: e.url, occurredAt: e.occurredAt, repo: byRepo.get(e.repoId)! }));
  return { repos: perRepo, history };
}
