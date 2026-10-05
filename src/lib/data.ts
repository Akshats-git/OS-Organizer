import "server-only";
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { contacts, events, inbox, loops, orgs, programEvents, programs, repos, settings } from "@/db/schema";
import { computeActions } from "./next-actions";
import { dailyActivity, presenceLevel, presenceScore } from "./presence";

const DAY = 86_400_000;

export async function getSetting(key: string) {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

export async function getRepoList() {
  const rows = await db
    .select({ repo: repos, org: orgs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .where(eq(repos.archived, false))
    .orderBy(asc(repos.colorIndex), asc(repos.id));
  return rows;
}

export type RepoWithOrg = Awaited<ReturnType<typeof getRepoList>>[number];

export async function getNetwork() {
  const list = await getRepoList();
  const repoIds = list.map((r) => r.repo.id);
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const [loopRows, eventRows, inboxRows] = await Promise.all([
    repoIds.length ? db.select().from(loops).where(inArray(loops.repoId, repoIds)).orderBy(asc(loops.createdAt)) : [],
    repoIds.length
      ? db.select().from(events).where(and(inArray(events.repoId, repoIds), gte(events.occurredAt, since))).orderBy(desc(events.occurredAt))
      : [],
    db.select().from(inbox).where(eq(inbox.status, "new")).orderBy(desc(inbox.receivedAt)),
  ]);

  const lines = list.map(({ repo, org }) => {
    const repoEvents = eventRows.filter((e) => e.repoId === repo.id);
    const score = presenceScore(repoEvents);
    return {
      repo,
      org,
      active: loopRows.filter((l) => l.repoId === repo.id && l.status === "active"),
      merged: loopRows.filter((l) => l.repoId === repo.id && l.stage === "merged").length,
      presence: { score, ...presenceLevel(score), days: dailyActivity(repoEvents) },
      lastEventAt: repoEvents[0]?.occurredAt ?? null,
    };
  });

  const { actions, waiting } = computeActions(
    list.map((l) => l.repo),
    loopRows,
    eventRows,
    inboxRows,
  );
  const activeIds = new Set(loopRows.filter((l) => l.status === "active").map((l) => l.id));
  return {
    lines,
    actions,
    waiting,
    inboxCount: inboxRows.length,
    loopEvents: eventRows.filter((e) => e.loopId && activeIds.has(e.loopId)),
  };
}

export type NetworkLine = Awaited<ReturnType<typeof getNetwork>>["lines"][number];

export async function getRepoDetail(slug: string) {
  const row = await db
    .select({ repo: repos, org: orgs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .where(eq(repos.slug, slug))
    .get();
  if (!row) return null;
  const [loopRows, eventRows, contactRows, program] = await Promise.all([
    db.select().from(loops).where(eq(loops.repoId, row.repo.id)).orderBy(desc(loops.createdAt)),
    db.select().from(events).where(eq(events.repoId, row.repo.id)).orderBy(desc(events.occurredAt)),
    db.select().from(contacts).where(eq(contacts.orgId, row.org.id)).orderBy(asc(contacts.name)),
    row.org.programId ? db.query.programs.findFirst({ where: eq(programs.id, row.org.programId) }) : null,
  ]);
  const score = presenceScore(eventRows);
  return {
    ...row,
    program: program ?? null,
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
  const [progs, evs, orgRows] = await Promise.all([
    db.select().from(programs).orderBy(asc(programs.name)),
    db.select().from(programEvents).orderBy(asc(programEvents.date)),
    db.select().from(orgs),
  ]);
  return progs.map((p) => ({
    ...p,
    events: evs.filter((e) => e.programId === p.id),
    orgCount: orgRows.filter((o) => o.programId === p.id).length,
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
