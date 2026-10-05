import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, inbox, loops, orgs, repos, settings, type Repo } from "@/db/schema";
import { findLinks, repoFromSubject } from "./links";

export const ingestSchema = z.object({
  source: z.enum(["discord", "gmail", "github"]),
  externalId: z.string().min(1).max(200),
  title: z.string().max(500).optional(),
  body: z.string().max(8000).optional(),
  url: z.string().url().optional().nullable(),
  author: z.string().max(200).optional().nullable(),
  context: z.string().max(300).optional().nullable(),
  discordGuildId: z.string().max(40).optional().nullable(),
  receivedAt: z.string().optional(),
});

export type IngestPayload = z.infer<typeof ingestSchema>;

async function activeRepos() {
  return db
    .select({ repo: repos, org: orgs })
    .from(repos)
    .innerJoin(orgs, eq(repos.orgId, orgs.id))
    .where(eq(repos.archived, false))
    .orderBy(asc(repos.colorIndex));
}

/** Guess which repo a forwarded message or email belongs to. */
export async function suggestRepo(p: Pick<IngestPayload, "body" | "title" | "url" | "discordGuildId" | "context">): Promise<Repo | null> {
  const list = await activeRepos();
  const match = (owner: string, name: string) =>
    list.find((r) => r.repo.owner.toLowerCase() === owner.toLowerCase() && r.repo.name.toLowerCase() === name.toLowerCase())?.repo;

  for (const link of findLinks(`${p.url ?? ""} ${p.body ?? ""}`)) {
    if (link.kind !== "discord-message") {
      const hit = match(link.owner, link.repo);
      if (hit) return hit;
    }
  }
  const subject = repoFromSubject(p.title ?? "");
  if (subject) {
    const hit = match(subject.owner, subject.repo);
    if (hit) return hit;
  }
  if (p.discordGuildId) {
    const inGuild = list.filter((r) => r.org.discordGuildId === p.discordGuildId);
    if (inGuild.length) return inGuild[0].repo;
  }
  const haystack = `${p.context ?? ""} ${p.title ?? ""}`.toLowerCase();
  const byName = list.find((r) => haystack.includes(r.repo.name.toLowerCase()) && r.repo.name.length > 3) ?? list.find((r) => haystack.includes(r.org.slug));
  return byName?.repo ?? null;
}

export async function ingestItem(p: IngestPayload) {
  const suggestion = await suggestRepo(p);
  const title = (p.title || p.body || "(no text)").replace(/\s+/g, " ").slice(0, 280);
  const [row] = await db
    .insert(inbox)
    .values({
      source: p.source, externalId: p.externalId, title, body: p.body ?? null, url: p.url ?? null, author: p.author ?? null,
      context: p.context ?? null, discordGuildId: p.discordGuildId ?? null, repoId: suggestion?.id ?? null,
      ...(p.receivedAt ? { receivedAt: p.receivedAt } : {}),
    })
    .onConflictDoUpdate({ target: [inbox.source, inbox.externalId], set: { title, body: p.body ?? null } })
    .returning();
  const now = new Date().toISOString();
  await db.insert(settings).values({ key: `${p.source}.lastIngest`, value: now }).onConflictDoUpdate({ target: settings.key, set: { value: now } });
  return { item: row, suggestion };
}

export type FileAs = "ask" | "approval" | "note";

/** Attach an inbox item to a repo, moving the right loop forward. Returns a sentence describing what changed. */
export async function fileItem(id: number, repoId: number, as: FileAs): Promise<string> {
  const item = await db.query.inbox.findFirst({ where: eq(inbox.id, id) });
  if (!item) throw new Error("That inbox item no longer exists.");
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, repoId) });
  if (!repo) throw new Error("That repo no longer exists.");
  const now = new Date().toISOString();
  const at = item.receivedAt ?? now;
  const source = item.source === "github" ? "github" : item.source;
  const excerpt = item.title.length > 72 ? item.title.slice(0, 70) + "…" : item.title;
  let summary: string;

  if (as === "approval") {
    const waiting = await db.query.loops.findFirst({
      where: and(eq(loops.repoId, repoId), eq(loops.status, "active"), eq(loops.stage, "ask")),
      orderBy: asc(loops.askedAt),
    });
    if (waiting) {
      await db.update(loops).set({ stage: "approved", approvedAt: at, approvalUrl: item.url, approvedBy: item.author?.startsWith("@") ? item.author : null, updatedAt: now }).where(eq(loops.id, waiting.id));
      await db.insert(events).values({ repoId, loopId: waiting.id, kind: "approved", title: "Approval received", url: item.url, source, occurredAt: at });
      summary = `“${waiting.title}” moved to Approved.`;
    } else {
      const [loop] = await db.insert(loops).values({ repoId, title: excerpt, stage: "approved", approvedAt: at, approvalUrl: item.url }).returning();
      await db.insert(events).values({ repoId, loopId: loop.id, kind: "approved", title: "Approval received", url: item.url, source, occurredAt: at });
      summary = `Started a new loop at Approved in ${repo.name}.`;
    }
  } else if (as === "ask") {
    const [loop] = await db.insert(loops).values({ repoId, title: excerpt, stage: "ask", askUrl: item.url, askedAt: at }).returning();
    await db.insert(events).values({ repoId, loopId: loop.id, kind: "asked", title: `Asked: ${excerpt}`, url: item.url, source, occurredAt: at });
    summary = `Started a new loop at Ask in ${repo.name}.`;
  } else {
    await db.insert(events).values({ repoId, kind: item.source === "gmail" ? "email" : "discord", title: excerpt, url: item.url, source, occurredAt: at });
    summary = `Saved to ${repo.name}’s timeline.`;
  }

  await db.update(inbox).set({ status: "filed", repoId }).where(eq(inbox.id, id));
  return summary;
}
