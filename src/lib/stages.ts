import type { Stage, Workflow } from "@/db/schema";

export const STATION_LABELS: Record<Stage, string> = {
  ask: "Ask",
  approved: "Approved",
  issue: "Issue",
  pr: "PR",
  merged: "Merged",
};

/** The stations each workflow stops at, in order. */
export const WORKFLOW_STATIONS: Record<Workflow, Stage[]> = {
  "ask-first": ["ask", "approved", "issue", "pr", "merged"],
  "issue-first": ["issue", "pr", "merged"],
  "pr-first": ["pr", "merged"],
};

export const WORKFLOW_LABELS: Record<Workflow, { name: string; hint: string }> = {
  "ask-first": { name: "Ask first", hint: "Ask in chat, wait for a maintainer’s go-ahead, then open the issue and PR." },
  "issue-first": { name: "Claim an issue", hint: "Comment on or get assigned to an issue, then open the PR." },
  "pr-first": { name: "PR first", hint: "No assignment needed. The first good PR wins." },
};

export const ALL_STATIONS: Stage[] = ["ask", "approved", "issue", "pr", "merged"];

export function nextStage(workflow: Workflow, stage: Stage): Stage | null {
  const s = WORKFLOW_STATIONS[workflow];
  const i = s.indexOf(stage);
  return i >= 0 && i < s.length - 1 ? s[i + 1] : null;
}

export function prevStage(workflow: Workflow, stage: Stage): Stage | null {
  const s = WORKFLOW_STATIONS[workflow];
  const i = s.indexOf(stage);
  return i > 0 ? s[i - 1] : null;
}

/** What you do to move a loop out of its current station. */
export const ADVANCE_VERB: Record<Stage, string> = {
  ask: "Got approval",
  approved: "Issue opened",
  issue: "PR opened",
  pr: "Merged",
  merged: "",
};
