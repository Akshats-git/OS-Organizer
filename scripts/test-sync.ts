/**
 * Offline check of the GitHub sync logic against canned API responses.
 * Run: pnpm test:sync
 */
import { rmSync } from "node:fs";
import assert from "node:assert/strict";

const DB = "./data/test-sync.db";
rmSync(DB, { force: true });
process.env.DATABASE_URL = `file:${DB}`;
process.env.GITHUB_TOKEN = "test-token";
delete process.env.DISCORD_WEBHOOK_URL;

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const responses: Record<string, unknown> = {
  "/user": { login: "me" },
  "/notifications": [
    { id: "n1", reason: "review_requested", updated_at: iso(0), subject: { title: "Refactor loader", url: "https://api.github.com/repos/acme/widgets/pulls/77", type: "PullRequest" }, repository: { full_name: "acme/widgets" } },
    { id: "n2", reason: "subscribed", updated_at: iso(0), subject: { title: "Noise", url: null, type: "Issue" }, repository: { full_name: "acme/widgets" } },
  ],
  RepoActivity: {
    prs: {
      nodes: [
        {
          number: 12, title: "Fix tokenizer crash", url: "https://github.com/acme/widgets/pull/12", state: "OPEN", merged: false, mergedAt: null, createdAt: iso(4),
          reviewDecision: "CHANGES_REQUESTED", mergeable: "MERGEABLE",
          closingIssuesReferences: { nodes: [{ number: 10 }] },
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }] },
          timelineItems: { nodes: [{ __typename: "PullRequestReview", author: { login: "maintainer" }, submittedAt: iso(1), state: "CHANGES_REQUESTED", url: "https://github.com/acme/widgets/pull/12#r1" }] },
        },
        {
          number: 5, title: "Docs typo", url: "https://github.com/acme/widgets/pull/5", state: "MERGED", merged: true, mergedAt: iso(20), createdAt: iso(22),
          reviewDecision: "APPROVED", mergeable: "UNKNOWN", closingIssuesReferences: { nodes: [] },
          commits: { nodes: [{ commit: { statusCheckRollup: null } }] }, timelineItems: { nodes: [] },
        },
      ],
    },
    issues: { nodes: [{ number: 30, title: "Add YAML export", url: "https://github.com/acme/widgets/issues/30", state: "OPEN", createdAt: iso(2) }] },
    reviewed: { nodes: [{ number: 40, title: "Speed up build", url: "https://github.com/acme/widgets/pull/40", updatedAt: iso(3) }] },
  },
  IssueRefs: {
    repository: { issue: { timelineItems: { nodes: [{ willCloseTarget: true, source: { number: 31, url: "https://github.com/acme/widgets/pull/31", state: "OPEN", author: { login: "someone-else" } } }] } } },
  },
  Rules: {
    repository: {
      url: "https://github.com/acme/widgets",
      c1: { text: "Please sign off your commits (DCO). We use Conventional Commits." }, c2: null, c3: null,
      t1: { text: "- [ ] Tests added\n- [ ] Docs updated" }, t2: null, t3: null,
      merged: { nodes: [10, 20, 30, 40].map((h) => ({ createdAt: iso(10), author: { login: "x" }, timelineItems: { nodes: [{ __typename: "IssueComment", author: { login: "maintainer" }, createdAt: new Date(Date.now() - 10 * 86_400_000 + h * 3_600_000).toISOString() }] } })) },
    },
  },
};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  let body: unknown;
  if (url.endsWith("/graphql")) {
    const { query } = JSON.parse(String(init?.body));
    const name = String(query).match(/query (\w+)/)?.[1] ?? "";
    body = { data: responses[name] };
  } else {
    const path = new URL(url).pathname;
    body = responses[path];
  }
  return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function main() {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(drizzle(createClient({ url: `file:${DB}` })), { migrationsFolder: "./drizzle" });

  const { db, schema } = await import("../src/db");
  const { runSync } = await import("../src/lib/github");
  const { eq } = await import("drizzle-orm");

  const [org] = await db.insert(schema.orgs).values({ slug: "acme", name: "Acme" }).returning();
  const [repo] = await db.insert(schema.repos).values({ orgId: org.id, owner: "acme", name: "widgets", slug: "acme-widgets", code: "AW" }).returning();
  // A loop you started by hand: approved, issue #10 claimed. Your PR #12 closes it.
  await db.insert(schema.loops).values({ repoId: repo.id, title: "Tokenizer crash", stage: "issue", issueNumber: 10, issueAt: iso(6) });

  const result = await runSync();
  assert.equal(result.ok, true, result.message);

  const loops = await db.select().from(schema.loops).where(eq(schema.loops.repoId, repo.id));
  const byTitle = (t: string) => loops.find((l) => l.title === t);

  const manual = byTitle("Tokenizer crash")!;
  assert.equal(manual.prNumber, 12, "PR closing the claimed issue attaches to the existing loop");
  assert.equal(manual.stage, "pr");
  assert.equal(manual.reviewState, "changes_requested");
  assert.equal(manual.ciState, "success");

  const merged = byTitle("Docs typo")!;
  assert.equal(merged.stage, "merged");
  assert.equal(merged.status, "done");

  const fromIssue = byTitle("Add YAML export")!;
  assert.equal(fromIssue.stage, "issue", "your open issue without a PR becomes a loop");
  assert.equal(fromIssue.collisionUrl, "https://github.com/acme/widgets/pull/31", "someone else's PR on your issue is flagged");

  const events = await db.select().from(schema.events).where(eq(schema.events.repoId, repo.id));
  assert.ok(events.some((e) => e.kind === "review-given"), "reviews you gave are logged");
  assert.ok(events.some((e) => e.kind === "review" && e.actor === "maintainer"), "maintainer reviews are logged");

  const [updated] = await db.select().from(schema.repos).where(eq(schema.repos.id, repo.id));
  assert.equal(updated.rules?.dco, true);
  assert.equal(updated.rules?.conventionalCommits, true);
  assert.ok(updated.rules?.checklist?.includes("Tests added"), "PR template checkboxes become checklist items");
  assert.equal(updated.medianReviewHours, 30, "median first response is measured");

  const inbox = await db.select().from(schema.inbox);
  assert.equal(inbox.length, 1, "only actionable notifications reach the inbox");
  assert.equal(inbox[0].url, "https://github.com/acme/widgets/pull/77");

  // A second sync must not duplicate anything.
  await runSync();
  const again = await db.select().from(schema.events).where(eq(schema.events.repoId, repo.id));
  assert.equal(again.length, events.length, "sync is idempotent");

  console.log(`✓ sync logic: ${loops.length} loops, ${events.length} events, rules and rhythm detected, idempotent`);
  rmSync(DB, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
