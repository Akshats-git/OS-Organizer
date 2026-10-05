import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, inbox, loops, orgs, repos, settings, type Loop, type Repo, type RepoRules } from "@/db/schema";
import { notifyDiscord } from "./notify";

const API = "https://api.github.com";
const WEEK = 7 * 86_400_000;

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set. Add a personal access token to .env to turn on GitHub sync.");
  return t;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[]; message?: string };
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.map((e) => e.message).join("; ") ?? json.message ?? `GitHub returned ${res.status}`);
  }
  return json.data as T;
}

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token()}`, accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

async function setSetting(key: string, value: string) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getLogin() {
  const me = await rest<{ login: string }>("/user");
  await setSetting("github.login", me.login);
  return me.login;
}

type Actor = { login: string } | null;
type TimelineNode =
  | { __typename: "PullRequestReview"; author: Actor; submittedAt: string; state: string; url: string }
  | { __typename: "IssueComment"; author: Actor; createdAt: string; url: string };

type PRNode = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  merged: boolean;
  mergedAt: string | null;
  createdAt: string;
  reviewDecision: "CHANGES_REQUESTED" | "APPROVED" | "REVIEW_REQUIRED" | null;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  closingIssuesReferences: { nodes: { number: number }[] };
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
  timelineItems: { nodes: TimelineNode[] };
};

type IssueNode = { number: number; title: string; url: string; state: "OPEN" | "CLOSED"; createdAt: string };

const REPO_QUERY = /* GraphQL */ `
  query RepoActivity($prs: String!, $issues: String!, $reviewed: String!) {
    prs: search(query: $prs, type: ISSUE, first: 30) {
      nodes {
        ... on PullRequest {
          number title url state merged mergedAt createdAt reviewDecision mergeable
          closingIssuesReferences(first: 5) { nodes { number } }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
          timelineItems(last: 20, itemTypes: [PULL_REQUEST_REVIEW, ISSUE_COMMENT]) {
            nodes {
              __typename
              ... on PullRequestReview { author { login } submittedAt state url }
              ... on IssueComment { author { login } createdAt url }
            }
          }
        }
      }
    }
    issues: search(query: $issues, type: ISSUE, first: 20) {
      nodes { ... on Issue { number title url state createdAt } }
    }
    reviewed: search(query: $reviewed, type: ISSUE, first: 20) {
      nodes { ... on PullRequest { number title url updatedAt } }
    }
  }
`;

const ISSUE_REFS_QUERY = /* GraphQL */ `
  query IssueRefs($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        timelineItems(last: 30, itemTypes: [CROSS_REFERENCED_EVENT]) {
          nodes {
            ... on CrossReferencedEvent {
              willCloseTarget
              source { ... on PullRequest { number url state author { login } } }
            }
          }
        }
      }
    }
  }
`;

const RULES_QUERY = /* GraphQL */ `
  query Rules($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      url
      c1: object(expression: "HEAD:CONTRIBUTING.md") { ... on Blob { text } }
      c2: object(expression: "HEAD:.github/CONTRIBUTING.md") { ... on Blob { text } }
      c3: object(expression: "HEAD:docs/CONTRIBUTING.md") { ... on Blob { text } }
      t1: object(expression: "HEAD:.github/PULL_REQUEST_TEMPLATE.md") { ... on Blob { text } }
      t2: object(expression: "HEAD:.github/pull_request_template.md") { ... on Blob { text } }
      t3: object(expression: "HEAD:PULL_REQUEST_TEMPLATE.md") { ... on Blob { text } }
      merged: pullRequests(last: 25, states: MERGED) {
        nodes {
          createdAt
          author { login }
          timelineItems(first: 6, itemTypes: [PULL_REQUEST_REVIEW, ISSUE_COMMENT]) {
            nodes {
              __typename
              ... on PullRequestReview { author { login } submittedAt }
              ... on IssueComment { author { login } createdAt }
            }
          }
        }
      }
    }
  }
`;

type Blob = { text: string } | null;

/** Read CONTRIBUTING and the PR template for signals worth a checklist item. */
export function digestRules(contributing: string, template: string, existing: RepoRules | null, contributingUrl?: string): RepoRules {
  const c = contributing.toLowerCase();
  const fromTemplate = [...template.matchAll(/^\s*[-*]\s*\[\s?\]\s+(.+)$/gm)].map((m) => m[1].replace(/<!--.*?-->/g, "").trim()).filter(Boolean);
  const derived: string[] = [];
  const dco = /signed-off-by|\bdco\b|developer certificate of origin|git commit -s/.test(c);
  const cla = /\bcla\b|contributor license agreement/.test(c);
  const conventionalCommits = /conventional commits|conventionalcommits\.org|\bfeat(\(.+\))?:/.test(c);
  const changelog = /changelog|changeset|news fragment|towncrier/.test(c);
  if (dco) derived.push("Sign off every commit (git commit -s)");
  if (cla) derived.push("Sign the CLA before the first PR");
  if (conventionalCommits) derived.push("Use conventional commit messages");
  if (changelog) derived.push("Add a changelog entry");
  const checklist = [...new Set([...(existing?.checklist ?? []), ...derived, ...fromTemplate])].slice(0, 16);
  return { ...existing, contributingUrl, dco, cla, conventionalCommits, changelog, checklist, fetchedAt: new Date().toISOString() };
}

function medianFirstResponseHours(nodes: { createdAt: string; author: Actor; timelineItems: { nodes: (TimelineNode | { __typename: string; author: Actor; submittedAt?: string; createdAt?: string })[] } }[]) {
  const hours: number[] = [];
  for (const pr of nodes) {
    const first = pr.timelineItems.nodes
      .filter((n) => n.author && n.author.login !== pr.author?.login)
      .map((n) => ("submittedAt" in n && n.submittedAt) || ("createdAt" in n && n.createdAt) || null)
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    if (first) hours.push((new Date(first).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000);
  }
  if (hours.length < 3) return null;
  hours.sort((a, b) => a - b);
  return Math.round(hours[Math.floor(hours.length / 2)]);
}

const ciFrom = (s: string | undefined | null): Loop["ciState"] =>
  s === "SUCCESS" ? "success" : s === "FAILURE" || s === "ERROR" ? "failure" : s ? "pending" : null;

const reviewFrom = (d: PRNode["reviewDecision"]): Loop["reviewState"] =>
  d === "CHANGES_REQUESTED" ? "changes_requested" : d === "APPROVED" ? "approved" : "waiting";

type Alerts = string[];

async function addEvent(e: typeof events.$inferInsert) {
  const rows = await db.insert(events).values(e).onConflictDoNothing().returning({ id: events.id });
  return rows.length > 0;
}

export async function syncRepo(repo: Repo, login: string, alerts: Alerts) {
  const full = `${repo.owner}/${repo.name}`;
  const data = await gql<{ prs: { nodes: PRNode[] }; issues: { nodes: IssueNode[] }; reviewed: { nodes: { number: number; title: string; url: string; updatedAt: string }[] } }>(
    REPO_QUERY,
    {
      prs: `repo:${full} is:pr author:${login} sort:updated-desc`,
      issues: `repo:${full} is:issue author:${login} sort:updated-desc`,
      reviewed: `repo:${full} is:pr reviewed-by:${login} -author:${login} sort:updated-desc`,
    },
  );

  let repoLoops = await db.select().from(loops).where(eq(loops.repoId, repo.id));
  const prs = data.prs.nodes.filter((p) => p && p.number);

  for (const pr of prs) {
    const closes = pr.closingIssuesReferences.nodes.map((n) => n.number);
    let loop =
      repoLoops.find((l) => l.prNumber === pr.number) ??
      repoLoops.find((l) => !l.prNumber && l.issueNumber && closes.includes(l.issueNumber));

    const others = pr.timelineItems.nodes.filter((n) => n.author && n.author.login !== login);
    const lastMaintainerAt = others
      .map((n) => (n.__typename === "PullRequestReview" ? n.submittedAt : n.createdAt))
      .sort()
      .at(-1) ?? null;

    const patch: Partial<Loop> = {
      prNumber: pr.number,
      prAt: pr.createdAt,
      issueNumber: loop?.issueNumber ?? closes[0] ?? null,
      reviewState: reviewFrom(pr.reviewDecision),
      ciState: ciFrom(pr.commits.nodes[0]?.commit.statusCheckRollup?.state),
      hasConflict: pr.mergeable === "CONFLICTING",
      lastMaintainerAt,
      mergedAt: pr.mergedAt,
      stage: pr.merged ? "merged" : "pr",
      status: pr.merged ? "done" : pr.state === "CLOSED" ? "dropped" : "active",
      updatedAt: new Date().toISOString(),
    };

    if (loop) {
      const before = loop;
      [loop] = await db.update(loops).set(patch).where(eq(loops.id, loop.id)).returning();
      if (before.reviewState !== "changes_requested" && patch.reviewState === "changes_requested") {
        alerts.push(`**${full}** · changes requested on #${pr.number} ${pr.title} — ${pr.url}`);
      }
      if (before.ciState !== "failure" && patch.ciState === "failure") {
        alerts.push(`**${full}** · CI is failing on #${pr.number} — ${pr.url}/checks`);
      }
    } else {
      [loop] = await db.insert(loops).values({ repoId: repo.id, title: pr.title, ...patch, stage: patch.stage! }).returning();
    }
    repoLoops = repoLoops.filter((l) => l.id !== loop.id).concat(loop);

    await addEvent({ repoId: repo.id, loopId: loop.id, kind: "pr", title: `PR #${pr.number} opened`, url: pr.url, source: "github", externalId: `gh:pr:${full}#${pr.number}`, occurredAt: pr.createdAt });
    if (pr.merged && pr.mergedAt) {
      const fresh = await addEvent({ repoId: repo.id, loopId: loop.id, kind: "merged", title: `PR #${pr.number} merged`, url: pr.url, source: "github", externalId: `gh:merged:${full}#${pr.number}`, occurredAt: pr.mergedAt });
      if (fresh) alerts.push(`**${full}** · merged #${pr.number} ${pr.title} 🎉`);
    }
    for (const n of others) {
      const at = n.__typename === "PullRequestReview" ? n.submittedAt : n.createdAt;
      const verb = n.__typename === "PullRequestReview" ? (n.state === "CHANGES_REQUESTED" ? "requested changes on" : n.state === "APPROVED" ? "approved" : "reviewed") : "commented on";
      await addEvent({ repoId: repo.id, loopId: loop.id, kind: "review", title: `${n.author!.login} ${verb} #${pr.number}`, actor: n.author!.login, url: n.url, source: "github", externalId: `gh:tl:${n.url}`, occurredAt: at });
    }
  }

  const prClosing = new Set(prs.flatMap((p) => p.closingIssuesReferences.nodes.map((n) => n.number)));
  for (const issue of data.issues.nodes.filter((i) => i && i.number)) {
    let loop = repoLoops.find((l) => l.issueNumber === issue.number);
    if (!loop && issue.state === "OPEN" && !prClosing.has(issue.number) && repo.workflow !== "pr-first") {
      [loop] = await db.insert(loops).values({ repoId: repo.id, title: issue.title, stage: "issue", issueNumber: issue.number, issueAt: issue.createdAt }).returning();
      repoLoops.push(loop);
    } else if (loop && !loop.issueAt) {
      await db.update(loops).set({ issueAt: issue.createdAt }).where(eq(loops.id, loop.id));
    }
    await addEvent({ repoId: repo.id, loopId: loop?.id ?? null, kind: "issue", title: `Issue #${issue.number} opened`, url: issue.url, source: "github", externalId: `gh:issue:${full}#${issue.number}`, occurredAt: issue.createdAt });
  }

  for (const pr of data.reviewed.nodes.filter((p) => p && p.number)) {
    await addEvent({ repoId: repo.id, kind: "review-given", title: `Reviewed #${pr.number} ${pr.title}`, url: pr.url, source: "github", externalId: `gh:reviewed:${full}#${pr.number}`, occurredAt: pr.updatedAt });
  }

  // Collision radar: someone else's PR pointing at an issue you've claimed.
  for (const loop of repoLoops.filter((l) => l.status === "active" && l.issueNumber && !l.prNumber)) {
    const refs = await gql<{ repository: { issue: { timelineItems: { nodes: { willCloseTarget?: boolean; source?: { number?: number; url?: string; state?: string; author?: Actor } }[] } } | null } }>(
      ISSUE_REFS_QUERY,
      { owner: repo.owner, name: repo.name, number: loop.issueNumber },
    );
    const sources = refs.repository.issue?.timelineItems.nodes.map((n) => n.source).filter((s) => s?.number && s.state === "OPEN") ?? [];
    const theirs = sources.find((s) => s!.author?.login !== login);
    if (theirs && loop.collisionUrl !== theirs.url) {
      await db.update(loops).set({ collisionUrl: theirs.url }).where(eq(loops.id, loop.id));
      const fresh = await addEvent({ repoId: repo.id, loopId: loop.id, kind: "collision", title: `${theirs.author?.login ?? "Someone"} opened #${theirs.number} referencing issue #${loop.issueNumber}`, url: theirs.url, source: "github", externalId: `gh:collision:${theirs.url}` });
      if (fresh) alerts.push(`⚠️ **${full}** · ${theirs.author?.login ?? "someone"} opened a PR for issue #${loop.issueNumber} you claimed — ${theirs.url}`);
    }
  }

  // Rules digest and maintainer rhythm, refreshed weekly.
  const stale = !repo.rules?.fetchedAt || Date.now() - new Date(repo.rules.fetchedAt).getTime() > WEEK;
  if (stale) {
    const r = await gql<{ repository: { url: string; c1: Blob; c2: Blob; c3: Blob; t1: Blob; t2: Blob; t3: Blob; merged: { nodes: Parameters<typeof medianFirstResponseHours>[0] } } }>(
      RULES_QUERY,
      { owner: repo.owner, name: repo.name },
    );
    const repoInfo = r.repository;
    const contributing = repoInfo.c1?.text ?? repoInfo.c2?.text ?? repoInfo.c3?.text ?? "";
    const path = repoInfo.c1 ? "CONTRIBUTING.md" : repoInfo.c2 ? ".github/CONTRIBUTING.md" : repoInfo.c3 ? "docs/CONTRIBUTING.md" : null;
    const template = repoInfo.t1?.text ?? repoInfo.t2?.text ?? repoInfo.t3?.text ?? "";
    const rules = digestRules(contributing, template, repo.rules, path ? `${repoInfo.url}/blob/HEAD/${path}` : undefined);
    await db.update(repos).set({ rules, medianReviewHours: medianFirstResponseHours(repoInfo.merged.nodes) ?? repo.medianReviewHours }).where(eq(repos.id, repo.id));
  }

  await db.update(repos).set({ lastSyncedAt: new Date().toISOString() }).where(eq(repos.id, repo.id));
}

type Notification = {
  id: string;
  reason: string;
  updated_at: string;
  subject: { title: string; url: string | null; type: string };
  repository: { full_name: string };
};

const NOTIFY_REASONS = new Set(["mention", "team_mention", "review_requested", "assign"]);

export async function syncNotifications(tracked: Repo[]) {
  const list = await rest<Notification[]>("/notifications?participating=true&per_page=50");
  let added = 0;
  for (const n of list) {
    if (!NOTIFY_REASONS.has(n.reason)) continue;
    const repo = tracked.find((r) => `${r.owner}/${r.name}`.toLowerCase() === n.repository.full_name.toLowerCase());
    if (!repo) continue;
    const url = n.subject.url?.replace("api.github.com/repos", "github.com").replace("/pulls/", "/pull/") ?? null;
    const rows = await db
      .insert(inbox)
      .values({ source: "github", externalId: `${n.id}:${n.updated_at}`, title: n.subject.title, context: `${n.repository.full_name} · ${n.reason.replace("_", " ")}`, url, repoId: repo.id, receivedAt: n.updated_at })
      .onConflictDoNothing()
      .returning({ id: inbox.id });
    added += rows.length;
  }
  return added;
}

export type SyncResult = { ok: boolean; message: string; repos: number };

export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  try {
    const login = await getLogin();
    const tracked = await db
      .select({ repo: repos })
      .from(repos)
      .innerJoin(orgs, eq(repos.orgId, orgs.id))
      .where(and(eq(repos.archived, false), eq(orgs.isDemo, false)));
    const alerts: Alerts = [];
    const failures: string[] = [];
    for (const { repo } of tracked) {
      try {
        await syncRepo(repo, login, alerts);
      } catch (err) {
        failures.push(`${repo.owner}/${repo.name}: ${(err as Error).message}`);
      }
    }
    const notes = await syncNotifications(tracked.map((t) => t.repo)).catch(() => 0);
    await notifyDiscord(alerts);
    const message = failures.length
      ? `Synced ${tracked.length - failures.length} of ${tracked.length} repos. ${failures.join(" ")}`
      : `Synced ${tracked.length} repo${tracked.length === 1 ? "" : "s"} as ${login}${notes ? `, ${notes} new notification${notes === 1 ? "" : "s"}` : ""}.`;
    await setSetting("github.lastSync", startedAt);
    await setSetting("github.lastResult", message);
    return { ok: failures.length === 0, message, repos: tracked.length };
  } catch (err) {
    const message = (err as Error).message;
    await setSetting("github.lastResult", message);
    return { ok: false, message, repos: 0 };
  }
}
