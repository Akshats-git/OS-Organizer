import "dotenv/config";
import { db, schema } from "../src/db";
import { sql } from "drizzle-orm";

const { programs, programEvents, orgs, repos, loops, events, inbox, contacts, settings } = schema;

const reset = process.argv.includes("--reset");
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();

// Deterministic PRNG so the demo history looks the same on every seed.
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);

async function main() {
  const existing = await db.select({ n: sql<number>`count(*)` }).from(programs);
  if (existing[0].n > 0 && !reset) {
    console.log("Database already has data. Run with --reset to start over.");
    return;
  }
  if (reset) {
    for (const t of [inbox, events, loops, contacts, repos, orgs, programEvents, programs, settings]) {
      await db.delete(t);
    }
  }

  await db.insert(programs).values([
    { id: "gsoc", name: "Google Summer of Code", url: "https://summerofcode.withgoogle.com", summary: "12+ week paid projects with open source orgs. Orgs are announced first, then contributors apply with a proposal." },
    { id: "lfx", name: "LFX Mentorship", url: "https://mentorship.lfx.linuxfoundation.org", summary: "Linux Foundation and CNCF projects, three terms a year. Apply per project with a resume and cover letter." },
    { id: "sob", name: "Summer of Bitcoin", url: "https://www.summerofbitcoin.org", summary: "Bitcoin and Lightning projects. A qualification round comes before the proposal." },
    { id: "outreachy", name: "Outreachy", url: "https://www.outreachy.org", summary: "Paid internships for people underrepresented in tech. Initial application, then a contribution period." },
    { id: "esoc", name: "ESoC", url: null, summary: "Add this cycle's dates when they're published." },
  ]);

  await db.insert(programEvents).values([
    { programId: "gsoc", title: "Orgs announced", date: "2027-02-24", kind: "announce", estimated: true },
    { programId: "gsoc", title: "Contributor applications open", date: "2027-03-15", kind: "open", estimated: true },
    { programId: "gsoc", title: "Proposal deadline", date: "2027-03-30", kind: "deadline", estimated: true },
    { programId: "gsoc", title: "Accepted projects announced", date: "2027-05-06", kind: "result", estimated: true },
    { programId: "gsoc", title: "Coding begins", date: "2027-06-01", kind: "coding", estimated: true },
    { programId: "lfx", title: "Spring term applications open", date: "2027-01-27", kind: "open", estimated: true },
    { programId: "lfx", title: "Spring term applications close", date: "2027-02-10", kind: "deadline", estimated: true },
    { programId: "lfx", title: "Spring term begins", date: "2027-03-03", kind: "coding", estimated: true },
    { programId: "lfx", title: "Summer term applications close", date: "2027-05-13", kind: "deadline", estimated: true },
    { programId: "sob", title: "Applications open", date: "2027-01-15", kind: "open", estimated: true },
    { programId: "sob", title: "Qualification round ends", date: "2027-02-28", kind: "deadline", estimated: true },
    { programId: "sob", title: "Proposal deadline", date: "2027-04-05", kind: "deadline", estimated: true },
    { programId: "sob", title: "Results", date: "2027-05-01", kind: "result", estimated: true },
    { programId: "outreachy", title: "Initial applications open", date: "2027-01-13", kind: "open", estimated: true },
    { programId: "outreachy", title: "Initial applications close", date: "2027-02-03", kind: "deadline", estimated: true },
    { programId: "outreachy", title: "Final applications due", date: "2027-04-01", kind: "deadline", estimated: true },
  ]);

  const orgRows = await db
    .insert(orgs)
    .values([
      { slug: "meridian", name: "Meridian Graphics", programId: "gsoc", chatPlatform: "discord", chatUrl: "https://discord.gg/example", discordGuildId: "100000000000000001", ideasUrl: "https://example.org/meridian/ideas", isDemo: true },
      { slug: "tidepool", name: "Tidepool Data", programId: "gsoc", chatPlatform: "discord", chatUrl: "https://discord.gg/example", discordGuildId: "100000000000000002", isDemo: true },
      { slug: "orbit", name: "Orbit Learning", programId: "gsoc", chatPlatform: "zulip", chatUrl: "https://orbit.zulipchat.com", isDemo: true },
      { slug: "fernwood", name: "Fernwood Lab", programId: "gsoc", chatPlatform: "discord", chatUrl: "https://discord.gg/example", discordGuildId: "100000000000000004", isDemo: true },
      { slug: "harbor", name: "Harbor", programId: "lfx", chatPlatform: "slack", chatUrl: "https://slack.example.org", isDemo: true },
    ])
    .returning();
  const org = Object.fromEntries(orgRows.map((o) => [o.slug, o.id]));

  const repoRows = await db
    .insert(repos)
    .values([
      {
        orgId: org.meridian, programId: "gsoc", owner: "meridian-gfx", name: "engine", slug: "meridian-gfx-engine", code: "ME", colorIndex: 0, workflow: "ask-first", staleDays: 4, medianReviewHours: 31,
        rules: { dco: true, conventionalCommits: true, checklist: ["Run cargo fmt and cargo clippy", "Add a test for the change", "Sign off every commit (git commit -s)"], contributingUrl: "https://github.com/meridian-gfx/engine/blob/main/CONTRIBUTING.md" },
        setupNotes: "Needs Rust 1.82+. Run `cargo xtask setup` once before building the examples.",
      },
      {
        orgId: org.tidepool, programId: "gsoc", owner: "tidepool-data", name: "flux", slug: "tidepool-data-flux", code: "TF", colorIndex: 1, workflow: "ask-first", staleDays: 5, medianReviewHours: 52,
        rules: { changelog: true, checklist: ["Add a news fragment in changes/", "Run pytest -m 'not slow'"] },
      },
      {
        orgId: org.orbit, programId: "gsoc", owner: "orbit-edu", name: "classroom", slug: "orbit-edu-classroom", code: "OC", colorIndex: 2, workflow: "issue-first", staleDays: 5, claimDays: 7, medianReviewHours: 20,
        rules: { cla: true, checklist: ["Sign the CLA before the first PR", "Screenshots for UI changes"] },
      },
      {
        orgId: org.fernwood, programId: "gsoc", owner: "fernwood-lab", name: "kit", slug: "fernwood-lab-kit", code: "FK", colorIndex: 3, workflow: "ask-first", staleDays: 5, medianReviewHours: 74,
        rules: { conventionalCommits: true, checklist: ["Update docs/ for public API changes"] },
      },
      {
        orgId: org.harbor, programId: "lfx", owner: "harbor-dev", name: "cli", slug: "harbor-dev-cli", code: "HC", colorIndex: 4, workflow: "pr-first", staleDays: 6, medianReviewHours: 40,
        rules: { dco: true, checklist: ["Sign off every commit (git commit -s)", "make lint passes"] },
      },
    ])
    .returning();
  const repo = Object.fromEntries(repoRows.map((r) => [r.code, r.id]));

  const loopRows = await db
    .insert(loops)
    .values([
      { repoId: repo.ME, title: "Fix shader cache invalidation", stage: "merged", status: "done", askedAt: ago(34), approvedAt: ago(33), approvedBy: "@lena", issueNumber: 398, issueAt: ago(33), prNumber: 412, prAt: ago(28), mergedAt: ago(20) },
      { repoId: repo.ME, title: "Add WebGPU backend flag", stage: "pr", askedAt: ago(14), approvedAt: ago(13), approvedBy: "@lena", issueNumber: 427, issueAt: ago(12), prNumber: 431, prAt: ago(6), reviewState: "changes_requested", ciState: "success", lastMaintainerAt: ago(1) },
      { repoId: repo.TF, title: "Streaming parquet reader", stage: "ask", askUrl: "https://discord.com/channels/100000000000000002/2/3", askedAt: ago(3, 2) },
      { repoId: repo.OC, title: "Keyboard shortcuts for the grader", stage: "merged", status: "done", issueNumber: 71, issueAt: ago(40), prNumber: 74, prAt: ago(36), mergedAt: ago(30) },
      { repoId: repo.OC, title: "Accessible color picker", stage: "issue", issueNumber: 88, issueAt: ago(5), collisionUrl: "https://github.com/orbit-edu/classroom/pull/93" },
      { repoId: repo.FK, title: "Docs: plugin lifecycle guide", stage: "approved", askedAt: ago(2), approvedAt: ago(1, 3), approvedBy: "@mira", approvalUrl: "https://discord.com/channels/100000000000000004/4/5" },
      { repoId: repo.FK, title: "Typed config loader", stage: "pr", askedAt: ago(19), approvedAt: ago(18), approvedBy: "@mira", issueNumber: 52, issueAt: ago(17), prNumber: 57, prAt: ago(6, 4), reviewState: "waiting", ciState: "success" },
      { repoId: repo.HC, title: "Shell completions for zsh", stage: "merged", status: "done", prNumber: 203, prAt: ago(18), mergedAt: ago(13) },
    ])
    .returning();

  // Timeline events for each loop's milestones.
  const ev: (typeof events.$inferInsert)[] = [];
  for (const l of loopRows) {
    const r = repoRows.find((x) => x.id === l.repoId)!;
    const gh = `https://github.com/${r.owner}/${r.name}`;
    if (l.askedAt) ev.push({ repoId: r.id, loopId: l.id, kind: "asked", title: `Asked about “${l.title}”`, source: "discord", occurredAt: l.askedAt, url: l.askUrl });
    if (l.approvedAt) ev.push({ repoId: r.id, loopId: l.id, kind: "approved", title: `${l.approvedBy} approved the work`, source: "discord", occurredAt: l.approvedAt, actor: l.approvedBy });
    if (l.issueNumber && l.issueAt) ev.push({ repoId: r.id, loopId: l.id, kind: "issue", title: `Issue #${l.issueNumber} opened`, source: "github", occurredAt: l.issueAt, url: `${gh}/issues/${l.issueNumber}` });
    if (l.prNumber && l.prAt) ev.push({ repoId: r.id, loopId: l.id, kind: "pr", title: `PR #${l.prNumber} opened`, source: "github", occurredAt: l.prAt, url: `${gh}/pull/${l.prNumber}` });
    if (l.mergedAt) ev.push({ repoId: r.id, loopId: l.id, kind: "merged", title: `PR #${l.prNumber} merged`, source: "github", occurredAt: l.mergedAt, url: `${gh}/pull/${l.prNumber}` });
    if (l.reviewState === "changes_requested") ev.push({ repoId: r.id, loopId: l.id, kind: "review", title: `Changes requested on #${l.prNumber}`, actor: "@lena", source: "github", occurredAt: ago(1), url: `${gh}/pull/${l.prNumber}` });
    if (l.collisionUrl) ev.push({ repoId: r.id, loopId: l.id, kind: "collision", title: `Another PR (#93) references issue #${l.issueNumber}`, source: "github", occurredAt: ago(0, 5), url: l.collisionUrl });
  }

  // Background activity (reviews given, Discord help) so presence has texture.
  const activity: Record<string, { span: number; density: number }> = {
    ME: { span: 50, density: 0.3 }, TF: { span: 30, density: 0.12 }, OC: { span: 45, density: 0.2 },
    FK: { span: 25, density: 0.25 }, HC: { span: 56, density: 0.06 },
  };
  for (const [code, { span, density }] of Object.entries(activity)) {
    const quietTail = code === "HC" ? 13 : 0;
    for (let d = quietTail; d < span; d++) {
      if (rand() > density) continue;
      const kind = rand() > 0.5 ? "review-given" : "help";
      ev.push({
        repoId: repo[code], kind, source: kind === "help" ? "discord" : "github", occurredAt: ago(d, Math.floor(rand() * 10)),
        title: kind === "help" ? "Answered a newcomer’s setup question" : "Reviewed a contributor’s PR",
      });
    }
  }
  await db.insert(events).values(ev);

  await db.insert(inbox).values([
    { source: "discord", externalId: "demo-d1", title: "Sure, go ahead with the streaming reader. Open an issue first and tag me so I can assign it.", body: "Sure, go ahead with the streaming reader. Open an issue first and tag me so I can assign it.", author: "forwarded from #contributors", context: "Tidepool Data", discordGuildId: "100000000000000002", repoId: repo.TF, url: "https://discord.com/channels/100000000000000002/2/9", receivedAt: ago(0, 2) },
    { source: "gmail", externalId: "demo-g1", title: "Re: [fernwood-lab/kit] Typed config loader (PR #57)", body: "@mira: Thanks! I'll take a look at this later this week.", author: "notifications@github.com", context: "fernwood-lab/kit", repoId: repo.FK, receivedAt: ago(0, 9) },
    { source: "gmail", externalId: "demo-g2", title: "[meridian-dev] Call for GSoC 2027 project ideas", body: "We're collecting project ideas for next year. Mentors, please add yours to the wiki by November 15.", author: "meridian-dev@lists.example.org", context: "meridian-dev mailing list", repoId: repo.ME, receivedAt: ago(1, 1) },
  ]);

  await db.insert(contacts).values([
    { orgId: org.meridian, name: "Lena Okafor", handle: "@lena", role: "Maintainer, rendering", timezone: "Europe/Berlin", lastContactAt: ago(1) },
    { orgId: org.tidepool, name: "Sam Ruiz", handle: "@samr", role: "GSoC org admin", timezone: "America/Chicago", lastContactAt: ago(3) },
    { orgId: org.fernwood, name: "Mira Chen", handle: "@mira", role: "Docs lead", timezone: "Asia/Singapore", lastContactAt: ago(1) },
    { orgId: org.orbit, name: "Theo Laurent", handle: "@theo", role: "Maintainer", timezone: "Europe/Paris", lastContactAt: ago(9) },
  ]);

  await db.insert(settings).values({ key: "demo", value: "true" });
  console.log(`Seeded demo data: ${repoRows.length} repos, ${loopRows.length} loops, ${ev.length} events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
