import type { Loop, Repo } from "@/db/schema";
import { daysSince } from "./time";

export type LoopStatus = { tone: "urgent" | "soon" | "calm" | "done"; label: string };

/** One short phrase describing where a loop stands and whether it needs you. */
export function loopStatus(l: Loop, r: Pick<Repo, "claimDays" | "staleDays">, now = Date.now()): LoopStatus {
  if (l.status === "dropped") return { tone: "calm", label: "Dropped" };
  if (l.stage === "merged") return { tone: "done", label: "Merged" };
  if (l.collisionUrl) return { tone: "urgent", label: "Another PR targets this issue" };
  if (l.stage === "pr") {
    if (l.reviewState === "changes_requested") return { tone: "urgent", label: "Changes requested" };
    if (l.ciState === "failure") return { tone: "urgent", label: "Checks failing" };
    if (l.hasConflict) return { tone: "urgent", label: "Merge conflicts" };
    if (l.reviewState === "approved") return { tone: "calm", label: "Approved, waiting to merge" };
    const waited = daysSince(l.lastMaintainerAt ?? l.prAt, now);
    if (waited >= r.staleDays) return { tone: "soon", label: `No review for ${Math.floor(waited)} days` };
    return { tone: "calm", label: "Waiting for review" };
  }
  if (l.stage === "ask") {
    const waited = daysSince(l.askedAt, now);
    if (waited >= 2) return { tone: "soon", label: `No reply for ${Math.floor(waited)} days` };
    return { tone: "calm", label: "Waiting for a reply" };
  }
  const from = l.stage === "approved" ? l.approvedAt : l.issueAt;
  const left = Math.ceil(r.claimDays - daysSince(from, now));
  if (left <= 2) return { tone: "urgent", label: left > 0 ? `Claim ends in ${left} day${left === 1 ? "" : "s"}` : "Claim window passed" };
  return { tone: "soon", label: `${left} days left on your claim` };
}
