import "server-only";
import { getNetwork, getUpcoming } from "./data";
import { LINE_COLORS } from "./lines";
import type { Tone } from "./next-actions";
import { daysUntil, formatDate } from "./time";

export type Briefing = {
  /** True when there is nothing worth an email today. */
  empty: boolean;
  subject: string;
  text: string;
  html: string;
};

const TONES: { tone: Tone; label: string; color: string }[] = [
  { tone: "urgent", label: "Urgent", color: "#C8372D" },
  { tone: "soon", label: "Soon", color: "#B88200" },
  { tone: "nudge", label: "When you can", color: "#5A6B85" },
];

/** Program milestones this close show up in the briefing. */
const DEADLINE_WINDOW_DAYS = 14;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The morning email: the Today list plus upcoming program dates, as plain
 * text and as inline-styled HTML (mail clients ignore stylesheets).
 */
export async function buildBriefing(appUrl: string, now = new Date()): Promise<Briefing> {
  const [{ lines, actions, waiting }, upcoming] = await Promise.all([getNetwork(), getUpcoming(10)]);
  const deadlines = upcoming
    .map((u) => ({ ...u, days: daysUntil(u.event.date, now) }))
    .filter((u) => u.days <= DEADLINE_WINDOW_DAYS);

  const repo = (id: number) => lines.find((l) => l.repo.id === id)?.repo;
  const link = (href: string | null | undefined) => (href?.startsWith("/") ? appUrl + href : href);
  const urgent = actions.filter((a) => a.tone === "urgent").length;
  const day = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const counts = [`${actions.length} to do`, waiting.length && `${waiting.length} waiting`].filter(Boolean).join(", ");
  const subject = `${urgent ? `🔴 ${urgent} urgent · ` : ""}OS Organizer · ${day}: ${counts}`;
  const empty = actions.every((a) => a.tone === "nudge") && deadlines.length === 0;

  // Plain text
  const t: string[] = [`${day}: ${counts}`, ""];
  for (const { tone, label } of TONES) {
    const group = actions.filter((a) => a.tone === tone);
    if (!group.length) continue;
    t.push(label.toUpperCase());
    for (const a of group) {
      const r = repo(a.repoId);
      t.push(`• ${r ? `[${r.code}] ` : ""}${a.title}`, `  ${a.detail}`);
      if (a.draft) t.push(`  Message: ${a.draft}`);
      if (a.href) t.push(`  ${link(a.href)}`);
    }
    t.push("");
  }
  if (waiting.length) {
    t.push("WAITING");
    for (const w of waiting) t.push(`• ${w.title}: ${w.detail}`);
    t.push("");
  }
  if (deadlines.length) {
    t.push("DEADLINES");
    for (const d of deadlines) t.push(`• ${formatDate(d.event.date)} · ${d.program.name}: ${d.event.title}${d.event.estimated ? " (estimated)" : ""}`);
    t.push("");
  }
  t.push(`Open the app: ${appUrl}`);

  // HTML
  const bullet = (id: number) => {
    const r = repo(id);
    if (!r) return "";
    const i = r.colorIndex % 8;
    const fg = [1, 2, 3].includes(i) ? "#14223D" : "#FFFFFF"; // matches --on-line-N in globals.css
    return `<span style="display:inline-block;min-width:22px;padding:2px 4px;margin-right:8px;border-radius:11px;background:${LINE_COLORS.light[i]};color:${fg};font:700 11px/16px Arial,sans-serif;text-align:center;vertical-align:1px">${esc(r.code)}</span>`;
  };
  const heading = (label: string, color: string) =>
    `<tr><td style="padding:22px 0 6px;font:700 12px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${color};border-bottom:2px solid ${color}">${label}</td></tr>`;
  const row = (inner: string) => `<tr><td style="padding:12px 0;border-bottom:1px solid #D5DBE2">${inner}</td></tr>`;

  const h: string[] = [];
  for (const { tone, label, color } of TONES) {
    const group = actions.filter((a) => a.tone === tone);
    if (!group.length) continue;
    h.push(heading(label, color));
    for (const a of group) {
      const href = link(a.href);
      h.push(
        row(
          `<div style="font:600 15px/1.35 Arial,sans-serif;color:#14223D">${bullet(a.repoId)}${esc(a.title)}</div>` +
            `<div style="margin-top:4px;font:14px/1.45 Arial,sans-serif;color:#46536B">${esc(a.detail)}</div>` +
            (a.draft
              ? `<div style="margin-top:8px;padding:10px 12px;background:#F1F4F7;border-left:3px solid #14223D;font:14px/1.45 Arial,sans-serif;color:#14223D">${esc(a.draft)}</div>`
              : "") +
            (href ? `<div style="margin-top:8px"><a href="${esc(href)}" style="font:600 13px Arial,sans-serif;color:#2559D9">${esc(a.cta ?? "Open")} →</a></div>` : ""),
        ),
      );
    }
  }
  if (waiting.length) {
    h.push(heading("Waiting", "#5A6B85"));
    for (const w of waiting) {
      h.push(row(`<div style="font:14px/1.45 Arial,sans-serif;color:#14223D">${bullet(w.repoId)}${esc(w.title)} <span style="color:#46536B">· ${esc(w.detail)}</span></div>`));
    }
  }
  if (deadlines.length) {
    h.push(heading("Deadlines", "#14223D"));
    for (const d of deadlines) {
      const when = d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `in ${d.days} days`;
      h.push(
        row(
          `<div style="font:14px/1.45 Arial,sans-serif;color:#14223D"><b>${esc(formatDate(d.event.date))}</b> · ${esc(d.program.name)}: ${esc(d.event.title)}` +
            ` <span style="color:#46536B">(${when}${d.event.estimated ? ", estimated" : ""})</span></div>`,
        ),
      );
    }
  }

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#E7EBEF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7EBEF"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:6px">
<tr><td style="padding:20px 24px;background:#14223D;border-radius:6px 6px 0 0">
<div style="font:700 12px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9FB0C8">OS Organizer · Morning briefing</div>
<div style="margin-top:6px;font:700 24px/1.2 Arial,sans-serif;color:#FFFFFF">${esc(day)}</div>
<div style="margin-top:4px;font:14px Arial,sans-serif;color:#C9D3E1">${esc(counts)}</div>
</td></tr>
<tr><td style="padding:0 24px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${h.join("")}</table>
<div style="margin-top:24px"><a href="${esc(appUrl)}" style="display:inline-block;padding:10px 16px;background:#14223D;color:#FFFFFF;border-radius:4px;font:600 14px Arial,sans-serif;text-decoration:none">Open OS Organizer</a></div>
</td></tr></table></td></tr></table></body></html>`;

  return { empty, subject, text: t.join("\n"), html };
}
