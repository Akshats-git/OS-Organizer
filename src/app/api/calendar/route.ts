import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { loops, programEvents, programs, repos } from "@/db/schema";
import { authorized, unauthorized } from "@/lib/auth";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

function allDay(uid: string, date: Date, summary: string, description?: string) {
  const next = new Date(date.getTime() + 86_400_000);
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@os-organizer`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

/** Subscribe to this in Google Calendar: program milestones plus claim deadlines. */
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const [milestones, claims] = await Promise.all([
    db.select({ e: programEvents, p: programs }).from(programEvents).innerJoin(programs, eq(programEvents.programId, programs.id)),
    db.select({ l: loops, r: repos }).from(loops).innerJoin(repos, eq(loops.repoId, repos.id)).where(and(eq(loops.status, "active"), inArray(loops.stage, ["approved", "issue"]))),
  ]);
  const vevents = [
    ...milestones.map(({ e, p }) =>
      allDay(`program-${e.id}`, new Date(e.date + "T00:00:00Z"), `${p.name}: ${e.title}${e.estimated ? " (estimated)" : ""}`, p.url ?? undefined),
    ),
    ...claims.map(({ l, r }) => {
      const from = l.stage === "approved" ? l.approvedAt : l.issueAt;
      const due = new Date(new Date(from ?? Date.now()).getTime() + r.claimDays * 86_400_000);
      return allDay(`claim-${l.id}`, due, `${r.code} · Claim window ends: ${l.title}`, `Open the ${l.stage === "approved" ? "issue" : "PR"} for ${r.owner}/${r.name} before this date.`);
    }),
  ];
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OS Organizer//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Open source prep", ...vevents, "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
}
