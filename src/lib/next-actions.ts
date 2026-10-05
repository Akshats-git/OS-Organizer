import type { Event, InboxItem, Loop, Repo } from "@/db/schema";
import { ghUrl } from "./links";
import { daysSince } from "./time";

export type Tone = "urgent" | "soon" | "nudge";

export type Action = {
  id: string;
  repoId: number;
  loopId?: number;
  tone: Tone;
  title: string;
  detail: string;
  since?: string | null;
  href?: string | null;
  cta?: string;
  /** Text to copy for a polite follow-up message. */
  draft?: string;
};

export type Waiting = {
  id: string;
  repoId: number;
  loopId: number;
  title: string;
  detail: string;
  since: string | null;
  href?: string | null;
};

const TONE_ORDER: Record<Tone, number> = { urgent: 0, soon: 1, nudge: 2 };

/** Hours a maintainer usually takes, or the repo's stale threshold if unknown. */
function staleDaysFor(repo: Repo) {
  if (repo.medianReviewHours) return Math.max(repo.staleDays, Math.ceil((repo.medianReviewHours * 2) / 24));
  return repo.staleDays;
}

export function computeActions(
  repos: Repo[],
  loops: Loop[],
  events: Event[],
  inbox: InboxItem[],
  now = Date.now(),
): { actions: Action[]; waiting: Waiting[] } {
  const actions: Action[] = [];
  const waiting: Waiting[] = [];
  const byId = new Map(repos.map((r) => [r.id, r]));

  for (const l of loops) {
    if (l.status !== "active") continue;
    const r = byId.get(l.repoId);
    if (!r) continue;
    const pr = l.prNumber ? ghUrl(r.owner, r.name, `/pull/${l.prNumber}`) : null;
    const issue = l.issueNumber ? ghUrl(r.owner, r.name, `/issues/${l.issueNumber}`) : null;

    if (l.collisionUrl) {
      actions.push({
        id: `collision-${l.id}`, repoId: r.id, loopId: l.id, tone: "urgent",
        title: `Someone else opened a PR for #${l.issueNumber ?? "your issue"}`,
        detail: "Check whether it duplicates your work, then talk to the maintainer before you continue.",
        href: l.collisionUrl, cta: "Open their PR",
      });
    }

    if (l.stage === "pr") {
      if (l.reviewState === "changes_requested") {
        actions.push({
          id: `review-${l.id}`, repoId: r.id, loopId: l.id, tone: "urgent",
          title: `Respond to review on #${l.prNumber}`,
          detail: `${l.title}. A maintainer asked for changes.`,
          since: l.lastMaintainerAt, href: pr, cta: "Open PR",
        });
      } else if (l.ciState === "failure") {
        actions.push({
          id: `ci-${l.id}`, repoId: r.id, loopId: l.id, tone: "urgent",
          title: `Fix failing checks on #${l.prNumber}`,
          detail: "Maintainers rarely review a PR with red CI.",
          href: pr ? `${pr}/checks` : null, cta: "See checks",
        });
      } else if (l.hasConflict) {
        actions.push({
          id: `conflict-${l.id}`, repoId: r.id, loopId: l.id, tone: "urgent",
          title: `Rebase #${l.prNumber}, it has merge conflicts`,
          detail: `${l.title}`, href: pr, cta: "Open PR",
        });
      } else {
        const waitedFrom = l.lastMaintainerAt ?? l.prAt;
        const waited = daysSince(waitedFrom, now);
        const limit = staleDaysFor(r);
        if (waited >= limit) {
          actions.push({
            id: `ping-pr-${l.id}`, repoId: r.id, loopId: l.id, tone: "soon",
            title: `Ask for a review on #${l.prNumber}`,
            detail: `No maintainer activity for ${Math.floor(waited)} days. This repo usually replies within ${r.medianReviewHours ? Math.round(r.medianReviewHours / 24) + 1 : limit} days.`,
            since: waitedFrom, href: pr, cta: "Copy message",
            draft: `Hi! Whenever you have a moment, could you take a look at #${l.prNumber} (${l.title})? I've addressed the earlier feedback and CI is green. Happy to change anything. Thanks!`,
          });
        } else {
          waiting.push({
            id: `w-pr-${l.id}`, repoId: r.id, loopId: l.id, title: `#${l.prNumber} ${l.title}`,
            detail: l.reviewState === "approved" ? "Approved, waiting to merge" : "Waiting for review",
            since: waitedFrom, href: pr,
          });
        }
      }
    }

    if (l.stage === "ask") {
      const waited = daysSince(l.askedAt, now);
      if (waited >= 2) {
        actions.push({
          id: `ping-ask-${l.id}`, repoId: r.id, loopId: l.id, tone: "soon",
          title: "Follow up on your ask",
          detail: `“${l.title}” has had no reply for ${Math.floor(waited)} days. Reply in the same thread or try another maintainer.`,
          since: l.askedAt, href: l.askUrl, cta: "Copy message",
          draft: `Hi again! Just following up on my message about ${l.title.toLowerCase()}. Is this something you'd like help with? If someone else is better to ask, I'm happy to check with them.`,
        });
      } else {
        waiting.push({
          id: `w-ask-${l.id}`, repoId: r.id, loopId: l.id, title: l.title,
          detail: "Waiting for a maintainer to reply", since: l.askedAt, href: l.askUrl,
        });
      }
    }

    if (l.stage === "approved" || l.stage === "issue") {
      const claimedAt = l.stage === "approved" ? l.approvedAt : l.issueAt;
      const used = daysSince(claimedAt, now);
      const left = Math.ceil(r.claimDays - used);
      const nextStep = l.stage === "approved" ? "Open the issue" : "Open the PR";
      actions.push({
        id: `claim-${l.id}`, repoId: r.id, loopId: l.id,
        tone: left <= 2 ? "urgent" : "soon",
        title: `${nextStep} for “${l.title}”`,
        detail: left > 0
          ? `Claimed ${Math.floor(used)} day${Math.floor(used) === 1 ? "" : "s"} ago. You have about ${left} day${left === 1 ? "" : "s"} before it looks abandoned.`
          : "Your claim is past the usual window. Post a progress update so it isn't reassigned.",
        since: claimedAt, href: issue ?? l.approvalUrl, cta: issue ? "Open issue" : "See approval",
      });
    }
  }

  // Repos with nothing in motion.
  for (const r of repos) {
    if (r.archived) continue;
    const active = loops.some((l) => l.repoId === r.id && l.status === "active");
    if (active) continue;
    const last = events.filter((e) => e.repoId === r.id).reduce<string | null>((m, e) => (!m || e.occurredAt > m ? e.occurredAt : m), null);
    const quiet = daysSince(last, now);
    actions.push({
      id: `cold-${r.id}`, repoId: r.id, tone: quiet > 10 ? "soon" : "nudge",
      title: `Start something new in ${r.name}`,
      detail: quiet === Infinity ? "Nothing here yet. Find a good first issue." : `Last activity ${Math.floor(quiet)} days ago. Pick an issue before the line goes cold.`,
      since: last, href: ghUrl(r.owner, r.name, "/issues?q=is%3Aopen+label%3A%22good+first+issue%22+no%3Aassignee"), cta: "Find an issue",
    });
  }

  const unfiled = inbox.filter((i) => i.status === "new");
  if (unfiled.length) {
    actions.push({
      id: "inbox", repoId: -1, tone: "nudge",
      title: `File ${unfiled.length} inbox item${unfiled.length === 1 ? "" : "s"}`,
      detail: "Forwarded messages and emails waiting to be attached to a line.",
      href: "/inbox", cta: "Open inbox",
    });
  }

  actions.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (a.since ?? "~").localeCompare(b.since ?? "~"));
  waiting.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  return { actions, waiting };
}
