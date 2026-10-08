"use server";

import { eq, inArray, like, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  contacts, events, inbox, loops, orgs, programEvents, programs, repos, settings,
  type Loop, type Stage, type Workflow, WORKFLOWS,
} from "@/db/schema";
import { runSync } from "@/lib/github";
import { fileItem, type FileAs } from "@/lib/ingest";
import { suggestCode } from "@/lib/lines";
import { parseLink } from "@/lib/links";
import { nextStage, WORKFLOW_STATIONS } from "@/lib/stages";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const done = (message: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};
const fail = (message: string): ActionResult => ({ ok: false, message });

async function loadLoop(id: number) {
  const row = await db.select({ loop: loops, repo: repos }).from(loops).innerJoin(repos, eq(loops.repoId, repos.id)).where(eq(loops.id, id)).get();
  if (!row) throw new Error("That loop no longer exists.");
  return row;
}

const STAMP: Record<Stage, keyof Loop> = { ask: "askedAt", approved: "approvedAt", issue: "issueAt", pr: "prAt", merged: "mergedAt" };
const EVENT_FOR: Record<Stage, "asked" | "approved" | "issue" | "pr" | "merged"> = { ask: "asked", approved: "approved", issue: "issue", pr: "pr", merged: "merged" };

/** A repo files under exactly one program; anything unknown files under none. */
async function resolveProgram(id?: string | null) {
  const wanted = id?.trim();
  if (!wanted) return null;
  const program = await db.query.programs.findFirst({ where: eq(programs.id, wanted) });
  return program?.id ?? null;
}

export async function startLoop(input: { repoId: number; title: string; link?: string }): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return fail("Give the loop a short name, like the issue title.");
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, input.repoId) });
  if (!repo) return fail("That repo no longer exists.");
  const link = input.link ? parseLink(input.link) : null;
  const now = new Date().toISOString();
  const values: typeof loops.$inferInsert = { repoId: repo.id, title, stage: WORKFLOW_STATIONS[repo.workflow][0] };

  if (link?.kind === "github-pr") Object.assign(values, { stage: "pr", prNumber: link.number, prAt: now, reviewState: "waiting" });
  else if (link?.kind === "github-issue") Object.assign(values, { stage: "issue", issueNumber: link.number, issueAt: now });
  else if (link?.kind === "discord-message") Object.assign(values, { stage: "ask", askUrl: link.url, askedAt: now });
  else values[STAMP[values.stage] as "askedAt"] = now;

  const [loop] = await db.insert(loops).values(values).returning();
  await db.insert(events).values({ repoId: repo.id, loopId: loop.id, kind: EVENT_FOR[loop.stage], title: `Started “${title}”`, url: link?.url, source: "manual" });
  return done(`Started “${title}” at ${loop.stage === "pr" ? "PR" : loop.stage[0].toUpperCase() + loop.stage.slice(1)}.`);
}

export async function advanceLoop(id: number, extra?: { link?: string; approvedBy?: string }): Promise<ActionResult> {
  const { loop, repo } = await loadLoop(id);
  const to = nextStage(repo.workflow, loop.stage);
  if (!to) return fail("This loop is already at the last station.");
  const now = new Date().toISOString();
  const link = extra?.link ? parseLink(extra.link) : null;
  const patch: Partial<Loop> = { stage: to, updatedAt: now, [STAMP[to]]: now };
  if (to === "approved") Object.assign(patch, { approvedBy: extra?.approvedBy || null, approvalUrl: link?.url ?? null });
  if (link?.kind === "github-issue") patch.issueNumber = link.number;
  if (link?.kind === "github-pr") Object.assign(patch, { prNumber: link.number, reviewState: "waiting" });
  const bare = extra?.link?.trim().match(/^#?(\d+)$/);
  if (bare && to === "issue") patch.issueNumber = Number(bare[1]);
  if (bare && to === "pr") Object.assign(patch, { prNumber: Number(bare[1]), reviewState: "waiting" });
  if (to === "merged") Object.assign(patch, { status: "done" });
  await db.update(loops).set(patch).where(eq(loops.id, id));
  const label = { ask: "Asked", approved: "Approved", issue: "Issue opened", pr: "PR opened", merged: "Merged" }[to];
  await db.insert(events).values({ repoId: repo.id, loopId: id, kind: EVENT_FOR[to], title: `${label}: ${loop.title}`, url: link?.url, actor: extra?.approvedBy || null, source: "manual" });
  return done(to === "merged" ? `Merged “${loop.title}”. Nice work.` : `Moved “${loop.title}” to ${label === "PR opened" ? "PR" : label.replace(" opened", "")}.`);
}

export async function moveLoopBack(id: number): Promise<ActionResult> {
  const { loop, repo } = await loadLoop(id);
  const stations = WORKFLOW_STATIONS[repo.workflow];
  const i = stations.indexOf(loop.stage);
  if (i <= 0) return fail("This loop is already at the first station.");
  await db.update(loops).set({ stage: stations[i - 1], status: "active", updatedAt: new Date().toISOString() }).where(eq(loops.id, id));
  return done(`Moved “${loop.title}” back a station.`);
}

export async function updateLoop(id: number, input: { title?: string; issue?: string; pr?: string; askUrl?: string; approvedBy?: string }): Promise<ActionResult> {
  const { loop, repo } = await loadLoop(id);
  const patch: Partial<Loop> = { updatedAt: new Date().toISOString() };
  if (input.title?.trim()) patch.title = input.title.trim();
  const num = (v?: string) => {
    if (!v?.trim()) return null;
    const p = parseLink(v);
    if (p && (p.kind === "github-issue" || p.kind === "github-pr")) return p.number;
    const n = Number(v.replace("#", ""));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  if (input.issue !== undefined) {
    const n = num(input.issue);
    if (n === undefined) return fail("Use an issue number like 214 or a GitHub issue link.");
    patch.issueNumber = n;
  }
  if (input.pr !== undefined) {
    const n = num(input.pr);
    if (n === undefined) return fail("Use a PR number like 231 or a GitHub PR link.");
    patch.prNumber = n;
    if (n && WORKFLOW_STATIONS[repo.workflow].indexOf(loop.stage) < WORKFLOW_STATIONS[repo.workflow].indexOf("pr")) {
      Object.assign(patch, { stage: "pr", prAt: loop.prAt ?? new Date().toISOString(), reviewState: "waiting" });
    }
  }
  if (input.askUrl !== undefined) patch.askUrl = input.askUrl.trim() || null;
  if (input.approvedBy !== undefined) patch.approvedBy = input.approvedBy.trim() || null;
  await db.update(loops).set(patch).where(eq(loops.id, id));
  return done("Saved.");
}

export async function setLoopStatus(id: number, status: "active" | "dropped"): Promise<ActionResult> {
  const { loop } = await loadLoop(id);
  await db.update(loops).set({ status, updatedAt: new Date().toISOString() }).where(eq(loops.id, id));
  if (status === "dropped") await db.insert(events).values({ repoId: loop.repoId, loopId: id, kind: "closed", title: `Dropped “${loop.title}”`, source: "manual" });
  return done(status === "dropped" ? `Dropped “${loop.title}”.` : `Restored “${loop.title}”.`);
}

export async function clearCollision(id: number): Promise<ActionResult> {
  await db.update(loops).set({ collisionUrl: null }).where(eq(loops.id, id));
  return done("Marked as checked.");
}

export async function logActivity(input: { repoId: number; kind: "help" | "review-given" | "note" | "discord"; title: string; url?: string }): Promise<ActionResult> {
  if (!input.title.trim()) return fail("Describe what you did in a few words.");
  await db.insert(events).values({ repoId: input.repoId, kind: input.kind, title: input.title.trim(), url: input.url?.trim() || null, source: "manual" });
  return done("Logged.");
}

export async function fileInboxItem(id: number, repoId: number, as: FileAs): Promise<ActionResult> {
  try {
    return done(await fileItem(id, repoId, as));
  } catch (err) {
    return fail((err as Error).message);
  }
}

export async function dismissInboxItem(id: number): Promise<ActionResult> {
  await db.update(inbox).set({ status: "dismissed" }).where(eq(inbox.id, id));
  return done("Dismissed.");
}

export async function addRepo(input: {
  github: string; orgName?: string; programId?: string; workflow?: Workflow; chatUrl?: string; discordGuildId?: string;
}): Promise<ActionResult & { slug?: string }> {
  const raw = input.github.trim().replace(/\.git$/, "");
  const link = parseLink(raw.startsWith("http") ? raw : `https://github.com/${raw}`);
  if (!link || link.kind === "discord-message") return fail("Paste a GitHub repo link or owner/name, like sympy/sympy.");
  const { owner, repo: name } = link;
  const slug = `${owner}-${name}`.toLowerCase();
  if (await db.query.repos.findFirst({ where: eq(repos.slug, slug) })) return fail(`${owner}/${name} is already on your network.`);

  const wantedProgram = await resolveProgram(input.programId);
  const orgSlug = (input.orgName?.trim() || owner).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let org = await db.query.orgs.findFirst({ where: eq(orgs.slug, orgSlug) });
  if (!org) {
    const isDiscord = /discord\.(gg|com)/.test(input.chatUrl ?? "");
    [org] = await db
      .insert(orgs)
      .values({
        slug: orgSlug, name: input.orgName?.trim() || owner, programId: wantedProgram,
        chatUrl: input.chatUrl?.trim() || null, chatPlatform: input.chatUrl ? (isDiscord ? "discord" : "other") : null,
        discordGuildId: input.discordGuildId?.trim() || null,
      })
      .returning();
  }
  const all = await db.select({ code: repos.code, colorIndex: repos.colorIndex, archived: repos.archived }).from(repos);
  const [{ top }] = await db.select({ top: max(repos.colorIndex) }).from(repos).where(eq(repos.archived, false));
  const used = new Set(all.filter((r) => !r.archived).map((r) => r.colorIndex % 8));
  const colorIndex = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i)) ?? ((top ?? -1) + 1);
  const workflow = WORKFLOWS.includes(input.workflow as Workflow) ? input.workflow! : "ask-first";
  const programId = wantedProgram ?? org.programId;
  await db.insert(repos).values({ orgId: org.id, programId, owner, name, slug, code: suggestCode(name, all.map((r) => r.code)), colorIndex, workflow });
  return { ...done(`Added ${owner}/${name}. Sync GitHub to pull in your PRs and its contribution rules.`), slug };
}

export async function updateRepo(id: number, input: {
  workflow?: Workflow; staleDays?: number; claimDays?: number; discordChannelUrl?: string; setupNotes?: string; checklist?: string[]; code?: string; programId?: string;
}): Promise<ActionResult> {
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo) return fail("That repo no longer exists.");
  const patch: Partial<typeof repo> = {};
  if (input.programId !== undefined) patch.programId = await resolveProgram(input.programId);
  if (input.workflow && WORKFLOWS.includes(input.workflow)) patch.workflow = input.workflow;
  if (input.staleDays && input.staleDays > 0) patch.staleDays = Math.round(input.staleDays);
  if (input.claimDays && input.claimDays > 0) patch.claimDays = Math.round(input.claimDays);
  if (input.discordChannelUrl !== undefined) patch.discordChannelUrl = input.discordChannelUrl.trim() || null;
  if (input.setupNotes !== undefined) patch.setupNotes = input.setupNotes;
  if (input.code && /^[A-Za-z0-9]{2}$/.test(input.code)) patch.code = input.code.toUpperCase();
  if (input.checklist) patch.rules = { ...repo.rules, checklist: input.checklist.map((c) => c.trim()).filter(Boolean) };
  await db.update(repos).set(patch).where(eq(repos.id, id));
  return done("Saved.");
}

export async function archiveRepo(id: number): Promise<ActionResult> {
  await db.update(repos).set({ archived: true }).where(eq(repos.id, id));
  return done("Removed from your network. Its history is kept.");
}

export async function addContact(input: { orgId: number; name: string; handle?: string; role?: string; timezone?: string }): Promise<ActionResult> {
  if (!input.name.trim()) return fail("Add a name.");
  await db.insert(contacts).values({ orgId: input.orgId, name: input.name.trim(), handle: input.handle?.trim() || null, role: input.role?.trim() || null, timezone: input.timezone?.trim() || null });
  return done(`Added ${input.name.trim()}.`);
}

export async function touchContact(id: number): Promise<ActionResult> {
  await db.update(contacts).set({ lastContactAt: new Date().toISOString() }).where(eq(contacts.id, id));
  return done("Noted.");
}

export async function addProgramEvent(input: { programId: string; title: string; date: string; kind: "open" | "deadline" | "announce" | "coding" | "result" }): Promise<ActionResult> {
  if (!input.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Add a title and a date.");
  await db.insert(programEvents).values({ ...input, title: input.title.trim(), estimated: false });
  return done("Added to the timeline and your calendar feed.");
}

export async function confirmProgramEvent(id: number): Promise<ActionResult> {
  await db.update(programEvents).set({ estimated: false }).where(eq(programEvents.id, id));
  return done("Marked as confirmed.");
}

export async function deleteProgramEvent(id: number): Promise<ActionResult> {
  await db.delete(programEvents).where(eq(programEvents.id, id));
  return done("Removed.");
}

export async function syncNow(): Promise<ActionResult> {
  const result = await runSync();
  revalidatePath("/", "layout");
  return { ok: result.ok, message: result.message };
}

export async function clearDemoData(): Promise<ActionResult> {
  const demoOrgs = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.isDemo, true));
  const ids = demoOrgs.map((o) => o.id);
  if (ids.length) {
    const demoRepos = await db.select({ id: repos.id }).from(repos).where(inArray(repos.orgId, ids));
    const repoIds = demoRepos.map((r) => r.id);
    if (repoIds.length) await db.delete(inbox).where(inArray(inbox.repoId, repoIds));
    await db.delete(inbox).where(like(inbox.externalId, "demo-%"));
    await db.delete(orgs).where(inArray(orgs.id, ids));
  }
  await db.insert(settings).values({ key: "demo", value: "false" }).onConflictDoUpdate({ target: settings.key, set: { value: "false" } });
  return done("Demo data cleared. Add your first repo to start a line.");
}
