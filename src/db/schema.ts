import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** A mentorship program such as GSoC or LFX. */
export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  summary: text("summary"),
});

/** A dated milestone in a program cycle (applications open, results, ...). */
export const programEvents = sqliteTable("program_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  kind: text("kind", { enum: ["open", "deadline", "announce", "coding", "result"] }).notNull(),
  estimated: integer("estimated", { mode: "boolean" }).notNull().default(false),
});

export const orgs = sqliteTable("orgs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  programId: text("program_id").references(() => programs.id, { onDelete: "set null" }),
  website: text("website"),
  chatPlatform: text("chat_platform", {
    enum: ["discord", "zulip", "slack", "matrix", "mailing-list", "other"],
  }),
  chatUrl: text("chat_url"),
  discordGuildId: text("discord_guild_id"),
  ideasUrl: text("ideas_url"),
  notes: text("notes"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(now),
});

export type RepoRules = {
  contributingUrl?: string;
  dco?: boolean;
  cla?: boolean;
  conventionalCommits?: boolean;
  changelog?: boolean;
  /** Checklist lines lifted from the PR template, plus your own. */
  checklist?: string[];
  fetchedAt?: string;
};

export const WORKFLOWS = ["ask-first", "issue-first", "pr-first"] as const;
export type Workflow = (typeof WORKFLOWS)[number];

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull(), // two-letter line bullet
  colorIndex: integer("color_index").notNull().default(0),
  workflow: text("workflow", { enum: WORKFLOWS }).notNull().default("ask-first"),
  /** Days a PR can wait on maintainers before we suggest a ping. */
  staleDays: integer("stale_days").notNull().default(5),
  /** Days an approved claim stays safe without a PR. */
  claimDays: integer("claim_days").notNull().default(7),
  discordChannelUrl: text("discord_channel_url"),
  rules: text("rules", { mode: "json" }).$type<RepoRules>(),
  setupNotes: text("setup_notes"),
  medianReviewHours: real("median_review_hours"),
  lastSyncedAt: text("last_synced_at"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(now),
});

export const STAGES = ["ask", "approved", "issue", "pr", "merged"] as const;
export type Stage = (typeof STAGES)[number];

/** One unit of contribution work moving through a repo's stations. */
export const loops = sqliteTable("loops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  stage: text("stage", { enum: STAGES }).notNull(),
  status: text("status", { enum: ["active", "done", "dropped"] }).notNull().default("active"),
  askUrl: text("ask_url"),
  askedAt: text("asked_at"),
  approvedBy: text("approved_by"),
  approvalUrl: text("approval_url"),
  approvedAt: text("approved_at"),
  issueNumber: integer("issue_number"),
  issueAt: text("issue_at"),
  prNumber: integer("pr_number"),
  prAt: text("pr_at"),
  reviewState: text("review_state", {
    enum: ["waiting", "changes_requested", "approved"],
  }),
  ciState: text("ci_state", { enum: ["pending", "success", "failure"] }),
  hasConflict: integer("has_conflict", { mode: "boolean" }).notNull().default(false),
  lastMaintainerAt: text("last_maintainer_at"),
  /** URL of someone else's PR that targets the same issue. */
  collisionUrl: text("collision_url"),
  mergedAt: text("merged_at"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const EVENT_KINDS = [
  "asked",
  "approved",
  "issue",
  "pr",
  "review",
  "merged",
  "closed",
  "review-given",
  "help",
  "discord",
  "email",
  "note",
  "collision",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  loopId: integer("loop_id").references(() => loops.id, { onDelete: "set null" }),
  kind: text("kind", { enum: EVENT_KINDS }).notNull(),
  title: text("title").notNull(),
  url: text("url"),
  actor: text("actor"),
  source: text("source", { enum: ["manual", "discord", "github", "gmail"] }).notNull(),
  externalId: text("external_id").unique(),
  occurredAt: text("occurred_at").notNull().default(now),
});

/** Things forwarded from Discord, Gmail or GitHub notifications, waiting to be filed. */
export const inbox = sqliteTable(
  "inbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source", { enum: ["discord", "gmail", "github"] }).notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    author: text("author"),
    context: text("context"),
    discordGuildId: text("discord_guild_id"),
    repoId: integer("repo_id").references(() => repos.id, { onDelete: "set null" }),
    status: text("status", { enum: ["new", "filed", "dismissed"] }).notNull().default("new"),
    receivedAt: text("received_at").notNull().default(now),
  },
  (t) => [uniqueIndex("inbox_source_external").on(t.source, t.externalId)],
);

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  handle: text("handle"),
  role: text("role"),
  timezone: text("timezone"),
  notes: text("notes"),
  lastContactAt: text("last_contact_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Program = typeof programs.$inferSelect;
export type ProgramEvent = typeof programEvents.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type Loop = typeof loops.$inferSelect;
export type Event = typeof events.$inferSelect;
export type InboxItem = typeof inbox.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
