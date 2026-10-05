import type { Event, EventKind } from "@/db/schema";

const WEIGHTS: Partial<Record<EventKind, number>> = {
  merged: 6,
  pr: 4,
  "review-given": 3,
  issue: 2,
  approved: 2,
  help: 2,
  review: 1,
  asked: 1,
  discord: 1,
  email: 0.5,
};

const HALF_LIFE_DAYS = 14;
const DAY = 86_400_000;

/** Visibility score: recent, meaningful activity counts most and fades with a two-week half-life. */
export function presenceScore(events: Event[], now = Date.now()) {
  return events.reduce((sum, e) => {
    const w = WEIGHTS[e.kind] ?? 0;
    const ageDays = (now - new Date(e.occurredAt).getTime()) / DAY;
    return sum + w * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  }, 0);
}

export type PresenceLevel = { label: "Strong" | "Steady" | "Fading" | "Cold"; hint: string };

export function presenceLevel(score: number): PresenceLevel {
  if (score >= 14) return { label: "Strong", hint: "Maintainers see you regularly." };
  if (score >= 7) return { label: "Steady", hint: "Keep a loop moving each week." };
  if (score >= 2.5) return { label: "Fading", hint: "It has gone quiet. Start a new loop or review a PR." };
  return { label: "Cold", hint: "You’ve dropped off this repo’s radar." };
}

/** Daily event counts for the last `days` days, oldest first. */
export function dailyActivity(events: Event[], days = 56, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() + DAY;
  const counts = new Array(days).fill(0);
  for (const e of events) {
    if ((WEIGHTS[e.kind] ?? 0) === 0) continue;
    const idx = days - 1 - Math.floor((end - 1 - new Date(e.occurredAt).getTime()) / DAY);
    if (idx >= 0 && idx < days) counts[idx]++;
  }
  return counts.map((count, i) => ({ date: new Date(end - (days - i) * DAY).toISOString().slice(0, 10), count }));
}
